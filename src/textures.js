import * as THREE from 'three';

/** Cria uma CanvasTexture estática desenhada por `draw(ctx, w, h)`. */
export function canvasTexture(width, height, draw, { repeat = null, srgb = true } = {}) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  draw(ctx, width, height);
  const tex = new THREE.CanvasTexture(canvas);
  if (srgb) tex.colorSpace = THREE.SRGBColorSpace;
  if (repeat) {
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(repeat[0], repeat[1]);
  }
  tex.anisotropy = 4;
  return tex;
}

/** Textura dinâmica: devolve { canvas, ctx, texture, update() }. */
export function dynamicTexture(width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return { canvas, ctx, texture, update: () => (texture.needsUpdate = true) };
}

// Pseudo-aleatório determinístico (as texturas saem iguais a cada carregamento)
function rng(seed = 1) {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
}

export function floorTexture() {
  return canvasTexture(
    512,
    512,
    (c, w, h) => {
      const r = rng(7);
      c.fillStyle = '#b4b8bc';
      c.fillRect(0, 0, w, h);
      for (let i = 0; i < 9000; i++) {
        const v = 160 + Math.floor(r() * 50);
        c.fillStyle = `rgba(${v},${v + 2},${v + 5},0.35)`;
        c.fillRect(r() * w, r() * h, 2, 2);
      }
      // manchas suaves de epóxi
      for (let i = 0; i < 14; i++) {
        const g = c.createRadialGradient(r() * w, r() * h, 0, r() * w, r() * h, 120);
        g.addColorStop(0, 'rgba(255,255,255,0.07)');
        g.addColorStop(1, 'rgba(255,255,255,0)');
        c.fillStyle = g;
        c.fillRect(0, 0, w, h);
      }
      // juntas de dilatação
      c.strokeStyle = 'rgba(80,84,90,0.35)';
      c.lineWidth = 2;
      c.strokeRect(1, 1, w - 2, h - 2);
    },
    { repeat: [6, 5] }
  );
}

export function wallpaperTexture() {
  return canvasTexture(512, 300, (c, w, h) => {
    const g = c.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, '#1c4fd6');
    g.addColorStop(1, '#4fa3ff');
    c.fillStyle = g;
    c.fillRect(0, 0, w, h);
    c.strokeStyle = 'rgba(255,255,255,0.25)';
    for (let i = 0; i < 6; i++) {
      c.lineWidth = 10 - i;
      c.beginPath();
      c.arc(w * 0.68, h * 0.55, 30 + i * 22, 0, Math.PI * 2);
      c.stroke();
    }
    c.fillStyle = '#ffffff';
    c.fillRect(30, 40, 150, 210);
    c.fillStyle = '#e63946';
    c.fillRect(40, 52, 130, 28);
    c.fillStyle = '#1c4fd6';
    c.font = 'bold 22px sans-serif';
    c.fillText('MANUFATURA', 42, 120);
    c.fillText('ADITIVA', 42, 148);
    c.font = '14px sans-serif';
    c.fillStyle = '#333';
    c.fillText('Seletiva Nacional', 42, 180);
    c.fillStyle = 'rgba(0,0,0,0.35)';
    c.fillRect(0, h - 22, w, 22);
  });
}

export function cadTexture() {
  return canvasTexture(512, 300, (c, w, h) => {
    c.fillStyle = '#3b3f46';
    c.fillRect(0, 0, w, h);
    c.fillStyle = '#2a2d33';
    c.fillRect(0, 0, w, 26);
    c.fillStyle = '#4a4f57';
    for (let i = 0; i < 14; i++) c.fillRect(8 + i * 26, 5, 18, 16);
    c.fillStyle = '#2f3238';
    c.fillRect(w - 90, 26, 90, h - 26);
    c.fillStyle = '#555b64';
    for (let i = 0; i < 10; i++) c.fillRect(w - 82, 40 + i * 20, 70, 10);
    // grade
    c.strokeStyle = 'rgba(255,255,255,0.06)';
    for (let x = 0; x < w - 90; x += 20) { c.beginPath(); c.moveTo(x, 26); c.lineTo(x, h); c.stroke(); }
    for (let y = 26; y < h; y += 20) { c.beginPath(); c.moveTo(0, y); c.lineTo(w - 90, y); c.stroke(); }
    // peça no CAD (como na foto)
    c.strokeStyle = '#d9a3a3';
    c.lineWidth = 9;
    c.beginPath();
    c.arc(250, 160, 70, 0.3, Math.PI * 1.7);
    c.stroke();
    c.lineWidth = 7;
    c.beginPath(); c.moveTo(120, 120); c.lineTo(180, 140); c.stroke();
    c.beginPath(); c.arc(250, 160, 30, 0, Math.PI * 2); c.stroke();
    c.fillStyle = '#c9cdd3';
    c.beginPath(); c.arc(105, 115, 14, 0, Math.PI * 2); c.fill();
  });
}

export function codeTexture() {
  return canvasTexture(512, 300, (c, w, h) => {
    const r = rng(3);
    c.fillStyle = '#1e1f22';
    c.fillRect(0, 0, w, h);
    c.fillStyle = '#2b2d31';
    c.fillRect(0, 0, 90, h);
    for (let y = 18; y < h; y += 13) {
      const x0 = 110 + Math.floor(r() * 3) * 16;
      const len = 60 + r() * 300;
      c.fillStyle = r() > 0.7 ? '#7aa2f7' : r() > 0.5 ? '#9ece6a' : '#a9b1c6';
      c.fillRect(x0, y, len, 5);
    }
    for (let y = 20; y < h; y += 24) { c.fillStyle = '#444'; c.fillRect(10, y, 64, 8); }
  });
}

export function laptopTexture() {
  return canvasTexture(256, 160, (c, w, h) => {
    c.fillStyle = '#16181d';
    c.fillRect(0, 0, w, h);
    c.fillStyle = '#2d3140';
    c.fillRect(70, 50, 120, 46);
    c.fillStyle = '#e0e0e0';
    c.font = '11px sans-serif';
    c.fillText('Bom dia, Marcus', 86, 70);
    c.fillStyle = '#3d7bff';
    c.fillRect(86, 78, 40, 10);
  });
}

export function bannerTexture(number, title) {
  return canvasTexture(256, 640, (c, w, h) => {
    const g = c.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#3a2d86');
    g.addColorStop(1, '#25205c');
    c.fillStyle = g;
    c.fillRect(0, 0, w, h);
    c.fillStyle = 'rgba(255,255,255,0.08)';
    c.beginPath(); c.moveTo(0, 0); c.lineTo(w, 140); c.lineTo(w, 0); c.fill();
    c.fillStyle = '#ffffff';
    c.font = 'bold 13px sans-serif';
    c.fillText('Aqui, habilidade vira inovação.', 18, 60);
    c.font = 'bold 30px sans-serif';
    const words = title.split(' ');
    let y = 250;
    let line = '';
    for (const word of words) {
      const test = line ? line + ' ' + word : word;
      if (c.measureText(test).width > w - 36) { c.fillText(line, 18, y); y += 36; line = word; } else line = test;
    }
    c.fillText(line, 18, y);
    c.font = 'bold 26px sans-serif';
    c.fillText('SENAI', 18, y + 60);
    c.fillStyle = '#ff6b2c';
    c.fillRect(0, h - 120, w, 120);
    c.fillStyle = '#ffffff';
    c.font = 'bold 72px sans-serif';
    c.fillText('#' + number, 30, h - 36);
  });
}

export function zebraTexture() {
  return canvasTexture(
    256,
    32,
    (c, w, h) => {
      c.fillStyle = '#f2c21b';
      c.fillRect(0, 0, w, h);
      c.fillStyle = '#121212';
      for (let x = -h; x < w + h; x += 40) {
        c.beginPath();
        c.moveTo(x, h); c.lineTo(x + 20, h); c.lineTo(x + 20 + h, 0); c.lineTo(x + h, 0);
        c.fill();
      }
    },
    { repeat: [3, 1] }
  );
}

export function cuttingMatTexture() {
  return canvasTexture(512, 256, (c, w, h) => {
    c.fillStyle = '#3e8c6a';
    c.fillRect(0, 0, w, h);
    c.strokeStyle = 'rgba(230,255,240,0.35)';
    c.lineWidth = 1;
    for (let x = 0; x < w; x += 16) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, h); c.stroke(); }
    for (let y = 0; y < h; y += 16) { c.beginPath(); c.moveTo(0, y); c.lineTo(w, y); c.stroke(); }
    c.strokeStyle = 'rgba(255,255,255,0.6)';
    c.lineWidth = 2;
    c.strokeRect(8, 8, w - 16, h - 16);
  });
}

export function labelTexture(text, { bg = '#111', fg = '#fff', width = 512, height = 128, font = 'bold 56px sans-serif' } = {}) {
  return canvasTexture(width, height, (c, w, h) => {
    c.fillStyle = bg;
    c.fillRect(0, 0, w, h);
    c.fillStyle = fg;
    c.font = font;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText(text, w / 2, h / 2);
  });
}

export function officeWindowTexture() {
  return canvasTexture(512, 256, (c, w, h) => {
    const g = c.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#f4f6f8');
    g.addColorStop(1, '#d9dde2');
    c.fillStyle = g;
    c.fillRect(0, 0, w, h);
    c.fillStyle = '#c94a3a';
    c.fillRect(20, 30, 40, 226);
    c.fillStyle = '#ffffff';
    c.fillRect(300, 40, 160, 90);
    c.fillStyle = '#9aa1aa';
    c.font = 'bold 26px sans-serif';
    c.fillText('worldskills', 310, 95);
    c.fillStyle = '#5f6670';
    c.fillRect(120, 160, 140, 10);
    c.fillRect(130, 170, 8, 60);
    c.fillRect(240, 170, 8, 60);
    c.fillStyle = '#3c8a3c';
    c.beginPath(); c.arc(470, 190, 26, 0, Math.PI * 2); c.fill();
    c.fillStyle = 'rgba(255,255,255,0.18)';
    c.beginPath(); c.moveTo(0, 0); c.lineTo(160, 0); c.lineTo(40, h); c.lineTo(0, h); c.fill();
  });
}

export function brazilFlagTexture() {
  return canvasTexture(128, 90, (c, w, h) => {
    c.fillStyle = '#1f9a4a'; c.fillRect(0, 0, w, h);
    c.fillStyle = '#f6d21b';
    c.beginPath(); c.moveTo(w / 2, 8); c.lineTo(w - 10, h / 2); c.lineTo(w / 2, h - 8); c.lineTo(10, h / 2); c.fill();
    c.fillStyle = '#233f8f';
    c.beginPath(); c.arc(w / 2, h / 2, 20, 0, Math.PI * 2); c.fill();
    c.strokeStyle = '#fff'; c.lineWidth = 3;
    c.beginPath(); c.arc(w / 2 + 8, h / 2 + 30, 40, -2.4, -0.9); c.stroke();
  });
}

export function minasFlagTexture() {
  return canvasTexture(128, 90, (c, w, h) => {
    c.fillStyle = '#fff'; c.fillRect(0, 0, w, h);
    c.strokeStyle = '#d32f2f'; c.lineWidth = 6;
    c.beginPath(); c.moveTo(w / 2, 18); c.lineTo(w / 2 + 26, h - 18); c.lineTo(w / 2 - 26, h - 18); c.closePath(); c.stroke();
  });
}

export function gridPlateTexture(size = 512, cells = 10, base = '#2b2f36', line = 'rgba(255,255,255,0.12)') {
  return canvasTexture(size, size, (c, w, h) => {
    c.fillStyle = base;
    c.fillRect(0, 0, w, h);
    c.strokeStyle = line;
    c.lineWidth = 2;
    for (let i = 0; i <= cells; i++) {
      const p = (i / cells) * w;
      c.beginPath(); c.moveTo(p, 0); c.lineTo(p, h); c.stroke();
      c.beginPath(); c.moveTo(0, p); c.lineTo(w, p); c.stroke();
    }
  });
}

export function pcbTexture() {
  return canvasTexture(128, 128, (c, w, h) => {
    const r = rng(11);
    c.fillStyle = '#d7dadf'; c.fillRect(0, 0, w, h);
    for (let i = 0; i < 18; i++) {
      c.fillStyle = r() > 0.5 ? '#6c737d' : '#2d6cdf';
      c.fillRect(r() * w, r() * h, 8 + r() * 24, 6 + r() * 18);
    }
  });
}
