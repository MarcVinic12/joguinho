import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/**
 * Peças 100% procedurais. Unidade = metro. Toda geometria é normalizada para:
 * base em y = 0 e centrada em XZ — facilita o clipping "camada por camada".
 *
 * baseMinutes: tempo real FDM de referência (0.20 mm, 20% infill, 150 mm/s)
 * volume: cm³ equivalentes de material (casca + preenchimento médio)
 */
export const PARTS = [
  {
    id: 'gear',
    name: 'Engrenagem Reta',
    desc: 'Z16 · furo Ø22 · alívios de massa',
    baseMinutes: 58,
    volume: 30,
    build: buildGear,
  },
  {
    id: 'cube',
    name: 'Cubo de Calibração',
    desc: '42 mm · bordas chanfradas',
    baseMinutes: 46,
    volume: 48,
    build: buildCube,
  },
  {
    id: 'vase',
    name: 'Vaso Torcido',
    desc: '120 mm · 12 faces · torção 110°',
    baseMinutes: 72,
    volume: 26,
    build: buildVase,
  },
  {
    id: 'bracket',
    name: 'Suporte Mecânico em L',
    desc: '70×40×55 mm · nervuras · rasgo',
    baseMinutes: 40,
    volume: 28,
    build: buildBracket,
  },
];

const cache = new Map();

export function getPart(id) {
  return PARTS.find((p) => p.id === id) ?? PARTS[0];
}

/** Geometria compartilhada (não descartar!). */
export function getPartGeometry(id) {
  if (!cache.has(id)) cache.set(id, normalize(getPart(id).build()));
  return cache.get(id);
}

function normalize(geo) {
  geo.computeBoundingBox();
  const b = geo.boundingBox;
  geo.translate(-(b.min.x + b.max.x) / 2, -b.min.y, -(b.min.z + b.max.z) / 2);
  geo.computeVertexNormals();
  geo.computeBoundingBox();
  geo.computeBoundingSphere();
  return geo;
}

function circlePath(cx, cy, r) {
  const p = new THREE.Path();
  p.absarc(cx, cy, r, 0, Math.PI * 2, true);
  return p;
}

function buildGear() {
  const teeth = 16;
  const rTip = 0.048;
  const rRoot = 0.041;
  const a = (Math.PI * 2) / teeth;
  const s = new THREE.Shape();
  for (let i = 0; i < teeth; i++) {
    const t = i * a;
    const pts = [
      [rRoot, t],
      [rTip, t + a * 0.2],
      [rTip, t + a * 0.45],
      [rRoot, t + a * 0.65],
    ];
    pts.forEach(([r, ang], k) => {
      const x = Math.cos(ang) * r;
      const y = Math.sin(ang) * r;
      if (i === 0 && k === 0) s.moveTo(x, y);
      else s.lineTo(x, y);
    });
  }
  s.closePath();
  s.holes.push(circlePath(0, 0, 0.011));
  for (let i = 0; i < 5; i++) {
    const ang = (i / 5) * Math.PI * 2;
    s.holes.push(circlePath(Math.cos(ang) * 0.026, Math.sin(ang) * 0.026, 0.0065));
  }
  const g = new THREE.ExtrudeGeometry(s, {
    depth: 0.026,
    bevelEnabled: true,
    bevelThickness: 0.0012,
    bevelSize: 0.0012,
    bevelSegments: 1,
    curveSegments: 20,
  });
  g.rotateX(-Math.PI / 2);
  return g;
}

function buildCube() {
  const h = 0.021;
  const s = new THREE.Shape();
  s.moveTo(-h, -h);
  s.lineTo(h, -h);
  s.lineTo(h, h);
  s.lineTo(-h, h);
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, {
    depth: 0.039,
    bevelEnabled: true,
    bevelThickness: 0.0015,
    bevelSize: 0.0015,
    bevelSegments: 1,
  });
  g.rotateX(-Math.PI / 2);
  return g;
}

function buildVase() {
  const H = 0.12;
  const N = 40;
  const wall = 0.0025;
  const radius = (y) => 0.024 + 0.012 * Math.sin((y / H) * Math.PI * 1.15 + 0.25) + 0.006 * (y / H);
  const pts = [new THREE.Vector2(0.0001, 0)];
  for (let i = 0; i <= N; i++) {
    const y = (i / N) * H;
    pts.push(new THREE.Vector2(radius(y), y));
  }
  for (let i = N; i >= 1; i--) {
    const y = Math.max((i / N) * H, 0.003);
    pts.push(new THREE.Vector2(radius(y) - wall, y));
  }
  pts.push(new THREE.Vector2(0.0001, 0.003));
  const g = new THREE.LatheGeometry(pts, 12);
  // torção helicoidal: gira cada vértice em torno de Y proporcional à altura
  const pos = g.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const ang = (v.y / H) * THREE.MathUtils.degToRad(110);
    const c = Math.cos(ang);
    const s = Math.sin(ang);
    pos.setXYZ(i, v.x * c - v.z * s, v.y, v.x * s + v.z * c);
  }
  return g;
}

function buildBracket() {
  const T = 0.007;
  const parts = [];

  // Aba de base (com 2 furos)
  const base = new THREE.Shape();
  base.moveTo(-0.035, -0.02);
  base.lineTo(0.035, -0.02);
  base.lineTo(0.035, 0.02);
  base.lineTo(-0.035, 0.02);
  base.closePath();
  base.holes.push(circlePath(-0.022, -0.004, 0.004), circlePath(0.022, -0.004, 0.004));
  const gBase = new THREE.ExtrudeGeometry(base, { depth: T, bevelEnabled: false, curveSegments: 16 });
  gBase.rotateX(-Math.PI / 2); // espessura em +Y
  parts.push(gBase);

  // Aba vertical (com rasgo oblongo)
  const wallS = new THREE.Shape();
  wallS.moveTo(-0.035, 0);
  wallS.lineTo(0.035, 0);
  wallS.lineTo(0.035, 0.055);
  wallS.lineTo(-0.035, 0.055);
  wallS.closePath();
  const slot = new THREE.Path();
  slot.moveTo(-0.012, 0.03);
  slot.absarc(-0.012, 0.036, 0.006, -Math.PI / 2, Math.PI / 2, true);
  slot.lineTo(0.012, 0.042);
  slot.absarc(0.012, 0.036, 0.006, Math.PI / 2, -Math.PI / 2, true);
  slot.closePath();
  wallS.holes.push(slot);
  const gWall = new THREE.ExtrudeGeometry(wallS, { depth: T, bevelEnabled: false, curveSegments: 12 });
  gWall.translate(0, 0, -0.02);
  parts.push(gWall);

  // Nervuras triangulares
  for (const x of [-0.035 + T, 0.035]) {
    const tri = new THREE.Shape();
    tri.moveTo(0, T);
    tri.lineTo(0.03, T);
    tri.lineTo(0, 0.045);
    tri.closePath();
    const gTri = new THREE.ExtrudeGeometry(tri, { depth: T, bevelEnabled: false });
    gTri.rotateY(-Math.PI / 2);
    gTri.translate(x, 0, -0.02 + T);
    parts.push(gTri);
  }
  return mergeGeometries(parts.map((g) => (g.index ? g.toNonIndexed() : g)));
}
