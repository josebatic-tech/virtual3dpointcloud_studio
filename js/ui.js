import { get, set, ref, setRef, clearSam } from './store.js';
import { DOM, MODEL_SIZES } from './constants.js';
import { getElem, setText } from './utils.js';
import { initThree } from './three-init.js';
import { buildEnv } from './environment.js';
import { rebuildGeometry } from './pointcloud.js';
import { rebuildGeometry as rebuildMeshGeometry } from './mesh.js';
import { loadDepthModel, runDepthFrame, startCamera, stopCamera, getAvailableCameras, isZedDevice, stopZed } from './depth.js';
import { describeViaVLM } from './describe.js';
import { loadSAMModel, handlePreviewClick, selectSAMMask } from './sam.js';
import { initStreamDiffusion } from './streamdiffusion.js';
import { initDirectorTools } from './director.js';
import { initPostProcessing } from './postprocessing.js';
import { setLightIntensity, setAmbientIntensity, setLightColor, toggleInteractiveMode } from './interactive-lights.js';
import * as zedClient from './zed.js';
import { setPersonOnly } from './matting.js';
import { ensureWhisper, isWhisperReady, isRecording, startRecording, stopRecordingAndTranscribe } from './voice.js';
import { runDirectorCommand } from './agent.js';

export function setStatus(msg, cls) {
  setText(DOM.STATUS, msg, cls);
}


export function initUI() {
  // Mobile optimization: aggressive performance settings
  const isMobile = /iPhone|iPad|Android/i.test(navigator.userAgent);
  if (isMobile) {
    // Ultra-low density on mobile = far fewer points rendered = faster
    set('density', 10);
    // Disable particles by default on mobile (null = no particles)
    set('particleType', null);
    // Reduce point size for mobile
    set('ptSize', 1);
    // Disable autorotate by default
    set('autoRotate', false);
    console.log('📱 Mobile: density=10, ptSize=1, particles OFF, autoRotate OFF');
  }

  const btnStart = getElem(DOM.BTN_START);
  const btnDepth = getElem(DOM.BTN_DEPTH);
  const btnStop = getElem(DOM.BTN_STOP);
  const btnRotate = getElem(DOM.BTN_ROTATE);
  const video = getElem(DOM.VIDEO);
  const btnViewPointCloud = document.getElementById('btnViewPointCloud');
  const btnViewCamera = document.getElementById('btnViewCamera');
  const deviceSelector = document.getElementById('cameraDevice');
  const deviceSelectorRow = document.getElementById('deviceSelectorRow');
  const zedRow = document.getElementById('zedRow');
  const btnZedConnect = getElem(DOM.BTN_ZED_CONNECT);

  let wasDepthRunning = false;
  let hasZedDevice = false;

  // Load available cameras
  async function loadCameraDevices() {
    const cameras = await getAvailableCameras();
    if (cameras.length > 1) {
      deviceSelectorRow.style.display = 'flex';
      deviceSelector.innerHTML = '<option value="">— select camera —</option>';

      // Check if any device is Zed
      hasZedDevice = cameras.some((cam) => isZedDevice(cam.label));

      cameras.forEach((cam, idx) => {
        const opt = document.createElement('option');
        opt.value = cam.deviceId;
        opt.textContent = cam.label || `Camera ${idx + 1}`;
        deviceSelector.appendChild(opt);
      });
    }
    updateZedRowVisibility();
  }

  function updateZedRowVisibility() {
    if (zedRow && deviceSelector.value) {
      const selectedDevice = Array.from(deviceSelector.options).find((opt) => opt.value === deviceSelector.value);
      const deviceLabel = selectedDevice ? selectedDevice.textContent : '';
      zedRow.style.display = isZedDevice(deviceLabel) ? 'flex' : 'none';
    } else if (zedRow) {
      zedRow.style.display = 'none';
    }
  }

  loadCameraDevices();

  // Resolution selector
  const resolutionSelector = document.getElementById('cameraResolution');
  if (resolutionSelector) {
    resolutionSelector.value = get('cameraRes') || '360p';
    resolutionSelector.onchange = async () => {
      set('cameraRes', resolutionSelector.value);
      if (get('stream')) {
        try {
          const wasRunning = get('isRunning');
          if (wasRunning) {
            set('isRunning', false);
            btnDepth.textContent = '◈ Estimate Depth';
            btnDepth.classList.remove('active');
          }
          stopCamera();
          const selectedDeviceId = deviceSelector.value || null;
          await startCamera(selectedDeviceId);
          set('stream', get('stream'));
          if (wasRunning) {
            btnDepth.click();
          }
        } catch (e) {
          setStatus('resolution change error: ' + e.message, 'error');
        }
      }
    };
  }

  btnStart.onclick = async () => {
    try {
      const selectedDeviceId = deviceSelector.value || null;
      await startCamera(selectedDeviceId);
      btnStart.disabled = true;
      btnDepth.disabled = false;
      btnStop.disabled = false;
      setStatus('camera active — click estimate depth');
      initThree();
      initPostProcessing();
      buildEnv();
      rebuildGeometry();
      rebuildMeshGeometry();
      const mesh = ref('mesh');
      if (mesh) mesh.visible = false;
    } catch (e) {
      setStatus('camera error: ' + e.message, 'error');
    }
  };

  // Allow switching cameras without stopping
  if (deviceSelector) {
    deviceSelector.onchange = async () => {
      updateZedRowVisibility();
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
          stopZed();
          if (btnZedConnect) {
            btnZedConnect.textContent = '⬡ Connect';
            btnZedConnect.classList.remove('active');
          }
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

  // Zed 2 connect button
  if (btnZedConnect) {
    btnZedConnect.onclick = async () => {
      if (zedClient.isZedConnected()) {
        zedClient.disconnectZed();
        btnZedConnect.textContent = '⬡ Connect';
        btnZedConnect.classList.remove('active');
        setStatus('Zed disconnected');
      } else {
        btnZedConnect.disabled = true;
        try {
          await zedClient.connectZed((msg) => setStatus(msg));
          btnZedConnect.textContent = '⬡ Connected';
          btnZedConnect.classList.add('active');
          btnZedConnect.disabled = false;
        } catch (e) {
          setStatus('Zed connection failed: ' + e.message, 'error');
          btnZedConnect.disabled = false;
          btnZedConnect.textContent = '⬡ Connect';
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
      // Check if Zed is connected
      const useZed = zedClient.isZedConnected();

      if (!useZed && !get('depthPipe')) {
        set('depthPipe', await loadDepthModel((msg) => setText(DOM.STATUS, msg)));
      }

      set('isRunning', true);
      btnDepth.disabled = false;
      btnDepth.textContent = '⏸ Pause';
      btnDepth.classList.add('active');

      (async function loop() {
        const isMobile = /iPhone|iPad|Android/i.test(navigator.userAgent);
        const FPS_TARGET = isMobile ? 8 : 30;
        const frameTime = 1000 / FPS_TARGET;
        if (isMobile) console.log('📱 Mobile depth: 8fps, skip every other frame');
        let lastDepthTime = 0;
        let frameSkip = 0;
        while (get('isRunning')) {
          const now = performance.now();
          if (now - lastDepthTime >= frameTime) {
            // On mobile, skip every other frame for extra performance
            if (!isMobile || frameSkip % 2 === 0) {
              if (useZed) {
                await zedClient.runZedFrame();
              } else {
                await runDepthFrame();
              }
            }
            frameSkip++;
            lastDepthTime = now;
          }
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
    stopZed();
    btnStart.disabled = false;
    btnDepth.disabled = true;
    btnStop.disabled = true;
    btnDepth.classList.remove('active');
    btnDepth.textContent = '◈ Estimate Depth';
    if (btnZedConnect) {
      btnZedConnect.textContent = '⬡ Connect';
      btnZedConnect.classList.remove('active');
    }
    setStatus('stopped');
  };

  btnRotate.onclick = () => {
    const next = !get('autoRotate');
    set('autoRotate', next);
    btnRotate.classList.toggle('active', next);
    btnRotate.textContent = next ? '↻ On' : '↻ Off';
  };

  // Mesh mode toggle
  const btnMeshMode = getElem(DOM.BTN_MESH_MODE);
  if (btnMeshMode) {
    btnMeshMode.onclick = () => {
      const isMesh = get('meshMode');
      set('meshMode', !isMesh);
      btnMeshMode.textContent = !isMesh ? '△ Mesh' : '☁ Cloud';
      btnMeshMode.classList.toggle('active', !isMesh);

      const points = ref('points');
      const mesh = ref('mesh');
      if (!isMesh) {
        if (mesh) mesh.visible = true;
        if (points) points.visible = false;
        if (get('isRunning')) rebuildMeshGeometry();
      } else {
        if (points) points.visible = true;
        if (mesh) mesh.visible = false;
        if (get('isRunning')) rebuildGeometry();
      }
    };
  }

  // Interactive lighting toggle
  const btnInteractiveLight = getElem(DOM.BTN_INTERACTIVE_LIGHT);
  if (btnInteractiveLight) {
    btnInteractiveLight.onclick = () => {
      const isEnabled = get('interactiveLightMode');
      toggleInteractiveMode(!isEnabled);
      btnInteractiveLight.classList.toggle('active', !isEnabled);
      btnInteractiveLight.textContent = !isEnabled ? '💡 On' : '💡 Off';
    };
  }

  // Viewport toggle (Point Cloud ↔ Camera)
  if (btnViewPointCloud && btnViewCamera) {
    btnViewPointCloud.onclick = () => {
      console.log('Switching to 3D Cloud view');
      const canvas = document.getElementById('pcCanvas');
      const videoContainer = document.getElementById('cameraViewContainer');

      // Show canvas, hide camera view
      canvas.style.display = 'block';
      canvas.style.opacity = '1';
      canvas.style.pointerEvents = 'auto';
      canvas.classList.remove('hidden');

      if (videoContainer) {
        videoContainer.style.display = 'none';
      }

      // Force renderer resize
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

      btnViewPointCloud.classList.add('active');
      btnViewCamera.classList.remove('active');

      // Resume depth after switch
      if (wasDepthRunning && !get('isRunning')) {
        setTimeout(() => btnDepth.click(), 300);
      }
    };

    btnViewCamera.onclick = () => {
      console.log('Switching to Camera view');
      const canvas = document.getElementById('pcCanvas');
      const videoContainer = document.getElementById('cameraViewContainer');
      const cameraViewVideo = document.getElementById('cameraViewVideo');
      const sidebarVideo = document.getElementById('video');

      // Hide canvas, show camera view
      canvas.style.display = 'none';
      canvas.style.pointerEvents = 'none';
      canvas.classList.add('hidden');

      if (videoContainer) {
        videoContainer.style.display = 'flex';
        videoContainer.style.alignItems = 'center';
        videoContainer.style.justifyContent = 'center';
      }

      // Clone the stream to the camera view video element if available
      if (cameraViewVideo && sidebarVideo && sidebarVideo.srcObject) {
        cameraViewVideo.srcObject = sidebarVideo.srcObject;
      }

      btnViewCamera.classList.add('active');

      btnViewPointCloud.classList.remove('active');

      // Pause depth if it was running
      if (get('isRunning')) {
        wasDepthRunning = true;
        setTimeout(() => btnDepth.click(), 250);
      }
    };
  } else {
    console.warn('View buttons not found:', { btnViewPointCloud, btnViewCamera });
  }

  // Fullscreen button
  const btnFullscreen = document.getElementById(DOM.BTN_FULLSCREEN);
  if (btnFullscreen) {
    btnFullscreen.onclick = () => {
      const toggleFullscreen = ref('toggleFullscreen');
      if (toggleFullscreen) {
        toggleFullscreen();
      }
    };
  }

  video.addEventListener('click', handlePreviewClick);

  // --- Sliders ---
  bindSlider('ptSize', (v) => {
    set('ptSize', v);
    const p = ref('points');
    if (!p) return;
    if (p.material.uniforms?.uPointSize) p.material.uniforms.uPointSize.value = v;
    else p.material.size = v;
  });
  bindSlider('density', (v) => {
    set('density', v);
    // Send density update to Zed if connected
    if (zedClient.isZedConnected()) {
      zedClient.sendDensityToZed(v);
    }
    if (get('meshMode')) {
      rebuildMeshGeometry();
    } else {
      rebuildGeometry();
    }
  });
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

  bindSlider('lightIntensity', (v) => {
    set('lightIntensity', v);
    setLightIntensity(v);
  }, true);

  bindSlider('lightAmbience', (v) => {
    set('lightAmbience', v);
    setAmbientIntensity(v);
  }, true);

  const lightColorInput = document.getElementById('lightColor');
  if (lightColorInput) {
    lightColorInput.oninput = (e) => {
      set('lightColor', e.target.value);
      setLightColor(e.target.value);
    };
  }

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

  // --- Person-only matting toggle ---
  bindToggle(DOM.TOG_PERSON_ONLY, (v) => {
    setPersonOnly(v, (msg) => setText(DOM.MATTING_STATUS, msg || ''));
  });

  // --- Mask navigation ---
  getElem(DOM.BTN_PREV_MASK).onclick = () => selectSAMMask(-1);
  getElem(DOM.BTN_NEXT_MASK).onclick = () => selectSAMMask(1);

  // Initialize tab switching
  initTabSwitching();

  // Initialize StreamDiffusion UI
  initStreamDiffusion();

  // Initialize Director Tools
  initDirectorTools();

  // Initialize VLM Chat
  initVLMChat();

  // Initialize Voice Director
  initVoiceDirector();
}

function initVoiceDirector() {
  const btnVoice = document.getElementById(DOM.BTN_VOICE);
  const voiceLog = document.getElementById(DOM.VOICE_LOG);
  if (!btnVoice) return;

  const status = (msg) => setText(DOM.VOICE_STATUS, msg || '');

  function logEntry(role, text) {
    if (!voiceLog) return;
    voiceLog.style.display = 'block';
    const div = document.createElement('div');
    div.className = `chat-msg ${role}`;
    div.textContent = text;
    voiceLog.appendChild(div);
    voiceLog.scrollTop = voiceLog.scrollHeight;
  }

  btnVoice.onclick = async () => {
    try {
      if (isRecording()) {
        btnVoice.disabled = true;
        btnVoice.classList.remove('active');
        btnVoice.textContent = '🎤 Click to talk';
        const text = await stopRecordingAndTranscribe(status);
        btnVoice.disabled = false;
        if (!text) {
          status('no speech detected');
          return;
        }
        logEntry('user', text);
        status('running command…');
        const reply = await runDirectorCommand(text);
        logEntry('assistant', reply);
        status('');
        return;
      }

      if (!isWhisperReady()) {
        btnVoice.disabled = true;
        status('loading voice model…');
        await ensureWhisper(status);
        btnVoice.disabled = false;
      }

      await startRecording();
      btnVoice.classList.add('active');
      btnVoice.textContent = '⏹ Listening… click to stop';
      status('listening…');
    } catch (e) {
      btnVoice.disabled = false;
      btnVoice.classList.remove('active');
      btnVoice.textContent = '🎤 Click to talk';
      status('voice error: ' + (e?.message || String(e)));
    }
  };
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

function initTabSwitching() {
  const tabBar = document.getElementById('tab-bar');
  const tabPanels = document.getElementById('tab-panels');

  if (!tabBar || !tabPanels) return;

  const tabBtns = Array.from(tabBar.querySelectorAll('.tab-btn'));

  tabBtns.forEach((btn) => {
    btn.onclick = () => {
      const tabName = btn.dataset.tab;
      if (!tabName) return;

      tabBtns.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');

      const panels = Array.from(tabPanels.querySelectorAll('.tab-panel'));
      panels.forEach((p) => p.classList.remove('active'));

      const activePanel = document.getElementById(`tab-${tabName}`);
      if (activePanel) activePanel.classList.add('active');
    };
  });
}

export function initVLMChat() {
  const vlmInput = document.getElementById('vlmInput');
  const btnVLMSend = document.getElementById('btnVLMSend');
  const btnVLMClear = document.getElementById('btnVLMClear');
  const vlmChat = document.getElementById('vlmChat');
  const vlmSystemPrompt = document.getElementById('vlmSystemPrompt');
  const vlmModel = document.getElementById('vlmModel');

  console.log('🤖 Initializing VLM Chat...');
  console.log('  vlmInput:', !!vlmInput);
  console.log('  btnVLMSend:', !!btnVLMSend);
  console.log('  vlmChat:', !!vlmChat);

  if (!vlmInput || !btnVLMSend || !vlmChat) {
    console.error('❌ VLM chat elements not found!');
    console.error('  Missing:', {
      vlmInput: !vlmInput,
      btnVLMSend: !btnVLMSend,
      vlmChat: !vlmChat
    });
    return;
  }
  console.log('✅ VLM chat elements found');

  // Load history from localStorage
  const savedHistory = localStorage.getItem('vlmHistory');
  const history = savedHistory ? JSON.parse(savedHistory) : [];
  set('vlmHistory', history);

  // Render existing history
  function renderHistory() {
    vlmChat.innerHTML = '';
    history.forEach((msg) => {
      const div = document.createElement('div');
      div.className = `chat-msg ${msg.role}`;
      div.textContent = msg.content;
      vlmChat.appendChild(div);
    });
    vlmChat.scrollTop = vlmChat.scrollHeight;
  }
  renderHistory();

  async function sendMessage() {
    const userText = vlmInput.value.trim();
    console.log('📤 Send message:', userText);
    console.log('   Stream ready:', !!get('stream'));

    if (!userText) {
      console.log('⚠️  Empty message, ignoring');
      return;
    }

    if (!get('stream')) {
      console.log('⚠️  No video stream! Start camera first.');
      vlmInput.placeholder = 'Start camera first (Camera tab)';
      return;
    }

    vlmInput.value = '';
    vlmInput.disabled = true;
    btnVLMSend.disabled = true;
    console.log('🔄 Sending to VLM...');

    const userMsg = { role: 'user', content: userText };
    history.push(userMsg);

    const div = document.createElement('div');
    div.className = 'chat-msg user';
    div.textContent = userText;
    vlmChat.appendChild(div);

    try {
      const result = await describeViaVLM(userText, vlmSystemPrompt?.value || '', history);
      if (result.error) {
        const errDiv = document.createElement('div');
        errDiv.className = 'chat-msg assistant';
        errDiv.textContent = `Error: ${result.error}`;
        vlmChat.appendChild(errDiv);
      } else {
        const assistantMsg = { role: 'assistant', content: result.content };
        history.push(assistantMsg);

        const respDiv = document.createElement('div');
        respDiv.className = 'chat-msg assistant';
        respDiv.textContent = result.content;
        vlmChat.appendChild(respDiv);
      }
    } catch (e) {
      const errDiv = document.createElement('div');
      errDiv.className = 'chat-msg assistant';
      errDiv.textContent = `Error: ${e.message}`;
      vlmChat.appendChild(errDiv);
    }

    set('vlmHistory', history);
    localStorage.setItem('vlmHistory', JSON.stringify(history));
    vlmChat.scrollTop = vlmChat.scrollHeight;
    vlmInput.disabled = false;
    btnVLMSend.disabled = false;
    vlmInput.focus();
  }

  btnVLMSend.onclick = sendMessage;
  vlmInput.onkeypress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  if (btnVLMClear) {
    btnVLMClear.onclick = () => {
      history.length = 0;
      set('vlmHistory', []);
      localStorage.setItem('vlmHistory', '[]');
      vlmChat.innerHTML = '';
    };
  }
}
