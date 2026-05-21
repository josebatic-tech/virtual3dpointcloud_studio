import { get, set } from './store.js';
import { MODELS, DOM, DEFAULTS } from './constants.js';
import { mirrorFrame, getElem } from './utils.js';

let _model = null;
let _processor = null;
let _busy = false;
let _describeMode = 'florence'; // 'florence' or 'vlm'

function _patchFetch(token) {
  const orig = window._hfFetchOrig || window.fetch;
  window._hfFetchOrig = orig;
  window.fetch = (url, opts = {}) => {
    if (typeof url === 'string' && url.includes('huggingface.co')) {
      opts = { ...opts, headers: { ...opts.headers, 'Authorization': 'Bearer ' + token } };
    }
    return orig(url, opts);
  };
}

function _makeProgress(onStatus) {
  let lastPct = -1;
  return (e) => {
    if (e.status === 'initiate') { onStatus('downloading ' + e.file + '…'); lastPct = -1; }
    else if (e.status === 'progress' && e.total > 0) {
      const pct = Math.round((e.loaded / e.total) * 100);
      if (pct !== lastPct) { lastPct = pct; onStatus(e.file + ' ' + pct + '%'); }
    }
  };
}

export async function loadDescribeModel(onStatus) {
  const token = document.getElementById('hfToken')?.value?.trim();
  if (token) _patchFetch(token);

  onStatus('loading transformers…');
  const { Florence2ForConditionalGeneration, AutoProcessor, env } =
    await import('@huggingface/transformers');
  env.allowLocalModels = false;

  onStatus('downloading Florence-2 processor…');
  _processor = await AutoProcessor.from_pretrained(MODELS.DESCRIBE, {
    progress_callback: _makeProgress(onStatus),
  });

  onStatus('downloading Florence-2 model (~270mb)…');
  _model = await Florence2ForConditionalGeneration.from_pretrained(MODELS.DESCRIBE, {
    device: 'wasm',
    dtype: 'q8',
    progress_callback: _makeProgress(onStatus),
  });

  set('describeLoaded', true);
  onStatus('ready');
}

export function setDescribeMode(mode) {
  _describeMode = mode; // 'florence' or 'vlm'
}

export async function describeScene() {
  if (_busy) return '';

  if (_describeMode === 'vlm') {
    return describeViaVLM();
  }

  // Florence-2 mode (original)
  if (!_model || !_processor) return '';
  _busy = true;

  try {
    const video = getElem(DOM.VIDEO);
    const vw = video.videoWidth || DEFAULTS.VIDEO_WIDTH;
    const vh = video.videoHeight || DEFAULTS.VIDEO_HEIGHT;
    if (!vw || !vh) return '';

    const { RawImage } = await import('@huggingface/transformers');
    const { canvas } = mirrorFrame(video, vw, vh);
    const image = RawImage.fromCanvas(canvas);

    const task = '<MORE_DETAILED_CAPTION>';
    const inputs = await _processor(image, task);

    const generated_ids = await _model.generate({
      ...inputs,
      max_new_tokens: 100,
    });

    const raw = _processor.batch_decode(generated_ids, { skip_special_tokens: false })[0];
    console.log('Florence raw output:', raw);

    // Try post_process_generation first
    try {
      const result = _processor.post_process_generation(raw, task, image.size);
      const caption = result[task];
      if (caption && !caption.includes('<') ) return caption.trim();
    } catch (_) {}

    // Manual extraction between task tags
    const closeTag = task.replace('<', '</');
    const start = raw.indexOf(task);
    const end = raw.indexOf(closeTag);
    if (start !== -1 && end > start) return raw.slice(start + task.length, end).trim();

    // Last resort: strip all angle-bracket tokens
    return raw.replace(/<[^>]+>/g, '').trim();
  } finally {
    _busy = false;
  }
}

async function describeViaVLM() {
  _busy = true;
  try {
    const video = getElem(DOM.VIDEO);
    const vw = video.videoWidth || DEFAULTS.VIDEO_WIDTH;
    const vh = video.videoHeight || DEFAULTS.VIDEO_HEIGHT;
    if (!vw || !vh) return '';

    const { RawImage } = await import('@huggingface/transformers');
    const { canvas } = mirrorFrame(video, vw, vh);
    const image = RawImage.fromCanvas(canvas);

    // Convert to base64
    const imageB64 = canvas.toDataURL('image/jpeg', 0.8).split(',')[1];

    // Call Ollama API with vision capability
    // Uses OpenAI-compatible API format
    const response = await fetch('http://localhost:11434/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'llava', // or your preferred vision model in Ollama
        messages: [{
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'Describe this scene in detail. What do you see? Be specific and concise.'
            },
            {
              type: 'image_url',
              image_url: { url: `data:image/jpeg;base64,${imageB64}` }
            }
          ]
        }],
        max_tokens: 150,
        temperature: 0.7
      })
    });

    if (!response.ok) {
      const err = await response.text();
      console.error('VLM API error:', err);
      throw new Error('VLM API failed: ' + response.statusText);
    }

    const data = await response.json();
    const caption = data.choices?.[0]?.message?.content?.trim() || '(no response)';
    console.log('VLM response:', caption);
    return caption;
  } catch (e) {
    console.error('VLM describe error:', e);
    throw e;
  } finally {
    _busy = false;
  }
}
