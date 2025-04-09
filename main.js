// === Three.js Setup ===
const scene = new THREE.Scene();
scene.background = null;
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.outputEncoding = THREE.sRGBEncoding;
renderer.setClearColor(0x000000, 0);
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// === Lighting ===
const ambientLight = new THREE.AmbientLight(0xffffff, 1.8);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 1.5);
directionalLight.position.set(5, 8, 8);
scene.add(directionalLight);

const fillLight = new THREE.DirectionalLight(0xffffff, 0.5);
fillLight.position.set(-5, 0, 6);
scene.add(fillLight);

const fillLight2 = new THREE.DirectionalLight(0xffffff, 0.3);
fillLight2.position.set(8, -10, 4);
scene.add(fillLight2);


// === Animation Mixer and Clock ===
const clock = new THREE.Clock();
let mixer;

// === GLTF Loader ===
const loader = new THREE.GLTFLoader();
loader.load('assets/invader3d.gltf', gltf => {
  const model = gltf.scene;
  model.rotation.y = -0.1;
  scene.add(model);
  mixer = new THREE.AnimationMixer(model);
  window.loadedAnimations = gltf.animations;

  const idleClip = THREE.AnimationClip.findByName(gltf.animations, 'Idle');
  if (idleClip) {
    const action = mixer.clipAction(idleClip);
    action.play();
  }

  window.mixer = mixer;

  const idleVideo = document.getElementById('Idle_eyes');
  idleVideo.play();
  const idleVideoTexture = new THREE.VideoTexture(idleVideo);
  idleVideoTexture.minFilter = THREE.LinearFilter;
  idleVideoTexture.magFilter = THREE.LinearFilter;
  idleVideoTexture.format = THREE.RGBAFormat;
  idleVideoTexture.flipY = false;

  model.traverse(child => {
    if (child.isMesh && child.material?.map?.image?.currentSrc?.includes("face_tex.png")) {
      child.material.map = idleVideoTexture;
      child.material.needsUpdate = true;
    }
    if (child.material?.name === "Mat.028") {
      child.material.map = idleVideoTexture;
      child.material.transparent = true;
      child.material.emissive = new THREE.Color(0xffffff);
      child.material.emissiveIntensity = 2.0;
      child.material.needsUpdate = true;
    }
  });
}, undefined, error => console.error('Model load error:', error));

camera.position.set(0, 0, 12);

function animate() {
  requestAnimationFrame(animate);
  if (mixer) mixer.update(clock.getDelta());
  renderer.render(scene, camera);
}
animate();

// === Character State ===
// Restore the original setCharacterState function exactly as it was
function setCharacterState(state) {
  const videos = {
    idle: document.getElementById('Idle_eyes'),
    thinking: document.getElementById('Thinking_eyes'),
    talking: document.getElementById('Talking_eyes')
  };

  Object.values(videos).forEach(video => video.pause());
  const selectedVideo = videos[state];
  if (!selectedVideo) return;
  selectedVideo.currentTime = 0;
  selectedVideo.play();

  const texture = new THREE.VideoTexture(selectedVideo);
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.format = THREE.RGBAFormat;
  texture.flipY = false;

  scene.traverse(child => {
    if (child.isMesh && child.material?.name === "Mat.028") {
      child.material.map = texture;
      child.material.needsUpdate = true;
    }
  });

  const animationName = state.charAt(0).toUpperCase() + state.slice(1);
  if (mixer && window.loadedAnimations) {
    const clip = THREE.AnimationClip.findByName(window.loadedAnimations, animationName);
    if (clip) {
      if (window.currentAction) window.currentAction.fadeOut(0.2);
      const action = mixer.clipAction(clip);
      action.reset().fadeIn(0.2).play();
      window.currentAction = action;
    }
  }
}

// === Chat and Voice ===
function displayReply(text, sender = 'bot') {
  const chatMessages = document.getElementById('chat-messages');
  const msg = document.createElement('div');
  msg.classList.add('message', sender);
  msg.textContent = text;
  chatMessages.appendChild(msg);
  chatMessages.scrollTop = chatMessages.scrollHeight;
  
  if (sender === 'bot') {
    speak(text);
  }
}

// Flag to track if the bot is currently speaking
let isBotSpeaking = false;

// Use a simple approach - just block processing results while speaking
function speak(text) {
  window.speechSynthesis.cancel();
  setCharacterState('talking');
  
  // Set flag to indicate bot is speaking
  isBotSpeaking = true;
  
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'ru-RU';
  utterance.rate = 1.4;
  utterance.pitch = 1.5;
  
  utterance.onend = () => {
    setCharacterState('idle');
    
    // Add a small delay before setting the flag to false
    // This helps prevent the bot from hearing the end of its own speech
    setTimeout(() => {
      isBotSpeaking = false;
    }, 200);
  };

  const voices = speechSynthesis.getVoices();
  const russianVoice = voices.find(v => v.lang === 'ru-RU' && v.name.includes('Google')) || voices.find(v => v.lang === 'ru-RU');
  if (russianVoice) utterance.voice = russianVoice;

  speechSynthesis.speak(utterance);
}

// === Webhook Communication ===
const sessionId = localStorage.getItem("chatSessionId") || crypto.randomUUID();
localStorage.setItem("chatSessionId", sessionId);

async function sendToWebhook(userInput) {
  const response = await fetch("https://n8n-system.onrender.com/webhook/chatbot-webhook", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message: userInput, sessionId })
  });
  const text = await response.text();
  try {
    const data = JSON.parse(text);
    return data.reply || data.response || data.output || data.text || data.message || JSON.stringify(data);
  } catch {
    return text;
  }
}

document.getElementById('send-btn').addEventListener('click', async () => {
  const input = document.getElementById('chat-input');
  const userMessage = input.value.trim();
  if (!userMessage) return;
  displayReply(userMessage, 'user');
  input.value = "";
  setCharacterState("thinking");
  const botReply = await sendToWebhook(userMessage);
  displayReply(botReply, 'bot');
});

// === Voice Recognition with Toggle ===
let microphoneActive = false;
let recognition;
let recognitionActive = false;

// Safer function to start recognition with retry logic
function startRecognition() {
  if (!recognition || recognitionActive) return;
  
  try {
    recognition.start();
    recognitionActive = true;
    console.log("Recognition started");
  } catch (e) {
    console.error("Failed to start recognition:", e);
    recognitionActive = false;
    
    // Try again after a short delay
    setTimeout(() => {
      try {
        if (microphoneActive && !recognitionActive) {
          recognition.start();
          recognitionActive = true;
          console.log("Recognition restarted after error");
        }
      } catch (retryError) {
        console.error("Retry failed:", retryError);
      }
    }, 1000);
  }
}

try {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (SpeechRecognition) {
    recognition = new SpeechRecognition();
    recognition.lang = 'ru-RU';
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onresult = async event => {
      const voiceInput = event.results[0][0].transcript;
      
      // Only process the input if the bot is not speaking
      if (!isBotSpeaking) {
        displayReply(voiceInput, 'user');
        setCharacterState("thinking");
        
        try {
          const botReply = await sendToWebhook(voiceInput);
          displayReply(botReply, 'bot');
        } catch (error) {
          console.error("Error getting bot reply:", error);
          setCharacterState('idle');
        }
      } else {
        console.log("Ignored speech input while bot was speaking");
      }
    };

    recognition.onerror = event => {
      console.error("Speech recognition error:", event.error);
      recognitionActive = false;
      
      // Only try to restart if it was a network error and microphone is active
      if (event.error === 'network' && microphoneActive) {
        console.log("Network error detected, will try to reconnect...");
        setTimeout(() => {
          if (microphoneActive) startRecognition();
        }, 2000);
      }
    };

    recognition.onend = () => {
      console.log("Recognition ended");
      recognitionActive = false;
      
      // Restart recognition if mic is active and bot is not speaking
      if (microphoneActive) {
        setTimeout(() => {
          if (microphoneActive) startRecognition();
        }, 300);
      }
    };
  }
} catch (err) {
  console.error("Speech recognition not supported:", err);
}

function toggleContinuousListening() {
  microphoneActive = !microphoneActive;

  const micOnIcon = document.getElementById('mic-on');
  const micOffIcon = document.getElementById('mic-off');
  const micBtn = document.getElementById('mic-btn');

  if (microphoneActive) {
    // Show active state
    micOnIcon.style.display = 'block';
    micOffIcon.style.display = 'none';
    micBtn.style.backgroundColor = '#ff4b4b'; // Red background when active
    
    // Start recognition
    startRecognition();
  } else {
    // Show inactive state
    micOnIcon.style.display = 'none';
    micOffIcon.style.display = 'block';
    micBtn.style.backgroundColor = '#f0f0f0'; // Default background when inactive
    
    // Stop recognition
    if (recognition && recognitionActive) {
      try {
        recognition.stop();
        recognitionActive = false;
        console.log("Recognition stopped by user");
      } catch (e) {
        console.error("Could not stop recognition:", e);
      }
    }
  }
}

document.getElementById('mic-btn').addEventListener('click', toggleContinuousListening);