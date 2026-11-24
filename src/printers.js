import * as THREE from 'three';
import { getPartGeometry } from './models.js';
import { dynamicTexture } from './textures.js';
import { M, add, box, cyl } from './props.js';

const STATE_LABEL = {
  idle: 'Ociosa',
  ready: 'Arquivo recebido',
  heating: 'Preparando',
  printing: 'Imprimindo',
  finishing: 'Finalizando',
  done: 'Concluída',
};

const UP = new THREE.Vector3(0, 1, 0);
const DOWN = new THREE.Vector3(0, -1, 0);
const damp = (cur, target, k, dt) => cur + (target - cur) * (1 - Math.exp(-k * dt));
const ease = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));

/* ===================================================================== */
/*  Base comum: estado, job, peça com clipping, tela de status           */
/* ===================================================================== */
class BasePrinter {
  constructor(name, tech, hooks) {
    this.name = name;
    this.tech = tech;
    this.hooks = hooks; // { toast(msg, type), onCollect(mesh, job) }
    this.group = new THREE.Group();
    this.group.name = name;
    this.state = 'idle';
    this.job = null;
    this.progress = 0;
    this.phaseTime = 0;
    this.partGroup = null;
    this.partHeight = 0;
    // Plano de corte principal (camadas) + 2 planos da "faixa quente" da camada atual
    this.clipPlane = new THREE.Plane(DOWN.clone(), 0);
    this.bandPlanes = [new THREE.Plane(DOWN.clone(), 0), new THREE.Plane(UP.clone(), 0)];
    this.display = dynamicTexture(256, 144);
    this._displayTimer = 0;
  }

  /** Caixa invisível que facilita mirar na máquina (impressoras abertas têm muitos "vãos"). */
  addHitbox(w, h, d) {
    const hit = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshBasicMaterial({ visible: false }));
    hit.position.y = h / 2;
    hit.name = 'hitbox';
    this.group.add(hit);
  }

  get stateLabel() {
    return STATE_LABEL[this.state];
  }

  get percent() {
    return Math.floor(this.progress * 100);
  }

  canReceive() {
    return this.state === 'idle' || this.state === 'ready';
  }

  receiveJob(job) {
    this.job = job;
    this.progress = 0;
    this.phaseTime = 0;
    this.state = 'ready';
    this.buildPart(job);
    if (job.autoStart) this.start();
    this.drawDisplay();
  }

  start() {
    if (this.state !== 'ready') return;
    this.state = 'heating';
    this.phaseTime = 0;
    this.hooks.toast(`${this.name}: impressão de "${this.job.partName}" iniciada`, 'info');
  }

  getPrompt() {
    switch (this.state) {
      case 'idle':
        return `${this.name} · sem arquivo — fatie uma peça no computador`;
      case 'ready':
        return `[E] Iniciar Impressão · ${this.job.partName}`;
      case 'heating':
        return `${this.name} · ${this.tech === 'fdm' ? 'aquecendo bico e mesa' : 'posicionando plataforma'}...`;
      case 'printing':
        return `${this.name} · imprimindo ${this.percent}% (camada ${this.currentLayer()}/${this.job.layers})`;
      case 'finishing':
        return `${this.name} · finalizando...`;
      case 'done':
        return `[E] Retirar a Peça Pronta · ${this.job.partName}`;
    }
    return null;
  }

  onInteract() {
    if (this.state === 'ready') this.start();
    else if (this.state === 'done') this.collect();
  }

  currentLayer() {
    return this.job ? Math.min(this.job.layers, Math.floor(this.progress * this.job.layers)) : 0;
  }

  collect() {
    const geo = getPartGeometry(this.job.partId);
    const finished = new THREE.Mesh(
      geo,
      new THREE.MeshStandardMaterial({ color: this.job.color, roughness: this.tech === 'fdm' ? 0.55 : 0.3 })
    );
    finished.castShadow = true;
    finished.scale.setScalar(this.partScale);
    this.hooks.onCollect(finished, this.job);
    this.hooks.toast(`✔ ${this.job.partName} retirada da ${this.name}!`, 'success');
    this.clearPart();
    this.job = null;
    this.progress = 0;
    this.state = 'idle';
    this.drawDisplay();
  }

  /** Cria a peça (frente + verso escurecido + faixa da camada atual), todas recortadas. */
  buildPart(job) {
    this.clearPart();
    const geo = getPartGeometry(job.partId);
    const color = new THREE.Color(job.color);
    const front = new THREE.MeshStandardMaterial({
      color,
      roughness: this.tech === 'fdm' ? 0.55 : 0.3,
      clippingPlanes: [this.clipPlane],
      clipShadows: true,
    });
    const back = new THREE.MeshStandardMaterial({
      color: color.clone().multiplyScalar(0.45),
      side: THREE.BackSide,
      clippingPlanes: [this.clipPlane],
      clipShadows: true,
    });
    const band = new THREE.MeshBasicMaterial({
      color: this.tech === 'fdm' ? 0xffb35c : 0xb48cff,
      side: THREE.DoubleSide,
      clippingPlanes: this.bandPlanes,
      toneMapped: false,
    });
    const g = new THREE.Group();
    const mFront = new THREE.Mesh(geo, front);
    mFront.castShadow = true;
    const mBack = new THREE.Mesh(geo, back);
    const mBand = new THREE.Mesh(geo, band);
    mBand.scale.setScalar(1.004);
    this.bandMesh = mBand;
    g.add(mFront, mBack, mBand);
    g.scale.setScalar(this.partScale);
    this.partGroup = g;
    this.partMaterials = [front, back, band];
    this.partHeight = geo.boundingBox.max.y * this.partScale;
    this.partHalf = new THREE.Vector2(
      (geo.boundingBox.max.x - geo.boundingBox.min.x) * 0.5 * this.partScale,
      (geo.boundingBox.max.z - geo.boundingBox.min.z) * 0.5 * this.partScale
    );
    this.attachPart(g, job);
  }

  clearPart() {
    if (!this.partGroup) return;
    this.partGroup.removeFromParent();
    this.partMaterials.forEach((m) => m.dispose());
    this.partGroup = null;
    this.detachExtras?.();
  }

  advance(dt) {
    switch (this.state) {
      case 'heating':
        this.phaseTime += dt;
        if (this.phaseTime >= this.heatDuration) {
          this.state = 'printing';
          this.phaseTime = 0;
        }
        break;
      case 'printing':
        this.phaseTime += dt;
        this.progress = Math.min(1, this.progress + dt / this.job.printSeconds);
        if (this.progress >= 1) {
          this.state = 'finishing';
          this.phaseTime = 0;
        }
        break;
      case 'finishing':
        this.phaseTime += dt;
        if (this.phaseTime >= this.finishDuration) {
          this.state = 'done';
          this.phaseTime = 0;
          this.hooks.toast(`🔔 ${this.name}: "${this.job.partName}" concluída! Vá até a impressora para retirar.`, 'success', 5000);
        }
        break;
    }
    this._displayTimer -= dt;
    if (this._displayTimer <= 0) {
      this._displayTimer = 0.25;
      this.drawDisplay();
    }
  }

  /** Tela LCD da própria impressora (CanvasTexture). */
  drawDisplay() {
    const c = this.display.ctx;
    const w = 256;
    const h = 144;
    c.fillStyle = '#0b1118';
    c.fillRect(0, 0, w, h);
    c.fillStyle = '#5fb8ff';
    c.font = 'bold 16px sans-serif';
    c.fillText(this.tech === 'fdm' ? 'FDM · PLA/PETG' : 'SLA · LCD 8K', 10, 22);
    c.fillStyle = '#e8eef5';
    c.font = 'bold 20px sans-serif';
    c.fillText(this.stateLabel, 10, 50);
    c.font = '13px sans-serif';
    c.fillStyle = '#9fb0c3';
    c.fillText(this.job ? this.job.partName : 'Aguardando arquivo...', 10, 72);
    // barra de progresso
    c.fillStyle = '#1f2a36';
    c.fillRect(10, 86, w - 20, 16);
    c.fillStyle = this.state === 'done' ? '#3ddc84' : '#ff7a1a';
    c.fillRect(10, 86, (w - 20) * this.progress, 16);
    c.fillStyle = '#fff';
    c.font = 'bold 14px monospace';
    c.fillText(`${this.percent}%`, w - 58, 99);
    c.font = '12px monospace';
    c.fillStyle = '#9fb0c3';
    c.fillText(this.displayFooter(), 10, 128);
    this.display.update();
  }
}

/* ===================================================================== */
/*  Impressora FDM (cartesiana "bed-slinger" — X no pórtico, Y na mesa) */
/* ===================================================================== */
export class FDMPrinter extends BasePrinter {
  constructor(hooks) {
    super('Impressora FDM', 'fdm', hooks);
    this.partScale = 1;
    this.heatDuration = 3.5;
    this.finishDuration = 2.5;
    this.nozzleTemp = 25;
    this.bedTemp = 25;
    this.bedTopY = 0.092; // superfície de impressão (local)
    this.head = { x: -0.1, y: 0.3, z: 0.09 };
    this.buildModel();
  }

  buildModel() {
    const g = this.group;
    const frame = new THREE.MeshStandardMaterial({ color: 0x1b1d20, roughness: 0.45, metalness: 0.3 });
    // Base e trilhos do eixo Y
    add(g, box(0.44, 0.06, 0.42), frame, 0, 0.03, 0);
    for (const sx of [-0.06, 0.06]) add(g, box(0.02, 0.02, 0.4), M.alu, sx, 0.07, 0, { cast: false });
    // Fonte / caixa de eletrônica
    add(g, box(0.1, 0.07, 0.2), frame, 0.24, 0.035, -0.05);
    // Mesa aquecida (move em Z local = eixo Y da máquina)
    this.bed = new THREE.Group();
    this.bed.position.y = 0.08;
    add(this.bed, box(0.25, 0.006, 0.25), M.alu, 0, 0.0, 0);
    add(this.bed, box(0.235, 0.004, 0.235), new THREE.MeshStandardMaterial({ color: 0x3a3226, roughness: 0.55, metalness: 0.3 }), 0, 0.005, 0, { cast: false });
    for (const sx of [-0.11, 0.11]) for (const sz of [-0.11, 0.11]) add(this.bed, cyl(0.008, 0.008, 0.01, 10), M.yellow, sx, -0.007, sz, { cast: false });
    g.add(this.bed);
    // Colunas Z (perfis 2040)
    for (const sx of [-0.2, 0.2]) add(g, box(0.04, 0.48, 0.02), frame, sx, 0.3, -0.02);
    add(g, box(0.44, 0.02, 0.04), frame, 0, 0.55, -0.02);
    // Fusos Z
    for (const sx of [-0.17, 0.17]) add(g, cyl(0.004, 0.004, 0.44, 8), M.alu, sx, 0.29, 0.0, { cast: false });
    // Pórtico X (sobe/desce em Z)
    this.gantry = new THREE.Group();
    add(this.gantry, box(0.44, 0.02, 0.02), frame, 0, 0, 0.0);
    for (const sx of [-0.2, 0.2]) add(this.gantry, box(0.05, 0.05, 0.045), frame, sx, 0, 0.0);
    g.add(this.gantry);
    // Cabeçote (move em X no pórtico)
    this.carriage = new THREE.Group();
    add(this.carriage, box(0.055, 0.07, 0.05), frame, 0, -0.005, 0.035);
    add(this.carriage, box(0.045, 0.045, 0.006), M.darkGrey, 0, 0, 0.062, { cast: false });
    this.fan = add(this.carriage, cyl(0.018, 0.018, 0.004, 12), M.midGrey, 0, 0, 0.066, { rx: Math.PI / 2, cast: false });
    add(this.carriage, box(0.02, 0.025, 0.02), M.alu, 0, -0.05, 0.035); // bloco aquecedor
    add(this.carriage, cyl(0.001, 0.005, 0.01, 8), new THREE.MeshStandardMaterial({ color: 0xd4a73a, metalness: 0.8, roughness: 0.3 }), 0, -0.067, 0.035, { cast: false });
    this.nozzleGlow = add(this.carriage, new THREE.SphereGeometry(0.004, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff7a1a, transparent: true, opacity: 0 }), 0, -0.073, 0.035, { cast: false });
    this.gantry.add(this.carriage);
    // Bobina de filamento no topo
    this.spool = new THREE.Group();
    this.spool.position.set(0, 0.62, -0.03);
    add(this.spool, cyl(0.1, 0.1, 0.06, 28), M.black, 0, 0, 0, { rz: Math.PI / 2 });
    this.spoolFil = add(this.spool, cyl(0.085, 0.085, 0.055, 28), new THREE.MeshStandardMaterial({ color: 0x2f6bff, roughness: 0.4 }), 0, 0, 0, { rz: Math.PI / 2 });
    add(g, box(0.02, 0.06, 0.02), frame, 0, 0.58, -0.03);
    g.add(this.spool);
    // Tela de status (frente, à direita)
    add(g, box(0.1, 0.065, 0.03), frame, 0.155, 0.08, 0.215, { rx: -0.5 });
    const screen = add(g, new THREE.PlaneGeometry(0.088, 0.05), new THREE.MeshBasicMaterial({ map: this.display.texture, toneMapped: false }), 0.155, 0.083, 0.2315, { rx: -0.5, cast: false });
    screen.renderOrder = 2;
    // LED de status
    this.led = add(g, new THREE.SphereGeometry(0.006, 8, 6), new THREE.MeshBasicMaterial({ color: 0x3ddc84 }), -0.19, 0.045, 0.211, { cast: false });
    this.addHitbox(0.48, 0.7, 0.46);
    this.updateHead(0);
  }

  attachPart(g, job) {
    g.position.set(0, 0.0075, 0);
    this.bed.add(g);
    this.spoolFil.material.color.set(job.color);
    // Ciclo de animação do cabeçote proporcional à velocidade escolhida
    this.pathSpeed = 1.6 + job.speed / 55;
  }

  displayFooter() {
    return `Bico ${this.nozzleTemp.toFixed(0)}°C  Mesa ${this.bedTemp.toFixed(0)}°C`;
  }

  update(dt, t) {
    this.advance(dt);
    const s = this.state;
    const job = this.job;
    const tNoz = s === 'heating' || s === 'printing' ? (job?.nozzle ?? 210) : 25;
    const tBed = s === 'heating' || s === 'printing' || s === 'finishing' ? 60 : 25;
    this.nozzleTemp = damp(this.nozzleTemp, tNoz, s === 'heating' ? 1.4 : 0.4, dt);
    this.bedTemp = damp(this.bedTemp, tBed, s === 'heating' ? 1.2 : 0.3, dt);

    // Altura impressa quantizada por camada
    let h = 0;
    if (job) {
      const layer = this.currentLayer();
      h = (layer / job.layers) * this.partHeight;
      if (s === 'finishing' || s === 'done') h = this.partHeight;
    }

    // Alvos do cabeçote
    let tx = -0.1;
    let tz = 0.09;
    let ty = 0.3;
    let k = 4;
    if (s === 'heating') {
      tx = -0.19; tz = 0; ty = this.bedTopY + 0.02; k = 3;
    } else if (s === 'printing') {
      const u = t * this.pathSpeed;
      // Trajetória tipo Lissajous cobrindo a área da camada (perímetros + preenchimento)
      tx = Math.sin(u * 1.0) * this.partHalf.x * 0.95;
      tz = -Math.sin(u * 1.618 + 0.7) * this.partHalf.y * 0.95; // mesa se move ao contrário
      ty = this.bedTopY + h + 0.0004;
      k = 22;
    } else if (s === 'finishing' || s === 'done') {
      tx = -0.18; tz = 0.1; ty = Math.min(0.45, this.bedTopY + this.partHeight + 0.06); k = 3;
    }
    this.head.x = damp(this.head.x, tx, k, dt);
    this.head.z = damp(this.head.z, tz, k, dt);
    this.head.y = damp(this.head.y, ty, k, dt);
    this.updateHead(dt);

    // Planos de corte (mundo). A impressora só tem rotação em Y, então Y mundo = Y grupo + Y local.
    const bedWorldY = this.group.position.y + this.bedTopY;
    this.clipPlane.constant = bedWorldY + h + 1e-4; // mantém y <= topo da camada
    const printing = s === 'printing';
    this.bandPlanes[0].constant = bedWorldY + h + 1e-4;
    this.bandPlanes[1].constant = -(bedWorldY + h - 0.0016);
    if (this.bandMesh) this.bandMesh.visible = printing && h > 0.0005;

    // Detalhes
    this.fan.rotation.y += dt * (printing ? 40 : 4);
    if (printing) this.spool.rotation.x -= dt * 0.6;
    this.nozzleGlow.material.opacity = printing ? 0.6 + Math.sin(t * 20) * 0.2 : 0;
    this.led.material.color.set(s === 'done' ? 0x3ddc84 : printing || s === 'heating' ? 0xff7a1a : s === 'ready' ? 0x5fb8ff : 0x3ddc84);
  }

  updateHead() {
    // Bico na ponta do cabeçote: y local do bico = gantry.y - 0.072
    this.gantry.position.set(0, this.head.y + 0.072, -0.05);
    this.carriage.position.x = this.head.x;
    this.carriage.position.z = 0.0;
    this.bed.position.z = this.head.z; // mesa desliza: peça passa sob o bico
  }
}

/* ===================================================================== */
/*  Impressora de resina (MSLA) — plataforma invertida, LCD UV, cuba    */
/* ===================================================================== */
export class ResinPrinter extends BasePrinter {
  constructor(hooks) {
    super('Impressora de Resina', 'sla', hooks);
    this.partScale = 0.7;
    this.heatDuration = 3.0;
    this.finishDuration = 3.2;
    this.filmY = 0.212; // filme FEP no fundo da cuba (local)
    this.restY = 0.43; // base da plataforma em repouso
    this.plateY = this.restY;
    this.coverLift = 0;
    this.uv = 0;
    this.buildModel();
  }

  buildModel() {
    const g = this.group;
    const body = new THREE.MeshStandardMaterial({ color: 0x35383d, roughness: 0.55, metalness: 0.2 });
    // Base
    add(g, box(0.27, 0.2, 0.25), body, 0, 0.1, 0);
    add(g, box(0.27, 0.01, 0.25), M.darkGrey, 0, 0.205, 0, { cast: false });
    // Tela LCD UV (sob a cuba)
    this.lcdMat = new THREE.MeshBasicMaterial({ color: 0x1a1030, toneMapped: false });
    add(g, new THREE.PlaneGeometry(0.15, 0.095), this.lcdMat, 0, 0.2105, 0.0, { rx: -Math.PI / 2, cast: false });
    // Cuba de resina
    // (paredes da cuba levemente translúcidas para o jogador ver a peça emergindo)
    const vatMat = new THREE.MeshStandardMaterial({ color: 0xb4bac2, roughness: 0.25, metalness: 0.5, transparent: true, opacity: 0.45, depthWrite: false });
    add(g, box(0.2, 0.004, 0.15), new THREE.MeshStandardMaterial({ color: 0x9aa0a8, metalness: 0.6, roughness: 0.3, transparent: true, opacity: 0.35, depthWrite: false }), 0, 0.209, 0, { cast: false });
    for (const sx of [-0.095, 0.095]) add(g, box(0.01, 0.026, 0.15), vatMat, sx, 0.222, 0, { cast: false });
    for (const sz of [-0.072, 0.072]) add(g, box(0.2, 0.026, 0.01), vatMat, 0, 0.222, sz, { cast: false });
    this.resinMat = new THREE.MeshStandardMaterial({ color: 0x8b9099, roughness: 0.1, transparent: true, opacity: 0.5, depthWrite: false });
    add(g, box(0.18, 0.008, 0.134), this.resinMat, 0, 0.216, 0, { cast: false });
    // Coluna Z (traseira)
    add(g, box(0.05, 0.42, 0.04), body, 0, 0.41, -0.1);
    add(g, box(0.012, 0.4, 0.01), M.alu, 0, 0.41, -0.078, { cast: false });
    // Braço + plataforma de construção
    this.plate = new THREE.Group();
    add(this.plate, box(0.03, 0.03, 0.1), body, 0, 0.06, -0.05);
    add(this.plate, cyl(0.012, 0.012, 0.05, 10), M.alu, 0, 0.035, 0);
    add(this.plate, box(0.06, 0.02, 0.05), M.alu, 0, 0.02, 0);
    add(this.plate, box(0.13, 0.012, 0.085), new THREE.MeshStandardMaterial({ color: 0xc7ccd2, roughness: 0.35, metalness: 0.85 }), 0, 0.006, 0);
    g.add(this.plate);
    // Luz UV
    this.uvLight = new THREE.PointLight(0x8a4dff, 0, 0.7, 2);
    this.uvLight.position.set(0, 0.24, 0);
    g.add(this.uvLight);
    // Tampa laranja translúcida (levanta ao concluir)
    this.cover = new THREE.Group();
    const coverMat = M.orangeTrans.clone();
    coverMat.opacity = 0.34;
    add(this.cover, box(0.272, 0.4, 0.252), coverMat, 0, 0.405, 0, { cast: false });
    add(this.cover, box(0.08, 0.012, 0.02), M.black, 0, 0.6, 0.12, { cast: false });
    g.add(this.cover);
    // Tela frontal
    const screen = add(g, new THREE.PlaneGeometry(0.11, 0.062), new THREE.MeshBasicMaterial({ map: this.display.texture, toneMapped: false }), 0, 0.12, 0.1255, { cast: false });
    screen.renderOrder = 2;
    add(g, new THREE.PlaneGeometry(0.1, 0.018), new THREE.MeshBasicMaterial({ color: 0x9aa0a8 }), 0, 0.03, 0.1255, { cast: false });
    this.addHitbox(0.3, 0.62, 0.28);
    this.updatePlate();
  }

  attachPart(g, job) {
    // Peça de cabeça para baixo, presa à plataforma
    g.rotation.x = Math.PI;
    this.supportGap = job.supports ? 0.012 : 0;
    g.position.y = -this.supportGap;
    this.plate.add(g);
    this.totalHeight = this.partHeight + this.supportGap;
    this.resinMat.color.set(job.color).lerp(new THREE.Color(0x222222), 0.15);
    this.cycle = 0.55 + job.exposure * 0.12;

    if (job.supports) {
      const supMat = new THREE.MeshStandardMaterial({ color: job.color, roughness: 0.35, clippingPlanes: [this.clipPlane] });
      this.supports = new THREE.Group();
      const n = 3;
      for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) {
          const x = (i / (n - 1) - 0.5) * this.partHalf.x * 1.1;
          const z = (j / (n - 1) - 0.5) * this.partHalf.y * 1.1;
          const pin = new THREE.Mesh(new THREE.CylinderGeometry(0.0012, 0.0022, this.supportGap + 0.002, 6), supMat);
          pin.position.set(x, -(this.supportGap / 2), z);
          this.supports.add(pin);
        }
      }
      // jangada (raft) colada na plataforma
      const raft = new THREE.Mesh(new THREE.BoxGeometry(this.partHalf.x * 2 * 0.8, 0.0015, this.partHalf.y * 2 * 0.8), supMat);
      raft.position.y = -0.00075;
      this.supports.add(raft);
      this.supportMat = supMat;
      this.plate.add(this.supports);
    }
  }

  detachExtras() {
    if (this.supports) {
      this.supports.removeFromParent();
      this.supports.traverse((o) => o.geometry?.dispose());
      this.supportMat.dispose();
      this.supports = null;
    }
  }

  displayFooter() {
    if (!this.job) return 'UV 405nm · pronta';
    return `Camada ${this.currentLayer()}/${this.job.layers}  Exp ${this.job.exposure.toFixed(1)}s`;
  }

  update(dt, t) {
    this.advance(dt);
    const s = this.state;
    const H = this.totalHeight ?? 0;
    let lift = 0;
    let uvOn = false;

    if (s === 'heating') {
      this.plateY = THREE.MathUtils.lerp(this.restY, this.filmY, ease(this.phaseTime / this.heatDuration));
    } else if (s === 'printing') {
      // Ciclo de camada: expõe (UV) → descola (sobe) → retorna
      const ph = (this.phaseTime % this.cycle) / this.cycle;
      uvOn = ph < 0.45;
      const peel = 0.008;
      if (ph >= 0.45 && ph < 0.75) lift = ease((ph - 0.45) / 0.3) * peel;
      else if (ph >= 0.75) lift = (1 - ease((ph - 0.75) / 0.25)) * peel;
      this.plateY = this.filmY + this.progress * H + lift;
    } else if (s === 'finishing') {
      const top = Math.max(this.restY, this.filmY + H + 0.03);
      this.plateY = THREE.MathUtils.lerp(this.filmY + H, top, ease(this.phaseTime / this.finishDuration));
    } else if (s === 'done') {
      this.plateY = Math.max(this.restY, this.filmY + H + 0.03);
    } else {
      this.plateY = damp(this.plateY, this.restY, 3, dt);
    }
    this.updatePlate();

    // A peça só existe da plataforma até "progress * altura" abaixo dela
    const plateWorldY = this.group.position.y + this.plateY;
    const visibleFrom = plateWorldY - this.progress * H;
    this.clipPlane.normal.copy(UP);
    this.clipPlane.constant = -(visibleFrom - 1e-4); // mantém y >= visibleFrom
    this.bandPlanes[0].constant = visibleFrom + 0.0012; // y <= visibleFrom + δ
    this.bandPlanes[1].constant = -(visibleFrom - 1e-4); // y >= visibleFrom
    if (this.bandMesh) this.bandMesh.visible = uvOn && this.progress > 0.002;

    // UV piscando + tampa
    this.uv = damp(this.uv, uvOn ? 1 : 0, 30, dt);
    this.lcdMat.color.setRGB(0.1 + 0.45 * this.uv, 0.06 + 0.15 * this.uv, 0.19 + 0.8 * this.uv);
    this.uvLight.intensity = this.uv * 0.9;
    this.coverLift = damp(this.coverLift, s === 'done' ? 0.34 : 0, 3, dt);
    this.cover.position.y = this.coverLift;
  }

  updatePlate() {
    this.plate.position.y = this.plateY;
  }
}
