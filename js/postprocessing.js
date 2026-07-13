import { set, ref } from './store.js';

/**
 * Post-processing was removed per simplification (see CLAUDE.md).
 * This module keeps the render entry point and no-op toggles so the
 * rest of the app doesn't need to know.
 */

export function initPostProcessing() {
  set('fxaaEnabled', false);
}

export function renderWithPostProcessing() {
  const renderer = ref('renderer');
  const scene = ref('scene');
  const camera = ref('camera');
  if (renderer && scene && camera) {
    renderer.clear();
    renderer.render(scene, camera);
  }
}

export function toggleFXAA(enabled) {
  set('fxaaEnabled', !!enabled);
}
