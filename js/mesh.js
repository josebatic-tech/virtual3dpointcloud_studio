import * as THREE from 'three';
import { get, ref, setRef } from './store.js';
import { DEFAULTS, DOM } from './constants.js';
import { getMaskBuffer } from './sam.js';
import { updateRelight } from './relight.js';

let _scene = null;
let _mesh = null;
let _posAttr = null;
let _colorAttr = null;
let _normalAttr = null;
let _indices = null;
let _W = 0;
let _H = 0;

export function rebuildGeometry() {
  _scene = ref('scene');
  if (!_scene) return;

  const video = document.getElementById(DOM.VIDEO);
  const vw = video.videoWidth || DEFAULTS.VIDEO_WIDTH;
  const vh = video.videoHeight || DEFAULTS.VIDEO_HEIGHT;
  _W = Math.floor(vw / get('density'));
  _H = Math.floor(vh / get('density'));

  const geo = new THREE.BufferGeometry();
  _posAttr = new THREE.BufferAttribute(new Float32Array(_W * _H * 3), 3);
  _colorAttr = new THREE.BufferAttribute(new Float32Array(_W * _H * 3), 3);
  _normalAttr = new THREE.BufferAttribute(new Float32Array(_W * _H * 3), 3);

  _posAttr.setUsage(THREE.DynamicDrawUsage);
  _colorAttr.setUsage(THREE.DynamicDrawUsage);
  _normalAttr.setUsage(THREE.DynamicDrawUsage);

  geo.setAttribute('position', _posAttr);
  geo.setAttribute('color', _colorAttr);
  geo.setAttribute('normal', _normalAttr);

  // Build indices for triangles
  const indexArray = new Uint32Array((_W - 1) * (_H - 1) * 6);
  let idx = 0;
  for (let y = 0; y < _H - 1; y++) {
    for (let x = 0; x < _W - 1; x++) {
      const a = y * _W + x;
      const b = y * _W + x + 1;
      const c = (y + 1) * _W + x;
      const d = (y + 1) * _W + x + 1;

      // Two triangles per quad
      indexArray[idx++] = a;
      indexArray[idx++] = c;
      indexArray[idx++] = b;

      indexArray[idx++] = b;
      indexArray[idx++] = c;
      indexArray[idx++] = d;
    }
  }
  _indices = new THREE.BufferAttribute(indexArray, 1);
  geo.setIndex(_indices);

  geo.computeVertexNormals();
  geo.normalizeNormals();

  const mat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    side: THREE.DoubleSide,
    wireframe: false,
    metalness: 0.15,
    roughness: 0.5,
    emissive: 0x0a0a0a,
    envMapIntensity: 1.0,
  });

  if (_mesh) _scene.remove(_mesh);
  _mesh = new THREE.Mesh(geo, mat);
  _scene.add(_mesh);
  setRef('mesh', _mesh);
}

function calculateNormals() {
  if (!_mesh) return;
  const geo = _mesh.geometry;
  if (geo) {
    geo.computeVertexNormals();
  }
}

export function writeDepthFrame(depthFlat, dW, dH, videoFrame) {
  if (!_posAttr || !_colorAttr || !_mesh) return;

  const video = document.getElementById(DOM.VIDEO);
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  const W = Math.floor(vw / get('density'));
  const H = Math.floor(vh / get('density'));
  const aspect = vw / vh;

  const pos = _posAttr.array;
  const col = _colorAttr.array;

  const maskBuffer = get('samEnabled') && get('samMasks') ? getMaskBuffer(W, H) : null;
  const scale = get('depthScale');

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      const dy = Math.floor((y / H) * dH);
      const dx = Math.floor((x / W) * dW);
      const v = depthFlat[dy * dW + dx];
      const di = i * 4;

      pos[i * 3]     = ((x / W) - 0.5) * 2 * aspect;
      pos[i * 3 + 1] = -((y / H) - 0.5) * 2;
      pos[i * 3 + 2] = (v - 0.5) * scale;

      col[i * 3]     = videoFrame[di]     / 255;
      col[i * 3 + 1] = videoFrame[di + 1] / 255;
      col[i * 3 + 2] = videoFrame[di + 2] / 255;

      if (maskBuffer && maskBuffer[i] === 0) {
        const opacity = get('samOpacity');
        col[i * 3]     *= opacity;
        col[i * 3 + 1] *= opacity;
        col[i * 3 + 2] *= opacity;
      }
    }
  }

  calculateNormals();
  _posAttr.needsUpdate = true;
  _colorAttr.needsUpdate = true;

  if (get('relightOn')) updateRelight();
}

export function getMesh() {
  return _mesh;
}
