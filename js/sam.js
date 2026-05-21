import { get, set, clearSam, ref, setRef } from './store.js';
import { MODELS, DEFAULTS, DOM, MODEL_SIZES } from './constants.js';
import { clickToVideoCoords, mirrorFrame, getElem, setText } from './utils.js';

/**
 * Build a progress callback for model download steps.
 * Shows percentage changes to avoid flooding the UI.
 */
function makeProgress(label, onStatus) {
  let lastPct = -1;
  return (e) => {
    if (e.status === 'initiate') {
      onStatus('downloading ' + e.file + '…');
    } else if (e.status === 'progress' && e.total > 0) {
      const pct = Math.round((e.loaded / e.total) * 100);
      if (pct !== lastPct) {
        lastPct = pct;
        onStatus(label + ' ' + pct + '%');
      }
    }
  };
}

/** Load SAM model + processor (lazy, first use) */
export async function loadSAMModel(onStatus) {
  onStatus('loading transformers…');
  const { SamModel, AutoProcessor, RawImage, env } = await import('@huggingface/transformers');
  env.allowLocalModels = false;

  onStatus('downloading SAM model (~' + MODEL_SIZES.SAM_MB + 'mb)…');
  set('samModel', await SamModel.from_pretrained(MODELS.SAM, {
    device: 'wasm',
    progress_callback: makeProgress('SAM', onStatus),
  }));

  set('samProcessor', await AutoProcessor.from_pretrained(MODELS.SAM, {
    progress_callback: makeProgress('processor', onStatus),
  }));

  set('samLoaded', true);
  onStatus('SAM ready — click webcam preview');
}

/** Handle a click on the webcam preview — compute real video coords and segment */
export function handlePreviewClick(e) {
  if (!get('samEnabled') || !get('samLoaded')) return;

  const video = getElem(DOM.VIDEO);
  const { x, y } = clickToVideoCoords(video, e.clientX, e.clientY);

  set('samClickPoint', [x, y]);
  setText(DOM.SAM_STATUS, 'segmenting…');
  runSAM();
}

/** Run SAM segmentation on the current frame */
export async function runSAM() {
  if (!get('samModel') || !get('samProcessor') || !get('samClickPoint')) return;

  const video = getElem(DOM.VIDEO);
  const vw = video.videoWidth || DEFAULTS.VIDEO_WIDTH;
  const vh = video.videoHeight || DEFAULTS.VIDEO_HEIGHT;

  try {
    const { canvas } = mirrorFrame(video, vw, vh);

    const { RawImage } = await import('@huggingface/transformers');
    const image = RawImage.fromCanvas(canvas);

    const [px, py] = get('samClickPoint');
    const inputPoints = [[[vw - px, py]]];

    const inputs = await get('samProcessor')(image, { input_points: inputPoints });
    const outputs = await get('samModel')(inputs);
    const masks = await get('samProcessor').post_process_masks(
      outputs.pred_masks,
      inputs.original_sizes,
      inputs.reshaped_input_sizes,
    );
    const iou_scores = outputs.iou_scores;

    set('samMasks', masks);
    const _d = masks[0]?.dims;
    set('samMaskCount', (_d?.length === 4 ? _d[1] : _d?.[0]) || 1);
    set('samSelectedIdx', 0);
    set('samScores', iou_scores?.data);

    const total = get('samMaskCount');
    getElem(DOM.SAM_MASK_SELECTOR).classList.toggle('visible', total > 1);
    updateMaskLabel();
    setText(DOM.SAM_STATUS, total + ' masks — use ◀ ▶ to select');

    drawMaskPreview();
  } catch (e) {
    console.error('SAM error:', e);
    setText(DOM.SAM_STATUS, 'error: ' + (e?.message || String(e)));
  }
}

/** Draw the selected mask overlay on the SAM preview canvas */
function drawMaskPreview() {
  const canvas = document.getElementById(DOM.SAM_CANVAS);
  if (!canvas) return;
  const video = getElem(DOM.VIDEO);
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  if (!vw || !vh) return;

  const pw = canvas.parentElement.clientWidth || 140;
  const ph = (pw / vw) * vh;

  const { ctx } = mirrorFrame(video, vw, vh);
  const maskBuf = getMaskBuffer(vw, vh);
  if (!maskBuf) return;

  const imgData = ctx.getImageData(0, 0, vw, vh);
  const d = imgData.data;
  const opacity = get('samOpacity');

  for (let i = 0; i < maskBuf.length; i++) {
    if (maskBuf[i] === 0) {
      const p = i * 4;
      d[p] *= opacity;
      d[p + 1] *= opacity;
      d[p + 2] *= opacity;
    }
  }
  ctx.putImageData(imgData, 0, 0);

  const previewCtx = canvas.getContext('2d');
  canvas.width = pw;
  canvas.height = ph;
  previewCtx.drawImage(ctx.canvas, 0, 0, pw, ph);
}

function updateMaskLabel() {
  const el = document.getElementById(DOM.SAM_MASK_LABEL);
  if (!el) return;
  const total = get('samMaskCount');
  const idx = get('samSelectedIdx') + 1;
  const score = get('samScores')?.[get('samSelectedIdx')];
  el.textContent = 'mask ' + idx + '/' + total + (score != null ? ' (' + (score * 100).toFixed(0) + '%)' : '');
}

/** Cycle through available masks */
export function selectSAMMask(delta) {
  const total = get('samMaskCount');
  if (total <= 1) return;
  const next = (get('samSelectedIdx') + delta + total) % total;
  set('samSelectedIdx', next);
  updateMaskLabel();
  setText(DOM.SAM_STATUS, 'mask ' + (next + 1) + '/' + total);
  drawMaskPreview();
}

export function getMaskCount() {
  return get('samMaskCount');
}

/**
 * Return a Uint8Array (1 = inside mask, 0 = outside) at the requested size.
 * Used by pointcloud.js to dim non-selected points.
 */
export function getMaskBuffer(W, H) {
  const masks = get('samMasks');
  if (!masks || !masks[0]) return null;

  const fullTensor = masks[0];
  if (!fullTensor?.dims) return null;

  // Shape is [1, num_masks, H, W] (4D) or [num_masks, H, W] (3D)
  let mN, mH, mW;
  if (fullTensor.dims.length === 4) {
    mN = fullTensor.dims[1]; mH = fullTensor.dims[2]; mW = fullTensor.dims[3];
  } else if (fullTensor.dims.length === 3) {
    mN = fullTensor.dims[0]; mH = fullTensor.dims[1]; mW = fullTensor.dims[2];
  } else {
    return null;
  }
  const data = fullTensor.data;
  const idx = Math.min(get('samSelectedIdx'), mN - 1);
  const offset = idx * mH * mW;

  const buf = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const mx = Math.floor((x / W) * mW);
      const my = Math.floor((y / H) * mH);
      buf[y * W + x] = data[offset + my * mW + mx] > 0.5 ? 1 : 0;
    }
  }
  return buf;
}
