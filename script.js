// Initialize Three.js Scene
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
);
const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// Create multiple shapes with varying sizes and initial positions
const shapes = [];
const createRandomShape = () => {
    const size = Math.random() * 0.5 + 0.3; // Random size between 0.3 and 0.8
    const geometry =
        Math.random() > 0.5
            ? new THREE.SphereGeometry(size, 16, 16)
            : new THREE.BoxGeometry(size, size, size);
    const material = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const shape = new THREE.Mesh(geometry, material);

    shape.position.set(
        (Math.random() - 0.5) * 10, // Random position between -5 and 5
        (Math.random() - 0.5) * 10,
        (Math.random() - 0.5) * 10
    );

    shape.userData = {
        velocity: new THREE.Vector3(
            (Math.random() - 0.5) * 0.05, // Random velocity
            (Math.random() - 0.5) * 0.05,
            (Math.random() - 0.5) * 0.05
        ),
    };

    scene.add(shape);
    shapes.push(shape);
};

// Create 20 shapes
for (let i = 0; i < 20; i++) createRandomShape();

camera.position.z = 10;

// Initialize Essentia.js
let essentia;

(async () => {
    try {
        const EssentiaWASM = await EssentiaModule({
            wasm_url: "libs/essentia-wasm.web.wasm",
        });

        essentia = new Essentia(EssentiaWASM);

        if (essentia) {
            console.log("Essentia.js is initialized and ready!");
        } else {
            console.error("Failed to initialize Essentia.js: Instance is undefined.");
        }
    } catch (error) {
        console.error("Error initializing Essentia.js:", error);
    }
})();

// Audio setup
const audio = document.getElementById('audio');
const audioContext = new (window.AudioContext || window.webkitAudioContext)();
const analyser = audioContext.createAnalyser();
analyser.fftSize = 256;
const dataArray = new Uint8Array(analyser.frequencyBinCount);

// Connect audio source to the analyser
const source = audioContext.createMediaElementSource(audio);
source.connect(analyser);
analyser.connect(audioContext.destination);

// Ensure AudioContext resumes on user interaction
window.addEventListener('click', () => {
    if (audioContext.state === 'suspended') {
        audioContext.resume().then(() => {
            console.log('AudioContext resumed successfully.');
        });
    }
});

// Resume audio context when play is clicked
audio.addEventListener('play', () => {
    if (audioContext.state === 'suspended') {
        audioContext.resume().then(() => {
            console.log('AudioContext resumed on play.');
        });
    }
});

// Mood detection logic
let currentMood = "neutral";

async function detectMood() {
    if (!essentia) return;

    try {
        analyser.getByteFrequencyData(dataArray);
        const audioFeatures = Array.from(dataArray);
        const featureVector = essentia.arrayToVector(new Float32Array(audioFeatures));
        const loudness = essentia.Loudness(featureVector).value;

        if (loudness < 0.5) {
            currentMood = "calm";
        } else if (loudness < 1) {
            currentMood = "sad";
        } else {
            currentMood = "energetic";
        }

        console.log("Detected Mood:", currentMood);
    } catch (error) {
        console.error("Error in mood detection:", error);
    }
}

// Update mood periodically
setInterval(() => {
    detectMood();
}, 5000);

// Animate the scene
function animate() {
    requestAnimationFrame(animate);

    analyser.getByteFrequencyData(dataArray);
    const bass = dataArray.slice(0, 10).reduce((a, b) => a + b, 0) / 10;
    const normalizedBass = Math.min(bass / 150, 2);

    // Update shapes' positions and behavior
    shapes.forEach((shape) => {
        // Update position
        shape.position.add(shape.userData.velocity);

        // Bounce back if the shape hits the bounds
        ['x', 'y', 'z'].forEach((axis) => {
            if (Math.abs(shape.position[axis]) > 5) {
                shape.userData.velocity[axis] *= -1; // Reverse direction
            }
        });

        // Change scale and rotation based on audio data
        shape.scale.set(
            1 + normalizedBass,
            1 + normalizedBass,
            1 + normalizedBass
        );
        shape.rotation.x += normalizedBass * 0.02;
        shape.rotation.y += normalizedBass * 0.02;

        // Change color based on mood
        switch (currentMood) {
            case "calm":
                shape.material.color.set(0x00ffff); // Cyan
                break;
            case "sad":
                shape.material.color.set(0x0000ff); // Blue
                break;
            case "energetic":
                shape.material.color.set(0xff0000); // Red
                break;
            default:
                shape.material.color.set(0xffffff); // White
                break;
        }
    });

    renderer.render(scene, camera);
}

// Start the animation loop
animate();

// Handle window resizing
window.addEventListener('resize', () => {
    renderer.setSize(window.innerWidth, window.innerHeight);
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
});