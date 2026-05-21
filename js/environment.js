import * as THREE from 'three';
import { get, set, ref, setRef } from './store.js';

export function buildEnv() {
  _buildGrid();
  _buildFloor();
  _buildAmbientSphere();
  _buildColorBackdrop();
  _updateFog();
}

function _buildGrid() {
  const old = ref('grid');
  if (old) ref('scene').remove(old);
  const g = new THREE.GridHelper(8, 24, 0x1c2030, 0x131820);
  g.position.y = -1.2;
  g.visible = get('envGrid');
  ref('scene').add(g);
  setRef('grid', g);
}

function _buildFloor() {
  const old = ref('floorMesh');
  if (old) ref('scene').remove(old);
  const geo = new THREE.PlaneGeometry(8, 8);
  const mat = new THREE.MeshBasicMaterial({ color: 0x0a0f18, transparent: true, opacity: 0.7, side: THREE.DoubleSide });
  const m = new THREE.Mesh(geo, mat);
  m.rotation.x = -Math.PI / 2;
  m.position.y = -1.21;
  m.visible = get('envFloor');
  ref('scene').add(m);
  setRef('floorMesh', m);
}

function _buildAmbientSphere() {
  const old = ref('ambientSphere');
  if (old) ref('scene').remove(old);
  const geo = new THREE.SphereGeometry(7, 16, 8);
  const mat = new THREE.MeshBasicMaterial({ color: 0x060810, side: THREE.BackSide });
  const s = new THREE.Mesh(geo, mat);
  s.visible = get('envAmbient');
  ref('scene').add(s);
  setRef('ambientSphere', s);
}

function _buildColorBackdrop() {
  const old = ref('colorBackdrop');
  if (old) ref('scene').remove(old);

  const geo = new THREE.SphereGeometry(50, 32, 32);
  const color = get('backgroundColor') || 0x080a0e;
  const mat = new THREE.MeshBasicMaterial({ color, side: THREE.BackSide });
  const backdrop = new THREE.Mesh(geo, mat);
  backdrop.visible = get('colorBackdropVisible');
  ref('scene').add(backdrop);
  setRef('colorBackdrop', backdrop);
}

function _updateFog() {
  ref('scene').fog = get('envFog') ? new THREE.FogExp2(0x080a0e, 0.12) : null;
}

export function setEnv(key, val) {
  set(key, val);
  if (key === 'envGrid' && ref('grid')) ref('grid').visible = val;
  if (key === 'envFloor' && ref('floorMesh')) ref('floorMesh').visible = val;
  if (key === 'envFog') _updateFog();
  if (key === 'envAmbient' && ref('ambientSphere')) ref('ambientSphere').visible = val;
}

export function setBackgroundColor(colorHex) {
  set('backgroundColor', colorHex);
  const backdrop = ref('colorBackdrop');
  if (backdrop && backdrop.material) {
    backdrop.material.color.setHex(colorHex);
  }
}
