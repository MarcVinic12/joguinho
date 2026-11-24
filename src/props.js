import * as THREE from 'three';
import * as TX from './textures.js';

/* ------------------------------------------------------------------ */
/*  Materiais compartilhados (paleta tirada das fotos)                 */
/* ------------------------------------------------------------------ */
const std = (color, roughness = 0.7, metalness = 0, extra = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness, metalness, ...extra });

export const M = {
  wall: std(0xeceef1, 0.92),
  wallLow: std(0xdfe2e6, 0.9),
  ceiling: std(0x50555c, 0.95),
  steel: std(0x7d8b99, 0.45, 0.55),
  steelDark: std(0x56606b, 0.5, 0.5),
  deskTop: std(0xf3f4f5, 0.45),
  deskFrame: std(0xb7bcc2, 0.35, 0.6),
  alu: std(0xc9ced4, 0.3, 0.75),
  black: std(0x1c1e21, 0.6),
  blackGloss: std(0x141518, 0.3),
  darkGrey: std(0x3a3e44, 0.6),
  midGrey: std(0x6b7078, 0.6),
  chairSeat: std(0x6c1d2b, 0.9),
  navy: std(0x2b3463, 0.8),
  panelWhite: std(0xe6e8ec, 0.8),
  orangeTrans: new THREE.MeshStandardMaterial({
    color: 0xff7414, roughness: 0.15, transparent: true, opacity: 0.55, depthWrite: false, side: THREE.DoubleSide,
  }),
  cardboard: std(0xb88a57, 0.95),
  tape: std(0xf0c12c, 0.6),
  white: std(0xf5f6f7, 0.6),
  cncWhite: std(0xeef0f2, 0.45, 0.1),
  blue: std(0x2f6db5, 0.5, 0.1),
  tubeBlue: std(0x2c86e8, 0.5),
  red: std(0xd32f2f, 0.5),
  yellow: std(0xf2c21b, 0.5),
  green: std(0x2e9d5a, 0.5),
  pink: std(0xe65b96, 0.6),
  purple: std(0x6a4bd1, 0.4),
  beige: std(0xd8c49a, 0.7),
  glass: new THREE.MeshStandardMaterial({ color: 0xbfd6e6, roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.25, depthWrite: false }),
  emissiveLight: new THREE.MeshBasicMaterial({ color: 0xffffff }),
};

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */
export const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
export const cyl = (rt, rb, h, s = 16) => new THREE.CylinderGeometry(rt, rb, h, s);

export function add(parent, geo, mat, x = 0, y = 0, z = 0, { ry = 0, rx = 0, rz = 0, cast = true, receive = true } = {}) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.rotation.set(rx, ry, rz);
  m.castShadow = cast;
  m.receiveShadow = receive;
  parent.add(m);
  return m;
}

export function place(obj, x, y, z, ry = 0) {
  obj.position.set(x, y, z);
  obj.rotation.y = ry;
  return obj;
}

export function screenMaterial(tex, brightness = 0.92) {
  return new THREE.MeshBasicMaterial({ map: tex, color: new THREE.Color(brightness, brightness, brightness), toneMapped: false });
}

/* ------------------------------------------------------------------ */
/*  Mobiliário                                                        */
/* ------------------------------------------------------------------ */
export function desk(w, d, h = 0.75) {
  const g = new THREE.Group();
  add(g, box(w, 0.03, d), M.deskTop, 0, h - 0.015, 0);
  const lh = h - 0.03;
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) add(g, box(0.05, lh, 0.05), M.deskFrame, sx * (w / 2 - 0.04), lh / 2, sz * (d / 2 - 0.04));
    add(g, box(0.03, 0.05, d - 0.08), M.deskFrame, sx * (w / 2 - 0.04), h - 0.06, 0, { cast: false });
  }
  add(g, box(w - 0.08, 0.05, 0.03), M.deskFrame, 0, h - 0.06, -(d / 2 - 0.04), { cast: false });
  add(g, box(w - 0.08, 0.2, 0.012), M.deskFrame, 0, h - 0.2, -(d / 2 - 0.05), { cast: false }); // painel de modéstia
  return g;
}

export function chair() {
  const g = new THREE.Group();
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    add(g, box(0.3, 0.03, 0.045), M.black, Math.cos(a) * 0.15, 0.07, Math.sin(a) * 0.15, { ry: -a, cast: false });
    add(g, new THREE.SphereGeometry(0.03, 8, 6), M.black, Math.cos(a) * 0.29, 0.03, Math.sin(a) * 0.29, { cast: false });
  }
  add(g, cyl(0.025, 0.025, 0.32), M.alu, 0, 0.24, 0);
  add(g, box(0.5, 0.08, 0.48), M.chairSeat, 0, 0.47, 0);
  add(g, box(0.46, 0.52, 0.05), M.black, 0, 0.86, 0.23, { rx: -0.08 });
  add(g, box(0.06, 0.32, 0.04), M.black, 0, 0.58, 0.25);
  for (const sx of [-1, 1]) {
    add(g, box(0.03, 0.2, 0.03), M.black, sx * 0.26, 0.6, 0.02);
    add(g, box(0.07, 0.03, 0.24), M.black, sx * 0.26, 0.71, 0.0);
  }
  return g;
}

export function monitor(w, h, tex, { stand = 0.12 } = {}) {
  const g = new THREE.Group();
  const cy = stand + h / 2;
  add(g, box(w + 0.02, h + 0.02, 0.025), M.blackGloss, 0, cy, 0);
  const screen = add(g, new THREE.PlaneGeometry(w, h), screenMaterial(tex), 0, cy, 0.0131, { cast: false });
  add(g, box(0.04, stand + 0.05, 0.03), M.black, 0, (stand + 0.05) / 2, -0.035);
  add(g, box(0.22, 0.012, 0.17), M.black, 0, 0.006, -0.03);
  g.userData.screen = screen;
  return g;
}

export function keyboard() {
  const g = new THREE.Group();
  add(g, box(0.44, 0.022, 0.14), M.black, 0, 0.011, 0, { cast: false });
  add(g, box(0.42, 0.004, 0.12), M.darkGrey, 0, 0.024, 0, { cast: false });
  return g;
}

export function mouse() {
  const m = new THREE.Mesh(new THREE.SphereGeometry(0.03, 12, 8), M.black);
  m.scale.set(1, 0.45, 1.6);
  m.position.y = 0.012;
  return m;
}

export function pcTower() {
  const g = new THREE.Group();
  add(g, box(0.2, 0.44, 0.45), M.black, 0, 0.22, 0);
  add(g, box(0.16, 0.02, 0.005), M.tubeBlue, 0, 0.4, 0.226, { cast: false });
  return g;
}

export function laptop() {
  const g = new THREE.Group();
  add(g, box(0.34, 0.018, 0.24), M.darkGrey, 0, 0.009, 0);
  const lid = new THREE.Group();
  lid.position.set(0, 0.018, -0.12);
  lid.rotation.x = -0.25;
  add(lid, box(0.34, 0.22, 0.01), M.darkGrey, 0, 0.11, 0);
  add(lid, new THREE.PlaneGeometry(0.31, 0.19), screenMaterial(TX.laptopTexture()), 0, 0.11, 0.0055, { cast: false });
  g.add(lid);
  return g;
}

export function bottle() {
  const g = new THREE.Group();
  add(g, cyl(0.04, 0.04, 0.24, 14), M.white, 0, 0.12, 0);
  add(g, cyl(0.03, 0.03, 0.04, 12), M.darkGrey, 0, 0.26, 0);
  return g;
}

export function flag(tex) {
  const g = new THREE.Group();
  add(g, cyl(0.004, 0.004, 0.32, 6), M.alu, 0, 0.16, 0);
  add(g, cyl(0.04, 0.05, 0.02, 12), M.black, 0, 0.01, 0);
  const f = add(g, new THREE.PlaneGeometry(0.17, 0.12), new THREE.MeshStandardMaterial({ map: tex, side: THREE.DoubleSide, roughness: 0.9 }), 0.088, 0.25, 0, { cast: false });
  f.rotation.y = 0.15;
  return g;
}

export function partition(len, h = 1.15, pattern = ['navy', 'white']) {
  const g = new THREE.Group();
  const segs = Math.max(1, Math.round(len / 1.2));
  const seg = len / segs;
  for (let i = 0; i <= segs; i++) add(g, box(0.04, h, 0.05), M.alu, -len / 2 + i * seg, h / 2, 0);
  for (let i = 0; i < segs; i++) {
    const mat = pattern[i % pattern.length] === 'navy' ? M.navy : M.panelWhite;
    add(g, box(seg - 0.04, h - 0.1, 0.025), mat, -len / 2 + seg * (i + 0.5), h / 2 + 0.02, 0);
  }
  add(g, box(len + 0.04, 0.035, 0.05), M.alu, 0, h, 0);
  return g;
}

/* ------------------------------------------------------------------ */
/*  Itens da bancada de manufatura aditiva                            */
/* ------------------------------------------------------------------ */
export function washCureStation() {
  const g = new THREE.Group();
  add(g, box(0.25, 0.09, 0.25), M.darkGrey, 0, 0.045, 0);
  add(g, box(0.16, 0.05, 0.005), screenMaterial(TX.labelTexture('WASH · CURE', { bg: '#0c1720', fg: '#59c1ff', font: 'bold 40px sans-serif' })), 0, 0.05, 0.126, { cast: false });
  add(g, cyl(0.08, 0.08, 0.012, 20), M.midGrey, 0, 0.1, 0);
  add(g, box(0.25, 0.32, 0.25), M.orangeTrans, 0, 0.25, 0, { cast: false });
  // cabos pretos dentro (como na foto)
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.07, 0.11, 0.02), new THREE.Vector3(0.0, 0.18, -0.05), new THREE.Vector3(0.06, 0.12, 0.05), new THREE.Vector3(-0.04, 0.2, 0.06),
  ]);
  add(g, new THREE.TubeGeometry(curve, 30, 0.004, 5), M.black, 0, 0, 0, { cast: false });
  return g;
}

export function gasMask() {
  const g = new THREE.Group();
  const face = add(g, new THREE.SphereGeometry(0.08, 14, 10), std(0x7b8088, 0.6), 0, 0.08, 0);
  face.scale.set(1, 1.15, 0.8);
  add(g, new THREE.SphereGeometry(0.06, 12, 8), M.glass, 0, 0.11, 0.035);
  for (const sx of [-1, 1]) {
    const f = add(g, cyl(0.04, 0.04, 0.035, 16), M.pink, sx * 0.075, 0.05, 0.05, { rz: Math.PI / 2 });
    f.rotation.y = sx * 0.5;
  }
  return g;
}

export function paperTowel() {
  const g = new THREE.Group();
  add(g, cyl(0.065, 0.065, 0.24, 18), M.white, 0, 0.12, 0);
  add(g, cyl(0.02, 0.02, 0.245, 10), std(0x9a8a70), 0, 0.12, 0, { cast: false });
  return g;
}

export function tub(mat = M.purple) {
  const g = new THREE.Group();
  add(g, box(0.16, 0.08, 0.12), mat, 0, 0.04, 0);
  add(g, box(0.17, 0.01, 0.13), mat, 0, 0.085, 0);
  return g;
}

export function cardboardEnclosure() {
  const g = new THREE.Group();
  add(g, box(0.6, 0.55, 0.55), M.cardboard, 0, 0.275, 0);
  for (const y of [0.05, 0.5]) add(g, box(0.61, 0.05, 0.56), M.tape, 0, y, 0, { cast: false });
  add(g, box(0.05, 0.56, 0.56), M.tape, -0.2, 0.275, 0, { cast: false });
  add(g, box(0.25, 0.12, 0.005), std(0xf4f4f4), 0.12, 0.42, 0.278, { cast: false }); // etiqueta
  return g;
}

export function scannerCase() {
  const g = new THREE.Group();
  add(g, box(0.52, 0.36, 0.22), std(0x6e7278, 0.55), 0, 0.18, 0);
  for (const y of [0.11, 0.25]) add(g, box(0.53, 0.02, 0.23), std(0x5c6066, 0.55), 0, y, 0, { cast: false });
  add(g, box(0.18, 0.035, 0.04), M.black, 0, 0.375, 0, { cast: false });
  for (const sx of [-0.15, 0.15]) add(g, box(0.05, 0.05, 0.02), M.black, sx, 0.33, 0.115, { cast: false });
  add(g, new THREE.PlaneGeometry(0.16, 0.05), new THREE.MeshBasicMaterial({ map: TX.labelTexture('3D SCANNER', { bg: '#1b1c1f', fg: '#e9e9e9', font: 'bold 48px sans-serif' }) }), 0, 0.2, 0.111, { cast: false });
  return g;
}

export function scannerTripod() {
  const g = new THREE.Group();
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    const leg = add(g, cyl(0.006, 0.006, 0.3, 6), M.black, Math.cos(a) * 0.07, 0.14, Math.sin(a) * 0.07);
    leg.rotation.set(Math.sin(a) * 0.45, 0, -Math.cos(a) * 0.45);
  }
  add(g, cyl(0.01, 0.01, 0.32, 8), M.black, 0, 0.42, 0);
  const head = new THREE.Group();
  head.position.set(0, 0.6, 0);
  head.rotation.x = -0.35;
  add(head, box(0.24, 0.06, 0.07), std(0xbfc3c8, 0.35, 0.5), 0, 0, 0);
  for (const sx of [-0.08, 0.08]) add(head, cyl(0.016, 0.016, 0.01, 12), M.blackGloss, sx, 0, 0.036, { rx: Math.PI / 2 });
  add(head, box(0.05, 0.12, 0.04), M.black, 0, -0.07, -0.01);
  g.add(head);
  return g;
}

export function aluminumCase() {
  const g = new THREE.Group();
  add(g, box(0.62, 0.18, 0.42), M.alu, 0, 0.09, 0);
  add(g, box(0.63, 0.015, 0.43), M.steelDark, 0, 0.12, 0, { cast: false });
  add(g, box(0.12, 0.03, 0.03), M.black, 0, 0.1, 0.22);
  return g;
}

/* ------------------------------------------------------------------ */
/*  Fundo do galpão                                                   */
/* ------------------------------------------------------------------ */
export function mechatronicsStation(seed = 1) {
  const g = new THREE.Group();
  let s = seed * 9301;
  const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  add(g, box(1.5, 0.05, 0.75), M.alu, 0, 0.88, 0);
  for (const sx of [-0.7, 0.7]) for (const sz of [-0.33, 0.33]) add(g, box(0.045, 0.88, 0.045), M.alu, sx, 0.44, sz);
  add(g, box(1.4, 0.03, 0.65), M.alu, 0, 0.2, 0, { cast: false });
  add(g, box(0.5, 0.45, 0.3), std(0xd9dcdf), -0.35, 0.45, 0);
  // torre de perfis
  for (const sx of [-0.55, 0.55]) add(g, box(0.04, 0.75, 0.04), M.alu, sx, 1.28, -0.25);
  add(g, box(1.14, 0.04, 0.04), M.alu, 0, 1.64, -0.25);
  // módulos
  for (let i = 0; i < 4; i++) {
    const w = 0.15 + r() * 0.2;
    const mat = [M.blue, M.midGrey, std(0xd8dbdf), M.black][i % 4];
    add(g, box(w, 0.08 + r() * 0.15, 0.2), mat, -0.5 + i * 0.32, 0.96 + r() * 0.05, -0.05 + r() * 0.1);
  }
  add(g, box(0.25, 0.18, 0.12), M.darkGrey, 0.35, 1.45, -0.25);
  add(g, box(0.2, 0.13, 0.005), screenMaterial(TX.cadTexture(), 0.7), 0.35, 1.45, -0.187, { cast: false });
  for (const [x, mat] of [[-0.2, M.red], [-0.12, M.green], [-0.04, M.yellow]]) add(g, cyl(0.015, 0.015, 0.03, 10), mat, x, 0.92, 0.3, { cast: false });
  // mangueiras pneumáticas azuis
  for (let k = 0; k < 6; k++) {
    const pts = [];
    const x0 = -0.6 + r() * 1.2;
    pts.push(new THREE.Vector3(x0, 0.9, -0.2 + r() * 0.3));
    pts.push(new THREE.Vector3(x0 + (r() - 0.5) * 0.4, 1.1 + r() * 0.3, -0.1));
    pts.push(new THREE.Vector3(-0.6 + r() * 1.2, 1.3 + r() * 0.3, -0.25));
    pts.push(new THREE.Vector3(-0.6 + r() * 1.2, 0.95, 0.1));
    add(g, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, 0.005, 5), M.tubeBlue, 0, 0, 0, { cast: false });
  }
  return g;
}

export function electricalBooth(number, labelText) {
  const g = new THREE.Group();
  add(g, box(2.4, 2.4, 0.08), M.white, 0, 1.2, 0);
  for (const sx of [-1.2, 1.2]) add(g, box(0.08, 2.4, 1.6), M.white, sx, 1.2, 0.8);
  add(g, box(2.48, 0.06, 1.7), M.alu, 0, 2.42, 0.8);
  const pcb = TX.pcbTexture();
  const pMat = new THREE.MeshStandardMaterial({ map: pcb, roughness: 0.7 });
  add(g, box(0.55, 0.75, 0.15), pMat, -0.45, 1.3, 0.12);
  add(g, box(0.4, 0.5, 0.12), std(0xd5d8dc), 0.35, 1.4, 0.1);
  add(g, box(0.25, 0.3, 0.1), std(0x9ea4ab), 0.75, 0.9, 0.09);
  // eletrodutos
  for (const x of [-0.6, -0.3, 0.35, 0.8]) add(g, box(0.03, 1.1, 0.03), std(0x8e959d), x, 1.95, 0.06, { cast: false });
  add(g, box(1.8, 0.03, 0.03), std(0x8e959d), 0.05, 2.1, 0.06, { cast: false });
  add(g, box(0.4, 0.28, 0.01), new THREE.MeshBasicMaterial({ map: TX.labelTexture(String(number), { bg: '#1f8a4c', fg: '#fff', width: 256, height: 180, font: 'bold 120px sans-serif' }) }), 1.0, 2.15, 1.65, { ry: 0, cast: false });
  if (labelText) {
    add(g, box(1.2, 0.18, 0.01), new THREE.MeshBasicMaterial({ map: TX.labelTexture(labelText, { bg: '#2a2f38', fg: '#fff', width: 768, height: 110, font: 'bold 52px sans-serif' }) }), -0.3, 2.2, 1.65, { cast: false });
  }
  return g;
}

export function cncLathe() {
  const g = new THREE.Group();
  add(g, box(3.2, 2.1, 1.8), M.cncWhite, 0, 1.05, 0);
  add(g, box(3.22, 0.35, 1.82), std(0x24272b), 0, 0.175, 0);
  add(g, box(0.45, 2.12, 1.82), std(0x1d2024), 1.4, 1.06, 0);
  add(g, box(1.5, 0.85, 0.03), std(0x1a1d22, 0.15, 0.3), -0.35, 1.3, 0.905);
  add(g, box(1.3, 0.65, 0.01), M.glass, -0.35, 1.32, 0.925, { cast: false });
  add(g, box(0.06, 0.4, 0.05), M.alu, 0.45, 1.3, 0.94);
  add(g, box(0.5, 0.85, 0.14), M.blackGloss, 1.1, 1.35, 0.96);
  add(g, box(0.4, 0.3, 0.005), screenMaterial(TX.cadTexture(), 0.8), 1.1, 1.55, 1.033, { cast: false });
  add(g, new THREE.PlaneGeometry(1.2, 0.18), new THREE.MeshBasicMaterial({ map: TX.labelTexture('TORNO CNC', { bg: '#eef0f2', fg: '#22252a', width: 512, height: 80, font: 'bold 50px sans-serif' }) }), -0.6, 1.88, 0.902, { cast: false });
  // torre de sinalização
  add(g, cyl(0.02, 0.02, 0.15, 8), M.alu, 1.4, 2.2, 0.5);
  [[0x2e9d5a, 2.32], [0xf2c21b, 2.42], [0xd32f2f, 2.52]].forEach(([c, y]) =>
    add(g, cyl(0.05, 0.05, 0.09, 14), new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: y < 2.35 ? 0.9 : 0.1 }), 1.4, y, 0.5)
  );
  // braço do monitor (do lado, como na foto)
  add(g, box(0.06, 0.06, 0.9), M.black, 1.75, 1.7, 0.7, { rx: -0.4 });
  return g;
}

export function windTurbine() {
  const g = new THREE.Group();
  add(g, cyl(0.04, 0.05, 2.6, 10), M.steel, 0, 1.3, 0);
  add(g, box(0.5, 0.05, 0.5), M.steelDark, 0, 0.025, 0);
  const head = new THREE.Group();
  head.position.y = 2.65;
  add(head, cyl(0.07, 0.06, 0.4, 12), M.white, 0, 0, -0.05, { rx: Math.PI / 2 });
  add(head, box(0.02, 0.35, 0.45), M.white, 0, 0.08, -0.45); // leme
  const rotor = new THREE.Group();
  rotor.position.z = 0.17;
  add(rotor, new THREE.SphereGeometry(0.07, 12, 8), M.white, 0, 0, 0);
  for (let i = 0; i < 3; i++) {
    const blade = new THREE.Group();
    blade.rotation.z = (i / 3) * Math.PI * 2;
    add(blade, box(0.09, 0.8, 0.015), M.white, 0, 0.45, 0, { ry: 0.25 });
    add(blade, box(0.09, 0.2, 0.016), std(0x2364c4), 0, 0.78, 0, { ry: 0.25 });
    rotor.add(blade);
  }
  head.add(rotor);
  g.add(head);
  g.userData.rotor = rotor;
  return g;
}

export function mitreSaw() {
  const g = new THREE.Group();
  add(g, box(0.5, 0.06, 0.45), std(0x2a2a2a), 0, 0.03, 0);
  add(g, cyl(0.22, 0.22, 0.02, 24), M.yellow, 0, 0.26, 0, { rx: Math.PI / 2, rz: Math.PI / 2 });
  add(g, box(0.08, 0.3, 0.08), M.yellow, 0.05, 0.2, -0.15);
  add(g, box(0.3, 0.06, 0.08), std(0x1d1d1d), 0.0, 0.4, 0.05);
  return g;
}

export function zebraBarrier(len) {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ map: TX.zebraTexture(), roughness: 0.6 });
  add(g, box(len, 0.12, 0.12), mat, 0, 1.25, 0);
  for (const sx of [-len / 2 + 0.06, len / 2 - 0.06]) add(g, box(0.06, 1.25, 0.06), M.black, sx, 0.62, 0);
  return g;
}

export function ceilingLight() {
  const g = new THREE.Group();
  add(g, box(2.4, 0.08, 0.32), std(0xd5d8dc, 0.4, 0.4), 0, 0, 0, { cast: false, receive: false });
  add(g, box(2.3, 0.01, 0.24), M.emissiveLight, 0, -0.045, 0, { cast: false, receive: false });
  for (const sx of [-1, 1]) add(g, box(0.01, 1.6, 0.01), M.steelDark, sx * 1.0, 0.8, 0, { cast: false, receive: false });
  return g;
}

export function banner(number, title) {
  const tex = TX.bannerTexture(number, title);
  const g = new THREE.Group();
  add(g, new THREE.PlaneGeometry(1.3, 3.25), new THREE.MeshStandardMaterial({ map: tex, side: THREE.DoubleSide, roughness: 0.9 }), 0, 0, 0, { cast: false });
  add(g, box(1.4, 0.04, 0.04), M.black, 0, 1.64, 0, { cast: false });
  return g;
}
