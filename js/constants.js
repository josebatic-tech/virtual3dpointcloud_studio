export const MODELS = {
  DEPTH: 'Xenova/depth-anything-small-hf',
  SAM: 'Xenova/slimsam-77-uniform',
  DESCRIBE: 'onnx-community/Florence-2-base-ft',
};

export const DEPTH = {
  VERSION: 'q4f16',
  DEVICE: 'wasm',
  CYCLE_MS: 500,
  DEFAULT_SCALE: 2,
};

export const DEFAULTS = {
  DENSITY: 4,
  PT_SIZE: 2,
  SAM_OPACITY: 0.3,
  VIDEO_WIDTH: 640,
  VIDEO_HEIGHT: 480,
  MAX_POINTS: 12,
  MIN_POINTS: 2,
};

export const MODEL_SIZES = { DEPTH_MB: 20, SAM_MB: 40, DESCRIBE_MB: 270 };
export const MODEL_NAMES = {
  DEPTH: 'Depth Anything Small',
  SAM: 'SlimSAM',
  DESCRIBE: 'BLIP Base',
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
  DESC_OUTPUT: 'descOutput',
  BTN_START: 'btnStart',
  BTN_DEPTH: 'btnDepth',
  BTN_STOP: 'btnStop',
  BTN_ROTATE: 'btnRotate',
  BTN_DESCRIBE: 'btnDescribe',
  BTN_PREV_MASK: 'btnPrevMask',
  BTN_NEXT_MASK: 'btnNextMask',
  TOG_SAM: 'togSam',
  TOG_WEBCAM: 'togWebcam',
  TOG_DEPTH: 'togDepthMap',
  TOG_SAM_MASK: 'togSamMask',
};
