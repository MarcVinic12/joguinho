import * as THREE from 'three';
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls.js';

const UP = new THREE.Vector3(0, 1, 0);

/** Jogador em primeira pessoa: Pointer Lock + WASD + colisão AABB no plano XZ. */
export class Player {
  constructor(camera, domElement, colliders, bounds) {
    this.camera = camera;
    this.controls = new PointerLockControls(camera, domElement);
    this.controls.pointerSpeed = 0.9;
    this.colliders = colliders;
    this.bounds = bounds;
    this.radius = 0.28;
    this.eyeHeight = 1.65;
    this.walkSpeed = 3.0;
    this.runSpeed = 5.2;
    this.velocity = new THREE.Vector3();
    this.keys = new Set();
    this.bobPhase = 0;
    this._fwd = new THREE.Vector3();
    this._right = new THREE.Vector3();
    this._wish = new THREE.Vector3();

    addEventListener('keydown', (e) => this.keys.add(e.code));
    addEventListener('keyup', (e) => this.keys.delete(e.code));
    addEventListener('blur', () => this.resetInput());
  }

  spawn({ x, z, yaw = 0 }) {
    this.camera.rotation.order = 'YXZ';
    this.camera.rotation.set(0, yaw, 0);
    this.camera.position.set(x, this.eyeHeight, z);
  }

  resetInput() {
    this.keys.clear();
    this.velocity.set(0, 0, 0);
  }

  update(dt) {
    const k = this.keys;
    const f = (k.has('KeyW') || k.has('ArrowUp') ? 1 : 0) - (k.has('KeyS') || k.has('ArrowDown') ? 1 : 0);
    const r = (k.has('KeyD') || k.has('ArrowRight') ? 1 : 0) - (k.has('KeyA') || k.has('ArrowLeft') ? 1 : 0);
    const speed = k.has('ShiftLeft') || k.has('ShiftRight') ? this.runSpeed : this.walkSpeed;

    this.camera.getWorldDirection(this._fwd);
    this._fwd.y = 0;
    this._fwd.normalize();
    this._right.crossVectors(this._fwd, UP).normalize();
    this._wish.set(0, 0, 0).addScaledVector(this._fwd, f).addScaledVector(this._right, r);
    if (this._wish.lengthSq() > 0) this._wish.normalize().multiplyScalar(speed);

    const accel = 1 - Math.exp(-12 * dt);
    this.velocity.lerp(this._wish, accel);

    const pos = this.camera.position;
    const nx = pos.x + this.velocity.x * dt;
    if (!this.blocked(nx, pos.z)) pos.x = nx;
    else this.velocity.x = 0;
    const nz = pos.z + this.velocity.z * dt;
    if (!this.blocked(pos.x, nz)) pos.z = nz;
    else this.velocity.z = 0;

    pos.x = THREE.MathUtils.clamp(pos.x, this.bounds.minX, this.bounds.maxX);
    pos.z = THREE.MathUtils.clamp(pos.z, this.bounds.minZ, this.bounds.maxZ);

    // Balanço leve da cabeça ao andar
    const sp = Math.hypot(this.velocity.x, this.velocity.z);
    if (sp > 0.2) this.bobPhase += dt * sp * 2.4;
    const bobAmp = Math.min(sp / this.walkSpeed, 1.4) * 0.028;
    pos.y = this.eyeHeight + Math.sin(this.bobPhase) * bobAmp;
  }

  blocked(x, z) {
    const r = this.radius;
    for (const c of this.colliders) {
      if (x + r > c.minX && x - r < c.maxX && z + r > c.minZ && z - r < c.maxZ) return true;
    }
    return false;
  }
}
