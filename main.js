// Create basic Three.js scene, camera, and renderer
const scene = new THREE.Scene();
scene.background = null;
const camera = new THREE.PerspectiveCamera(
  75, window.innerWidth / window.innerHeight, 0.1, 1000
);
const renderer = new THREE.WebGLRenderer({ antialias: true,  alpha: true  });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.outputEncoding = THREE.sRGBEncoding;
renderer.setClearColor(0x000000, 0); // transparent
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// Lighting

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


// Create a clock for animation updates
const clock = new THREE.Clock();

// Set up the GLTF loader
const loader = new THREE.GLTFLoader();
loader.load(
  'assets/invader3d.gltf', // Update this path to your glTF file
  function (gltf) {
    const model = gltf.scene;
    // Rotate the model to adjust its orientation
    model.rotation.y = -0.1; // rotate by -0.2 radians (about -11.5°) on the Y-axis
    scene.add(model);

    // Set up the AnimationMixer for this model
    const mixer = new THREE.AnimationMixer(model);
    window.loadedAnimations = gltf.animations;

    // Find the "Idle" animation clip by name
    const idleClip = THREE.AnimationClip.findByName(gltf.animations, 'Idle');
    if (idleClip) {
      const action = mixer.clipAction(idleClip);
      action.play(); // Play the Idle animation
    } else {
      console.warn('No "Idle" animation found!');
    }

    // Store the mixer so it can be updated in the animation loop
    window.mixer = mixer;
        // Adding video texture after model is loaded:
        const idleVideo = document.getElementById('Idle_eyes');
        idleVideo.play();  // Start playing the video
    
        // Create a Three.js VideoTexture from the video element
        const idleVideoTexture = new THREE.VideoTexture(idleVideo);
        idleVideoTexture.minFilter = THREE.LinearFilter;
        idleVideoTexture.magFilter = THREE.LinearFilter;
        idleVideoTexture.format = THREE.RGBAFormat;
        idleVideoTexture.flipY = false;
    
        // Replace stub texture with video texture
        model.traverse(function(child) {
          if (child.isMesh && child.material && child.material.map) {
            // Replace stub texture if it matched "face_tex.png"
            if (
              child.material.map.image &&
              child.material.map.image.currentSrc &&
              child.material.map.image.currentSrc.indexOf("face_tex.png") !== -1
            ) {
              child.material.map = idleVideoTexture;
              child.material.needsUpdate = true;
            }
        
            // If it's Mat.028 (eye material), assign video texture and emissive glow
            if (child.material.name === "Mat.028") {
              child.material.map = idleVideoTexture;
              child.material.transparent = true;
              child.material.emissive = new THREE.Color(0xffffff);
              child.material.emissiveIntensity = 2.0;
              child.material.needsUpdate = true;
              console.log(child.material.name + " texture replaced with video texture.");
            }
          }
        });
  },
  undefined,
  function (error) {
    console.error('An error occurred while loading the model:', error);
  }
  
);

// Position the camera
camera.position.set(0, 0, 12);

//Preload videos
function preloadVideos() {
  ["Idle_eyes", "Thinking_eyes", "Talking_eyes"].forEach(id => {
    const video = document.getElementById(id);
    if (video) video.load();
  });
}

document.addEventListener('DOMContentLoaded', preloadVideos);


//Character states
function setCharacterState(state) {
  const idleVideo = document.getElementById('Idle_eyes');
  const thinkingVideo = document.getElementById('Thinking_eyes');
  const talkingVideo = document.getElementById('Talking_eyes');

  // Pause all videos first
  idleVideo.pause();
  thinkingVideo.pause();
  talkingVideo.pause();

  let selectedVideo, animationName;

  if (state === 'idle') {
    selectedVideo = idleVideo;
    animationName = 'Idle';
  } else if (state === 'thinking') {
    selectedVideo = thinkingVideo;
    animationName = 'Thinking';
  } else if (state === 'talking') {
    selectedVideo = talkingVideo;
    animationName = 'Talking';
  }

  if (selectedVideo) {
    selectedVideo.currentTime = 0;
    selectedVideo.play();
  
    // Force texture update immediately (no delay)
    const texture = new THREE.VideoTexture(selectedVideo);
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.format = THREE.RGBAFormat;
    texture.flipY = false;
  
    // Apply to the face material
    scene.traverse(child => {
      if (child.isMesh && child.material && child.material.name === "Mat.028") {
        child.material.map = texture;
        child.material.needsUpdate = true;
      }
    });
  }

  // Play animation (if model & mixer are loaded)
  if (window.mixer && window.loadedAnimations) {
    const clip = THREE.AnimationClip.findByName(window.loadedAnimations, animationName);
    if (clip) {
      if (window.currentAction) {
        window.currentAction.fadeOut(0.2); // fade out previous
      }
  
      const action = window.mixer.clipAction(clip);
      action.reset().fadeIn(0.2).play();
      window.currentAction = action; // remember current action
    }
  }

  window.currentState = state;
}

// Animation loop
function animate() {
  requestAnimationFrame(animate);
  
  // Update the animation mixer
  if (window.mixer) {
    const delta = clock.getDelta();
    window.mixer.update(delta);
  }
  
  renderer.render(scene, camera);
}
animate();

// Handle window resizing
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

//Keep video texture playing when tab is not active
window.addEventListener('focus', () => {
  const idleVideo = document.getElementById('Idle_eyes');
  if (idleVideo && idleVideo.paused) {
    idleVideo.play();
  }
});

//Configuration for n8n memory
const sessionId = localStorage.getItem("chatSessionId") || crypto.randomUUID();
localStorage.setItem("chatSessionId", sessionId);

// Then when sending messages to webhook:
async function sendToWebhook(userInput) {
  try {
    const response = await fetch("https://n8n-system.onrender.com/webhook/chatbot-webhook", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: userInput,
        sessionId: sessionId
      })
    });
    
    if (!response.ok) {
      throw new Error(`Server responded with status: ${response.status}`);
    }
    
    // Check if response is empty
    const text = await response.text();
    if (!text) {
      return "I received an empty response. Please try again.";
    }
    
    // Try to parse JSON
    try {
      const data = JSON.parse(text);
      
      // Check different possible response structures
      if (data.reply) return data.reply;
      if (data.response) return data.response;
      if (data.output) return data.output;
      if (data.text) return data.text;
      if (data.message) return data.message;
      
      // If we have data but none of the expected fields, just stringify it
      return JSON.stringify(data);
    } catch (e) {
      // If not valid JSON, return the text as is
      console.log("Not valid JSON, returning text:", text);
      return text;
    }
  } catch (error) {
    console.error("Error sending to webhook:", error);
    throw error;
  }
}

// Preload voices if needed
window.speechSynthesis.onvoiceschanged = () => {
  speechSynthesis.getVoices();
};

// Enhanced speak function with better voice selection and speed control
function speak(text) {
  // Cancel any ongoing speech
  window.speechSynthesis.cancel();
  
  setCharacterState('talking');
  
  // Create a new utterance
  const utterance = new SpeechSynthesisUtterance();
  utterance.text = text;
  utterance.lang = 'ru-RU';
  utterance.rate = 1.3; // Adjust this value to change speed (1.0 is normal, higher is faster)
  utterance.pitch = 1.0; // Normal pitch (0.1 to 2.0)
  
  // Handle completion
  utterance.onend = () => {
    setCharacterState('idle');
  };
  
  // Force voice selection
  const voices = window.speechSynthesis.getVoices();
  if (voices.length) {
    // Try to find a good Russian voice
    const russianVoice = voices.find(v => 
      v.lang === 'ru-RU' && (v.name.includes('Google') || v.name.includes('Yandex'))
    ) || voices.find(v => v.lang === 'ru-RU');
    
    if (russianVoice) {
      console.log("Using voice:", russianVoice.name);
      utterance.voice = russianVoice;
    }
  }
  
  // Handle case where voices might not be loaded yet
  if (voices.length === 0) {
    window.speechSynthesis.onvoiceschanged = () => {
      const newVoices = window.speechSynthesis.getVoices();
      const russianVoice = newVoices.find(v => 
        v.lang === 'ru-RU' && (v.name.includes('Google') || v.name.includes('Yandex'))
      ) || newVoices.find(v => v.lang === 'ru-RU');
      
      if (russianVoice) {
        console.log("Using voice:", russianVoice.name);
        utterance.voice = russianVoice;
      }
      window.speechSynthesis.speak(utterance);
    };
  } else {
    window.speechSynthesis.speak(utterance);
  }
}

// Display reply in chat box
function displayReply(text, sender = 'bot') {
  const chatMessages = document.getElementById('chat-messages');
  const msg = document.createElement('div');
  msg.classList.add('message', sender);
  msg.textContent = text;
  chatMessages.appendChild(msg);
  chatMessages.scrollTop = chatMessages.scrollHeight;

  if (sender === 'bot') {
    speak(text); // Use the new speak function instead of inline speech code
  }
}


// Send button click handler
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

//Voice input
let recognition;
try {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (SpeechRecognition) {
    recognition = new SpeechRecognition();
    recognition.lang = 'ru-RU';
    recognition.continuous = false;
    
    recognition.onresult = async (event) => {
      const voiceInput = event.results[0][0].transcript;
      displayReply(voiceInput, 'user');
      
      setCharacterState("thinking");
      try {
        const botReply = await sendToWebhook(voiceInput);
        displayReply(botReply, 'bot');
      } catch (error) {
        console.error("Error getting bot reply:", error);
        displayReply("Sorry, I encountered a problem. Please try again.", 'bot');
        setCharacterState("idle");
      }
    };
    
    recognition.onerror = (event) => {
      console.error("Speech recognition error:", event.error);
      displayReply("Sorry, I couldn't understand that. Please try typing instead.", 'bot');
      setCharacterState("idle");
    };
  } else {
    document.getElementById('mic-btn').style.display = 'none';
  }
} catch (error) {
  console.error("Speech recognition not supported:", error);
  document.getElementById('mic-btn').style.display = 'none';
}

// Update mic button click handler
document.getElementById('mic-btn').addEventListener('click', () => {
  if (recognition) {
    try {
      recognition.start();
    } catch (error) {
      console.error("Error starting recognition:", error);
    }
  }
});

//Get voices list for console
speechSynthesis.getVoices().forEach(v => console.log(v.name, v.lang));