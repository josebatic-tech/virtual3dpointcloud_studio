import { get, set } from './store.js';

const API_URL = 'http://localhost:8001/api/generate-from-frame';
let _generationLoop = null;

export function initStreamDiffusion() {
  const toggle = document.getElementById('togStreamDiffusion');
  const promptInput = document.getElementById('sdPrompt');
  const statusEl = document.getElementById('sdStatus');

  if (!toggle) return;

  toggle.onchange = async (e) => {
    if (e.target.checked) {
      statusEl.textContent = 'starting…';
      try {
        await startStreamGeneration();
        statusEl.textContent = '';
      } catch (err) {
        statusEl.textContent = 'error: ' + (err?.message || String(err));
        e.target.checked = false;
      }
    } else {
      stopStreamGeneration();
      statusEl.textContent = '';
    }
  };
}

export async function startStreamGeneration() {
  // Health check first
  try {
    const res = await fetch('http://localhost:8001/api/health');
    if (!res.ok) throw new Error('API unavailable');
  } catch (err) {
    throw new Error('StreamDiffusion API not running on port 8001');
  }

  set('sdGenerating', true);
  const imgEl = document.getElementById('sdResultImg');
  const loadingEl = document.getElementById('sdLoading');

  (async function loop() {
    while (get('sdGenerating')) {
      try {
        await generateFrame();
        // 2-3 second interval
        await new Promise(r => setTimeout(r, 2500));
      } catch (err) {
        if (get('sdGenerating')) {
          const statusEl = document.getElementById('sdStatus');
          statusEl.textContent = 'error: ' + (err?.message || String(err));
          console.error('SD generation error:', err);
          await new Promise(r => setTimeout(r, 1000));
        }
      }
    }
  })();
}

export function stopStreamGeneration() {
  set('sdGenerating', false);
}

async function generateFrame() {
  const video = document.getElementById('video');
  const promptInput = document.getElementById('sdPrompt');
  const imgEl = document.getElementById('sdResultImg');
  const loadingEl = document.getElementById('sdLoading');

  if (!video || !video.srcObject) {
    throw new Error('Camera not active');
  }

  const prompt = promptInput.value.trim() || 'a scene';

  // Capture frame from video
  const canvas = document.createElement('canvas');
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(video, 0, 0);
  const frameB64 = canvas.toDataURL('image/jpeg');

  // Show loading state
  loadingEl.textContent = 'generating…';
  loadingEl.style.display = 'flex';
  imgEl.style.display = 'none';

  // POST to backend
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      image_b64: frameB64,
      prompt: prompt,
      height: 512,
      width: 512,
      num_steps: 4,
      guidance_scale: 0.0,
    }),
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || `API error: ${res.status}`);
  }

  const data = await res.json();
  if (!data.success) {
    throw new Error(data.error || 'Generation failed');
  }

  // Animate through diffusion steps if available
  if (data.images_b64 && data.images_b64.length > 0) {
    imgEl.style.display = 'block';
    loadingEl.style.display = 'none';

    const totalSteps = data.images_b64.length;
    const statusEl = document.getElementById('sdStatus');

    // Rapidly cycle through intermediate steps
    for (let i = 0; i < data.images_b64.length; i++) {
      imgEl.src = data.images_b64[i];

      // Calculate and display percentage
      const percentage = Math.round(((i + 1) / totalSteps) * 100);
      statusEl.textContent = `${percentage}%`;

      // Wait 100ms between steps to show progression
      await new Promise(r => setTimeout(r, 100));
    }

    // Final status with latency after animation completes
    statusEl.textContent = `${(data.latency_ms).toFixed(0)}ms`;
  } else {
    // Fallback to single final image
    imgEl.src = data.image_b64;
    imgEl.style.display = 'block';
    loadingEl.style.display = 'none';

    const statusEl = document.getElementById('sdStatus');
    statusEl.textContent = `${(data.latency_ms).toFixed(0)}ms`;
  }
}
