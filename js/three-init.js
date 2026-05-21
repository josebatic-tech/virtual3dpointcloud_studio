import * as THREE from 'three';
import { get, set, setRef, ref } from './store.js';
import { DOM } from './constants.js';
import { startRenderLoop } from './render-loop.js';

export function initThree() {
  console.log('initThree called');
  const canvas = document.getElementById(DOM.PC_CANVAS);
  console.log('canvas:', canvas?.clientWidth, 'x', canvas?.clientHeight);

  const sc = new THREE.Scene();
  const cam = new THREE.PerspectiveCamera(55, canvas.clientWidth / canvas.clientHeight, 0.01, 200);
  cam.position.set(0, 0, 3);

  const ren = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false });
  ren.setPixelRatio(Math.min(devicePixelRatio, 2));
  ren.setSize(canvas.clientWidth, canvas.clientHeight);
  ren.setClearColor(0x080a0e, 1);

  setRef('scene', sc);
  setRef('camera', cam);
  setRef('renderer', ren);

  new ResizeObserver(() => {
    ren.setSize(canvas.clientWidth, canvas.clientHeight);
    cam.aspect = canvas.clientWidth / canvas.clientHeight;
    cam.updateProjectionMatrix();
  }).observe(canvas);

  setRef('rotX', 0.1);
  setRef('rotY', 0);
  setRef('isDragging', false);
  setRef('lastX', 0);
  setRef('lastY', 0);
  setRef('targetFOV', 55);
  setRef('cameraVelocity', { x: 0, y: 0, z: 0 });

  _initInteraction(canvas);
  startRenderLoop();
}

function _initInteraction(canvas) {
  canvas.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return;
    setRef('isDragging', true);
    setRef('lastX', e.clientX);
    setRef('lastY', e.clientY);
  });

  window.addEventListener('mouseup', () => setRef('isDragging', false));

  canvas.addEventListener('mousemove', (e) => {
    if (get('relightOn')) {
      const dot = document.getElementById(DOM.LIGHT_DOT);
      const rect = canvas.getBoundingClientRect();
      dot.style.left = e.clientX - rect.left + 'px';
      dot.style.top = e.clientY - rect.top + 'px';
      const nx = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const ny = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      set('lightPos', { x: nx * 3, y: ny * 2, z: 2.5 });
    }

    if (!ref('isDragging')) return;
    setRef('rotY', ref('rotY') + (e.clientX - ref('lastX')) * 0.005);
    setRef('rotX', ref('rotX') + (e.clientY - ref('lastY')) * 0.005);
    setRef('lastX', e.clientX);
    setRef('lastY', e.clientY);
  });

  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const cam = ref('camera');
    const currentFOV = cam.fov;
    const newFOV = Math.max(20, Math.min(100, currentFOV + e.deltaY * 0.05));
    setRef('targetFOV', newFOV);
  }, { passive: false });

  // Keyboard controls for camera movement
  const keys = {};
  window.addEventListener('keydown', (e) => {
    keys[e.key.toLowerCase()] = true;
  });
  window.addEventListener('keyup', (e) => {
    keys[e.key.toLowerCase()] = false;
  });

  setRef('keys', keys);

  let tx = 0, ty = 0, pinchDist = 0;
  canvas.addEventListener('touchstart', (e) => {
    if (e.touches.length === 1) { tx = e.touches[0].clientX; ty = e.touches[0].clientY; }
    if (e.touches.length === 2) {
      pinchDist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY,
      );
    }
  });

  canvas.addEventListener('touchmove', (e) => {
    e.preventDefault();
    if (e.touches.length === 1) {
      setRef('rotY', ref('rotY') + (e.touches[0].clientX - tx) * 0.005);
      setRef('rotX', ref('rotX') + (e.touches[0].clientY - ty) * 0.005);
      tx = e.touches[0].clientX;
      ty = e.touches[0].clientY;
    }
    if (e.touches.length === 2) {
      const d = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY,
      );
      const cam = ref('camera');
      cam.position.z = Math.max(0.5, Math.min(12, cam.position.z - (d - pinchDist) * 0.008));
      pinchDist = d;
    }
  }, { passive: false });
}
