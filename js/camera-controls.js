import { ref, get, set } from './store.js';

const cameraPresets = {
  orbit: {
    name: 'Orbit',
    autoRotate: true,
    speed: 0.002,
  },
  stationary: {
    name: 'Stationary',
    autoRotate: false,
    speed: 0,
  },
  cinematic: {
    name: 'Cinematic',
    autoRotate: true,
    speed: 0.0008,
  },
};

export function setCameraMovementMode(mode) {
  const config = cameraPresets[mode];
  if (!config) return;

  set('autoRotate', config.autoRotate);
  set('cameraMovementMode', mode);
  set('cameraRotationSpeed', config.speed);

  // Update button states
  document.getElementById('btnCamOrbit')?.classList.toggle('active', mode === 'orbit');
  document.getElementById('btnCamStationary')?.classList.toggle('active', mode === 'stationary');
  document.getElementById('btnCamCinematic')?.classList.toggle('active', mode === 'cinematic');

  console.log(`Camera mode: ${config.name}`);
}

export function setCameraRotationSpeed(speed) {
  set('cameraRotationSpeed', speed);
}

export function smoothCameraTransition(targetPos, targetRotation = null, duration = 1000) {
  const camera = ref('camera');
  if (!camera) return;

  const startPos = { ...camera.position };
  const startTime = Date.now();

  const animate = () => {
    const elapsed = Date.now() - startTime;
    const progress = Math.min(elapsed / duration, 1);

    camera.position.x = startPos.x + (targetPos.x - startPos.x) * easeInOutQuad(progress);
    camera.position.y = startPos.y + (targetPos.y - startPos.y) * easeInOutQuad(progress);
    camera.position.z = startPos.z + (targetPos.z - startPos.z) * easeInOutQuad(progress);

    if (progress < 1) {
      requestAnimationFrame(animate);
    }
  };

  animate();
}

export function focusOnObject(targetWorldPos = null, distance = 3) {
  const camera = ref('camera');
  if (!camera) return;

  const target = targetWorldPos || { x: 0, y: 0.5, z: 0 };

  // Calculate camera position orbiting around target
  const angle = Math.atan2(camera.position.z - target.z, camera.position.x - target.x);
  const newPos = {
    x: target.x + Math.cos(angle) * distance,
    y: target.y + 0.5,
    z: target.z + Math.sin(angle) * distance,
  };

  smoothCameraTransition(newPos, target, 800);
}

export function dollyCamera(direction, speed = 0.1) {
  const camera = ref('camera');
  if (!camera) return;

  const distance = Math.sqrt(
    camera.position.x ** 2 +
    camera.position.y ** 2 +
    camera.position.z ** 2
  );

  const newDistance = Math.max(0.5, Math.min(12, distance - direction * speed));
  const scale = newDistance / distance;

  camera.position.multiplyScalar(scale);
}

export function panCamera(x, y, speed = 0.05) {
  const camera = ref('camera');
  if (!camera) return;

  camera.position.x += x * speed;
  camera.position.y += y * speed;
}

function easeInOutQuad(t) {
  return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
}

export function enableFreeLook() {
  set('freeLookEnabled', true);
  set('autoRotate', false);
}

export function disableFreeLook() {
  set('freeLookEnabled', false);
}
