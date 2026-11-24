import * as THREE from 'three';
import { PARTS, getPart, getPartGeometry } from './models.js';
import { gridPlateTexture } from './textures.js';

const MATERIALS = {
  fdm: [
    { name: 'PLA Laranja', color: '#ff7a1a', nozzle: 210 },
    { name: 'PLA Azul', color: '#2f6bff', nozzle: 210 },
    { name: 'PETG Preto', color: '#2a2d33', nozzle: 240 },
    { name: 'PLA Branco', color: '#eeeeea', nozzle: 210 },
    { name: 'PLA Verde', color: '#2fbf71', nozzle: 210 },
  ],
  sla: [
    { name: 'Resina Cinza', color: '#8b9099' },
    { name: 'Resina Âmbar', color: '#e0a040' },
    { name: 'Resina Branca', color: '#e6e4de' },
    { name: 'Resina Rosa', color: '#e85a9a' },
  ],
};

const SLICE_STEPS = {
  fdm: ['Analisando malha...', 'Gerando perímetros...', 'Calculando preenchimento...', 'Otimizando trajetórias...', 'Escrevendo G-code...'],
  sla: ['Analisando malha...', 'Orientando peça...', 'Gerando suportes...', 'Rasterizando camadas...', 'Comprimindo arquivo .ctb...'],
};

const RESIN_SCALE = 0.7;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const fmtTime = (min) => {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return h ? `${h}h ${String(m).padStart(2, '0')}min` : `${m} min`;
};

/** Software de fatiamento (overlay 2D + mini-viewport 3D próprio). */
export class SlicerUI {
  constructor(root, { onSend, onClose }) {
    this.root = root;
    this.onSend = onSend;
    this.onClose = onClose;
    this.isOpen = false;
    this.state = {
      partId: PARTS[0].id,
      tech: 'fdm',
      fdm: { layer: 0.2, infill: 20, speed: 150, material: 0 },
      sla: { layer: 0.05, exposure: 2.5, supports: true, material: 0 },
      autoStart: false,
    };
    this.slicing = null; // { elapsed, duration }
    this.sliced = null; // job pronto
    this.layerView = 1;
    this.build();
  }

  /* ----------------------------- DOM ----------------------------- */
  build() {
    this.root.innerHTML = `
    <div class="slicer hidden">
      <div class="sl-topbar">
        <div class="sl-brand"><span class="sl-logo"></span>FatiaLab <b>3D</b><small>v2.6</small></div>
        <div class="sl-tabs"><span class="active">Preparar</span><span>Pré-visualizar</span><span>Dispositivo</span></div>
        <button class="sl-close" title="Fechar (ESC)">✕</button>
      </div>
      <div class="sl-body">
        <aside class="sl-left">
          <h3><i>1</i> Peça</h3>
          <div class="sl-parts"></div>
          <h3><i>2</i> Tecnologia</h3>
          <div class="sl-seg sl-tech">
            <button data-tech="fdm">Filamento (FDM)</button>
            <button data-tech="sla">Resina (SLA)</button>
          </div>
          <h3><i>3</i> Parâmetros</h3>
          <div class="sl-params"></div>
          <h3><i>4</i> Material</h3>
          <div class="sl-colors"></div>
        </aside>
        <main class="sl-view">
          <div class="sl-canvas"></div>
          <div class="sl-viewinfo"></div>
          <div class="sl-machine"></div>
          <div class="sl-layer hidden">
            <span>Camadas</span>
            <input type="range" min="0" max="100" value="100" />
            <b></b>
          </div>
        </main>
        <aside class="sl-right">
          <h3>Resumo</h3>
          <div class="sl-summary"></div>
          <div class="sl-progress hidden">
            <div class="sl-bar"><i></i></div>
            <div class="sl-step"></div>
          </div>
          <button class="sl-btn primary sl-slice">Fatiar</button>
          <label class="sl-check"><input type="checkbox" class="sl-auto" /> Iniciar impressão automaticamente</label>
          <button class="sl-btn send sl-send" disabled>Enviar para Impressora</button>
          <p class="sl-hint"><kbd>ESC</kbd> para sair do software</p>
        </aside>
      </div>
    </div>`;
    const q = (s) => this.root.querySelector(s);
    this.el = {
      panel: q('.slicer'),
      parts: q('.sl-parts'),
      tech: q('.sl-tech'),
      params: q('.sl-params'),
      colors: q('.sl-colors'),
      canvas: q('.sl-canvas'),
      viewinfo: q('.sl-viewinfo'),
      machine: q('.sl-machine'),
      layer: q('.sl-layer'),
      layerRange: q('.sl-layer input'),
      layerLabel: q('.sl-layer b'),
      summary: q('.sl-summary'),
      progress: q('.sl-progress'),
      bar: q('.sl-bar i'),
      step: q('.sl-step'),
      slice: q('.sl-slice'),
      send: q('.sl-send'),
      auto: q('.sl-auto'),
      close: q('.sl-close'),
    };

    this.el.parts.innerHTML = PARTS.map(
      (p) => `<button class="sl-part" data-part="${p.id}"><img alt="" /><span><b>${p.name}</b><small>${p.desc}</small></span></button>`
    ).join('');

    this.el.parts.addEventListener('click', (e) => {
      const b = e.target.closest('[data-part]');
      if (!b) return;
      this.state.partId = b.dataset.part;
      this.invalidate();
    });
    this.el.tech.addEventListener('click', (e) => {
      const b = e.target.closest('[data-tech]');
      if (!b) return;
      this.state.tech = b.dataset.tech;
      this.invalidate();
    });
    this.el.params.addEventListener('input', (e) => this.onParam(e));
    this.el.params.addEventListener('click', (e) => this.onParam(e));
    this.el.colors.addEventListener('click', (e) => {
      const b = e.target.closest('[data-mat]');
      if (!b) return;
      this.state[this.state.tech].material = Number(b.dataset.mat);
      this.invalidate(false);
    });
    this.el.slice.addEventListener('click', () => this.startSlicing());
    this.el.send.addEventListener('click', () => this.send());
    this.el.auto.addEventListener('change', () => (this.state.autoStart = this.el.auto.checked));
    this.el.close.addEventListener('click', () => this.onClose(true));
    this.el.layerRange.addEventListener('input', () => {
      this.layerView = Number(this.el.layerRange.value) / 100;
      this.updateLayerLabel();
    });

    this.renderAll();
  }

  onParam(e) {
    const t = e.target.closest('button, input');
    if (!t) return;
    if (e.type === 'click' && t.tagName === 'INPUT') return; // sliders já tratados no 'input'
    const tech = this.state.tech;
    const p = this.state[tech];
    if (t.dataset.layer && e.type === 'click') p.layer = Number(t.dataset.layer);
    else if (t.dataset.supports && e.type === 'click') p.supports = t.dataset.supports === 'yes';
    else if (t.name === 'infill') p.infill = Number(t.value);
    else if (t.name === 'speed') p.speed = Number(t.value);
    else if (t.name === 'exposure') p.exposure = Number(t.value);
    else return;
    if (e.type === 'input') {
      // atualiza só os rótulos e o resumo, sem recriar o DOM (mantém o arraste do slider)
      this.root.querySelectorAll('[data-out]').forEach((o) => (o.textContent = this.formatOut(o.dataset.out)));
      this.invalidate(false, false);
    } else this.invalidate(false);
  }

  formatOut(key) {
    const s = this.state;
    if (key === 'infill') return `${s.fdm.infill}%`;
    if (key === 'speed') return `${s.fdm.speed} mm/s`;
    if (key === 'exposure') return `${s.sla.exposure.toFixed(1)} s`;
    return '';
  }

  /** Qualquer mudança invalida o fatiamento atual. */
  invalidate(refreshPreview = true, rerender = true) {
    this.slicing = null;
    this.sliced = null;
    if (rerender) this.renderAll();
    else this.renderSummary();
    if (refreshPreview) this.refreshPreview();
    else this.applyPreviewMaterial();
  }

  renderAll() {
    const s = this.state;
    this.el.parts.querySelectorAll('[data-part]').forEach((b) => b.classList.toggle('active', b.dataset.part === s.partId));
    this.el.tech.querySelectorAll('[data-tech]').forEach((b) => b.classList.toggle('active', b.dataset.tech === s.tech));

    const seg = (attr, value, options) =>
      `<div class="sl-seg">${options.map(([v, label]) => `<button data-${attr}="${v}" class="${String(v) === String(value) ? 'active' : ''}">${label}</button>`).join('')}</div>`;

    if (s.tech === 'fdm') {
      const p = s.fdm;
      this.el.params.innerHTML = `
        <label>Altura de camada</label>
        ${seg('layer', p.layer, [[0.12, '0.12 mm<small>Fino</small>'], [0.2, '0.20 mm<small>Padrão</small>'], [0.28, '0.28 mm<small>Rascunho</small>']])}
        <label>Preenchimento (infill) <output data-out="infill">${p.infill}%</output></label>
        <input type="range" name="infill" min="0" max="100" step="5" value="${p.infill}" />
        <label>Velocidade de impressão <output data-out="speed">${p.speed} mm/s</output></label>
        <input type="range" name="speed" min="40" max="300" step="10" value="${p.speed}" />`;
    } else {
      const p = s.sla;
      this.el.params.innerHTML = `
        <label>Altura de camada</label>
        ${seg('layer', p.layer, [[0.03, '0.03 mm<small>Alta definição</small>'], [0.05, '0.05 mm<small>Padrão</small>']])}
        <label>Tempo de exposição <output data-out="exposure">${p.exposure.toFixed(1)} s</output></label>
        <input type="range" name="exposure" min="1" max="4" step="0.1" value="${p.exposure}" />
        <label>Suportes</label>
        ${seg('supports', p.supports ? 'yes' : 'no', [['yes', 'Sim'], ['no', 'Não']])}`;
    }

    const mats = MATERIALS[s.tech];
    const sel = s[s.tech].material;
    this.el.colors.innerHTML = mats
      .map((m, i) => `<button data-mat="${i}" class="${i === sel ? 'active' : ''}" title="${m.name}"><span style="background:${m.color}"></span>${m.name}</button>`)
      .join('');

    this.el.machine.textContent = s.tech === 'fdm' ? 'Impressora FDM · Mesa 235×235×250 mm · Bico 0.4' : 'Impressora de Resina · LCD 8K · 130×80×160 mm';
    this.renderSummary();
  }

  /* --------------------------- Estimativas --------------------------- */
  estimate() {
    const s = this.state;
    const part = getPart(s.partId);
    const geo = getPartGeometry(s.partId);
    const size = new THREE.Vector3();
    geo.boundingBox.getSize(size);
    const scale = s.tech === 'fdm' ? 1 : RESIN_SCALE;
    const dims = size.clone().multiplyScalar(scale * 1000);
    const mat = MATERIALS[s.tech][s[s.tech].material];

    if (s.tech === 'fdm') {
      const p = s.fdm;
      const layers = Math.ceil(dims.y / p.layer);
      const realMin = part.baseMinutes * Math.pow(0.2 / p.layer, 0.9) * (0.55 + (0.9 * p.infill) / 100) * Math.pow(150 / p.speed, 0.6);
      const grams = part.volume * (0.32 + (0.68 * p.infill) / 100) * 1.24;
      return {
        part, dims, layers, mat,
        realMin,
        printSeconds: clamp(realMin * 0.4, 25, 150),
        sliceSeconds: clamp(15 + layers / 60 + p.infill / 12, 15, 30),
        material: `${grams.toFixed(1)} g · ${(grams / 2.98).toFixed(2)} m de filamento`,
        cost: grams * 0.12,
      };
    }
    const p = s.sla;
    const layers = Math.ceil((dims.y + (p.supports ? 12 * RESIN_SCALE : 0)) / p.layer);
    const realMin = (layers * (p.exposure + 5.5)) / 60;
    const ml = part.volume * RESIN_SCALE * 0.75 * (p.supports ? 1.15 : 1);
    return {
      part, dims, layers, mat,
      realMin,
      printSeconds: clamp(realMin * 0.35, 25, 150),
      sliceSeconds: clamp(15 + layers / 120 + (p.supports ? 5 : 0), 15, 30),
      material: `${ml.toFixed(1)} ml de resina`,
      cost: ml * 0.25,
    };
  }

  renderSummary() {
    const e = this.estimate();
    const s = this.state;
    const status = this.sliced ? '<span class="ok">✔ Fatiado</span>' : this.slicing ? '<span class="run">Fatiando...</span>' : '<span class="no">Não fatiado</span>';
    const p = s[s.tech];
    const warn =
      s.tech === 'sla' && !p.supports && (s.partId === 'vase' || s.partId === 'bracket')
        ? '<div class="sl-warn">⚠ Peça com balanços: imprimir sem suportes pode falhar (simulação mantém a peça).</div>'
        : s.tech === 'sla' && p.exposure < 1.6
        ? '<div class="sl-warn">⚠ Exposição baixa: risco de camadas não curarem.</div>'
        : s.tech === 'fdm' && p.speed > 250
        ? '<div class="sl-warn">⚠ Velocidade alta: verifique o resfriamento.</div>'
        : '';
    this.el.summary.innerHTML = `
      <div class="sl-status">${status}</div>
      <dl>
        <dt>Peça</dt><dd>${e.part.name}</dd>
        <dt>Dimensões</dt><dd>${e.dims.x.toFixed(0)} × ${e.dims.z.toFixed(0)} × ${e.dims.y.toFixed(0)} mm</dd>
        <dt>Camadas</dt><dd>${e.layers}</dd>
        <dt>Tempo estimado</dt><dd>${fmtTime(e.realMin)}</dd>
        <dt>Tempo no jogo</dt><dd>~${Math.round(e.printSeconds)} s</dd>
        <dt>Material</dt><dd>${e.material}</dd>
        <dt>Custo</dt><dd>R$ ${e.cost.toFixed(2).replace('.', ',')}</dd>
      </dl>${warn}`;
    this.el.send.disabled = !this.sliced;
    this.el.send.textContent = this.sliced ? `Enviar para ${s.tech === 'fdm' ? 'Impressora FDM' : 'Impressora de Resina'}` : 'Enviar para Impressora';
    this.el.slice.disabled = !!this.slicing;
    this.el.slice.textContent = this.slicing ? 'Fatiando...' : this.sliced ? 'Fatiar novamente' : 'Fatiar';
    this.el.progress.classList.toggle('hidden', !this.slicing && !this.sliced);
    this.el.layer.classList.toggle('hidden', !this.sliced);
    if (!this.slicing && !this.sliced) this.el.bar.style.width = '0%';
    if (this.sliced) {
      this.el.bar.style.width = '100%';
      this.el.step.textContent = `Concluído · ${e.layers} camadas geradas`;
    }
    this.el.viewinfo.innerHTML = `<b>${e.part.name}</b><br>${e.dims.x.toFixed(1)} × ${e.dims.z.toFixed(1)} × ${e.dims.y.toFixed(1)} mm`;
  }

  /* --------------------------- Fatiamento --------------------------- */
  startSlicing() {
    if (this.slicing) return;
    const e = this.estimate();
    this.sliced = null;
    this.slicing = { elapsed: 0, duration: e.sliceSeconds };
    this.renderSummary();
  }

  finishSlicing() {
    const s = this.state;
    const e = this.estimate();
    const p = s[s.tech];
    this.sliced = {
      partId: s.partId,
      partName: e.part.name,
      tech: s.tech,
      color: e.mat.color,
      materialName: e.mat.name,
      nozzle: e.mat.nozzle,
      layerHeight: p.layer,
      infill: p.infill,
      speed: p.speed ?? 0,
      exposure: p.exposure ?? 0,
      supports: !!p.supports,
      layers: e.layers,
      printSeconds: e.printSeconds,
      realMinutes: e.realMin,
    };
    this.slicing = null;
    this.layerView = 1;
    this.el.layerRange.value = 100;
    this.updateLayerLabel();
    this.renderSummary();
  }

  send() {
    if (!this.sliced) return;
    const job = { ...this.sliced, autoStart: this.state.autoStart };
    this.onSend(job);
  }

  updateLayerLabel() {
    const e = this.estimate();
    this.el.layerLabel.textContent = `${Math.round(this.layerView * e.layers)} / ${e.layers}`;
  }

  /* ----------------------------- Abrir/fechar ----------------------------- */
  open() {
    this.isOpen = true;
    this.el.panel.classList.remove('hidden');
    if (!this.renderer) this.initPreview();
    this.resizePreview();
    this.refreshPreview();
  }

  close() {
    this.isOpen = false;
    this.el.panel.classList.add('hidden');
  }

  /* ----------------------------- Preview 3D ----------------------------- */
  initPreview() {
    const r = new THREE.WebGLRenderer({ antialias: true });
    r.setPixelRatio(Math.min(devicePixelRatio, 1.5));
    r.localClippingEnabled = true;
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer = r;
    this.el.canvas.appendChild(r.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1b1f26);
    scene.add(new THREE.HemisphereLight(0xffffff, 0x334055, 1.6));
    const d = new THREE.DirectionalLight(0xffffff, 2.2);
    d.position.set(0.3, 0.6, 0.4);
    scene.add(d);
    this.scene = scene;
    this.camera = new THREE.PerspectiveCamera(35, 1, 0.005, 10);

    // Mesas de impressão
    this.bedFDM = new THREE.Mesh(new THREE.BoxGeometry(0.235, 0.004, 0.235), new THREE.MeshStandardMaterial({ map: gridPlateTexture(512, 10, '#2c3038'), roughness: 0.7 }));
    this.bedFDM.position.y = -0.002;
    this.bedSLA = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.004, 0.08), new THREE.MeshStandardMaterial({ map: gridPlateTexture(256, 8, '#9aa3ad', 'rgba(0,0,0,0.15)'), roughness: 0.4, metalness: 0.6 }));
    this.bedSLA.position.y = -0.002;
    const vol = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(0.235, 0.25, 0.235)), new THREE.LineBasicMaterial({ color: 0x3e7bd6, transparent: true, opacity: 0.35 }));
    vol.position.y = 0.125;
    this.volFDM = vol;
    const volS = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(0.13, 0.16, 0.08)), new THREE.LineBasicMaterial({ color: 0xa06bff, transparent: true, opacity: 0.4 }));
    volS.position.y = 0.08;
    this.volSLA = volS;
    scene.add(this.bedFDM, this.bedSLA, vol, volS);

    // Peça: frente + verso + faixa da camada (com planos de corte)
    this.clip = new THREE.Plane(new THREE.Vector3(0, -1, 0), 10);
    this.bandPlanes = [new THREE.Plane(new THREE.Vector3(0, -1, 0), 0), new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)];
    this.matFront = new THREE.MeshStandardMaterial({ roughness: 0.5, clippingPlanes: [this.clip] });
    this.matBack = new THREE.MeshBasicMaterial({ side: THREE.BackSide, clippingPlanes: [this.clip] });
    this.matBand = new THREE.MeshBasicMaterial({ color: 0xffd34d, side: THREE.DoubleSide, clippingPlanes: this.bandPlanes, toneMapped: false });
    this.pivot = new THREE.Group();
    this.mFront = new THREE.Mesh(undefined, this.matFront);
    this.mBack = new THREE.Mesh(undefined, this.matBack);
    this.mBand = new THREE.Mesh(undefined, this.matBand);
    this.mBand.scale.setScalar(1.006);
    this.pivot.add(this.mFront, this.mBack, this.mBand);
    scene.add(this.pivot);

    // Plano "scanner" que sobe durante o fatiamento
    this.scan = new THREE.Mesh(new THREE.PlaneGeometry(0.26, 0.26), new THREE.MeshBasicMaterial({ color: 0x46b4ff, transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false }));
    this.scan.rotation.x = -Math.PI / 2;
    scene.add(this.scan);

    this.makeThumbnails();
    new ResizeObserver(() => this.resizePreview()).observe(this.el.canvas);
  }

  makeThumbnails() {
    const r = this.renderer;
    const prevBg = this.scene.background;
    r.setSize(160, 120, false);
    this.camera.aspect = 160 / 120;
    this.camera.updateProjectionMatrix();
    this.bedFDM.visible = this.bedSLA.visible = this.volFDM.visible = this.volSLA.visible = this.scan.visible = false;
    this.mBand.visible = false;
    this.scene.background = new THREE.Color(0x262b34);
    this.clip.constant = 10;
    this.matFront.color.set('#ff8a3a');
    this.matBack.color.set('#7a3a10');
    const imgs = this.el.parts.querySelectorAll('img');
    PARTS.forEach((p, i) => {
      const geo = getPartGeometry(p.id);
      this.setGeometry(geo, 1);
      this.pivot.rotation.y = 0.6;
      this.frameCamera(geo.boundingSphere.radius, geo.boundingBox.max.y / 2, 2.4);
      r.render(this.scene, this.camera);
      imgs[i].src = r.domElement.toDataURL();
    });
    this.scene.background = prevBg;
    this.bedFDM.visible = this.bedSLA.visible = this.volFDM.visible = this.volSLA.visible = this.scan.visible = true;
  }

  setGeometry(geo, scale) {
    this.mFront.geometry = this.mBack.geometry = this.mBand.geometry = geo;
    this.pivot.scale.setScalar(scale);
  }

  frameCamera(radius, targetY, dist = 3.3) {
    const d = radius * dist;
    this.camera.position.set(d * 0.75, targetY + d * 0.55, d * 0.9);
    this.camera.lookAt(0, targetY, 0);
  }

  resizePreview() {
    if (!this.renderer) return;
    const w = this.el.canvas.clientWidth || 600;
    const h = this.el.canvas.clientHeight || 400;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  refreshPreview() {
    if (!this.renderer) return;
    const s = this.state;
    const geo = getPartGeometry(s.partId);
    const scale = s.tech === 'fdm' ? 1 : RESIN_SCALE;
    this.setGeometry(geo, scale);
    const fdm = s.tech === 'fdm';
    this.bedFDM.visible = this.volFDM.visible = fdm;
    this.bedSLA.visible = this.volSLA.visible = !fdm;
    this.frameCamera(Math.max(geo.boundingSphere.radius * scale, fdm ? 0.07 : 0.05), (geo.boundingBox.max.y * scale) / 2);
    this.applyPreviewMaterial();
  }

  applyPreviewMaterial() {
    if (!this.renderer) return;
    const s = this.state;
    const c = new THREE.Color(MATERIALS[s.tech][s[s.tech].material].color);
    this.matFront.color.copy(c);
    this.matBack.color.copy(c).multiplyScalar(0.4);
    this.matFront.roughness = s.tech === 'fdm' ? 0.55 : 0.3;
  }

  /* ----------------------------- Loop ----------------------------- */
  update(dt) {
    if (this.slicing) {
      this.slicing.elapsed += dt;
      const k = Math.min(1, this.slicing.elapsed / this.slicing.duration);
      this.el.bar.style.width = `${(k * 100).toFixed(1)}%`;
      const steps = SLICE_STEPS[this.state.tech];
      const left = Math.ceil(this.slicing.duration - this.slicing.elapsed);
      this.el.step.textContent = `${steps[Math.min(steps.length - 1, Math.floor(k * steps.length))]} ${Math.round(k * 100)}% · ~${left}s`;
      if (k >= 1) this.finishSlicing();
    }
    if (!this.isOpen || !this.renderer) return;

    this.pivot.rotation.y += dt * 0.5;
    const scale = this.state.tech === 'fdm' ? 1 : RESIN_SCALE;
    const H = getPartGeometry(this.state.partId).boundingBox.max.y * scale;

    // Corte: durante o fatiamento o plano varre a peça; depois, o slider de camadas controla
    let cut = 10;
    let band = false;
    if (this.slicing) {
      const k = Math.min(1, this.slicing.elapsed / this.slicing.duration);
      this.scan.visible = true;
      this.scan.position.y = k * H;
      band = true;
      cut = k * H;
      this.clip.constant = 10;
    } else {
      this.scan.visible = false;
      if (this.sliced) {
        cut = this.layerView * H;
        band = this.layerView < 0.999;
      }
      this.clip.constant = cut + 1e-4;
    }
    this.bandPlanes[0].constant = cut + 0.0008;
    this.bandPlanes[1].constant = -(cut - 0.0008);
    this.mBand.visible = band;
    this.renderer.render(this.scene, this.camera);
  }
}
