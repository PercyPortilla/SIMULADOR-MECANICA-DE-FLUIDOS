import './equipmentLab.css';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EQUIPMENT_CATALOG, createCatalogAsset } from './equipment/catalog/equipmentCatalog.js';
import { INSPECTION_MODES } from './equipment/common/assetUtils.js';
import { createEquipmentMaterial } from './equipment/common/materialLibrary.js';

const host = document.querySelector('#equipment-lab');
host.innerHTML = `
  <div class="lab-shell">
    <aside class="lab-panel">
      <div class="lab-brand"><div class="lab-logo">P</div><div><p class="lab-eyebrow">PULPA LAB 3D</p><h1>EQUIPMENT <span>LAB</span></h1></div></div>
      <a class="lab-back" href="/">← Volver al simulador</a>
      <label class="lab-control"><span>EQUIPO AISLADO</span><select id="asset-select"></select></label>
      <label class="lab-control"><span>MODO DE INSPECCIÓN</span><select id="mode-select"></select></label>
      <div class="lab-toggles">
        <label><span>Animación</span><input id="animation-toggle" type="checkbox" checked /></label>
        <label><span>Bounding box</span><input id="bbox-toggle" type="checkbox" checked /></label>
        <label><span>Ports</span><input id="ports-toggle" type="checkbox" checked /></label>
        <label><span>Referencia humana 1.75 m</span><input id="human-toggle" type="checkbox" checked /></label>
      </div>
      <div class="lab-button-row"><button id="reset-camera">Reset cámara</button><button id="pause-motion">Pausar</button><button id="capture-4k">Captura 4K</button><button id="fit-closeup">Close-up</button></div>
      <section class="lab-card"><h2>QA / Estado</h2><div class="lab-status">● ASSET ISOLATED · 1 UNIT = 1 m</div></section>
      <section class="lab-card"><h2>Metadatos</h2><dl id="asset-metadata" class="lab-metadata"></dl></section>
      <section class="lab-card"><h2>Ports</h2><ul id="asset-ports" class="lab-port-list"></ul></section>
    </aside>
    <main class="lab-viewport"><canvas id="lab-canvas"></canvas><div class="lab-badge">CATÁLOGO V1 · AISLADO</div><div class="lab-overlay"><strong>Orbit</strong> · arrastrar &nbsp; <strong>Pan</strong> · botón derecho &nbsp; <strong>Zoom</strong> · rueda</div></main>
  </div>`;

const canvas = host.querySelector('#lab-canvas');
const viewport = host.querySelector('.lab-viewport');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.localClippingEnabled = true;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.08;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x17232a);
const camera = new THREE.PerspectiveCamera(42, 1, 0.05, 300);
camera.position.set(16, 11, 16);
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.dampingFactor = 0.07;
controls.target.set(0, 2.5, 0);
controls.maxDistance = 90;
controls.minDistance = 2;

scene.add(new THREE.HemisphereLight(0xc8dce3, 0x43382f, 1.7));
const key = new THREE.DirectionalLight(0xffffff, 3.2);
key.position.set(11, 18, 9);
key.castShadow = true;
key.shadow.mapSize.set(2048, 2048);
key.shadow.camera.left = -20; key.shadow.camera.right = 20; key.shadow.camera.top = 20; key.shadow.camera.bottom = -20;
scene.add(key);
const fill = new THREE.DirectionalLight(0x9fc8d9, 1.1);
fill.position.set(-10, 8, -12);
scene.add(fill);

const ground = new THREE.Mesh(new THREE.PlaneGeometry(100, 100), createEquipmentMaterial('concrete', { color: 0x515a5c }));
ground.name = 'equipment-lab-ground';
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);
const grid = new THREE.GridHelper(80, 80, 0x607984, 0x344a53);
grid.position.y = 0.005;
scene.add(grid);
const axes = new THREE.AxesHelper(2.5);
axes.position.set(-6, 0.02, -6);
scene.add(axes);

function makeHumanReference() {
  const group = new THREE.Group();
  group.name = 'human-reference-1p75m';
  const bodyMat = createEquipmentMaterial('safetyYellow');
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.18, 1.15, 5, 12), bodyMat);
  body.position.y = 0.78;
  body.castShadow = true;
  group.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.13, 18, 12), createEquipmentMaterial('paintedOrangeSteel'));
  head.position.y = 1.65;
  head.castShadow = true;
  group.add(head);
  group.position.set(-5.6, 0, 4.7);
  return group;
}
const human = makeHumanReference();
scene.add(human);

const assetSelect = host.querySelector('#asset-select');
const modeSelect = host.querySelector('#mode-select');
const animationToggle = host.querySelector('#animation-toggle');
const bboxToggle = host.querySelector('#bbox-toggle');
const portsToggle = host.querySelector('#ports-toggle');
const humanToggle = host.querySelector('#human-toggle');
const metadataNode = host.querySelector('#asset-metadata');
const portsNode = host.querySelector('#asset-ports');

const grouped = new Map();
EQUIPMENT_CATALOG.forEach((entry) => {
  if (!grouped.has(entry.category)) {
    const group = document.createElement('optgroup');
    group.label = entry.category;
    grouped.set(entry.category, group);
    assetSelect.append(group);
  }
  const option = document.createElement('option');
  option.value = entry.key;
  option.textContent = entry.label;
  grouped.get(entry.category).append(option);
});
INSPECTION_MODES.forEach((mode) => {
  const option = document.createElement('option');
  option.value = mode;
  option.textContent = ({ normal: 'Normal', transparent: 'Transparente', cutaway: 'Corte', interior: 'Interior' })[mode];
  modeSelect.append(option);
});

let active = null;
let bboxHelper = null;
let portGroup = new THREE.Group();
portGroup.name = 'port-debug-markers';
scene.add(portGroup);
const clock = new THREE.Clock();
let portRefreshAccumulator = 0;

function clearPortMarkers() {
  portGroup.children.forEach((child) => { child.geometry?.dispose?.(); child.material?.dispose?.(); });
  portGroup.clear();
}

function updatePorts() {
  clearPortMarkers();
  if (!active || !portsToggle.checked) return;
  const ports = active.getPorts();
  ports.forEach((port) => {
    const marker = new THREE.Mesh(new THREE.SphereGeometry(0.12, 16, 12), new THREE.MeshStandardMaterial({ color: 0x64d2b0, emissive: 0x1a5c4b, emissiveIntensity: 0.9 }));
    marker.position.copy(port.position);
    portGroup.add(marker);
    const arrow = new THREE.ArrowHelper(port.direction, port.position, 0.7, 0xe4b46e, 0.18, 0.1);
    portGroup.add(arrow);
  });
}

function renderMetadata() {
  if (!active) return;
  const m = active.metadata;
  const d = m.dimensions;
  metadataNode.innerHTML = `
    <dt>ID</dt><dd>${m.id}</dd>
    <dt>Categoría</dt><dd>${m.category}</dd>
    <dt>Clase</dt><dd>${m.referenceClass}</dd>
    <dt>Dimensiones</dt><dd>${d.length.toFixed(2)} × ${d.width.toFixed(2)} × ${d.height.toFixed(2)} m</dd>
    <dt>LOD</dt><dd>${m.capabilities.lod ? 'LOD0 / LOD1 / LOD2' : 'No requerido'}</dd>
    <dt>Inspección</dt><dd>${m.capabilities.inspection ? 'Normal / T / C / I' : 'N/A'}</dd>`;
  const ports = active.getPorts();
  portsNode.replaceChildren();
  if (!ports.length) {
    const li = document.createElement('li'); li.textContent = 'Sin ports de proceso'; portsNode.append(li);
  } else ports.forEach((port) => {
    const li = document.createElement('li');
    li.textContent = `${port.id} · ${port.type}${port.nominalDiameter ? ` · Ø${port.nominalDiameter} m` : ''}`;
    portsNode.append(li);
  });
}

function frameAsset() {
  if (!active) return;
  const box = active.getBoundingBox();
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const radius = Math.max(size.length() * 0.62, 4);
  camera.position.set(center.x + radius, center.y + radius * 0.65, center.z + radius);
  controls.target.copy(center);
  controls.update();
}

function loadAsset(keyName) {
  if (active) {
    scene.remove(active.root);
    active.dispose();
  }
  if (bboxHelper) { scene.remove(bboxHelper); bboxHelper = null; }
  active = createCatalogAsset(keyName);
  active.root.position.set(0, 0, 0);
  scene.add(active.root);
  active.setAnimationEnabled(animationToggle.checked);
  active.setInspectionMode(modeSelect.value);
  bboxHelper = new THREE.Box3Helper(active.getBoundingBox(), 0xe4b46e);
  bboxHelper.name = 'asset-bounding-box';
  bboxHelper.visible = bboxToggle.checked;
  scene.add(bboxHelper);
  renderMetadata();
  updatePorts();
  frameAsset();
}

assetSelect.addEventListener('change', () => loadAsset(assetSelect.value));
modeSelect.addEventListener('change', () => { active?.setInspectionMode(modeSelect.value); updatePorts(); });
animationToggle.addEventListener('change', () => active?.setAnimationEnabled(animationToggle.checked));
bboxToggle.addEventListener('change', () => { if (bboxHelper) bboxHelper.visible = bboxToggle.checked; });
portsToggle.addEventListener('change', updatePorts);
humanToggle.addEventListener('change', () => { human.visible = humanToggle.checked; });
host.querySelector('#reset-camera').addEventListener('click', frameAsset);
host.querySelector('#fit-closeup').addEventListener('click', () => {
  if (!active) return;
  const box = active.getBoundingBox();
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  const radius = Math.max(size.x, size.y, size.z) * 0.72;
  camera.position.set(center.x + radius, center.y + radius * 0.3, center.z + radius * 0.58);
  controls.target.copy(center);
  controls.update();
});
host.querySelector('#capture-4k').addEventListener('click', () => {
  const previousSize = renderer.getSize(new THREE.Vector2());
  const previousRatio = renderer.getPixelRatio();
  renderer.setPixelRatio(1);
  renderer.setSize(3840, 2160, false);
  camera.aspect = 3840 / 2160;
  camera.updateProjectionMatrix();
  renderer.render(scene, camera);
  const link = document.createElement('a');
  link.download = `${active?.id || 'equipment'}-4k.png`;
  link.href = canvas.toDataURL('image/png');
  link.click();
  renderer.setPixelRatio(previousRatio);
  renderer.setSize(previousSize.x, previousSize.y, false);
  camera.aspect = previousSize.x / previousSize.y;
  camera.updateProjectionMatrix();
});
host.querySelector('#pause-motion').addEventListener('click', () => {
  animationToggle.checked = !animationToggle.checked;
  active?.setAnimationEnabled(animationToggle.checked);
  host.querySelector('#pause-motion').textContent = animationToggle.checked ? 'Pausar' : 'Continuar';
});

function resize() {
  const width = Math.max(1, viewport.clientWidth);
  const height = Math.max(1, viewport.clientHeight);
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();
assetSelect.value = 'haulTruck';
modeSelect.value = 'normal';
loadAsset('haulTruck');

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);
  active?.update(dt);
  active?.updateLOD(camera);
  if (bboxHelper && bboxToggle.checked && active) bboxHelper.box.copy(active.getBoundingBox());
  portRefreshAccumulator += dt;
  if (portsToggle.checked && active && portRefreshAccumulator >= 0.5) {
    portRefreshAccumulator = 0;
    updatePorts();
  }
  controls.update();
  renderer.render(scene, camera);
}
animate();
