/**
 * Voice input via Whisper (Transformers.js), fully in-browser.
 *
 * Usage: ensureWhisper() once, then startRecording() / stopRecordingAndTranscribe().
 * Audio is captured with MediaRecorder, decoded to 16 kHz mono PCM,
 * and run through whisper-tiny.en (~40 MB, cached after first load).
 */

const WHISPER_MODEL = 'onnx-community/whisper-tiny.en';

let _asr = null;
let _loading = null;
let _recorder = null;
let _chunks = [];
let _micStream = null;

export function isWhisperReady() {
  return !!_asr;
}

export function isRecording() {
  return !!_recorder && _recorder.state === 'recording';
}

export async function ensureWhisper(onStatus) {
  if (_asr) return _asr;
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
        if (pct !== lastPct) { lastPct = pct; onStatus?.('whisper ' + pct + '%'); }
      }
    };

    _asr = await pipeline('automatic-speech-recognition', WHISPER_MODEL, {
      progress_callback: progressCb,
    });
    onStatus?.('voice ready');
    return _asr;
  })();

  try {
    return await _loading;
  } finally {
    _loading = null;
  }
}

export async function startRecording() {
  if (isRecording()) return;

  _micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
  _chunks = [];
  _recorder = new MediaRecorder(_micStream);
  _recorder.ondataavailable = (e) => { if (e.data.size > 0) _chunks.push(e.data); };
  _recorder.start();
}

export async function stopRecordingAndTranscribe(onStatus) {
  if (!_recorder) return '';

  const recorder = _recorder;
  const stopped = new Promise((resolve) => { recorder.onstop = resolve; });
  recorder.stop();
  await stopped;

  _micStream?.getTracks().forEach((t) => t.stop());
  _micStream = null;
  _recorder = null;

  const blob = new Blob(_chunks, { type: recorder.mimeType });
  _chunks = [];
  if (blob.size === 0) return '';

  onStatus?.('transcribing…');

  // Decode to 16 kHz mono — the AudioContext resamples during decode
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  const audioCtx = new AudioCtx({ sampleRate: 16000 });
  try {
    const audioBuffer = await audioCtx.decodeAudioData(await blob.arrayBuffer());
    const pcm = audioBuffer.getChannelData(0);
    const asr = await ensureWhisper(onStatus);
    const result = await asr(pcm);
    return (result?.text || '').trim();
  } finally {
    audioCtx.close();
  }
}
