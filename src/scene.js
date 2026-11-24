import * as THREE from 'three';
import * as TX from './textures.js';
import * as P from './props.js';

const { M, add, box, place } = P;

const ROOM = { minX: -12, maxX: 12, minZ: -10, maxZ: 8, height: 8.5 };
const DESK_H = 0.75;

/**
 * Monta o laboratório reproduzindo as fotos.
 * Retorna colisores (AABB em XZ), âncoras para as impressoras e o computador interativo.
 */
export function createLab(scene, { mobile = false } = {}) {
  const colliders = [];
  const updaters = [];
  const root = new THREE.Group();
  root.name = 'Lab';
  scene.add(root);

  const collide = (obj, pad = 0.03) => {
    obj.updateMatrixWorld(true);
    const b = new THREE.Box3().setFromObject(obj);
    colliders.push({ minX: b.min.x - pad, maxX: b.max.x + pad, minZ: b.min.z - pad, maxZ: b.max.z + pad });
  };
  const put = (obj, x, y, z, ry = 0, solid = false) => {
    place(obj, x, y, z, ry);
    root.add(obj);
    if (solid) collide(obj);
    return obj;
  };

  buildRoom(root, updaters);
  buildLights(scene, mobile);

  /* ---------------- Bancada principal (fileira em X, z = 0) ---------------- */
  // Divisória baixa atrás da bancada + divisória lateral direita
  put(P.partition(7.9, 1.15, ['white', 'navy', 'white', 'navy']), -0.05, 0, -0.62, 0, true);
  put(P.partition(4.4, 1.15, ['navy', 'white']), 3.88, 0, 1.6, Math.PI / 2, true);

  // Mesa A — notebook, monitor, bandeiras
  const deskA = put(P.desk(2.4, 0.8), -2.6, 0, 0);
  const onA = (o, x, z, ry = 0) => place(o, x, DESK_H, z, ry) && deskA.add(o);
  onA(P.laptop(), -0.75, 0.0, 0.1);
  onA(P.monitor(0.52, 0.3, TX.codeTexture()), 0.05, -0.18);
  onA(P.keyboard(), 0.05, 0.12);
  onA(P.mouse(), 0.38, 0.14);
  onA(P.bottle(), -1.05, 0.22);
  onA(P.flag(TX.brazilFlagTexture()), 0.72, -0.15, -0.3);
  onA(P.flag(TX.minasFlagTexture()), 0.86, -0.1, -0.5);
  deskA.add(place(P.pcTower(), -0.9, 0, -0.1));
  collide(deskA);

  // Mesa B — impressoras de resina, estações de lavagem/cura, EPI
  const deskB = put(P.desk(2.0, 0.8), -0.4, 0, 0);
  add(deskB, new THREE.PlaneGeometry(1.55, 0.6), new THREE.MeshStandardMaterial({ map: TX.cuttingMatTexture(), roughness: 0.9 }), 0.05, DESK_H + 0.002, -0.02, { rx: -Math.PI / 2, cast: false });
  deskB.add(place(P.washCureStation(), 0.02, DESK_H, -0.12));
  deskB.add(place(P.washCureStation(), 0.38, DESK_H, -0.12));
  const mask = place(P.gasMask(), -0.2, DESK_H, 0.2, 0.3);
  mask.scale.setScalar(0.75);
  deskB.add(mask);
  deskB.add(place(P.paperTowel(), 0.16, DESK_H, 0.18));
  deskB.add(place(P.tub(), 0.72, DESK_H, -0.05));
  add(deskB, box(0.28, 0.025, 0.2), M.black, -0.55, DESK_H + 0.0125, 0.27); // pasta/estojo
  collide(deskB);

  // Mesa C — estação do competidor (computador interativo)
  const deskC = put(P.desk(2.2, 0.8), 1.7, 0, 0);
  const monLeft = P.monitor(0.6, 0.34, TX.wallpaperTexture());
  const monRight = P.monitor(0.6, 0.34, TX.cadTexture());
  deskC.add(place(monLeft, -0.42, DESK_H, -0.18, 0.12));
  deskC.add(place(monRight, 0.22, DESK_H, -0.18, -0.08));
  deskC.add(place(P.keyboard(), -0.12, DESK_H, 0.12));
  deskC.add(place(P.mouse(), 0.25, DESK_H, 0.14));
  add(deskC, box(0.4, 0.004, 0.3), M.black, 0.28, DESK_H + 0.002, 0.13, { cast: false }); // mousepad
  add(deskC, box(0.06, 0.12, 0.06), M.blue, -0.75, DESK_H + 0.06, -0.15); // porta-canetas
  deskC.add(place(P.pcTower(), 0.75, 0, -0.1));
  add(deskC, box(0.04, 0.3, 0.04), M.black, -0.6, DESK_H + 0.15, -0.3); // webcam/suporte
  collide(deskC);

  // O alvo interativo é a mesa C inteira (monitores, teclado, gabinete)
  const computerTarget = deskC;

  // Scanner no tripé (canto, junto às mesas C/D)
  put(P.scannerTripod(), 2.62, DESK_H, -0.22, -0.6);

  // Mesa D (perpendicular) — caixa de papelão e impressora FDM
  const deskD = put(P.desk(2.2, 1.0), 3.3, 0, 0.7, Math.PI / 2);
  root.add(place(P.cardboardEnclosure(), 3.35, DESK_H, 0.05, Math.PI / 2));
  collide(deskD);

  // Mesa E (primeiro plano da foto 1) — maleta do scanner + vitrine de peças
  const deskE = put(P.desk(1.8, 1.0), 3.3, 0, 2.75, Math.PI / 2);
  root.add(place(P.scannerCase(), 3.35, DESK_H, 2.35, Math.PI / 2 + 0.08));
  add(root, box(0.18, 0.004, 0.26), M.alu, 3.0, DESK_H + 0.002, 2.0, { cast: false }); // passa-cabos
  add(root, new THREE.PlaneGeometry(0.42, 0.09), new THREE.MeshBasicMaterial({ map: TX.labelTexture('PEÇAS PRODUZIDAS', { bg: '#ff6b2c', fg: '#fff', width: 512, height: 110, font: 'bold 54px sans-serif' }) }), 3.62, DESK_H + 0.06, 3.3, { ry: -Math.PI / 2, cast: false });
  collide(deskE);
  const showcase = new THREE.Group();
  showcase.position.set(3.3, DESK_H, 3.3);
  root.add(showcase);

  // Cadeiras (assento vinho)
  put(P.chair(), 1.55, 0, 0.85, 0.15, true);
  put(P.chair(), -0.75, 0, 1.25, -0.5, true);
  put(P.chair(), -2.6, 0, 0.9, 0.2, true);

  // Maleta de alumínio no chão com peças impressas
  const caseFloor = put(P.aluminumCase(), -0.35, 0, 0.6, 0.05, true);
  const g = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.03, 16), M.beige);
  g.position.set(-0.12, 0.145, 0);
  caseFloor.add(g);
  const pinkPart = new THREE.Mesh(new THREE.TorusGeometry(0.04, 0.018, 8, 16), M.pink);
  pinkPart.position.set(0.12, 0.16, 0.02);
  pinkPart.rotation.x = Math.PI / 2;
  caseFloor.add(pinkPart);

  // Barreira zebrada (atrás do scanner, à direita)
  put(P.zebraBarrier(2.2), 4.0, 0, -0.95, 0, true);

  /* ---------------------------- Fundo do galpão ---------------------------- */
  // Mecatrônica (esquerda)
  [-9.4, -7.6, -5.8].forEach((x, i) => put(P.mechatronicsStation(i + 1), x, 0, -2.3, 0, true));
  [-9.4, -7.6, -5.8].forEach((x, i) => put(P.mechatronicsStation(i + 7), x, 0, -4.6, Math.PI, true));

  // Fileira de computadores ao fundo
  for (let i = 0; i < 3; i++) {
    const d = put(P.desk(1.6, 0.8), -3.4 + i * 1.75, 0, -4.4, Math.PI);
    const m = P.monitor(0.55, 0.32, i % 2 ? TX.cadTexture() : TX.codeTexture());
    d.add(place(m, 0, DESK_H, -0.15));
    d.add(place(P.keyboard(), 0, DESK_H, 0.15));
    collide(d);
    put(P.chair(), -3.4 + i * 1.75, 0, -5.2, Math.PI + 0.2, true);
  }
  put(P.partition(5.4, 1.15, ['white', 'navy']), -1.65, 0, -3.6, 0, true);

  // Cabines de instalações elétricas
  put(P.electricalBooth(62, 'ENERGIA VERDE'), 2.2, 0, -8.2, 0, false);
  put(P.electricalBooth(18, 'INSTALAÇÕES ELÉTRICAS'), 4.8, 0, -8.2, 0, false);
  colliders.push({ minX: 0.9, maxX: 6.1, minZ: -8.3, maxZ: -6.5 });

  // Bancada de painel elétrico (técnicos na foto)
  const panelWall = new THREE.Group();
  add(panelWall, box(2.2, 2.2, 0.1), M.white, 0, 1.1, 0);
  add(panelWall, box(0.7, 0.9, 0.15), new THREE.MeshStandardMaterial({ map: TX.pcbTexture() }), -0.4, 1.3, 0.1);
  add(panelWall, box(0.4, 0.6, 0.12), std(0xd0d3d7), 0.5, 1.2, 0.1);
  put(panelWall, 7.6, 0, -5.4, -0.3, true);

  // Centro de torneamento CNC + serra + turbina
  put(P.cncLathe(), 9.6, 0, -2.6, -0.15, true);
  const sawTable = put(P.desk(1.0, 0.7), 7.3, 0, -1.4, 0, true);
  sawTable.add(place(P.mitreSaw(), 0, DESK_H, 0));
  const turbine = put(P.windTurbine(), 6.2, 0, -2.1, 0.4, true);
  updaters.push((dt) => (turbine.userData.rotor.rotation.z += dt * 2.2));

  // Banners #62 e #18 pendurados nos pilares
  put(P.banner(62, 'TECNOLOGIA EM ENERGIA VERDE'), 3.3, 4.9, -9.55);
  put(P.banner(18, 'INSTALAÇÕES ELÉTRICAS'), 5.5, 4.9, -9.55);

  // Bancada de apoio à esquerda da mesa A (foto 2, canto esquerdo)
  const sideDesk = put(P.desk(1.6, 0.8), -5.2, 0, 0.3, 0.0, false);
  sideDesk.add(place(P.monitor(0.5, 0.3, TX.codeTexture()), 0, DESK_H, -0.15));
  sideDesk.add(place(P.tub(P.M.midGrey), 0.5, DESK_H, 0.1));
  collide(sideDesk);

  /* ------------------------------- Âncoras -------------------------------- */
  const anchors = {
    spawn: { x: 0.4, z: 4.4, yaw: 0 },
    // Impressora de resina principal: mesa B, mais à esquerda (a mais alta, com base cinza)
    resin: { position: new THREE.Vector3(-1.05, DESK_H, -0.1), rotationY: 0 },
    // Impressora FDM: mesa D, frente voltada para o corredor (-X)
    fdm: { position: new THREE.Vector3(3.3, DESK_H, 1.05), rotationY: -Math.PI / 2 },
  };

  return {
    root,
    colliders,
    bounds: { minX: ROOM.minX + 0.4, maxX: ROOM.maxX - 0.4, minZ: ROOM.minZ + 0.4, maxZ: ROOM.maxZ - 0.4 },
    anchors,
    computerTarget,
    showcase,
    update(dt, t) {
      for (const f of updaters) f(dt, t);
    },
  };
}

function std(color, roughness = 0.7) {
  return new THREE.MeshStandardMaterial({ color, roughness });
}

/* --------------------------------------------------------------------- */
/*  Galpão: piso, paredes, pilares, teto, janela, relógio, TV            */
/* --------------------------------------------------------------------- */
function buildRoom(root, updaters) {
  const W = ROOM.maxX - ROOM.minX;
  const D = ROOM.maxZ - ROOM.minZ;
  const H = ROOM.height;
  const cx = (ROOM.minX + ROOM.maxX) / 2;
  const cz = (ROOM.minZ + ROOM.maxZ) / 2;

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(W, D),
    new THREE.MeshStandardMaterial({ map: TX.floorTexture(), roughness: 0.32, metalness: 0.05 })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(cx, 0, cz);
  floor.receiveShadow = true;
  root.add(floor);

  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(W, D), M.ceiling);
  ceil.rotation.x = Math.PI / 2;
  ceil.position.set(cx, H, cz);
  root.add(ceil);

  const wall = (w, x, z, ry) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, H), M.wall);
    m.position.set(x, H / 2, z);
    m.rotation.y = ry;
    m.receiveShadow = true;
    root.add(m);
    const skirt = new THREE.Mesh(new THREE.PlaneGeometry(w, 1.2), M.wallLow);
    skirt.position.set(x, 0.6, z);
    skirt.rotation.y = ry;
    skirt.position.addScaledVector(new THREE.Vector3(Math.sin(ry), 0, Math.cos(ry)), 0.01);
    root.add(skirt);
  };
  wall(W, cx, ROOM.minZ, 0);
  wall(W, cx, ROOM.maxZ, Math.PI);
  wall(D, ROOM.minX, cz, Math.PI / 2);
  wall(D, ROOM.maxX, cz, -Math.PI / 2);

  // Pilares metálicos
  for (const x of [-9, -3, 3, 9]) {
    add(root, box(0.35, H, 0.35), M.steel, x, H / 2, ROOM.minZ + 0.2);
    add(root, box(0.35, H, 0.35), M.steel, x, H / 2, ROOM.maxZ - 0.2);
  }
  for (const z of [-5, 1, 6]) {
    add(root, box(0.35, H, 0.35), M.steel, ROOM.minX + 0.2, H / 2, z);
    add(root, box(0.35, H, 0.35), M.steel, ROOM.maxX - 0.2, H / 2, z);
  }
  // Contraventamento em X (parede do fundo, direita — como na foto)
  for (const s of [1, -1]) {
    add(root, box(8.6, 0.12, 0.12), M.steelDark, 6, 3.4, ROOM.minZ + 0.35, { rz: (s * Math.PI) / 4, cast: false });
  }
  // Treliças do telhado + calhas de luz
  for (let x = -10; x <= 10; x += 4) add(root, box(0.2, 0.5, D), M.steelDark, x, H - 0.3, cz, { cast: false, receive: false });
  for (let x = -8; x <= 8; x += 4) {
    for (let z = -7; z <= 6; z += 3.25) {
      const l = P.ceilingLight();
      l.position.set(x, 6.4, z);
      root.add(l);
    }
  }

  // Parede do fundo: janela para a sala de treinamento, relógio, TV
  const win = new THREE.Group();
  add(win, new THREE.PlaneGeometry(4.2, 2.2), new THREE.MeshBasicMaterial({ map: TX.officeWindowTexture(), toneMapped: false, color: 0xe6e6e6 }), 0, 0, 0, { cast: false });
  add(win, new THREE.PlaneGeometry(4.2, 2.2), M.glass, 0, 0, 0.02, { cast: false });
  for (const sx of [-2.1, 0, 2.1]) add(win, box(0.08, 2.3, 0.08), std(0x2a2d31), sx, 0, 0.03);
  for (const sy of [-1.12, 1.12]) add(win, box(4.3, 0.08, 0.08), std(0x2a2d31), 0, sy, 0.03);
  win.position.set(-5, 2.1, ROOM.minZ + 0.02);
  root.add(win);

  add(root, box(1.6, 0.95, 0.06), M.blackGloss, -2.0, 5.6, ROOM.minZ + 0.05); // TV

  // Relógio digital vermelho com a hora real
  const clock = TX.dynamicTexture(256, 96);
  const clockMesh = add(root, new THREE.PlaneGeometry(0.75, 0.28), new THREE.MeshBasicMaterial({ map: clock.texture, toneMapped: false }), -5, 3.55, ROOM.minZ + 0.06, { cast: false });
  add(root, box(0.8, 0.33, 0.04), M.black, -5, 3.55, ROOM.minZ + 0.03);
  let last = '';
  const drawClock = () => {
    const d = new Date();
    const txt = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
    if (txt === last) return;
    last = txt;
    const c = clock.ctx;
    c.fillStyle = '#120404';
    c.fillRect(0, 0, 256, 96);
    c.fillStyle = '#ff2a1a';
    c.shadowColor = '#ff2a1a';
    c.shadowBlur = 12;
    c.font = 'bold 64px monospace';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText(txt, 128, 50);
    clock.update();
  };
  drawClock();
  updaters.push(drawClock);
  clockMesh.renderOrder = 1;
}

function buildLights(scene, mobile) {
  scene.add(new THREE.HemisphereLight(0xf3f6ff, 0x8a8d91, 1.35));

  const key = new THREE.DirectionalLight(0xffffff, 1.5);
  key.position.set(4, 12, 6);
  key.target.position.set(0, 0, 0);
  key.castShadow = true;
  key.shadow.mapSize.set(mobile ? 1024 : 2048, mobile ? 1024 : 2048);
  key.shadow.camera.left = -9;
  key.shadow.camera.right = 9;
  key.shadow.camera.top = 9;
  key.shadow.camera.bottom = -9;
  key.shadow.camera.near = 1;
  key.shadow.camera.far = 30;
  key.shadow.bias = -0.0004;
  key.shadow.normalBias = 0.02;
  key.shadow.radius = 4;
  scene.add(key, key.target);

  const fill = new THREE.DirectionalLight(0xdfe8ff, 0.45);
  fill.position.set(-6, 8, -4);
  scene.add(fill);
}
