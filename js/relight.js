import * as THREE from 'three';
import { get, ref } from './store.js';

export function updateRelight() {
  const points = ref('points');
  const posAttr = ref('posAttr');
  const colorAttr = ref('colorAttr');
  if (!points || !posAttr || !colorAttr) return;

  const pos = posAttr.array;
  const col = colorAttr.array;
  const n = points.geometry.drawRange.count;
  const lp = get('lightPos');
  const li = get('lightIntensity');
  const lc = new THREE.Color(get('lightColor'));

  for (let i = 0; i < n; i++) {
    const dx = lp.x - pos[i * 3];
    const dy = lp.y - pos[i * 3 + 1];
    const dz = lp.z - pos[i * 3 + 2];
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz) + 0.001;
    const falloff = Math.min(1, li / (dist * dist * 0.6));
    const shade = 0.25 + 0.75 * falloff;

    col[i * 3]     = Math.min(1, col[i * 3]     * shade * lc.r * 2);
    col[i * 3 + 1] = Math.min(1, col[i * 3 + 1] * shade * lc.g * 2);
    col[i * 3 + 2] = Math.min(1, col[i * 3 + 2] * shade * lc.b * 2);
  }

  colorAttr.needsUpdate = true;
}
