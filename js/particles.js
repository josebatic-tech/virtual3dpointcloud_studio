import * as THREE from 'three';
import { get, set, ref, setRef } from './store.js';

let particleSystem = null;
let particleGeometry = null;
let particleMaterial = null;

const particleConfigs = {
  rain: {
    count: 2000,
    color: 0x8899ff,
    size: 0.05,
    speed: 0.15,
    spread: 15,
    opacity: 0.6,
  },
  snow: {
    count: 1000,
    color: 0xffffff,
    size: 0.15,
    speed: 0.03,
    spread: 20,
    opacity: 0.8,
  },
  wind: {
    count: 500,
    color: 0xccddff,
    size: 0.1,
    speed: 0.08,
    spread: 25,
    opacity: 0.4,
  },
};

export function createParticleSystem(type = 'rain', customCount = null) {
  const scene = ref('scene');
  if (!scene) return;

  // Remove existing particles
  if (particleSystem) {
    scene.remove(particleSystem);
  }

  let config = { ...particleConfigs[type] } || { ...particleConfigs.rain };
  if (customCount) {
    config.count = customCount;
  }

  particleGeometry = new THREE.BufferGeometry();
  const positions = new Float32Array(config.count * 3);
  const velocities = new Float32Array(config.count * 3);

  for (let i = 0; i < config.count; i++) {
    positions[i * 3] = (Math.random() - 0.5) * config.spread;
    positions[i * 3 + 1] = Math.random() * 10;
    positions[i * 3 + 2] = (Math.random() - 0.5) * config.spread;

    velocities[i * 3] = (Math.random() - 0.5) * 0.5; // wind
    velocities[i * 3 + 1] = -config.speed;
    velocities[i * 3 + 2] = (Math.random() - 0.5) * 0.3;
  }

  particleGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  particleGeometry.setAttribute('velocity', new THREE.BufferAttribute(velocities, 3));

  particleMaterial = new THREE.PointsMaterial({
    color: config.color,
    size: config.size,
    transparent: true,
    opacity: config.opacity,
    sizeAttenuation: true,
  });

  particleSystem = new THREE.Points(particleGeometry, particleMaterial);
  scene.add(particleSystem);

  set('particleType', type);
  set('particleConfig', config);
  setRef('particleSystem', particleSystem);
}

export function updateParticles() {
  if (!particleSystem || !particleGeometry) return;

  const positions = particleGeometry.attributes.position.array;
  const velocities = particleGeometry.attributes.velocity.array;
  const config = get('particleConfig');

  for (let i = 0; i < positions.length; i += 3) {
    positions[i] += velocities[i] * 0.1; // x
    positions[i + 1] += velocities[i + 1] * 0.1; // y
    positions[i + 2] += velocities[i + 2] * 0.1; // z

    // Wrap around
    if (positions[i + 1] < -2) {
      positions[i + 1] = 10;
    }
    if (Math.abs(positions[i]) > config.spread / 2) {
      positions[i] = -positions[i];
    }
    if (Math.abs(positions[i + 2]) > config.spread / 2) {
      positions[i + 2] = -positions[i + 2];
    }
  }

  particleGeometry.attributes.position.needsUpdate = true;
}

export function removeParticles() {
  const scene = ref('scene');
  if (particleSystem && scene) {
    scene.remove(particleSystem);
  }
  particleSystem = null;
  particleGeometry = null;
  set('particleType', null);
}

export function setParticleIntensity(intensity) {
  if (particleMaterial) {
    particleMaterial.opacity = Math.max(0, Math.min(1, intensity));
  }
  set('particleIntensity', intensity);
}
