import * as THREE from 'three';
import { get, ref, setRef } from './store.js';
import { DEFAULTS, DOM } from './constants.js';
import { getMaskBuffer } from './sam.js';
import { updateRelight } from './relight.js';

let _scene = null;
let _points = null;
let _posAttr = null;
let _colorAttr = null;

export function rebuildGeometry() {
  _scene = ref('scene');
  if (!_scene) return;

  const video = document.getElementById(DOM.VIDEO);
  const vw = video.videoWidth || DEFAULTS.VIDEO_WIDTH;
  const vh = video.videoHeight || DEFAULTS.VIDEO_HEIGHT;
  const W = Math.floor(vw / get('density'));
  const H = Math.floor(vh / get('density'));

  const geo = new THREE.BufferGeometry();
  _posAttr = new THREE.BufferAttribute(new Float32Array(W * H * 3), 3);
  _colorAttr = new THREE.BufferAttribute(new Float32Array(W * H * 3), 3);
  _posAttr.setUsage(THREE.DynamicDrawUsage);
  _colorAttr.setUsage(THREE.DynamicDrawUsage);
  geo.setAttribute('position', _posAttr);
  geo.setAttribute('color', _colorAttr);

  const mat = new THREE.PointsMaterial({
    size: get('ptSize'),
    vertexColors: true,
    sizeAttenuation: false,
  });

  if (_points) _scene.remove(_points);
  _points = new THREE.Points(geo, mat);
  _scene.add(_points);
  setRef('points', _points);
}

export function writeDepthFrame(depthFlat, dW, dH, videoFrame) {
  if (!_posAttr || !_colorAttr || !_points) return;

  const video = document.getElementById(DOM.VIDEO);
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  const W = Math.floor(vw / get('density'));
  const H = Math.floor(vh / get('density'));
  const aspect = vw / vh;

  const depthCanvas = document.getElementById(DOM.DEPTH_CANVAS);
  const dctx = depthCanvas.getContext('2d');
  depthCanvas.width = W;
  depthCanvas.height = H;
  const img = dctx.createImageData(W, H);

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

      img.data[di]     = Math.round(255 * v);
      img.data[di + 1] = Math.round(255 * (1 - Math.abs(v - 0.5) * 2));
      img.data[di + 2] = Math.round(255 * (1 - v));
      img.data[di + 3] = 255;

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

  dctx.putImageData(img, 0, 0);
  _posAttr.needsUpdate = true;
  _colorAttr.needsUpdate = true;
  _points.geometry.setDrawRange(0, W * H);

  if (get('relightOn')) updateRelight();
}
