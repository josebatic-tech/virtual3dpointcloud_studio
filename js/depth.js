import { get, set } from './store.js';
import { MODELS, DEPTH } from './constants.js';
import { DEFAULTS, DOM } from './constants.js';
import { mirrorFrame, getElem, setText } from './utils.js';
import { rebuildGeometry, writeDepthFrame } from './pointcloud.js';

const offCanvas = document.createElement('canvas');
const offCtx = offCanvas.getContext('2d', { willReadFrequently: true });

let _prevW = 0;
let _prevH = 0;

export async function loadDepthModel(onStatus) {
  const { pipeline, env } = await import('@huggingface/transformers');
  env.allowLocalModels = false;

  // Prefer WebGPU — same quantized model file, faster backend
  let device = DEPTH.DEVICE;
  const dtype = DEPTH.VERSION;
  try {
    if (navigator.gpu) {
      const adapter = await navigator.gpu.requestAdapter();
      if (adapter) device = 'webgpu';
    }
  } catch (_) {}
  onStatus('loading depth model (' + device + ')…');

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
    pipe = await pipeline('depth-estimation', MODELS.DEPTH, { device, dtype, progress_callback: progressCb });
  } catch (gpuErr) {
    if (device === 'webgpu') {
      onStatus('WebGPU failed, falling back to wasm…');
      pipe = await pipeline('depth-estimation', MODELS.DEPTH, { device: 'wasm', dtype, progress_callback: progressCb });
      device = 'wasm';
    } else {
      throw gpuErr;
    }
  }

  onStatus('depth model ready (' + device + ')');
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
      rebuildGeometry();
    }

    const videoFrame = offCtx.getImageData(0, 0, W, H).data;
    console.log('videoFrame length:', videoFrame.length, 'WxH:', W, 'x', H);
    writeDepthFrame(depthFlat, get('depthW'), get('depthH'), videoFrame);

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

export async function startCamera(deviceId = null) {
  const constraints = {
    video: { width: { ideal: DEFAULTS.VIDEO_WIDTH }, height: { ideal: DEFAULTS.VIDEO_HEIGHT } },
    audio: false,
  };

  if (deviceId) {
    constraints.video.deviceId = { exact: deviceId };
  }

  set('stream', await navigator.mediaDevices.getUserMedia(constraints));
  const video = getElem(DOM.VIDEO);
  video.srcObject = get('stream');
  await video.play();
}

export function stopCamera() {
  if (get('interval')) { clearInterval(get('interval')); set('interval', null); }
  set('isRunning', false);
  if (get('stream')) { get('stream').getTracks().forEach((t) => t.stop()); set('stream', null); }
  getElem(DOM.VIDEO).srcObject = null;
}
