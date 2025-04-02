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
    
        // Replace stub texture with video texture
        model.traverse(function(child) {
          if (child.isMesh && child.material && child.material.map) {
            // Check if this material uses the stub texture by name or path
            if (child.material.map.image && child.material.map.image.currentSrc &&
                child.material.map.image.currentSrc.indexOf("face_tex.png") !== -1) {
              child.material.map = idleVideoTexture;
              child.material.needsUpdate = true;
            }
          }
          model.traverse(function(child) {
            if (child.isMesh && child.material && child.material.map) {
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
        });
  },
  undefined,
  function (error) {
    console.error('An error occurred while loading the model:', error);
  }
  
);

// Position the camera
camera.position.set(0, 0, 12);

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
  const response = await fetch("https://n8n-system.onrender.com/webhook-test/chatbot-webhook", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message: userInput,
      sessionId: sessionId  // <- include the same ID
    })
  });

  const data = await response.json();
  return data.reply; // or whatever structure your webhook returns
}