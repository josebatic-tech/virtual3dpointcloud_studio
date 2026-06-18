export const MODELS = {
  DEPTH: 'Xenova/depth-anything-small-hf',
  SAM: 'Xenova/slimsam-77-uniform',
};

export const DEPTH = {
  VERSION: 'q4f16',
  DEVICE: 'wasm',
  CYCLE_MS: 500,
  DEFAULT_SCALE: 2,
};

export const CAMERA_RESOLUTIONS = {
  '360p': { width: 480, height: 360 },
  '480p': { width: 640, height: 480 },
  '720p': { width: 1280, height: 720 },
  '1080p': { width: 1920, height: 1080 },
};

export const DEFAULTS = {
  DENSITY: 2,
  PT_SIZE: 2,
  SAM_OPACITY: 0.3,
  VIDEO_WIDTH: 1280,
  VIDEO_HEIGHT: 720,
  CAMERA_RES: '720p',
  MAX_POINTS: 12,
  MIN_POINTS: 2,
  LIGHT_INTENSITY: 1,
};

export const MODEL_SIZES = { DEPTH_MB: 20, SAM_MB: 40 };
export const MODEL_NAMES = {
  DEPTH: 'Depth Anything Small',
  SAM: 'SlimSAM',
};

export const DOM = {
  STATUS: 'status',
  VIDEO: 'video',
  DEPTH_CANVAS: 'depthCanvas',
  SAM_CANVAS: 'samCanvas',
  PC_CANVAS: 'pcCanvas',
  SAM_STATUS: 'samStatus',
  SAM_MASK_SELECTOR: 'samMaskSelector',
  SAM_MASK_LABEL: 'samMaskLabel',
  BTN_START: 'btnStart',
  BTN_DEPTH: 'btnDepth',
  BTN_STOP: 'btnStop',
  BTN_ROTATE: 'btnRotate',
  BTN_PREV_MASK: 'btnPrevMask',
  BTN_NEXT_MASK: 'btnNextMask',
  BTN_MESH_MODE: 'btnMeshMode',
  BTN_INTERACTIVE_LIGHT: 'btnInteractiveLight',
  BTN_ZED_CONNECT: 'btnZedConnect',
  BTN_FULLSCREEN: 'btnFullscreen',
  TOG_SAM: 'togSam',
  TOG_WEBCAM: 'togWebcam',
  TOG_DEPTH: 'togDepthMap',
  TOG_SAM_MASK: 'togSamMask',
  TOG_PERSON_ONLY: 'togPersonOnly',
  MATTING_STATUS: 'mattingStatus',
  BTN_VOICE: 'btnVoice',
  VOICE_STATUS: 'voiceStatus',
  VOICE_LOG: 'voiceLog',
  FPS_COUNTER: 'fpsCounter',
};

export const VLM = {
  // Use same host as current page, port 3001 for CORS proxy
  ENDPOINT: `http://${window.location.hostname}:3001`,
  MODEL: 'llava',
  MAX_TOKENS: 200,
  TEMPERATURE: 0.7,
  // Reduce image quality for faster processing
  IMAGE_QUALITY: 0.6,
  // Compress image before sending
  MAX_IMAGE_SIZE: 640,
};
