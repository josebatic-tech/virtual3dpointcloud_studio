import { get, set, ref, setRef, clearSam } from './store.js';
import { DOM, MODEL_SIZES } from './constants.js';
import { getElem, setText } from './utils.js';
import { initThree } from './three-init.js';
import { buildEnv } from './environment.js';
import { rebuildGeometry } from './pointcloud.js';
import { loadDepthModel, runDepthFrame, startCamera, stopCamera, getAvailableCameras } from './depth.js';
import { loadDescribeModel, describeScene, setDescribeMode } from './describe.js';
import { loadSAMModel, handlePreviewClick, selectSAMMask } from './sam.js';
import { initStreamDiffusion } from './streamdiffusion.js';
import { initDirectorTools } from './director.js';
import { initPostProcessing } from './postprocessing.js';

export function setStatus(msg, cls) {
  setText(DOM.STATUS, msg, cls);
}


export function initUI() {
  const btnStart = getElem(DOM.BTN_START);
  const btnDepth = getElem(DOM.BTN_DEPTH);
  const btnStop = getElem(DOM.BTN_STOP);
  const btnRotate = getElem(DOM.BTN_ROTATE);
  const btnDescribe = getElem(DOM.BTN_DESCRIBE);
  const video = getElem(DOM.VIDEO);
  const btnModeFlorence = document.getElementById('btnModeFlorence');
  const btnModeVLM = document.getElementById('btnModeVLM');
  const hfTokenRow = document.getElementById('hfTokenRow');
  const btnViewPointCloud = document.getElementById('btnViewPointCloud');
  const btnViewCamera = document.getElementById('btnViewCamera');
  const deviceSelector = document.getElementById('cameraDevice');
  const deviceSelectorRow = document.getElementById('deviceSelectorRow');

  let wasDepthRunning = false;

  // Load available cameras
  async function loadCameraDevices() {
    const cameras = await getAvailableCameras();
    if (cameras.length > 1) {
      deviceSelectorRow.style.display = 'flex';
      deviceSelector.innerHTML = '<option value="">— select camera —</option>';
      cameras.forEach((cam, idx) => {
        const opt = document.createElement('option');
        opt.value = cam.deviceId;
        opt.textContent = cam.label || `Camera ${idx + 1}`;
        deviceSelector.appendChild(opt);
      });
    }
  }

  loadCameraDevices();

  btnStart.onclick = async () => {
    try {
      const selectedDeviceId = deviceSelector.value || null;
      await startCamera(selectedDeviceId);
      btnStart.disabled = true;
      btnDepth.disabled = false;
      btnStop.disabled = false;
      btnDescribe.disabled = false;
      setStatus('camera active — click estimate depth');
      initThree();
      initPostProcessing();
      buildEnv();
    } catch (e) {
      setStatus('camera error: ' + e.message, 'error');
    }
  };

  // Allow switching cameras without stopping
  if (deviceSelector) {
    deviceSelector.onchange = async () => {
      if (get('stream')) {
        try {
          const selectedDeviceId = deviceSelector.value || null;
          const wasRunning = get('isRunning');
          if (wasRunning) {
            set('isRunning', false);
            btnDepth.textContent = '◈ Estimate Depth';
            btnDepth.classList.remove('active');
          }
          stopCamera();
          await startCamera(selectedDeviceId);
          set('stream', get('stream'));
          if (wasRunning) {
            btnDepth.click();
          }
        } catch (e) {
          setStatus('camera switch error: ' + e.message, 'error');
          loadCameraDevices();
        }
      }
    };
  }

  btnDepth.onclick = async () => {
    if (get('isRunning')) {
      set('isRunning', false);
      btnDepth.textContent = '◈ Estimate Depth';
      btnDepth.classList.remove('active');
      setStatus('paused');
      return;
    }

    btnDepth.disabled = true;
    try {
      if (!get('depthPipe')) set('depthPipe', await loadDepthModel((msg) => setText(DOM.STATUS, msg)));
      set('isRunning', true);
      btnDepth.disabled = false;
      btnDepth.textContent = '⏸ Pause';
      btnDepth.classList.add('active');
      (async function loop() {
        while (get('isRunning')) {
          await runDepthFrame();
          await new Promise(r => requestAnimationFrame(r));
        }
      })();
    } catch (e) {
      setStatus('model error: ' + (e?.message || String(e)), 'error');
      btnDepth.disabled = false;
    }
  };

  btnStop.onclick = () => {
    stopCamera();
    btnStart.disabled = false;
    btnDepth.disabled = true;
    btnStop.disabled = true;
    btnDescribe.disabled = true;
    btnDepth.classList.remove('active');
    btnDepth.textContent = '◈ Estimate Depth';
    setStatus('stopped');
  };

  btnRotate.onclick = () => {
    const next = !get('autoRotate');
    set('autoRotate', next);
    btnRotate.classList.toggle('active', next);
    btnRotate.textContent = next ? '↻ On' : '↻ Off';
  };

  // Describe mode toggle
  if (btnModeFlorence && btnModeVLM) {
    btnModeFlorence.onclick = () => {
      setDescribeMode('florence');
      btnModeFlorence.classList.add('active');
      btnModeVLM.classList.remove('active');
      hfTokenRow.style.display = 'flex';
    };
    btnModeVLM.onclick = () => {
      setDescribeMode('vlm');
      btnModeVLM.classList.add('active');
      btnModeFlorence.classList.remove('active');
      hfTokenRow.style.display = 'none';
    };
  }

  // Viewport toggle (Point Cloud ↔ Camera)
  if (btnViewPointCloud && btnViewCamera) {
    btnViewPointCloud.onclick = () => {
      console.log('Switching to 3D Cloud view');
      const canvas = document.getElementById('pcCanvas');
      const previewWebcam = document.getElementById('previewWebcam');

      // Start 3D view fade-in while camera fades out (crossfade blend)
      canvas.style.display = 'block';
      canvas.style.opacity = '0';
      canvas.style.pointerEvents = 'auto';
      canvas.classList.remove('hidden');

      // Prepare canvas but keep it invisible
      const dummy = canvas.offsetWidth;

      // Force renderer resize immediately
      const renderer = ref('renderer');
      const camera = ref('camera');
      const scene = ref('scene');
      if (renderer && camera && canvas && scene) {
        const viewport = document.getElementById('viewport');
        const w = viewport.clientWidth;
        const h = viewport.clientHeight;
        renderer.setSize(w, h);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.render(scene, camera);
      }

      // Blend: fade out camera while fading in 3D (parallel, not sequential)
      if (previewWebcam) {
        previewWebcam.classList.remove('fullscreen-video');
        previewWebcam.style.transition = 'opacity 0.5s ease-in-out';
        previewWebcam.style.opacity = '0';
      }
      video.classList.remove('fullscreen');

      btnViewPointCloud.classList.add('active');
      btnViewCamera.classList.remove('active');

      // Trigger crossfade blend for canvas
      canvas.style.transition = 'opacity 0.5s ease-in-out';
      canvas.style.opacity = '1';

      // Resume depth after blend completes
      if (wasDepthRunning && !get('isRunning')) {
        setTimeout(() => btnDepth.click(), 500);
      }
    };

    btnViewCamera.onclick = () => {
      console.log('Switching to Camera view');
      const canvas = document.getElementById('pcCanvas');
      const previewWebcam = document.getElementById('previewWebcam');

      // Immediately disable canvas interaction
      canvas.style.pointerEvents = 'none';

      // Blend: fade out 3D while fading in camera (crossfade blend)
      if (previewWebcam) {
        previewWebcam.classList.add('fullscreen-video');
        previewWebcam.style.transition = 'opacity 0.5s ease-in-out';
        previewWebcam.style.opacity = '1';
      }
      video.classList.add('fullscreen');

      btnViewCamera.classList.add('active');
      btnViewPointCloud.classList.remove('active');

      // Trigger crossfade blend for canvas
      canvas.style.transition = 'opacity 0.5s ease-in-out';
      canvas.style.opacity = '0';

      // Hide canvas after blend completes
      setTimeout(() => {
        canvas.classList.add('hidden');
      }, 500);

      // Pause depth if it was running
      if (get('isRunning')) {
        wasDepthRunning = true;
        setTimeout(() => btnDepth.click(), 250);
      }
    };
  } else {
    console.warn('View buttons not found:', { btnViewPointCloud, btnViewCamera });
  }

  btnDescribe.onclick = async () => {
    const mode = btnModeFlorence?.classList.contains('active') ? 'florence' : 'vlm';

    if (mode === 'florence' && !get('describeLoaded')) {
      btnDescribe.disabled = true;
      btnDescribe.textContent = 'loading…';
      try {
        await loadDescribeModel((msg) => { btnDescribe.textContent = msg; });
      } catch (e) {
        setStatus('describe error: ' + (e?.message || String(e)), 'error');
        btnDescribe.disabled = false;
        btnDescribe.textContent = '◈ Describe Scene';
        return;
      }
      btnDescribe.disabled = false;
      btnDescribe.textContent = '◈ Describe Scene';
    }

    btnDescribe.disabled = true;
    btnDescribe.textContent = 'describing…';
    try {
      const text = await describeScene();
      getElem(DOM.DESC_OUTPUT).textContent = text || '(no description)';
      showSubtitle(text || '(no description)');
    } catch (e) {
      getElem(DOM.DESC_OUTPUT).textContent = 'error: ' + (e?.message || String(e));
    }
    btnDescribe.disabled = false;
    btnDescribe.textContent = '◈ Describe Scene';
  };

  video.addEventListener('click', handlePreviewClick);

  // --- Sliders ---
  bindSlider('ptSize', (v) => {
    set('ptSize', v);
    const p = ref('points');
    if (p) p.material.size = v;
  });
  bindSlider('density', (v) => { set('density', v); rebuildGeometry(); });
  bindSlider('depthScale', (v) => set('depthScale', v), true);
  bindSlider('samOpacity', (v) => set('samOpacity', v), true);
  bindSlider('camSpeed', (v) => set('camSpeed', v), true);
  bindSlider('lensFocus', (v) => {
    set('lensFocus', v);
    const cam = ref('camera');
    if (cam) {
      setRef('targetFOV', v);
    }
  });
  bindSlider('particleCount', (v) => set('particleCount', parseInt(v)), false);
  bindSlider('particleOpacity', (v) => {
    set('particleOpacity', v);
    const p = ref('particleSystem');
    if (p && p.material) p.material.opacity = v;
  }, true);

  // --- Preview toggles ---
  [DOM.TOG_WEBCAM, DOM.TOG_DEPTH, DOM.TOG_SAM_MASK].forEach((id) => {
    bindToggle(id, (v) => {
      const el = document.getElementById(id);
      const panelId = el?.dataset?.preview;
      if (panelId) document.getElementById(panelId).style.display = v ? 'block' : 'none';
    });
  });

  bindToggle(DOM.TOG_SAM, async (v) => {
    set('samEnabled', v);
    video.classList.toggle('sam-active', v);
    const statusEl = document.getElementById(DOM.SAM_STATUS);
    statusEl.textContent = v ? (get('samLoaded') ? 'ready — click preview' : 'loading…') : '';
    document.getElementById(DOM.SAM_MASK_SELECTOR).classList.remove('visible');
    if (!v) clearSam();
    if (v && !get('samLoaded')) {
      try {
        await loadSAMModel((msg) => { statusEl.textContent = msg; });
      } catch (e) {
        statusEl.textContent = 'error: ' + (e?.message || String(e));
      }
    }
  });

  // --- Mask navigation ---
  getElem(DOM.BTN_PREV_MASK).onclick = () => selectSAMMask(-1);
  getElem(DOM.BTN_NEXT_MASK).onclick = () => selectSAMMask(1);

  // --- Light color ---
  const lightColorInput = document.getElementById('lightColor');
  if (lightColorInput) {
    lightColorInput.oninput = (e) => {
      set('lightColor', e.target.value);
    };
  }

  const descOut = document.getElementById(DOM.DESC_OUTPUT);
  if (descOut) descOut.textContent = '';

  const hfInput = document.getElementById('hfToken');
  if (hfInput) {
    const saved = localStorage.getItem('hfToken');
    if (saved) hfInput.value = saved;
    hfInput.onchange = () => localStorage.setItem('hfToken', hfInput.value.trim());
  }

  // Initialize StreamDiffusion UI
  initStreamDiffusion();

  // Initialize Director Tools
  initDirectorTools();
}

function bindSlider(id, cb, isFloat) {
  const el = document.getElementById(id);
  const val = document.getElementById(id + 'Val');
  if (!el) return;
  el.oninput = () => {
    const v = isFloat ? parseFloat(el.value) : +el.value;
    if (val) val.textContent = isFloat ? v.toFixed(1) : v;
    cb(v);
  };
}

function bindToggle(id, cb) {
  const el = document.getElementById(id);
  if (!el) return;
  el.onchange = () => cb(el.checked);
}

let _subtitleTimer = null;
function showSubtitle(text) {
  const el = document.getElementById('subtitle');
  if (!el) return;
  el.textContent = text;
  el.style.opacity = '1';
  clearTimeout(_subtitleTimer);
  _subtitleTimer = setTimeout(() => { el.style.opacity = '0'; }, 8000);
}
