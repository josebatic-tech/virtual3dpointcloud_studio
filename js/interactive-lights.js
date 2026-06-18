import * as THREE from 'three';
import { get, set, ref, setRef } from './store.js';

let _dirLight = null;
let _ambLight = null;
let _lightHelper = null;

export function initInteractiveLights() {
  const scene = ref('scene');
  if (!scene) return;

  _dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
  _dirLight.position.set(3, 2, 2);
  _dirLight.castShadow = false;
  scene.add(_dirLight);
  setRef('dirLight', _dirLight);

  _ambLight = new THREE.AmbientLight(0xffffff, 0.5);
  scene.add(_ambLight);
  setRef('ambLight', _ambLight);

  const fillLight = new THREE.DirectionalLight(0x87ceeb, 0.3);
  fillLight.position.set(-3, 1, 2);
  scene.add(fillLight);

  const backLight = new THREE.DirectionalLight(0xffffff, 0.4);
  backLight.position.set(0, 2, -3);
  scene.add(backLight);

  set('lightIntensity', 1);
  set('lightAmbience', 0.5);
  set('lightColor', '#ffffff');
  set('interactiveLightMode', false);
}

export function updateLightPosition(nx, ny) {
  if (!_dirLight) return;
  _dirLight.position.set(nx * 5, ny * 4, 3);
  _dirLight.target.position.set(0, 0, 0);
  _dirLight.target.updateMatrixWorld();
}

export function setLightIntensity(intensity) {
  if (!_dirLight) return;
  _dirLight.intensity = Math.max(0.1, intensity * 1.2);
}

export function setAmbientIntensity(intensity) {
  if (!_ambLight) return;
  _ambLight.intensity = intensity;
}

export function setLightColor(hexColor) {
  if (!_dirLight) return;
  _dirLight.color.setStyle(hexColor);
}

export function toggleInteractiveMode(enabled) {
  set('interactiveLightMode', enabled);
  const canvas = document.getElementById('pcCanvas');
  if (canvas) {
    canvas.style.cursor = enabled ? 'crosshair' : 'auto';
  }
}
