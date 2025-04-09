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
        const idleVideo = document.getElementById('Idle_eyes'); // Assumes duplicate ID is fixed in HTML
        const thinkingVideo = document.getElementById('Thinking_eyes');
        const talkingVideo = document.getElementById('Talking_eyes');

        if (!idleVideo || !thinkingVideo || !talkingVideo) {
            console.error("One or more video elements not found!");
            return; // Stop if videos aren't present
        }

        // Play the default video
        idleVideo.play().catch(e => console.error("Error playing idle video:", e));

        // Create textures ONCE
        idleTexture = new THREE.VideoTexture(idleVideo);
        thinkingTexture = new THREE.VideoTexture(thinkingVideo);
        talkingTexture = new THREE.VideoTexture(talkingVideo);

        const setupTexture = (texture) => {
            texture.minFilter = THREE.LinearFilter;
            texture.magFilter = THREE.LinearFilter;
            texture.format = THREE.RGBAFormat;
            texture.flipY = false; // Important for GLTF typically
            texture.needsUpdate = true; // Ensure initial update
        };

        setupTexture(idleTexture);
        setupTexture(thinkingTexture);
        setupTexture(talkingTexture);


        // Traverse model ONCE to find and cache the face material
        model.traverse(child => {
            if (child.isMesh) {
                 // Optional: Still replace the initial placeholder texture if needed
                 // Note: This assumes 'face_tex.png' is NOT Mat.028
                 if (child.material?.map?.image?.currentSrc?.includes("face_tex.png")) {
                    console.log("Replacing face_tex.png with initial idle texture on material:", child.material.name);
                    child.material.map = idleTexture;
                    child.material.needsUpdate = true;
                 }

                 // Find and CACHE the primary material for state changes
                 if (child.material?.name === "Mat.028") {
                    faceMaterial = child.material; // Cache the material reference
                    console.log("Found and cached face material:", faceMaterial.name);
                    faceMaterial.map = idleTexture; // Apply initial texture
                    faceMaterial.transparent = true; // Set transparency and emission once
                    faceMaterial.emissive = new THREE.Color(0xffffff);
                    faceMaterial.emissiveIntensity = 2.0;
                    faceMaterial.needsUpdate = true;
                 }
            }
        });

        if (!faceMaterial) {
             console.warn("Material 'Mat.028' not found in the model. Character state changes won't update texture.");
        }

    },
    undefined, // Progress callback (optional)
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
                currentAction.fadeOut(0.2); // Fade out previous action
            }
            action.reset().fadeIn(0.2).play(); // Fade in and play new action
            currentAction = action; // Update current action
        } else {
            console.warn("Animation clip not found for state:", animationName);
             // Optional: Play Idle animation as a fallback if state animation missing?
             // const idleClip = THREE.AnimationClip.findByName(loadedAnimations, 'Idle');
             // if (idleClip && currentAction !== mixer.clipAction(idleClip)) {
             //     currentAction.fadeOut(0.2);
             //     currentAction = mixer.clipAction(idleClip);
             //     currentAction.reset().fadeIn(0.2).play();
             // }
        }
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
    window.speechSynthesis.cancel(); // Cancel any previous speech
    setCharacterState('talking');
    isBotSpeaking = true;
    console.log("Bot started speaking.");

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'ru-RU';
    utterance.rate = 1.4;
    utterance.pitch = 1.5;

    utterance.onend = () => {
        console.log("Bot finished speaking (utterance.onend).");
        setCharacterState('idle');
        // Delay resetting flag slightly to avoid capturing echo
        setTimeout(() => {
            isBotSpeaking = false;
            console.log("isBotSpeaking flag set to false.");
        }, 200);
    };

    utterance.onerror = (event) => {
        console.error("SpeechSynthesis Error:", event.error);
        // Even if speech fails, reset state and flag
         setCharacterState('idle');
         isBotSpeaking = false;
         console.log("isBotSpeaking flag set to false due to speech error.");
    };


    // Try to find preferred voice (do this only once if needed, but fine here)
    const voices = speechSynthesis.getVoices();
    const russianVoice = voices.find(v => v.lang === 'ru-RU' && v.name.includes('Google')) || voices.find(v => v.lang === 'ru-RU');
    if (russianVoice) {
        utterance.voice = russianVoice;
        // console.log("Using voice:", russianVoice.name);
    } else {
         console.warn("Could not find specific Russian voice.");
    }


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
         console.log("Recognition already active.");
         return;
     }
     if (isBotSpeaking) {
         console.log("Bot is speaking, delaying recognition start.");
         // Optional: could add a check here to start after bot finishes
         return;
     }

    try {
        recognition.start();
        recognitionActive = true;
        console.log("Recognition started");
    } catch (e) {
        console.error("Failed to start recognition:", e);
        recognitionActive = false; // Ensure flag is reset on immediate error

        // Avoid rapid retry loops if start always fails (e.g., permissions)
        // Maybe add a counter or check error type before retrying immediately
        // if (e.name === 'InvalidStateError') { // Often means it's already started or stopped strangely
        //     console.log("Attempting restart after short delay due to InvalidStateError");
        //     setTimeout(() => {
        //         if (microphoneActive && !recognitionActive && !isBotSpeaking) { // Check flags again
        //             startRecognition();
        //         }
        //     }, 500);
        // }
    }
}

// Function to stop recognition safely
function stopRecognition() {
     if (recognition && recognitionActive) {
         try {
             recognition.stop();
             // recognitionActive will be set to false in the 'onend' event
             console.log("Recognition stopped by user request.");
         } catch (e) {
             console.error("Error stopping recognition:", e);
             // Force flag reset if stop fails critically
             recognitionActive = false;
             updateMicButtonState(); // Update UI just in case
         }
     } else {
          console.log("Recognition not active or not initialized, cannot stop.");
     }
}

// Update Mic Button UI
function updateMicButtonState() {
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
        recognition.lang = 'ru-RU';
        recognition.continuous = false; // Important: stops after first pause
        recognition.interimResults = false;
        recognition.maxAlternatives = 1;
        console.log("SpeechRecognition initialized.");

        recognition.onresult = async (event) => {
            const voiceInput = event.results[0][0].transcript.trim();
            console.log("Recognition result received:", voiceInput);

            // Check if the bot is speaking BEFORE processing
            if (isBotSpeaking) {
                console.log("Ignored speech input result while bot was speaking.");
                return; // Ignore result
            }

             if (!voiceInput) {
                 console.log("Empty recognition result.");
                 return; // Ignore empty results
             }

            // Process the valid input
            displayReply(voiceInput, 'user');
            setCharacterState("thinking");

            try {
                const botReply = await sendToWebhook(voiceInput);
                // Check again if bot started speaking *while* waiting for webhook
                if (!isBotSpeaking) {
                    displayReply(botReply, 'bot');
                } else {
                    console.log("Bot started speaking before webhook reply could be displayed/spoken.");
                    // Optional: Queue the reply? Or just drop it? For simplicity, dropping it.
                    setCharacterState("idle"); // Reset state as bot took over
                }
            } catch (error) {
                 console.error("Error getting bot reply from webhook after voice input:", error);
                 // Display error message only if bot isn't speaking
                 if (!isBotSpeaking) {
                      displayReply(error.message || "Sorry, there was an error processing my reply.", 'bot');
                 }
                 setCharacterState('idle'); // Ensure state resets
            }
        };

        recognition.onerror = (event) => {
            console.error("Speech recognition error:", event.error, event.message);
            recognitionActive = false; // Ensure flag is reset on error

            // Automatic restart logic based on error type
             if (event.error === 'network') {
                 console.log("Network error detected, attempting reconnect shortly...");
                 // Simple retry after delay
                 setTimeout(() => {
                     if (microphoneActive && !recognitionActive && !isBotSpeaking) startRecognition();
                 }, 2000); // Delay before retry
             } else if (event.error === 'no-speech') {
                 console.log("No speech detected timeout.");
                 // The 'onend' event will handle restart if microphoneActive is true
             } else if (event.error === 'audio-capture') {
                  console.error("Audio capture failed. Check microphone hardware/permissions.");
                  // Maybe disable mic button / show error state?
                  microphoneActive = false; // Turn off mic state on critical error
                  updateMicButtonState();
                  displayReply("Error: Could not capture audio. Please check microphone.", 'bot');
             } else if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
                  console.error("Speech recognition permission denied or service not allowed.");
                  microphoneActive = false; // Turn off mic state
                  updateMicButtonState();
                  displayReply("Error: Microphone access denied. Please check permissions.", 'bot');
             }
             // Reset UI if microphone was intended to be active but failed critically
             if (!microphoneActive) {
                updateMicButtonState();
             }
        };

        recognition.onend = () => {
            console.log(`Recognition ended. State: {microphoneActive: ${microphoneActive}, recognitionActive: ${recognitionActive}, isBotSpeaking: ${isBotSpeaking}}`);
            const wasActive = recognitionActive; // Capture state before resetting
            recognitionActive = false; // Recognition has stopped

            // Automatically restart if the user still wants the mic on,
            // it wasn't stopped intentionally by the user turning it off,
            // and the bot isn't speaking.
            if (microphoneActive && !isBotSpeaking) {
                 console.log("Restarting recognition due to onend event.");
                 // Use a small delay to prevent immediate restart issues / rapid loops
                 setTimeout(() => {
                    if (microphoneActive && !recognitionActive && !isBotSpeaking) { // Double check state before starting
                        startRecognition();
                    } else {
                         console.log("Conditions changed, not restarting recognition.");
                    }
                 }, 300); // Short delay
             } else if (!microphoneActive && wasActive) {
                  console.log("Recognition ended because microphone was deactivated.");
                  updateMicButtonState(); // Ensure UI is correct
             } else if (isBotSpeaking) {
                  console.log("Recognition ended, not restarting because bot is speaking.");
             }
        };

    } else {
         console.error("Speech Recognition API not supported in this browser.");
         micButton.disabled = true; // Disable button if API not supported
         displayReply("Sorry, voice input is not supported in your browser.", 'bot');
    }
} catch (err) {
    console.error("Error initializing Speech Recognition:", err);
    if (micButton) micButton.disabled = true;
    displayReply("Error initializing voice input.", 'bot');
}


function toggleContinuousListening() {
    microphoneActive = !microphoneActive; // Toggle the desired state
    console.log(`Mic button toggled. microphoneActive state is now: ${microphoneActive}`);

    updateMicButtonState(); // Update UI immediately

    if (microphoneActive) {
        // Request permission if needed / Start recognition
        startRecognition();
    } else {
        // Stop recognition if it's currently active
        stopRecognition();
    }
}

micButton.addEventListener('click', toggleContinuousListening);

// Initial UI setup
updateMicButtonState();