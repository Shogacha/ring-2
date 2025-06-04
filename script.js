import * as THREE from './libs/three.module.js';
import { GLTFLoader } from './libs/GLTFLoader.js';
import { Hands } from 'https://cdn.jsdelivr.net/npm/@mediapipe/hands/hands.js';
import { Camera } from 'https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js';

let camera, scene, renderer, ring;
let video, handLandmarks;
const videoWidth = 640;
const videoHeight = 480;

init();

async function init() {
  await setupCamera();

  // MediaPipe Hands
  const hands = new Hands({
    locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
  });
  hands.setOptions({
    maxNumHands: 1,
    modelComplexity: 1,
    minDetectionConfidence: 0.7,
    minTrackingConfidence: 0.7
  });
  hands.onResults(onResults);

  const cameraMediapipe = new Camera(video, {
    onFrame: async () => await hands.send({ image: video }),
    width: videoWidth,
    height: videoHeight
  });
  cameraMediapipe.start();

  // Three.js
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.01, 10);
  camera.position.z = 2;

  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  document.body.appendChild(renderer.domElement);

  const light = new THREE.HemisphereLight(0xffffff, 0x444444);
  scene.add(light);

  const loader = new GLTFLoader();
  loader.load('ring.glb', (gltf) => {
    console.log("✅ Кольцо загружено");
    ring = gltf.scene;
    ring.scale.set(0.3, 0.3, 0.3);
    ring.rotation.x = Math.PI / 2;
    scene.add(ring);
  });

  window.addEventListener('resize', onWindowResize);

  animate();
}

async function setupCamera() {
  video = document.getElementById('video');
  video.width = videoWidth;
  video.height = videoHeight;

  try {
    console.log("Попытка получить заднюю камеру");
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { exact: "environment" } }
    });
    video.srcObject = stream;
    video.style.transform = "";
    await video.play();
    console.log("Задняя камера включена");
  } catch (err) {
    console.warn("Задняя камера недоступна, пытаемся фронтальную", err);
    try {
      const fallbackStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user" }
      });
      video.srcObject = fallbackStream;
      video.style.transform = "scaleX(-1)";
      await video.play();
      console.log("Фронтальная камера включена");
    } catch (err2) {
      console.error("Камера не доступна", err2);
      alert("Ошибка: не удалось получить доступ к камере");
    }
  }
}

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();

  renderer.setSize(window.innerWidth, window.innerHeight);
}

function onResults(results) {
  if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
    handLandmarks = results.multiHandLandmarks[0];
  } else {
    handLandmarks = null;
  }
}

function animate() {
  requestAnimationFrame(animate);

  if (ring && handLandmarks) {
    const knuckle = handLandmarks[13];

    let x = (knuckle.x - 0.5) * 2;
    let y = -(knuckle.y - 0.5) * 2;

    if (video.style.transform === "scaleX(-1)") {
      x = -x;
    }

    ring.position.lerp(new THREE.Vector3(x * 0.8, y * 0.8 - 0.1, 0), 0.5);
  }

  if (ring) {
    ring.rotation.y += 0.01;
  }

  renderer.render(scene, camera);
}
