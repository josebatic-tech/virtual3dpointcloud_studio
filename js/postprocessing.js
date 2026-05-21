import * as THREE from 'three';
import { get, set, ref, setRef } from './store.js';

let composer, effectFXAA;

export function initPostProcessing() {
  const renderer = ref('renderer');
  const scene = ref('scene');
  const camera = ref('camera');
  const canvas = document.getElementById('pcCanvas');

  if (!renderer || !scene || !camera) return;

  composer = new THREE.EffectComposer(renderer);
  const renderPass = new THREE.RenderPass(scene, camera);
  composer.addPass(renderPass);

  // Simple FXAA for edge smoothing
  effectFXAA = new THREE.ShaderPass(THREE.FXAAShader);
  effectFXAA.uniforms['resolution'].value.set(1 / canvas.clientWidth, 1 / canvas.clientHeight);
  effectFXAA.enabled = false;
  composer.addPass(effectFXAA);

  const outputPass = new THREE.OutputPass();
  composer.addPass(outputPass);

  setRef('effectComposer', composer);
  set('fxaaEnabled', false);

  window.addEventListener('resize', () => {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    composer.setSize(w, h);
    if (effectFXAA) {
      effectFXAA.uniforms['resolution'].value.set(1 / w, 1 / h);
    }
  });

  console.log('Post-processing initialized');
}

export function renderWithPostProcessing() {
  const composer = ref('effectComposer');
  if (composer) {
    composer.render();
  } else {
    ref('renderer').render(ref('scene'), ref('camera'));
  }
}

export function toggleFXAA(enabled) {
  if (effectFXAA) effectFXAA.enabled = enabled;
  set('fxaaEnabled', enabled);
}
