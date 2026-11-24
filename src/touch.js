import * as THREE from 'three';

const _euler = new THREE.Euler(0, 0, 0, 'YXZ');
const HALF_PI = Math.PI / 2 - 0.05;

/**
 * Controles para celular:
 *  - metade esquerda: joystick flutuante (aparece onde o dedo toca) → andar; empurrar até o fim = correr
 *  - metade direita: arrastar para olhar; toque rápido = interagir
 *  - botão "USAR" (interagir) e botão de pausa
 */
export class TouchControls {
  constructor({ camera, player, onInteract, onPause }) {
    this.camera = camera;
    this.player = player;
    this.onInteract = onInteract;
    this.onPause = onPause;
    this.enabled = false;
    this.lookSpeed = 0.0055;
    this.joyRadius = 60;
    this.joy = null; // { id, x0, y0 }
    this.look = null; // { id, x, y, sx, sy, t }

    const root = document.createElement('div');
    root.id = 'touch-ui';
    root.className = 'hidden';
    root.innerHTML = `
      <div class="t-layer"></div>
      <div class="t-joy hidden"><div class="t-knob"></div></div>
      <div class="t-joy-hint">Arraste para andar</div>
      <button class="t-btn t-use" aria-label="Interagir">USAR</button>
      <button class="t-btn t-pause" aria-label="Pausar">❚❚</button>`;
    document.body.appendChild(root);
    this.root = root;
    this.layer = root.querySelector('.t-layer');
    this.joyEl = root.querySelector('.t-joy');
    this.knob = root.querySelector('.t-knob');
    this.hint = root.querySelector('.t-joy-hint');
    this.useBtn = root.querySelector('.t-use');

    this.layer.addEventListener('pointerdown', (e) => this.down(e));
    this.layer.addEventListener('pointermove', (e) => this.move(e));
    this.layer.addEventListener('pointerup', (e) => this.up(e));
    this.layer.addEventListener('pointercancel', (e) => this.up(e));
    this.useBtn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      this.onInteract();
    });
    root.querySelector('.t-pause').addEventListener('pointerdown', (e) => {
      e.preventDefault();
      this.onPause();
    });
    // evita menu de contexto / seleção com toque longo
    root.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  setEnabled(v) {
    this.enabled = v;
    this.root.classList.toggle('hidden', !v);
    if (!v) this.reset();
  }

  /** mode: false | 'info' | 'action' — destaca o botão USAR quando há ação disponível. */
  setTarget(mode) {
    this.useBtn.classList.toggle('ready', mode === 'action');
  }

  reset() {
    this.joy = null;
    this.look = null;
    this.joyEl.classList.add('hidden');
    this.player.setTouchMove(0, 0, false);
  }

  down(e) {
    if (!this.enabled) return;
    e.preventDefault();
    this.layer.setPointerCapture?.(e.pointerId);
    if (e.clientX < innerWidth * 0.45 && !this.joy) {
      this.joy = { id: e.pointerId, x0: e.clientX, y0: e.clientY };
      this.joyEl.style.left = `${e.clientX}px`;
      this.joyEl.style.top = `${e.clientY}px`;
      this.knob.style.transform = 'translate(-50%, -50%)';
      this.joyEl.classList.remove('hidden');
      this.hint.classList.add('hidden');
    } else if (!this.look) {
      this.look = { id: e.pointerId, x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, t: performance.now() };
    }
  }

  move(e) {
    if (!this.enabled) return;
    if (this.joy && e.pointerId === this.joy.id) {
      let dx = e.clientX - this.joy.x0;
      let dy = e.clientY - this.joy.y0;
      const len = Math.hypot(dx, dy);
      const R = this.joyRadius;
      if (len > R) {
        dx = (dx / len) * R;
        dy = (dy / len) * R;
      }
      this.knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
      const mag = Math.min(len / R, 1);
      const dead = mag < 0.12;
      this.player.setTouchMove(dead ? 0 : dx / R, dead ? 0 : -dy / R, mag > 0.95);
    } else if (this.look && e.pointerId === this.look.id) {
      const dx = e.clientX - this.look.x;
      const dy = e.clientY - this.look.y;
      this.look.x = e.clientX;
      this.look.y = e.clientY;
      _euler.setFromQuaternion(this.camera.quaternion);
      _euler.y -= dx * this.lookSpeed;
      _euler.x = THREE.MathUtils.clamp(_euler.x - dy * this.lookSpeed, -HALF_PI, HALF_PI);
      this.camera.quaternion.setFromEuler(_euler);
    }
  }

  up(e) {
    if (this.joy && e.pointerId === this.joy.id) {
      this.joy = null;
      this.joyEl.classList.add('hidden');
      this.player.setTouchMove(0, 0, false);
    } else if (this.look && e.pointerId === this.look.id) {
      const moved = Math.hypot(e.clientX - this.look.sx, e.clientY - this.look.sy);
      const quick = performance.now() - this.look.t < 280;
      this.look = null;
      if (moved < 12 && quick && e.type === 'pointerup') this.onInteract(); // toque rápido = interagir
    }
  }
}
