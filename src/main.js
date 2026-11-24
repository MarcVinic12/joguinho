import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import './style.css';
import { createLab } from './scene.js';
import { Player } from './player.js';
import { Interaction } from './interaction.js';
import { HUD } from './hud.js';
import { SlicerUI } from './slicerUI.js';
import { FDMPrinter, ResinPrinter } from './printers.js';

/* ------------------------------- Renderer ------------------------------- */
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.localClippingEnabled = true; // necessário para a impressão camada por camada
document.getElementById('app').appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xdde1e6);
scene.fog = new THREE.Fog(0xdde1e6, 20, 42);
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.35;

const camera = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, 0.02, 80);

/* ------------------------------- Mundo ------------------------------- */
const hud = new HUD();
const lab = createLab(scene);

let showcaseCount = 0;
const hooks = {
  toast: (msg, type, ms) => hud.toast(msg, type, ms),
  onCollect: (mesh, job) => {
    // Expõe a peça pronta na mesa "Peças Produzidas" (grade 2 × 4)
    const i = showcaseCount++ % 8;
    mesh.position.set(-0.25 + (i % 2) * 0.22, 0, -0.33 + Math.floor(i / 2) * 0.2);
    mesh.rotation.y = Math.random() * Math.PI;
    lab.showcase.add(mesh);
    hud.addCollected(job);
  },
};

const fdm = new FDMPrinter(hooks);
fdm.group.position.copy(lab.anchors.fdm.position);
fdm.group.rotation.y = lab.anchors.fdm.rotationY;
const resin = new ResinPrinter(hooks);
resin.group.position.copy(lab.anchors.resin.position);
resin.group.rotation.y = lab.anchors.resin.rotationY;
scene.add(fdm.group, resin.group);
const printers = [fdm, resin];

const player = new Player(camera, renderer.domElement, lab.colliders, lab.bounds);
player.spawn(lab.anchors.spawn);

const interaction = new Interaction(camera, hud);
interaction.register(lab.computerTarget, {
  getPrompt: () => '[E] Usar Computador · Software de Fatiamento',
  onInteract: openSlicer,
});
interaction.register(fdm.group, fdm);
interaction.register(resin.group, resin);

const slicer = new SlicerUI(document.getElementById('slicer-root'), {
  onSend: handleSend,
  onClose: (relock) => closeSlicer(relock),
});

/* ------------------------- Máquina de estados da UI ------------------------- */
// 'menu' (overlay) | 'play' (pointer lock) | 'slicer' (software aberto)
let mode = 'menu';

player.controls.addEventListener('lock', () => {
  mode = 'play';
  player.resetInput();
  hud.hideOverlay();
  hud.setGameHudVisible(true);
});
player.controls.addEventListener('unlock', () => {
  player.resetInput();
  if (mode === 'slicer') return;
  mode = 'menu';
  interaction.clear();
  hud.showOverlay('pause');
});
document.addEventListener('pointerlockerror', () => {
  if (mode !== 'slicer') {
    mode = 'menu';
    hud.showOverlay('pause');
  }
});

function requestLock() {
  try {
    const r = renderer.domElement.requestPointerLock?.();
    if (r && typeof r.catch === 'function') r.catch(() => hud.showOverlay('pause'));
  } catch {
    hud.showOverlay('pause');
  }
}

document.getElementById('overlay').addEventListener('click', () => {
  if (mode === 'menu') requestLock();
});

function openSlicer() {
  mode = 'slicer';
  interaction.clear();
  player.controls.unlock();
  hud.setGameHudVisible(false);
  slicer.open();
}

function closeSlicer(relock) {
  if (mode !== 'slicer') return;
  slicer.close();
  mode = 'menu';
  hud.setGameHudVisible(true);
  if (relock) requestLock(); // clique (gesto do usuário) permite retomar o pointer lock direto
  else hud.showOverlay('resume');
}

function handleSend(job) {
  const printer = job.tech === 'fdm' ? fdm : resin;
  if (!printer.canReceive()) {
    hud.toast(`${printer.name} ocupada (${printer.stateLabel.toLowerCase()}). Aguarde ou retire a peça.`, 'error', 4200);
    return;
  }
  printer.receiveJob(job);
  hud.toast(
    job.autoStart
      ? `Arquivo enviado: ${printer.name} começou a imprimir "${job.partName}"`
      : `Arquivo enviado para a ${printer.name}. Vá até ela e pressione E para iniciar.`,
    'success',
    4500
  );
  closeSlicer(true);
}

addEventListener('keydown', (e) => {
  if (e.code === 'KeyE' && mode === 'play' && !e.repeat) interaction.interact();
  if (e.code === 'Escape' && mode === 'slicer') closeSlicer(false);
});
renderer.domElement.addEventListener('mousedown', (e) => {
  if (mode === 'play' && e.button === 0) interaction.interact();
});

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

/* ------------------------------- Loop ------------------------------- */
const timer = new THREE.Timer();
timer.connect(document); // pausa o delta quando a aba fica oculta
renderer.setAnimationLoop((time) => {
  timer.update(time);
  const dt = Math.min(timer.getDelta(), 0.05);
  const t = timer.getElapsed();

  if (mode === 'play') player.update(dt);
  for (const p of printers) p.update(dt, t);
  lab.update(dt, t);
  if (mode === 'play') interaction.update();
  hud.updatePrinters(printers, dt);
  slicer.update(dt);

  renderer.render(scene, camera);
});

// Atalho de depuração no console: window.lab
window.lab = { scene, camera, fdm, resin, slicer, player, interaction };
