import * as THREE from 'three';
import { get, set, ref, setRef } from './store.js';
import { setText } from './utils.js';
import { DOM } from './constants.js';

const ZED_WS_URL = 'ws://localhost:8765';

let _ws = null;
let _connected = false;
let _pendingFrame = null;
let _frameCanvas = null;
let _frameCtx = null;

export function isZedConnected() {
  return _connected;
}

export function connectZed(onStatus) {
  return new Promise((resolve, reject) => {
    try {
      _ws = new WebSocket(ZED_WS_URL);
      _ws.binaryType = 'arraybuffer';

      _ws.onopen = () => {
        _connected = true;
        onStatus?.('Zed 2 connected');
        set('zedConnected', true);

        // Initialize canvas for JPEG decoding
        _frameCanvas = document.createElement('canvas');
        _frameCtx = _frameCanvas.getContext('2d');

        resolve(true);
      };

      _ws.onmessage = (event) => {
        // Store latest frame (drop old ones - no backpressure)
        _pendingFrame = event.data;
      };

      _ws.onclose = () => {
        _connected = false;
        set('zedConnected', false);
        onStatus?.('Zed disconnected');
      };

      _ws.onerror = () => {
        _connected = false;
        reject(new Error(`Cannot connect to Zed server at ${ZED_WS_URL}`));
      };

      // Timeout if no connection within 3 seconds
      setTimeout(() => {
        if (!_connected && _ws) {
          _ws.close();
          reject(new Error('Zed server connection timeout'));
        }
      }, 3000);
    } catch (e) {
      reject(e);
    }
  });
}

export function disconnectZed() {
  if (_ws) {
    _ws.close();
    _ws = null;
  }
  _connected = false;
  set('zedConnected', false);
}

export async function runZedFrame() {
  if (!_pendingFrame) return;

  const buffer = _pendingFrame;
  _pendingFrame = null;

  try {
    // Parse binary message header
    const view = new DataView(buffer);
    const version = view.getUint32(0, true);
    const nPoints = view.getUint32(4, true);
    const jpegSize = view.getUint32(8, true);

    if (nPoints === 0) return;

    const jpegOffset = 12;
    const xyzOffset = jpegOffset + jpegSize;
    const rgbOffset = xyzOffset + nPoints * 3 * 4;

    // Decode JPEG frame for preview
    const jpegBytes = new Uint8Array(buffer, jpegOffset, jpegSize);
    const blob = new Blob([jpegBytes], { type: 'image/jpeg' });
    const img = await createImageBitmap(blob);

    // Draw to preview canvas (for sidebar video preview)
    _frameCanvas.width = img.width;
    _frameCanvas.height = img.height;
    _frameCtx.drawImage(img, 0, 0);

    // Extract XYZ and RGB as Float32Array views (zero-copy)
    const xyz = new Float32Array(buffer, xyzOffset, nPoints * 3);
    const rgb = new Float32Array(buffer, rgbOffset, nPoints * 3);

    // Write to Three.js geometry
    writeZedPointCloud(xyz, rgb, nPoints);

    setText(DOM.STATUS, nPoints + ' pts — Zed 2 live', 'running');
  } catch (e) {
    console.error('Error processing Zed frame:', e);
  }
}

function writeZedPointCloud(xyz, rgb, nPoints) {
  const points = ref('points');
  const mesh = ref('mesh');

  // Use points or mesh geometry depending on mode
  const target = get('meshMode') ? mesh : points;
  if (!target) return;

  const geo = target.geometry;
  if (!geo) return;

  const posAttr = geo.getAttribute('position');
  const colorAttr = geo.getAttribute('color');

  // Rebuild if the current cloud is not Zed-compatible (e.g. the GPU
  // shader grid has no color attribute) or is too small
  if (!posAttr || !colorAttr || posAttr.array.length < nPoints * 3) {
    rebuildGeometryForZed(nPoints);
    return;
  }

  const pos = posAttr.array;
  const col = colorAttr.array;

  // Find Z range for normalization
  let minZ = Infinity, maxZ = -Infinity;
  for (let i = 0; i < nPoints; i++) {
    const z = xyz[i * 3 + 2];
    if (z > 0 && isFinite(z)) {
      if (z < minZ) minZ = z;
      if (z > maxZ) maxZ = z;
    }
  }

  const depthScale = get('depthScale') || 2;
  const zRange = maxZ - minZ || 1;
  const zCenter = (maxZ + minZ) / 2;

  // Write points
  const count = Math.min(nPoints, pos.length / 3);
  for (let i = 0; i < count; i++) {
    const x = xyz[i * 3];
    const y = xyz[i * 3 + 1];
    const z = xyz[i * 3 + 2];

    // Zed coordinate system: X right, Y down, Z forward
    // Three.js: X right, Y up, Z back
    // Also center around camera and normalize depth
    pos[i * 3] = x;
    pos[i * 3 + 1] = -y;
    pos[i * 3 + 2] = -z * depthScale / zRange * 2;

    col[i * 3] = Math.max(0, Math.min(1, rgb[i * 3]));
    col[i * 3 + 1] = Math.max(0, Math.min(1, rgb[i * 3 + 1]));
    col[i * 3 + 2] = Math.max(0, Math.min(1, rgb[i * 3 + 2]));
  }

  posAttr.needsUpdate = true;
  colorAttr.needsUpdate = true;
  geo.setDrawRange(0, count);
}

function rebuildGeometryForZed(nPoints) {
  // Similar to rebuildGeometry in pointcloud.js but for arbitrary point count
  const points = ref('points');
  const scene = ref('scene');

  if (!scene) return;

  // Remove old geometry
  if (points) scene.remove(points);

  const geo = new THREE.BufferGeometry();
  const posAttr = new THREE.BufferAttribute(new Float32Array(nPoints * 3), 3);
  const colorAttr = new THREE.BufferAttribute(new Float32Array(nPoints * 3), 3);

  posAttr.setUsage(THREE.DynamicDrawUsage);
  colorAttr.setUsage(THREE.DynamicDrawUsage);

  geo.setAttribute('position', posAttr);
  geo.setAttribute('color', colorAttr);

  const mat = new THREE.PointsMaterial({
    size: get('ptSize') || 2,
    sizeAttenuation: true,
    vertexColors: true,
  });

  const newPoints = new THREE.Points(geo, mat);
  scene.add(newPoints);

  setRef('points', newPoints);

  // Update draw range
  geo.setDrawRange(0, nPoints);
}

export function sendDensityToZed(density) {
  if (_ws && _connected) {
    try {
      _ws.send(JSON.stringify({ density: Math.max(1, Math.floor(density)) }));
    } catch (e) {
      console.warn('Failed to send density to Zed:', e);
    }
  }
}
