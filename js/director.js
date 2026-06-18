import { get, set, ref } from './store.js';
import { setEnv, setBackgroundColor } from './environment.js';
import { createParticleSystem, removeParticles, setParticleIntensity } from './particles.js';
import { toggleFXAA } from './postprocessing.js';

export function initDirectorTools() {
  // Camera position buttons
  document.getElementById('btnCamLeft')?.addEventListener('click', () => setCameraPosition(-45));
  document.getElementById('btnCamRight')?.addEventListener('click', () => setCameraPosition(45));

  // Background color buttons
  document.getElementById('btnBgGreen')?.addEventListener('click', () => setColorBackground('green'));
  document.getElementById('btnBgBlue')?.addEventListener('click', () => setColorBackground('blue'));
  document.getElementById('btnBgRed')?.addEventListener('click', () => setColorBackground('red'));
  document.getElementById('btnBgYellow')?.addEventListener('click', () => setColorBackground('yellow'));

  // Particle effect buttons
  document.getElementById('btnParticleRain')?.addEventListener('click', () => toggleParticles('rain'));
  document.getElementById('btnParticleSnow')?.addEventListener('click', () => toggleParticles('snow'));
  document.getElementById('btnParticleWind')?.addEventListener('click', () => toggleParticles('wind'));

  // Initialize defaults
  set('particleType', null);
  set('backgroundColor', 0x080a0e);
}

export function setCameraPosition(angle) {
  const cam = ref('camera');
  if (!cam) return;

  const rad = (angle * Math.PI) / 180;
  const distance = 3;
  cam.position.x = Math.sin(rad) * distance;
  cam.position.z = Math.cos(rad) * distance;
  cam.lookAt(0, 0.5, 0);

  document.getElementById('btnCamLeft')?.classList.toggle('active', angle < 0);
  document.getElementById('btnCamRight')?.classList.toggle('active', angle > 0);

  console.log(`Camera position: ${angle}°`);
}

export function setColorBackground(color) {
  const colors = {
    green: 0x1a5f3f,
    blue: 0x0d3b66,
    red: 0x6b1a23,
    yellow: 0x8b7b2f,
  };

  const renderer = ref('renderer');
  const scene = ref('scene');

  if (renderer && colors[color]) {
    renderer.setClearColor(colors[color], 1);
    set('backgroundColor', colors[color]);

    // Also update backdrop if it exists
    const backdrop = ref('colorBackdrop');
    if (backdrop && backdrop.material) {
      backdrop.material.color.setHex(colors[color]);
    }
  }

  // Update button states
  document.getElementById('btnBgGreen')?.classList.toggle('active', color === 'green');
  document.getElementById('btnBgBlue')?.classList.toggle('active', color === 'blue');
  document.getElementById('btnBgRed')?.classList.toggle('active', color === 'red');
  document.getElementById('btnBgYellow')?.classList.toggle('active', color === 'yellow');

  console.log(`Background color: ${color}`);
}

export function toggleParticles(type) {
  const currentType = get('particleType');

  if (currentType === type) {
    removeParticles();
  } else {
    const count = get('particleCount') || 2000;
    createParticleSystem(type, count);
  }

  // Update button states
  document.getElementById('btnParticleRain')?.classList.toggle('active', get('particleType') === 'rain');
  document.getElementById('btnParticleSnow')?.classList.toggle('active', get('particleType') === 'snow');
  document.getElementById('btnParticleWind')?.classList.toggle('active', get('particleType') === 'wind');

  console.log(`Particle effect: ${get('particleType') || 'none'}`);
}
