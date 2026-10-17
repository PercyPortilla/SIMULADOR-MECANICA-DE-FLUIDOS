import * as THREE from 'three';
import { createAssetHandle } from '../src/equipment/common/assetUtils.js';
import { createBaseScene } from '../src/scene/baseEnvironment.js';
import { BLENDER_REPLACEMENT_SPECS } from '../src/scene/integration/blenderVisualReplacement.js';
import { INSPECTION_FOCUS_PROFILES } from '../src/scene/inspection/equipmentInspection.js';
import { RELEASE_INFO } from '../src/releaseInfo.js';
import { getInspectionComponentHotspots } from '../src/ui/inspectionGuide.js';

const scene = createBaseScene();
const checks = [];
const add = (id, ok, details = '') => checks.push({ id, ok: Boolean(ok), details });

add('scene-no-fog', scene.scene.fog === null);
add('release-identity', RELEASE_INFO.version === 'V25' && /Rendimiento y Fidelidad Operacional/i.test(RELEASE_INFO.name), `${RELEASE_INFO.version} · ${RELEASE_INFO.name}`);
add('inspection-target-count', scene.equipmentInspection.getTargets().length === 38, String(scene.equipmentInspection.getTargets().length));
add('inspection-focus-profile-count', Object.keys(INSPECTION_FOCUS_PROFILES).length === 7, String(Object.keys(INSPECTION_FOCUS_PROFILES).length));
add('lod-motion-interval', scene.industrialAnimations.lodUpdateIntervalSeconds === 0.125, String(scene.industrialAnimations.lodUpdateIntervalSeconds));
add('lod-stationary-refresh', scene.industrialAnimations.lodStationaryRefreshSeconds === 2, String(scene.industrialAnimations.lodStationaryRefreshSeconds));

const ewHotspots = getInspectionComponentHotspots('EW-CELLS');
const smeltingHotspots = getInspectionComponentHotspots('SMELTING-FURNACE');
add('ew-component-hotspots', ewHotspots.length >= 4, String(ewHotspots.length));
add('smelting-component-hotspots', smeltingHotspots.length >= 4, String(smeltingHotspots.length));

const smelting = BLENDER_REPLACEMENT_SPECS['SMELTING-FURNACE'];
add(
  'smelting-16s-pacing',
  smelting.animationPacing?.cycleSeconds === 16
    && smelting.animationPacing?.activeStartSeconds === 8.8
    && smelting.animationPacing?.activeEndSeconds === 13.12,
  JSON.stringify(smelting.animationPacing ?? null),
);
add(
  'mobile-loads-start-empty',
  BLENDER_REPLACEMENT_SPECS['EXCAVATOR-01'].initialMaterialLoadVisible === false
    && BLENDER_REPLACEMENT_SPECS['LOADER-01'].initialMaterialLoadVisible === false,
);

const reactorOffsets = ['R-01', 'R-02', 'R-03', 'R-04'].map((id) => (
  scene.equipmentSystem.getEquipment(id).group3D.userData.animationPhaseOffset
));
add(
  'reactor-phase-offsets',
  reactorOffsets.every((value, index) => Math.abs(value - [0.63, 1.26, 1.89, 2.52][index]) < 1e-10),
  JSON.stringify(reactorOffsets),
);

const root = new THREE.Group();
const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial());
let lodReads = 0;
Object.defineProperty(mesh.userData, 'lodTier', {
  configurable: true,
  enumerable: true,
  get() {
    lodReads += 1;
    return 0;
  },
});
root.add(mesh);
const handle = createAssetHandle({
  root,
  id: 'V25-AUDIT-ASSET',
  category: 'audit',
  name: 'V25 audit asset',
  referenceClass: 'audit',
  dimensions: { length: 1, width: 1, height: 1 },
  lodDistances: [10, 20],
});
const camera = new THREE.PerspectiveCamera();
camera.position.set(0, 0, 5);
handle.updateLOD(camera);
const firstPassReads = lodReads;
for (let index = 0; index < 20; index += 1) handle.updateLOD(camera);
add('lod-state-cache', firstPassReads === 1 && lodReads === firstPassReads, `${firstPassReads}/${lodReads}`);
handle.dispose();

add('shadow-caster-budget-preserved', Number(scene.resourceStats.shadowCasters || Infinity) < 3300, String(scene.resourceStats.shadowCasters));

const failed = checks.filter((check) => !check.ok);
const result = {
  revision: 'V25',
  scope: 'performance-operational-fidelity',
  generatedAt: new Date().toISOString(),
  checks: checks.length,
  passed: checks.length - failed.length,
  failed,
  checksDetail: checks,
};

console.log(JSON.stringify(result, null, 2));
if (failed.length) process.exitCode = 1;
