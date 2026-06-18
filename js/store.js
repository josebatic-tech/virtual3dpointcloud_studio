import { DEFAULTS, DEPTH } from './constants.js';

/**
 * Centralized state and reference store.
 *
 * - get/set: app settings and runtime state (plain data)
 * - ref/setRef: Three.js objects and other DOM references
 */

const _state = {
  depthPipe: null,
  stream: null,
  isRunning: false,
  interval: null,
  cameraRes: DEFAULTS.CAMERA_RES,
  ptSize: DEFAULTS.PT_SIZE,
  density: DEFAULTS.DENSITY,
  depthScale: DEPTH.DEFAULT_SCALE,
  depthW: 0,
  depthH: 0,
  envGrid: true,
  envFloor: true,
  envFog: true,
  envAmbient: false,
  relightOn: false,
  lightPos: { x: 0, y: 2, z: 3 },
  lightIntensity: DEFAULTS.LIGHT_INTENSITY,
  autoRotate: false,
  vlmHistory: [],
  samModel: null,
  samProcessor: null,
  samLoaded: false,
  samEnabled: false,
  samOpacity: DEFAULTS.SAM_OPACITY,
  samMasks: null,
  samMaskCount: 0,
  samSelectedIdx: 0,
  samScores: null,
  samClickPoint: null,
  sdGenerating: false,
  personOnly: false,
  personMask: null,
};

const _refs = {};

/** Read a state value */
export function get(key) { return _state[key]; }

/** Write a state value */
export function set(key, val) { _state[key] = val; }

/** Read a Three.js / DOM reference */
export function ref(key) { return _refs[key]; }

/** Store a Three.js / DOM reference */
export function setRef(key, val) { _refs[key] = val; }


/** Reset SAM masks, used when disabling SAM */
export function clearSam() {
  _state.samMasks = null;
  _state.samMaskCount = 0;
  _state.samSelectedIdx = 0;
  _state.samScores = null;
  _state.samClickPoint = null;
}
