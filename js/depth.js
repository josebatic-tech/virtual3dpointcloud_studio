import { get, set } from './store.js';
import { MODELS, DEPTH } from './constants.js';
import { DEFAULTS, DOM } from './constants.js';
import { CAMERA_RESOLUTIONS } from './constants.js';
import { mirrorFrame, getElem, setText } from './utils.js';
import { rebuildGeometry, writeDepthFrame } from './pointcloud.js';
import { rebuildGeometry as rebuildMeshGeometry, writeDepthFrame as writeMeshDepthFrame } from './mesh.js';
import * as zedClient from './zed.js';

const offCanvas = document.createElement('canvas');
const offCtx = offCanvas.getContext('2d', { willReadFrequently: true });

let _prevW = 0;
let _prevH = 0;

export async function loadDepthModel(onStatus) {
  const { pipeline, env } = await import('@huggingface/transformers');
  env.allowLocalModels = false;

  // Prefer high-performance GPU (NVIDIA/dedicated) via WebGPU
  let device = 'wasm';
  const dtype = DEPTH.VERSION;

  console.log('WebGPU available:', !!navigator.gpu);

  try {
    if (navigator.gpu) {
      // Try to get all adapters and find NVIDIA
      console.log('Enumerating adapters...');
      let adapter = null;

      // First try to get NVIDIA discrete GPU
      try {
        adapter = await navigator.gpu.requestAdapter({
          powerPreference: 'high-performance',
          forceFallbackAdapter: false
        });
        const info = adapter?.info || {};
        console.log('High-performance adapter:', info);

        // Check if it's NVIDIA
        if (info.vendor && info.vendor.toLowerCase().includes('nvidia')) {
          device = 'webgpu';
          onStatus(`loading depth model (WebGPU - NVIDIA ${info.description})…`);
          console.log('Using NVIDIA GPU');
        } else {
          // Not NVIDIA, try requesting with no preferences
          console.log('Not NVIDIA, trying alternative...');
          adapter = await navigator.gpu.requestAdapter();
          const altInfo = adapter?.info || {};
          console.log('Alternative adapter:', altInfo);

          if (altInfo.vendor && altInfo.vendor.toLowerCase().includes('nvidia')) {
            device = 'webgpu';
            onStatus(`loading depth model (WebGPU - NVIDIA ${altInfo.description})…`);
            console.log('Using NVIDIA GPU (alternative)');
          } else {
            device = 'webgpu';
            onStatus(`loading depth model (WebGPU - ${altInfo.vendor || 'GPU'})…`);
            console.log('Using available GPU:', altInfo.vendor);
          }
        }
      } catch (e) {
        console.error('Adapter enumeration error:', e);
        adapter = await navigator.gpu.requestAdapter();
        const info = adapter?.info || {};
        device = 'webgpu';
        onStatus(`loading depth model (WebGPU - ${info.vendor || 'GPU'})…`);
      }

      if (!adapter) {
        console.log('No adapter found, using WASM');
        device = 'wasm';
        onStatus('loading depth model (wasm)…');
      }
    } else {
      console.log('navigator.gpu not available');
      onStatus('loading depth model (wasm)…');
    }
  } catch (e) {
    console.error('WebGPU error:', e);
    device = 'wasm';
    onStatus('loading depth model (wasm)…');
  }

  let lastPct = -1;
  const progressCb = (e) => {
    if (e.status === 'initiate') {
      onStatus('downloading ' + e.file + '…');
      lastPct = -1;
    } else if (e.status === 'progress' && e.total > 0) {
      const pct = Math.round((e.loaded / e.total) * 100);
      if (pct !== lastPct) { lastPct = pct; onStatus(e.file + ' ' + pct + '%'); }
    }
  };

  let pipe;
  try {
    console.log('Loading pipeline with device:', device);
    pipe = await pipeline('depth-estimation', MODELS.DEPTH, { device, dtype, progress_callback: progressCb });
    console.log('Pipeline loaded successfully with device:', device);
  } catch (gpuErr) {
    console.error('Pipeline load error:', gpuErr);
    if (device === 'webgpu') {
      console.log('WebGPU failed, falling back to wasm…');
      onStatus('WebGPU failed, falling back to wasm…');
      pipe = await pipeline('depth-estimation', MODELS.DEPTH, { device: 'wasm', dtype, progress_callback: progressCb });
      device = 'wasm';
    } else {
      throw gpuErr;
    }
  }

  onStatus('depth model ready (' + device + ')');
  console.log('Depth model ready with device:', device);
  return pipe;
}

export async function runDepthFrame() {
  if (!get('depthPipe') || !get('stream')) return;

  const video = getElem(DOM.VIDEO);
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  if (!vw || !vh) return;

  const W = Math.floor(vw / get('density'));
  const H = Math.floor(vh / get('density'));

  offCanvas.width = W;
  offCanvas.height = H;
  offCtx.save();
  offCtx.scale(-1, 1);
  offCtx.drawImage(video, -W, 0, W, H);
  offCtx.restore();

  let depthFlat;
  try {
    const result = await get('depthPipe')(offCanvas);
    const raw = result.depth.data;
    const dW = result.depth.width;
    const dH = result.depth.height;

    let mn = Infinity, mx = -Infinity;
    for (let i = 0; i < raw.length; i++) {
      const v = raw[i];
      if (isFinite(v)) { if (v < mn) mn = v; if (v > mx) mx = v; }
    }
    if (!isFinite(mn)) mn = 0;
    if (!isFinite(mx)) mx = 1;
    const rng = mx - mn || 1;
    depthFlat = new Float32Array(raw.length);
    for (let i = 0; i < raw.length; i++) {
      depthFlat[i] = isFinite(raw[i]) ? (raw[i] - mn) / rng : 0.5;
    }

    console.log('depth: size=' + dW + 'x' + dH + ' range=' + mn.toFixed(3) + '-' + mx.toFixed(3) + ' first5=' + Array.from(depthFlat.slice(0,5)).map(v=>v.toFixed(3)).join(','));

    set('depthW', dW);
    set('depthH', dH);
  } catch (e) {
    setText(DOM.STATUS, 'depth error: ' + (e?.message || String(e)), 'error');
    return;
  }

  try {
    console.log('check dims: _prevW=' + _prevW + ' W=' + W + ' _prevH=' + _prevH + ' H=' + H);
    if (_prevW !== W || _prevH !== H) {
      _prevW = W;
      _prevH = H;
      console.log('rebuilding geometry');
      if (get('meshMode')) {
        rebuildMeshGeometry();
      } else {
        rebuildGeometry();
      }
    }

    const videoFrame = offCtx.getImageData(0, 0, W, H).data;
    console.log('videoFrame length:', videoFrame.length, 'WxH:', W, 'x', H);
    if (get('meshMode')) {
      writeMeshDepthFrame(depthFlat, get('depthW'), get('depthH'), videoFrame);
    } else {
      writeDepthFrame(depthFlat, get('depthW'), get('depthH'), videoFrame);
    }

    setText(DOM.STATUS, W + '×' + H + ' pts — running', 'running');
  } catch (e) {
    setText(DOM.STATUS, 'render error: ' + (e?.message || String(e)), 'error');
    console.error('runDepthFrame error:', e);
  }
}

export async function getAvailableCameras() {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices.filter((d) => d.kind === 'videoinput');
  } catch (e) {
    console.error('Error enumerating devices:', e);
    return [];
  }
}

export function isZedDevice(cameraLabel) {
  return cameraLabel && cameraLabel.toUpperCase().includes('ZED');
}

export async function stopZed() {
  zedClient.disconnectZed();
}

export async function startCamera(deviceId = null) {
  try {
    const resKey = get('cameraRes') || DEFAULTS.CAMERA_RES;
    const res = CAMERA_RESOLUTIONS[resKey];

    // Detect if mobile (iOS/Android)
    const isMobile = /iPhone|iPad|Android/i.test(navigator.userAgent);
    const isIOS = /iPhone|iPad/.test(navigator.userAgent);

    // Check if HTTPS or localhost (required for camera on iOS)
    const isSecureContext = window.isSecureContext || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    if (isIOS && !isSecureContext) {
      console.warn('⚠️  iOS requires HTTPS for camera access. Current URL is HTTP.');
      throw new Error('iOS requires HTTPS. Please use an HTTPS URL or localhost.');
    }

    // Mobile-optimized constraints - ultra low res for performance
    const constraints = {
      video: {
        width: isMobile
          ? { ideal: 360 }  // Ultra low for mobile
          : { ideal: res.width },
        height: isMobile
          ? { ideal: 240 }
          : { ideal: res.height },
        facingMode: 'user', // Front camera on mobile
      },
      audio: false,
    };

    if (deviceId) {
      constraints.video.deviceId = { exact: deviceId };
    }

    console.log('📱 Camera constraints:', { isMobile, isIOS, constraints });

    try {
      set('stream', await navigator.mediaDevices.getUserMedia(constraints));
    } catch (permissionError) {
      console.error('❌ Camera permission denied:', permissionError.name);
      if (permissionError.name === 'NotAllowedError') {
        throw new Error('Camera permission denied. Please allow camera access in browser settings.');
      } else if (permissionError.name === 'NotFoundError') {
        throw new Error('No camera found on this device.');
      } else if (permissionError.name === 'NotSupportedError') {
        throw new Error('Camera API not supported in this browser.');
      }
      throw permissionError;
    }

    const video = getElem(DOM.VIDEO);
    video.srcObject = get('stream');
    await video.play();

    // Check if this device is a Zed camera
    if (deviceId) {
      const devices = await getAvailableCameras();
      const selectedDevice = devices.find((d) => d.deviceId === deviceId);
      set('isZedDevice', selectedDevice ? isZedDevice(selectedDevice.label) : false);
    } else {
      set('isZedDevice', false);
    }
  } catch (error) {
    console.error('❌ Camera start error:', error.message);
    throw error;
  }
}

export function stopCamera() {
  if (get('interval')) { clearInterval(get('interval')); set('interval', null); }
  set('isRunning', false);
  if (get('stream')) { get('stream').getTracks().forEach((t) => t.stop()); set('stream', null); }
  getElem(DOM.VIDEO).srcObject = null;
}
