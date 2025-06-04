import * as THREE from './libs/three.module.js';
import { GLTFLoader } from './libs/GLTFLoader.js';

let camera, scene, renderer, ring;
let video, handLandmarks;

init();

async function init() {
  video = document.getElementById('video');

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { exact: "environment" } }
    });
    video.srcObject = stream;
  } catch (err) {
    const fallbackStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "user" }
    });
    video.srcObject = fallbackStream;
    video.style.transform = "scaleX(-1)";
  }

  // MediaPipe
  const hands = new Hands({ locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}` });
  hands.setOptions({
    maxNumHands: 1,
    modelComplexity: 1,
    minDetectionConfidence: 0.7,
    minTrackingConfidence: 0.7
  });
  hands.onResults(onResults);

  const cameraMediapipe = new Camera(video, {
    onFrame: async () => await hands.send({ image: video }),
    width: 640,
    height: 480
  });
  cameraMediapipe.start();

  // Three.js
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.01, 100);
  camera.position.z = 1;

  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  document.body.appendChild(renderer.domElement);

  const light = new THREE.HemisphereLight(0xffffff, 0x444444);
  scene.add(light);

  const loader = new GLTFLoader();
  loader.load('ring.glb', (gltf) => {
    ring = gltf.scene;
    ring.scale.set(0.05, 0.05, 0.05);
    scene.add(ring);
  }, undefined, (error) => {
    console.error('Ошибка загрузки кольца:', error);
  });

  animate();
}

function onResults(results) {
  if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
    handLandmarks = results.multiHandLandmarks[0];
    // console.log("Координаты руки:", handLandmarks);
  } else {
    handLandmarks = null;
  }
}

function animate() {
  requestAnimationFrame(animate);

  if (ring && handLandmarks) {
    const knuckle = handLandmarks[13]; // Средний палец, первая фаланга

    const x = (knuckle.x - 0.5) * camera.aspect * 2;
    const y = -(knuckle.y - 0.5) * 2;
    const z = -0.5 + knuckle.z * 0.5; // Учитываем глубину

    ring.position.set(x, y, z);
    ring.rotation.x = Math.PI / 2;
    ring.rotation.y += 0.01;
  }

  renderer.render(scene, camera);
}
