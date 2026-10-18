import './babylonPreview.css';
import { createBabylonRuntime } from './babylon/runtime/baseEnvironment.js';
import { CAMERA_PRESET_ORDER } from './babylon/cameras/cameraPresets.js';
import { CAMERA_PRESET_LABELS } from './ui/cameraMetadata.js';

const canvas = document.querySelector('#babylon-canvas');
const cameraSelect = document.querySelector('#babylon-camera');
const engineStatus = document.querySelector('#babylon-engine-status');
const terrainStatus = document.querySelector('#babylon-terrain-status');
const blenderStatus = document.querySelector('#babylon-blender-status');
const equipmentStatus = document.querySelector('#babylon-equipment-status');
const pipingStatus = document.querySelector('#babylon-piping-status');
const handednessStatus = document.querySelector('#babylon-handedness');

if (!(canvas instanceof HTMLCanvasElement)) {
  throw new Error('Babylon preview canvas not found.');
}

const runtime = createBabylonRuntime({ canvas });

CAMERA_PRESET_ORDER.forEach((id) => {
  const option = document.createElement('option');
  option.value = id;
  option.textContent = CAMERA_PRESET_LABELS[id] ?? id;
  cameraSelect.append(option);
});
cameraSelect.value = runtime.activeCamera;

cameraSelect.addEventListener('change', () => {
  runtime.setCamera(cameraSelect.value);
});

const webglVersion = runtime.engine.webGLVersion || '?';
engineStatus.textContent = `Babylon.js · WebGL ${webglVersion}`;
terrainStatus.textContent = `${runtime.terrain.getTotalVertices().toLocaleString('es-PE')} vértices · getTerrainHeight()`;
handednessStatus.textContent = runtime.scene.useRightHandedSystem ? 'Right-handed · 1 u = 1 m' : 'ERROR';

if (runtime.receptionEarthworkOverlay) {
  runtime.receptionEarthworkOverlay.ready.then(() => {
    const metadata = runtime.receptionEarthworkOverlay.host.metadata;
    blenderStatus.textContent = runtime.receptionEarthworkOverlay.loaded
      ? `V26 cargado · ${metadata.importedMeshCount ?? 0} meshes`
      : 'Fallback procedural';
    runtime.invalidateRender(180);
  });
} else {
  blenderStatus.textContent = 'No disponible';
}

if (runtime.processEquipmentSystem) {
  runtime.processEquipmentSystem.ready.then(() => {
    equipmentStatus.textContent = `${runtime.processEquipmentSystem.loadedVisualCount}/${runtime.processEquipmentSystem.visualCount} GLB`;
    const audits = runtime.pipingSystem?.auditConnectionEndpoints?.() ?? [];
    const valid = audits.filter((audit) => audit.valid).length;
    pipingStatus.textContent = `${valid}/${audits.length} endpoints`;
    runtime.invalidateRender(240);
  });
} else {
  equipmentStatus.textContent = 'No disponible';
  pipingStatus.textContent = 'No disponible';
}

function resize() {
  runtime.resize();
}

window.addEventListener('resize', resize);
window.addEventListener('orientationchange', resize);
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) runtime.invalidateRender(240);
});

runtime.startRenderLoop();
runtime.invalidateRender();

// Deliberately exposed only by this migration-preview entrypoint. It gives
// runtime QA a stable handle without coupling the production V30 UI to Babylon
// before equipment/piping/Inspection reach parity.
window.__PULPA_BABYLON_PREVIEW__ = runtime;

window.addEventListener('beforeunload', () => {
  window.removeEventListener('resize', resize);
  window.removeEventListener('orientationchange', resize);
  runtime.dispose();
}, { once: true });
