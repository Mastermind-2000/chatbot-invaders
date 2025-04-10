// === Three.js Setup ===
const scene = new THREE.Scene();
scene.background = null; // Use null for transparency with alpha: true
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true }); // alpha: true for transparent background
renderer.setPixelRatio(window.devicePixelRatio);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.outputEncoding = THREE.sRGBEncoding;
renderer.setClearColor(0x000000, 0); // Set clear color with 0 alpha
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

// === Animation Mixer, Clock, and Cached Resources ===
const clock = new THREE.Clock();
let mixer;
let faceMaterial; // Variable to cache the target material
let idleTexture, thinkingTexture, talkingTexture; // Variables to cache video textures
let loadedAnimations = []; // Store loaded animations
let currentAction; // Store the current animation action

// === GLTF Loader ===
const loader = new THREE.GLTFLoader();
loader.load(
    'assets/invader3d.gltf',
    (gltf) => {
        const model = gltf.scene;
        model.rotation.y = -0.1;
        scene.add(model);

        // --- Animation Setup ---
        mixer = new THREE.AnimationMixer(model);
        loadedAnimations = gltf.animations; // Cache animations

        const idleClip = THREE.AnimationClip.findByName(loadedAnimations, 'Idle');
        if (idleClip) {
            currentAction = mixer.clipAction(idleClip);
            currentAction.play();
        }

        // --- Video Texture and Material Caching ---
        const idleVideo = document.getElementById('Idle_eyes');
        const thinkingVideo = document.getElementById('Thinking_eyes');
        const talkingVideo = document.getElementById('Talking_eyes');

        if (!idleVideo || !thinkingVideo || !talkingVideo) {
            console.error("One or more video elements not found!");
            return; // Stop if videos aren't present
        }

        // --- Helper function to wait for video readiness ---
        function waitForVideoReady(video) {
          return new Promise((resolve, reject) => {
              // Проверяем, возможно видео уже готово?
              // readyState 3 (HAVE_FUTURE_DATA) или 4 (HAVE_ENOUGH_DATA)
              if (video.readyState >= 3) {
                  console.log(`Video ${video.id || video.src} already ready (readyState: ${video.readyState})`);
                  resolve(video); // Возвращаем сам элемент для удобства
                  return;
              }
              if (video.error) { // Проверяем, не было ли ошибки ранее
                   console.error(`Video ${video.id || video.src} already has an error state.`);
                   reject(new Error(`Video already has an error: ${video.id || video.src}`));
                   return;
              }

              let resolved = false; // Флаг, чтобы избежать двойного разрешения/отклонения

              const onCanPlay = () => {
                  if (resolved) return;
                  resolved = true;
                  console.log(`Video ${video.id || video.src} is ready (canplay event).`);
                  cleanup();
                  resolve(video);
              };

              const onError = (err) => {
                  if (resolved) return;
                  resolved = true;
                  console.error(`Video Error (${video.id || video.src}):`, err);
                  cleanup();
                  reject(new Error(`Video failed to load: ${video.id || video.src}`));
              };

              const cleanup = () => { // Функция для удаления слушателей
                  video.removeEventListener('canplay', onCanPlay);
                  video.removeEventListener('error', onError);
              };

              // Добавляем слушатели
              video.addEventListener('canplay', onCanPlay);
              video.addEventListener('error', onError);
          });
      }

      // --- Wait for all videos to be ready using Promise.all ---
      console.log("Waiting for all videos to be ready...");
      const videoPromises = [
          waitForVideoReady(idleVideo),
          waitForVideoReady(thinkingVideo),
          waitForVideoReady(talkingVideo)
      ];

      Promise.all(videoPromises)
          .then(([readyIdleVideo, readyThinkingVideo, readyTalkingVideo]) => {
              // Этот код выполнится ТОЛЬКО КОГДА все три видео готовы
              console.log("All videos are ready. Creating textures and applying initial state.");

              // --- Create textures ONCE --- (Используем элементы, возвращенные промисами)
              idleTexture = new THREE.VideoTexture(readyIdleVideo);
              thinkingTexture = new THREE.VideoTexture(readyThinkingVideo);
              talkingTexture = new THREE.VideoTexture(readyTalkingVideo);

              const setupTexture = (texture) => { // Настройка текстур
                  texture.minFilter = THREE.LinearFilter;
                  texture.magFilter = THREE.LinearFilter;
                  texture.format = THREE.RGBAFormat;
                  texture.flipY = false;
                  texture.needsUpdate = true; // Важно для первого кадра
              };

              setupTexture(idleTexture);
              setupTexture(thinkingTexture);
              setupTexture(talkingTexture);

              // --- Traverse model ONCE to find face material (делаем это здесь, т.к. нужна idleTexture) ---
              model.traverse(child => {
                  if (child.isMesh) {
                      // Optional replacement
                      if (child.material?.map?.image?.currentSrc?.includes("face_tex.png")) {
                           console.log("Replacing face_tex.png with initial idle texture...");
                           child.material.map = idleTexture;
                           child.material.needsUpdate = true;
                      }
                      // Find and cache face material
                      if (child.material?.name === "Mat.028") {
                           faceMaterial = child.material;
                           console.log("Found and cached face material:", faceMaterial.name);
                           faceMaterial.map = idleTexture; // Apply initial texture
                           faceMaterial.transparent = true;
                           faceMaterial.emissive = new THREE.Color(0xffffff);
                           faceMaterial.emissiveIntensity = 2.0;
                           faceMaterial.needsUpdate = true;
                      }
                  }
              });

               if (!faceMaterial) {
                   console.warn("Material 'Mat.028' not found...");
               }

              // --- Play the default video NOW that it's ready ---
              console.log("Playing initial idle video.");
              readyIdleVideo.play().catch(e => console.error("Error playing idle video:", e));

          })
          .catch(error => {
              // Обработка ошибки, если ХОТЯ БЫ ОДНО видео не загрузилось
              console.error("Failed to get all videos ready:", error);
              // Здесь можно показать сообщение об ошибке пользователю или использовать fallback
              // Например, не применять видео текстуры вообще
          });

  },
  undefined, // Progress callback
  (error) => console.error('Model load error:', error)
);

camera.position.set(0, 0, 12);

function animate() {
    requestAnimationFrame(animate);
    const delta = clock.getDelta();
    if (mixer) mixer.update(delta);
    renderer.render(scene, camera);
}
animate();

// === Character State (Optimized) ===
function setCharacterState(state) {
    console.log("Setting character state:", state);
    const videos = {
        idle: document.getElementById('Idle_eyes'),
        thinking: document.getElementById('Thinking_eyes'),
        talking: document.getElementById('Talking_eyes')
    };

    // Stop all videos first
    Object.values(videos).forEach(video => {
        if (video) video.pause();
    });

    const selectedVideo = videos[state];
    if (!selectedVideo) {
        console.warn("No video element found for state:", state);
        return;
    }

    // Select and play the correct video
    selectedVideo.currentTime = 0;
    selectedVideo.play().catch(e => console.error(`Error playing ${state} video:`, e));

    // Select the correct CACHED texture
    let selectedTexture;
    switch (state) {
        case 'idle':
            selectedTexture = idleTexture;
            break;
        case 'thinking':
            selectedTexture = thinkingTexture;
            break;
        case 'talking':
            selectedTexture = talkingTexture;
            break;
        default:
             console.warn("Unknown state for texture selection:", state);
             selectedTexture = idleTexture; // Default to idle
    }

    // Update the CACHED material's map
    if (faceMaterial && selectedTexture) {
        faceMaterial.map = selectedTexture;
        // No need to set needsUpdate = true here usually,
        // as VideoTexture updates automatically. But doesn't hurt.
        faceMaterial.needsUpdate = true;
    } else if (!faceMaterial) {
         // Warning already logged during setup
    } else {
         console.warn("Could not set texture for state:", state);
    }


   // --- Animation Handling ---
const animationName = state.charAt(0).toUpperCase() + state.slice(1); // e.g., "Idle", "Thinking"
if (mixer && loadedAnimations) {
  const clip = THREE.AnimationClip.findByName(loadedAnimations, animationName);
  if (clip) {
    const action = mixer.clipAction(clip);

    if (currentAction && currentAction !== action) {
      // Smoothly transition from previous to new animation
      currentAction.crossFadeTo(action, 0.5, false); // 0.5 seconds fade duration
    } else {
      action.reset().fadeIn(0.5).play(); // First-time animation or same clip
    }

    action.play();
    currentAction = action; // Save as current
  } else {
    console.warn("Animation clip not found for state:", animationName);
  }
}



// === Chat and Voice ===
const chatMessages = document.getElementById('chat-messages'); // Cache element

function displayReply(text, sender = 'bot') {
    const msg = document.createElement('div');
    msg.classList.add('message', sender);
    msg.textContent = text;
    chatMessages.appendChild(msg);
    chatMessages.scrollTop = chatMessages.scrollHeight; // Scroll to bottom

    if (sender === 'bot') {
        speak(text);
    }
}

let isBotSpeaking = false; // Flag to track if the bot is currently speaking

function speak(text) {
  // 1. STOP recognition explicitly when bot starts speaking
  console.log("Bot starting to speak, stopping recognition if active.");
  stopRecognition(); // Stop listening

  window.speechSynthesis.cancel(); // Cancel any previous speech
  setCharacterState('talking');
  isBotSpeaking = true; // Set flag: Bot IS speaking
  console.log("isBotSpeaking flag set to true.");

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'ru-RU';
  utterance.rate = 1.4;
  utterance.pitch = 1.5;

  utterance.onend = () => {
      console.log("Bot finished speaking (utterance.onend).");
      setCharacterState('idle');
      // Delay resetting flag AND potentially restarting recognition
      setTimeout(() => {
          isBotSpeaking = false; // Set flag: Bot is NO LONGER speaking
          console.log("isBotSpeaking flag set to false.");

          // If the user intended the mic to be on, restart recognition now
          if (microphoneActive) {
              console.log("Bot finished, restarting recognition because microphoneActive is true.");
              startRecognition(); // Restart listening
          }

      }, 500); // Keep the delay (tune as needed)
  };

  utterance.onerror = (event) => {
      console.error("SpeechSynthesis Error:", event.error);
      // Ensure state is reset even on error
       setCharacterState('idle');
       const wasSpeaking = isBotSpeaking;
       isBotSpeaking = false; // Reset flag on error too
       console.log("isBotSpeaking flag set to false due to speech error.");
       // If mic should be active, try restarting recognition even after speech error
       if (wasSpeaking && microphoneActive) {
            console.log("Bot speech errored, restarting recognition because microphoneActive is true.");
            startRecognition();
       }
  };

    const voices = speechSynthesis.getVoices(); // Keep voice selection
    const russianVoice = voices.find(v => v.lang === 'ru-RU' && v.name.includes('Google')) || voices.find(v => v.lang === 'ru-RU');
    if (russianVoice) utterance.voice = russianVoice;
    else console.warn("Could not find specific Russian voice.");

    speechSynthesis.speak(utterance);
}

// === Webhook Communication (Improved Error Handling) ===
const sessionId = localStorage.getItem("chatSessionId") || crypto.randomUUID();
localStorage.setItem("chatSessionId", sessionId);

async function sendToWebhook(userInput) {
    const webhookUrl = "https://n8n-system.onrender.com/webhook/chatbot-webhook";
    console.log(`Sending to webhook: ${userInput}`);
    try {
        const response = await fetch(webhookUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ message: userInput, sessionId })
        });

        // Check for HTTP errors (like 4xx, 5xx)
        if (!response.ok) {
            const errorText = await response.text(); // Get error details if possible
            console.error(`Webhook Error Response: ${response.status} ${response.statusText}`, errorText);
            throw new Error(`Webhook request failed: ${response.status} ${response.statusText}`);
        }

        const text = await response.text();
        // Attempt to parse JSON, but handle potential errors
        try {
            const data = JSON.parse(text);
            // Try various common reply keys
            const reply = data.reply || data.response || data.output || data.text || data.message || JSON.stringify(data);
            console.log("Webhook reply (JSON parsed):", reply);
            return reply;
        } catch (parseError) {
            console.warn("Webhook response was not valid JSON, returning raw text.", parseError);
            console.log("Webhook reply (raw text):", text);
            return text; // Return raw text if JSON parsing fails
        }
    } catch (networkError) {
         console.error("Error sending message to webhook:", networkError);
         // Provide a user-friendly error message
         return "Sorry, I couldn't connect to my brain right now. Please try again later.";
    }
}


// === Event Listeners ===
const chatInput = document.getElementById('chat-input');
const sendButton = document.getElementById('send-btn');
const micButton = document.getElementById('mic-btn');

sendButton.addEventListener('click', handleSend);
chatInput.addEventListener('keypress', (event) => {
     if (event.key === 'Enter') {
         handleSend();
     }
 });

async function handleSend() {
    const userMessage = chatInput.value.trim();
    if (!userMessage) return;

    displayReply(userMessage, 'user');
    chatInput.value = ""; // Clear input
    setCharacterState("thinking");

    try {
        const botReply = await sendToWebhook(userMessage);
        displayReply(botReply, 'bot');
    } catch (error) {
        // Error handling is now more robust within sendToWebhook,
        // but we might still catch network errors here if fetch itself fails
        console.error("Error processing user message:", error);
        // Display the error message returned by sendToWebhook or a default one
        displayReply(error.message || "Sorry, something went wrong.", 'bot');
        setCharacterState('idle'); // Reset state on error
    }
}


// === Voice Recognition with Toggle ===
let microphoneActive = false;
let recognition;
let recognitionActive = false;
const micOnIcon = document.getElementById('mic-on');
const micOffIcon = document.getElementById('mic-off');


// Safer function to start recognition with retry logic
function startRecognition() {
  if (!recognition) {
      console.warn("Speech Recognition not initialized.");
      return;
  }
   if (recognitionActive) {
       console.log("Attempted to start recognition, but already active.");
       return;
   }
   // ** Crucial check: Do not start if bot is speaking **
   if (isBotSpeaking) {
       console.log("Attempted to start recognition, but bot is speaking. Aborting start.");
       return; // <--- Prevent starting if bot is speaking
   }

  try {
      console.log("Attempting recognition.start()");
      recognition.start();
      recognitionActive = true; // Set active flag *after* successful start call
      console.log("Recognition successfully started.");
  } catch (e) {
      // Log different errors that might occur on start
      if (e.name === 'NetworkError') {
           console.error("NetworkError starting recognition:", e.message);
      } else if (e.name === 'InvalidStateError') {
           console.warn("InvalidStateError on start (already started or ending?):", e.message);
           // It might already be active despite our flag, or stopping slowly.
           // Avoid immediate retry for this state.
           recognitionActive = false; // Ensure flag is false if start fails
      } else {
           console.error(`Error starting recognition (name: ${e.name}):`, e.message);
           recognitionActive = false; // Ensure flag is reset
      }
  }
}

// Function to stop recognition safely
function stopRecognition() {
   if (recognition && recognitionActive) {
       try {
           recognition.stop();
           console.log("Called recognition.stop().");
           // Note: recognitionActive will be set to false in the 'onend' event handler
       } catch (e) {
           console.error("Error calling recognition.stop():", e);
           // Force flag reset if stop fails critically, though onend should handle it
           recognitionActive = false;
           updateMicButtonState(); // Update UI just in case
       }
   } else {
        // console.log("Stop request ignored: Recognition not active or not initialized.");
   }
}

// Update Mic Button UI (Keep this function as is)
function updateMicButtonState() {
   // ... (same as before) ...
   if (microphoneActive) {
       micOnIcon.style.display = 'block';
       micOffIcon.style.display = 'none';
       micButton.style.backgroundColor = '#ff4b4b'; // Red background
   } else {
       micOnIcon.style.display = 'none';
       micOffIcon.style.display = 'block';
       micButton.style.backgroundColor = '#f0f0f0'; // Default background
   }
}


try {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (SpeechRecognition) {
      recognition = new SpeechRecognition();
      // ... (keep recognition setup: lang, continuous, etc. the same) ...
      recognition.lang = 'ru-RU';
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;
      console.log("SpeechRecognition initialized.");


      recognition.onresult = async (event) => {
           // ** Check bot speaking flag FIRST **
           if (isBotSpeaking) {
              console.log("Ignored 'onresult' because bot is speaking.");
              return; // Ignore result completely
           }

          const voiceInput = event.results[0][0].transcript.trim();
          console.log("Recognition result received:", voiceInput);

           if (!voiceInput) {
               console.log("Empty recognition result, ignoring.");
               return; // Ignore empty results
           }

          // Process the valid input
          displayReply(voiceInput, 'user');
          setCharacterState("thinking");

          try {
              const botReply = await sendToWebhook(voiceInput);
              // Check AGAIN if bot might have started speaking somehow
              // (less likely now but good safety check)
              if (!isBotSpeaking) {
                  displayReply(botReply, 'bot');
              } else {
                  console.log("Bot started speaking before webhook reply could be displayed/spoken.");
                  setCharacterState("idle");
              }
          } catch (error) {
               console.error("Error processing webhook reply after voice input:", error);
               if (!isBotSpeaking) { // Display error only if bot silent
                    displayReply(error.message || "Sorry, there was an error processing my reply.", 'bot');
               }
               setCharacterState('idle');
          }
      };

      recognition.onerror = (event) => {
          console.error(`Speech recognition error: ${event.error}`, event.message || '(no message)');
          const wasActive = recognitionActive;
          recognitionActive = false; // Ensure flag is reset

           // Automatic restart logic based on error type
           // Only try restarting if the mic button is still meant to be active
           if (microphoneActive) {
                if (event.error === 'network') {
                    console.log("Network error, attempting reconnect shortly...");
                    setTimeout(() => {
                        if (microphoneActive && !recognitionActive && !isBotSpeaking) startRecognition();
                    }, 2000);
                } else if (event.error === 'no-speech') {
                    console.log("No speech detected timeout.");
                    // Let onend handle potential restart
                } else if (event.error === 'audio-capture' || event.error === 'not-allowed' || event.error === 'service-not-allowed') {
                     // Critical errors: Log, inform user, and turn off mic state
                     console.error("Critical recognition error. Disabling microphone.");
                     let userMessage = "Error: Could not capture audio. Please check microphone.";
                     if (event.error !== 'audio-capture') {
                          userMessage = "Error: Microphone access denied or service unavailable. Please check permissions.";
                     }
                     if (!isBotSpeaking) displayReply(userMessage, 'bot');
                     microphoneActive = false; // Turn off the toggle state
                     updateMicButtonState();   // Update UI to reflect it's off
                     // No automatic restart for these errors
                } else {
                     // Other errors - potentially try restart via onend if applicable
                     console.log("Unhandled recognition error type:", event.error);
                }
           } else {
                console.log("Recognition error occurred, but microphone toggle is off.");
           }

           // Fallback UI update if needed
           if (!microphoneActive && wasActive) {
              updateMicButtonState();
           }
      };

      recognition.onend = () => {
          console.log(`Recognition ended. State: {microphoneActive: ${microphoneActive}, recognitionActive: ${recognitionActive}, isBotSpeaking: ${isBotSpeaking}}`);
          recognitionActive = false; // Definitely not active anymore

          // ** RESTART LOGIC: Only if mic button is on AND bot isn't speaking **
          if (microphoneActive && !isBotSpeaking) {
               console.log("Restarting recognition via onend (mic active, bot not speaking).");
               // Use a delay before restarting
               setTimeout(() => {
                  // Double check state hasn't changed during the delay
                  if (microphoneActive && !recognitionActive && !isBotSpeaking) {
                      startRecognition();
                  } else {
                       console.log("Conditions changed during delay, not restarting recognition.");
                  }
               }, 500); // <--- INCREASED RESTART DELAY (e.g., 500ms) - Tune as needed
           } else if (isBotSpeaking) {
                console.log("Recognition ended naturally or was stopped, but bot is speaking. Will not restart immediately.");
           } else if (!microphoneActive) {
                console.log("Recognition ended and microphone toggle is off. Not restarting.");
                updateMicButtonState(); // Ensure UI is correct
           }
      };

  } else {
      // ... (keep API not supported handling the same) ...
       console.error("Speech Recognition API not supported in this browser.");
       micButton.disabled = true; // Disable button if API not supported
       displayReply("Sorry, voice input is not supported in your browser.", 'bot');
  }
} catch (err) {
  // ... (keep init error handling the same) ...
  console.error("Error initializing Speech Recognition:", err);
  if (micButton) micButton.disabled = true;
  displayReply("Error initializing voice input.", 'bot');
}

// Function to toggle microphone state (Keep this the same)
function toggleContinuousListening() {
  microphoneActive = !microphoneActive; // Toggle the desired state
  console.log(`Mic button toggled. microphoneActive state is now: ${microphoneActive}`);

  updateMicButtonState(); // Update UI immediately

  if (microphoneActive) {
      // Start recognition (will check isBotSpeaking flag internally)
      startRecognition();
  } else {
      // Stop recognition if it's currently active
      stopRecognition();
  }
}


// Event listener for mic button (Keep this the same)
micButton.addEventListener('click', toggleContinuousListening);

// Initial UI setup (Keep this the same)
updateMicButtonState();