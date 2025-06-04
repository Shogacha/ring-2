import * as THREE from './libs/three.module.js';
import { GLTFLoader } from './libs/GLTFLoader.js';
import { Hands } from 'https://cdn.jsdelivr.net/npm/@mediapipe/hands/hands.js';
import { Camera } from 'https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js';

let camera, scene, renderer, ring;
let video, handLandmarks;
let videoWidth = 640;
let videoHeight = 480;

init();

async function init() {
  video = document.getElementById('video');
  video.width = videoWidth;
  video.height = videoHeight;

  // Запрос камеры - сначала задняя, если нет - фронтальная
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { exact: "environment" } }
    });
    video.srcObject = stream;
    video.style.transform = ""; // задняя камера - без зеркала
  } catch (err) {
    const fallbackStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "user" }
    });
    video.srcObject = fallbackStream;
    video.style.transform = "scaleX(-1)"; // фронтальная - зеркалим
  }

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
    onFrame: async () => {
      await hands.send({ image: video });
    },
    width: videoWidth,
    height: videoHeight
  });

  cameraMediapipe.start();

  // Three.js сцена
  scene = new THREE.Scene();

  // Камера с перспективой, близко к видео по соотношению сторон
  camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.01, 10);
  camera.position.z = 2; // Подальше, чтобы видеть кольцо

  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  document.body.appendChild(renderer.domElement);

  const light = new THREE.HemisphereLight(0xffffff, 0x444444);
  scene.add(light);

  // Загружаем кольцо
  const loader = new GLTFLoader();
  loader.load('ring.glb', (gltf) => {
    console.log("✅ Кольцо загружено");
    ring = gltf.scene;
    ring.scale.set(0.3, 0.3, 0.3); // подогнал масштаб под видимость
    ring.rotation.x = Math.PI / 2; // чтобы было "на пальце"

    scene.add(ring);
  });

  window.addEventListener('resize', onWindowResize);

  animate();
}

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();

  renderer.setSize(window.innerWidth, window.innerHeight);
}

function onResults(results) {
  if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
    handLandmarks = results.multiHandLandmarks[0];
    // console.log("Рука найдена", handLandmarks);
  } else {
    handLandmarks = null;
    // console.log("Рука не найдена");
  }
}

function animate() {
  requestAnimationFrame(animate);

  if (ring && handLandmarks) {
    // Возьмём, например, средний фаланговый сустав пальца безымянного (landmark 13)
    const knuckle = handLandmarks[13];

    // MediaPipe даёт координаты от 0 до 1: (0,0) - левый верхний угол камеры
    // Преобразуем их в координаты Three.js так, чтобы центр камеры был (0,0)
    // При этом y нужно инвертировать (в Three y вверх)
    let x = (knuckle.x - 0.5) * 2; // [-1..1]
    let y = -(knuckle.y - 0.5) * 2; // [-1..1]

    // Если камера фронтальная - зеркалим x, чтобы кольцо двигалось правильно
    if (video.style.transform === "scaleX(-1)") {
      x = -x;
    }

    // Задаём позицию кольца с небольшой глубиной впереди камеры
    ring.position.set(x * 0.8, y * 0.8 - 0.1, 0);

    // Можно добавить плавное следование
    ring.position.lerp(new THREE.Vector3(x * 0.8, y * 0.8 - 0.1, 0), 0.5);
  }

  if (ring) {
    ring.rotation.y += 0.01;
  }

  renderer.render(scene, camera);
}
