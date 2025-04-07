// Cleaned JavaScript for Chatbot with working mic toggle and animated 3D character

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
scene.add(new THREE.AmbientLight(0xffffff, 1.8));
const directionalLight = new THREE.DirectionalLight(0xffffff, 1.5);
directionalLight.position.set(5, 8, 8);
scene.add(directionalLight);
scene.add(new THREE.DirectionalLight(0xffffff, 0.5).position.set(-5, 0, 6));
scene.add(new THREE.DirectionalLight(0xffffff, 0.3).position.set(8, -10, 4));

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
  if (sender === 'bot') speak(text);
}

function speak(text) {
  window.speechSynthesis.cancel();
  setCharacterState('talking');
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'ru-RU';
  utterance.rate = 1.4;
  utterance.pitch = 1.5;
  utterance.onend = () => setCharacterState('idle');

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

try {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (SpeechRecognition) {
    recognition = new SpeechRecognition();
    recognition.lang = 'ru-RU';
    recognition.continuous = false;

    recognition.onresult = async event => {
      const voiceInput = event.results[0][0].transcript;
      displayReply(voiceInput, 'user');
      setCharacterState("thinking");
      const botReply = await sendToWebhook(voiceInput);
      displayReply(botReply, 'bot');
    };

    recognition.onerror = event => {
      console.error("Speech recognition error:", event.error);
      setCharacterState("idle");
    };

    recognition.onend = () => {
      if (microphoneActive) setTimeout(() => recognition.start(), 100);
    };
  }
} catch (err) {
  console.error("Speech recognition not supported:", err);
}

document.getElementById('mic-btn').addEventListener('click', () => {
  microphoneActive = !microphoneActive;
  document.getElementById('mic-on').style.display = microphoneActive ? 'block' : 'none';
  document.getElementById('mic-off').style.display = microphoneActive ? 'none' : 'block';
  if (microphoneActive) recognition?.start();
  else recognition?.stop();
});