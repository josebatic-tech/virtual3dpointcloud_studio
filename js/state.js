/**
 * Re-exports from store.js for backwards compatibility.
 * New code should import directly from store.js.
 */
export { get, set, ref, setRef, clearSam } from './store.js';

import { setRef } from './store.js';
import * as THREE from 'three';

/** Convenience: set a Three.js object by name */
export function setScene(s) { setRef('scene', s); }
export function setCamera(c) { setRef('camera', c); }
export function setRenderer(r) { setRef('renderer', r); }
export function setPoints(p) { setRef('points', p); }
export function setPosAttr(a) { setRef('posAttr', a); }
export function setColorAttr(a) { setRef('colorAttr', a); }
export function setGridHelper(g) { setRef('grid', g); }
export function setFloorMesh(f) { setRef('floorMesh', f); }
export function setAmbientSphere(a) { setRef('ambientSphere', a); }
export function setRotX(v) { setRef('rotX', v); }
export function setRotY(v) { setRef('rotY', v); }
export function setIsDragging(v) { setRef('isDragging', v); }
export function setLastX(v) { setRef('lastX', v); }
export function setLastY(v) { setRef('lastY', v); }
