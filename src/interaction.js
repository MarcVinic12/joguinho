import * as THREE from 'three';

/**
 * Raycast a partir do centro da tela. Cada alvo registrado tem um handler:
 *   { getPrompt(): string|null, onInteract(): void }
 * Prompts que começam com "[E]" deixam a mira no modo "ação".
 */
export class Interaction {
  constructor(camera, hud, { maxDistance = 2.6 } = {}) {
    this.camera = camera;
    this.hud = hud;
    this.raycaster = new THREE.Raycaster();
    this.raycaster.far = maxDistance;
    this.targets = [];
    this.current = null;
    this.center = new THREE.Vector2(0, 0);
  }

  register(object, handler) {
    object.userData.interactHandler = handler;
    this.targets.push(object);
  }

  findHandler(obj) {
    while (obj) {
      if (obj.userData.interactHandler) return obj.userData.interactHandler;
      obj = obj.parent;
    }
    return null;
  }

  update() {
    this.raycaster.setFromCamera(this.center, this.camera);
    const hits = this.raycaster.intersectObjects(this.targets, true);
    const handler = hits.length ? this.findHandler(hits[0].object) : null;
    this.current = handler;
    if (!handler) {
      this.hud.setTarget(null, false);
      return;
    }
    const prompt = handler.getPrompt();
    this.hud.setTarget(prompt, prompt?.startsWith('[E]') ? 'action' : 'info');
  }

  clear() {
    this.current = null;
    this.hud.setTarget(null, false);
  }

  interact() {
    if (this.current) this.current.onInteract();
  }
}
