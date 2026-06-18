import * as THREE from 'three';
import { get, ref, setRef } from './store.js';
import { DEFAULTS, DOM } from './constants.js';
import { getMaskBuffer } from './sam.js';

/**
 * GPU-resident point cloud.
 *
 * The grid geometry (positions + uvs) is built once per resolution change.
 * Each frame only uploads small textures (depth R32F, video color RGBA,
 * optional SAM/person masks R8); the vertex shader displaces points by
 * depth and the fragment shader samples the video for color. No per-vertex
 * CPU loop runs per frame.
 */

let _scene = null;
let _points = null;
let _material = null;
let _W = 0;
let _H = 0;

let _depthTex = null;
let _colorTex = null;
let _samTex = null;
let _samData = null;
let _personTex = null;
let _fullTex = null; // 1x1 white fallback so mask samplers are always valid

const VERTEX_SHADER = /* glsl */ `
  uniform sampler2D uDepth;
  uniform sampler2D uPerson;
  uniform sampler2D uSam;
  uniform float uDepthScale;
  uniform float uPointSize;
  uniform float uPersonOnly;
  varying vec2 vUv;
  varying float vSam;

  void main() {
    vUv = uv;
    float d = texture2D(uDepth, uv).r;
    vSam = texture2D(uSam, uv).r;
    vec3 p = vec3(position.x, position.y, (d - 0.5) * uDepthScale);
    gl_PointSize = uPointSize;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
    if (uPersonOnly > 0.5 && texture2D(uPerson, uv).r < 0.5) {
      gl_Position = vec4(0.0, 0.0, 2.0, 1.0); // z > w: clipped away
    }
  }
`;

const FRAGMENT_SHADER = /* glsl */ `
  uniform sampler2D uColor;
  uniform float uSamEnabled;
  uniform float uSamOpacity;
  varying vec2 vUv;
  varying float vSam;

  void main() {
    vec3 c = texture2D(uColor, vUv).rgb;
    if (uSamEnabled > 0.5) c *= mix(uSamOpacity, 1.0, step(0.5, vSam));
    gl_FragColor = vec4(c, 1.0);
  }
`;

function makeDataTexture(data, w, h, format, type) {
  const tex = new THREE.DataTexture(data, w, h, format, type);
  tex.minFilter = THREE.NearestFilter;
  tex.magFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  return tex;
}

function fullTexture() {
  if (!_fullTex) {
    _fullTex = makeDataTexture(new Uint8Array([255]), 1, 1, THREE.RedFormat, THREE.UnsignedByteType);
  }
  return _fullTex;
}

export function rebuildGeometry() {
  _scene = ref('scene');
  if (!_scene) return;

  const video = document.getElementById(DOM.VIDEO);
  const vw = video.videoWidth || DEFAULTS.VIDEO_WIDTH;
  const vh = video.videoHeight || DEFAULTS.VIDEO_HEIGHT;
  const W = Math.floor(vw / get('density'));
  const H = Math.floor(vh / get('density'));
  const aspect = vw / vh;
  _W = W;
  _H = H;

  // Static grid: x/y spread like before, z displaced in the vertex shader.
  // Texture buffers store row 0 = image top, so v=0 maps to y=+1.
  const positions = new Float32Array(W * H * 3);
  const uvs = new Float32Array(W * H * 2);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      positions[i * 3]     = ((x / W) - 0.5) * 2 * aspect;
      positions[i * 3 + 1] = -((y / H) - 0.5) * 2;
      positions[i * 3 + 2] = 0;
      uvs[i * 2]     = (x + 0.5) / W;
      uvs[i * 2 + 1] = (y + 0.5) / H;
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));

  if (!_material) {
    _material = new THREE.ShaderMaterial({
      uniforms: {
        uDepth: { value: fullTexture() },
        uColor: { value: fullTexture() },
        uSam: { value: fullTexture() },
        uPerson: { value: fullTexture() },
        uDepthScale: { value: get('depthScale') },
        uPointSize: { value: get('ptSize') },
        uSamEnabled: { value: 0 },
        uSamOpacity: { value: get('samOpacity') },
        uPersonOnly: { value: 0 },
      },
      vertexShader: VERTEX_SHADER,
      fragmentShader: FRAGMENT_SHADER,
    });
  }

  if (_points) {
    _points.geometry.dispose();
    _scene.remove(_points);
  }
  _points = new THREE.Points(geo, _material);
  _points.frustumCulled = false; // depth displacement happens on the GPU
  _points.visible = false; // hidden until the first depth frame arrives
  _scene.add(_points);
  setRef('points', _points);
}

function updateDepthTexture(depthFlat, dW, dH) {
  if (!_depthTex || _depthTex.image.width !== dW || _depthTex.image.height !== dH) {
    _depthTex?.dispose();
    _depthTex = makeDataTexture(new Float32Array(depthFlat), dW, dH, THREE.RedFormat, THREE.FloatType);
    _material.uniforms.uDepth.value = _depthTex;
  } else {
    _depthTex.image.data.set(depthFlat);
    _depthTex.needsUpdate = true;
  }
}

function updateColorTexture(videoFrame, W, H) {
  const data = new Uint8Array(videoFrame.buffer, videoFrame.byteOffset, videoFrame.byteLength);
  if (!_colorTex || _colorTex.image.width !== W || _colorTex.image.height !== H) {
    _colorTex?.dispose();
    _colorTex = makeDataTexture(data, W, H, THREE.RGBAFormat, THREE.UnsignedByteType);
    _material.uniforms.uColor.value = _colorTex;
  } else {
    _colorTex.image.data = data;
    _colorTex.needsUpdate = true;
  }
}

function updateSamTexture(W, H) {
  const samOn = get('samEnabled') && get('samMasks');
  _material.uniforms.uSamEnabled.value = samOn ? 1 : 0;
  _material.uniforms.uSamOpacity.value = get('samOpacity');
  if (!samOn) return;

  const mask = getMaskBuffer(W, H);
  if (!mask) return;

  if (!_samData || _samData.length !== mask.length) {
    _samData = new Uint8Array(mask.length);
    _samTex?.dispose();
    _samTex = makeDataTexture(_samData, W, H, THREE.RedFormat, THREE.UnsignedByteType);
    _material.uniforms.uSam.value = _samTex;
  }
  for (let i = 0; i < mask.length; i++) _samData[i] = mask[i] ? 255 : 0;
  _samTex.needsUpdate = true;
}

function updatePersonTexture() {
  const personOnly = get('personOnly');
  _material.uniforms.uPersonOnly.value = personOnly ? 1 : 0;
  if (!personOnly) return;

  const mask = get('personMask');
  if (!mask) {
    // No mask yet (model still warming up) — show everything
    _material.uniforms.uPerson.value = fullTexture();
    return;
  }

  const data = mask.data instanceof Uint8Array
    ? mask.data
    : new Uint8Array(mask.data.buffer, mask.data.byteOffset, mask.data.byteLength);
  if (!_personTex || _personTex.image.width !== mask.width || _personTex.image.height !== mask.height) {
    _personTex?.dispose();
    _personTex = makeDataTexture(data, mask.width, mask.height, THREE.RedFormat, THREE.UnsignedByteType);
  } else {
    _personTex.image.data = data;
    _personTex.needsUpdate = true;
  }
  _material.uniforms.uPerson.value = _personTex;
}

/** Render the depth-map preview, only when its panel is visible. */
function drawDepthPreview(depthFlat, dW, dH) {
  const panel = document.getElementById('previewDepth');
  if (!panel || panel.style.display === 'none') return;

  const depthCanvas = document.getElementById(DOM.DEPTH_CANVAS);
  if (!depthCanvas) return;
  const dctx = depthCanvas.getContext('2d');
  depthCanvas.width = dW;
  depthCanvas.height = dH;
  const img = dctx.createImageData(dW, dH);
  for (let i = 0; i < depthFlat.length; i++) {
    const v = depthFlat[i];
    const di = i * 4;
    img.data[di]     = Math.round(255 * v);
    img.data[di + 1] = Math.round(255 * (1 - Math.abs(v - 0.5) * 2));
    img.data[di + 2] = Math.round(255 * (1 - v));
    img.data[di + 3] = 255;
  }
  dctx.putImageData(img, 0, 0);
}

export function writeDepthFrame(depthFlat, dW, dH, videoFrame) {
  if (!_points || !_material) return;

  // Zed mode may have replaced the scene's points object; re-attach ours
  if (!_points.parent && _scene) {
    const stale = ref('points');
    if (stale && stale !== _points) _scene.remove(stale);
    _scene.add(_points);
    setRef('points', _points);
  }

  _points.visible = true;
  _material.uniforms.uDepthScale.value = get('depthScale');
  _material.uniforms.uPointSize.value = get('ptSize');

  updateDepthTexture(depthFlat, dW, dH);
  updateColorTexture(videoFrame, _W, _H);
  updateSamTexture(_W, _H);
  updatePersonTexture();
  drawDepthPreview(depthFlat, dW, dH);
}
