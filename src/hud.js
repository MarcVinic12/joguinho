/** Camada 2D do jogo: mira, dica de interação, toasts, painel das impressoras e inventário. */
export class HUD {
  constructor() {
    this.root = document.getElementById('hud');
    this.crosshair = document.getElementById('crosshair');
    this.prompt = document.getElementById('prompt');
    this.toasts = document.getElementById('toasts');
    this.panel = document.getElementById('printer-panel');
    this.inventory = document.getElementById('inventory');
    this.overlay = document.getElementById('overlay');
    this.overlaySub = document.getElementById('overlay-sub');
    this.playBtn = document.getElementById('play-btn');
    this._lastPrompt = undefined;
    this._panelTimer = 0;
    this.collected = [];
    this.touch = false;
    this.onTargetChange = null;
    this._lastMode = undefined;
    this.renderInventory();
  }

  /** Ajusta textos e instruções para celular. */
  setTouchMode() {
    this.touch = true;
    document.querySelector('.overlay-keys').innerHTML = `
      <li><b>Lado esquerdo</b> arraste para andar</li>
      <li><b>Empurre até o fim</b> para correr</li>
      <li><b>Lado direito</b> arraste para olhar</li>
      <li><b>USAR</b> ou toque rápido para interagir</li>
      <li><b>❚❚</b> pausar</li>
      <li><b>Dica:</b> use o celular deitado</li>`;
    this.playBtn.textContent = 'Toque para jogar';
  }

  /** mode: false | 'info' | 'action' */
  setTarget(text, mode) {
    if (mode !== this._lastMode) {
      this._lastMode = mode;
      this.onTargetChange?.(mode);
    }
    this.crosshair.classList.toggle('info', mode === 'info');
    this.crosshair.classList.toggle('action', mode === 'action');
    if (text === this._lastPrompt) return;
    this._lastPrompt = text;
    if (!text) {
      this.prompt.classList.add('hidden');
      return;
    }
    this.prompt.classList.remove('hidden');
    this.prompt.innerHTML = text.replace(/^\[E\]/, this.touch ? '<kbd>USAR</kbd>' : '<kbd>E</kbd>');
  }

  toast(message, type = 'info', ms = 3600) {
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.textContent = message;
    this.toasts.appendChild(el);
    requestAnimationFrame(() => el.classList.add('show'));
    setTimeout(() => {
      el.classList.remove('show');
      setTimeout(() => el.remove(), 400);
    }, ms);
  }

  showOverlay(variant) {
    this.overlay.classList.remove('hidden');
    if (variant === 'pause') {
      this.overlaySub.textContent = 'Jogo pausado. As impressoras continuam trabalhando enquanto você não está olhando.';
      this.playBtn.textContent = this.touch ? 'Toque para continuar' : 'Clique para continuar';
    } else if (variant === 'resume') {
      this.overlaySub.textContent = 'Você saiu do software de fatiamento.';
      this.playBtn.textContent = this.touch ? 'Toque para voltar ao laboratório' : 'Clique para voltar ao laboratório';
    }
  }

  hideOverlay() {
    this.overlay.classList.add('hidden');
  }

  setGameHudVisible(v) {
    this.root.classList.toggle('dimmed', !v);
  }

  updatePrinters(printers, dt) {
    this._panelTimer -= dt;
    if (this._panelTimer > 0) return;
    this._panelTimer = 0.2;
    this.panel.innerHTML = printers
      .map((p) => {
        const cls = p.state === 'done' ? 'done' : p.state === 'idle' ? 'idle' : 'busy';
        return `<div class="pp-row ${cls}">
          <div class="pp-head"><span class="pp-dot"></span><b>${p.name}</b><span class="pp-state">${p.stateLabel}</span></div>
          ${p.job ? `<div class="pp-job">${p.job.partName}</div>` : ''}
          <div class="pp-bar"><i style="width:${(p.progress * 100).toFixed(1)}%"></i></div>
          <div class="pp-pct">${p.percent}%</div>
        </div>`;
      })
      .join('');
  }

  addCollected(job) {
    this.collected.push(job);
    this.renderInventory();
  }

  renderInventory() {
    const n = this.collected.length;
    this.inventory.innerHTML = `<b>Peças produzidas: ${n}</b>${this.collected
      .slice(-4)
      .map((j) => `<div><span style="background:${j.color}"></span>${j.partName} · ${j.tech === 'fdm' ? 'FDM' : 'SLA'}</div>`)
      .join('')}`;
  }
}
