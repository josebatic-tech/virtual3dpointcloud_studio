import { get, set } from './store.js';
import { DOM } from './constants.js';
import { mirrorFrame } from './utils.js';

/**
 * Automatic person matting (MODNet via Transformers.js).
 *
 * When "Person Only" is enabled, a self-contained loop grabs mirrored
 * webcam frames, runs portrait matting, and publishes the alpha mask to
 * the store as 'personMask' ({data, width, height}, 0-255 alpha).
 * pointcloud.js samples that mask to hide background points.
 */

const MATTING_MODEL = 'Xenova/modnet';
const INFER_WIDTH = 256;
const LOOP_DELAY_MS = 150;

let _segmenter = null;
let _loading = null;
let _loopRunning = false;

export function isMattingLoaded() {
  return !!_segmenter;
}

async function loadModel(onStatus) {
  if (_segmenter) return _segmenter;
  if (_loading) return _loading;

  _loading = (async () => {
    const { pipeline, env } = await import('@huggingface/transformers');
    env.allowLocalModels = false;

    let lastPct = -1;
    const progressCb = (e) => {
      if (e.status === 'initiate') {
        onStatus?.('downloading ' + e.file + '…');
        lastPct = -1;
      } else if (e.status === 'progress' && e.total > 0) {
        const pct = Math.round((e.loaded / e.total) * 100);
        if (pct !== lastPct) { lastPct = pct; onStatus?.('matting ' + pct + '%'); }
      }
    };

    _segmenter = await pipeline('image-segmentation', MATTING_MODEL, {
      device: 'wasm',
      progress_callback: progressCb,
    });
    onStatus?.('person matting ready');
    return _segmenter;
  })();

  try {
    return await _loading;
  } finally {
    _loading = null;
  }
}

/** Enable/disable person-only mode. Loads the model on first enable. */
export async function setPersonOnly(on, onStatus) {
  set('personOnly', on);

  if (!on) {
    set('personMask', null);
    onStatus?.('');
    return;
  }

  if (!_segmenter) {
    onStatus?.('loading matting model…');
    try {
      await loadModel(onStatus);
    } catch (e) {
      set('personOnly', false);
      onStatus?.('matting error: ' + (e?.message || String(e)));
      return;
    }
  }

  // User may have toggled off while the model was downloading
  if (!get('personOnly')) return;

  onStatus?.('person matting active');
  if (!_loopRunning) runLoop();
}

async function runLoop() {
  _loopRunning = true;
  const { RawImage } = await import('@huggingface/transformers');

  while (get('personOnly')) {
    const video = document.getElementById(DOM.VIDEO);
    if (_segmenter && video && video.videoWidth && !video.paused) {
      try {
        const w = INFER_WIDTH;
        const h = Math.round((w / video.videoWidth) * video.videoHeight);
        const { canvas } = mirrorFrame(video, w, h);
        const output = await _segmenter(RawImage.fromCanvas(canvas));
        const mask = output?.[0]?.mask;
        if (mask && get('personOnly')) {
          set('personMask', { data: mask.data, width: mask.width, height: mask.height });
        }
      } catch (e) {
        console.error('matting error:', e);
      }
    }
    await new Promise((r) => setTimeout(r, LOOP_DELAY_MS));
  }

  _loopRunning = false;
}
