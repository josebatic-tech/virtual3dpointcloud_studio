import { get, set, ref, setRef } from './store.js';
import { updateParticles } from './particles.js';
import { renderWithPostProcessing } from './postprocessing.js';

export function startRenderLoop() {
  let frameCount = 0;
  const isMobile = /iPhone|iPad|Android/i.test(navigator.userAgent);
  const FPS_CAP = isMobile ? 10 : 40;
  const frameTime = 1000 / FPS_CAP;
  let lastFrameTime = performance.now();

  if (isMobile) console.log('📱 Mobile mode: 10fps rendering');

  function loop() {
    requestAnimationFrame(loop);
    const now = performance.now();
    const dt = now - lastFrameTime;

    if (dt < frameTime) return;
    lastFrameTime = now - (dt - frameTime);
    frameCount++;
    if (frameCount <= 5) console.log('render frame', frameCount, 'renderer:', !!ref('renderer'), 'scene:', !!ref('scene'), 'camera:', !!ref('camera'));

    const cam = ref('camera');
    const keys = ref('keys');

    // Smooth FOV interpolation (lens zoom)
    if (cam) {
      const targetFOV = ref('targetFOV');
      const currentFOV = cam.fov;
      if (Math.abs(targetFOV - currentFOV) > 0.1) {
        cam.fov += (targetFOV - currentFOV) * 0.1;
        cam.updateProjectionMatrix();
      }
    }

    // Keyboard camera movement (arrow keys)
    if (keys && cam) {
      const speed = get('camSpeed') || 0.08;
      const velocity = ref('cameraVelocity');

      if (keys['arrowup'] || keys['w']) velocity.y += speed;
      if (keys['arrowdown'] || keys['s']) velocity.y -= speed;
      if (keys['arrowleft'] || keys['a']) velocity.x -= speed;
      if (keys['arrowright'] || keys['d']) velocity.x += speed;

      // Apply velocity with damping
      cam.position.x += velocity.x;
      cam.position.y += velocity.y;
      velocity.x *= 0.85;
      velocity.y *= 0.85;
      if (Math.abs(velocity.x) < 0.001) velocity.x = 0;
      if (Math.abs(velocity.y) < 0.001) velocity.y = 0;
    }

    if (get('autoRotate')) {
      const rotationSpeed = get('cameraRotationSpeed') || 0.003;
      setRef('rotY', ref('rotY') + rotationSpeed);
    }

    const points = ref('points');
    if (points) {
      points.rotation.x = ref('rotX');
      points.rotation.y = ref('rotY');
    }

    const mesh = ref('mesh');
    if (mesh) {
      mesh.rotation.x = ref('rotX');
      mesh.rotation.y = ref('rotY');
    }

    const grid = ref('grid');
    const floor = ref('floorMesh');
    const sphere = ref('ambientSphere');

    if (grid) { grid.rotation.x = ref('rotX'); grid.rotation.y = ref('rotY'); }
    if (floor) { floor.rotation.x = ref('rotX'); floor.rotation.y = ref('rotY'); }
    if (sphere) sphere.rotation.y += 0.004;

    // Update particles
    if (get('particleType')) {
      updateParticles();
    }

    // Render with post-processing
    renderWithPostProcessing();
  }

  loop();
}
