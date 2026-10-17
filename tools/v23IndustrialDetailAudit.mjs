import * as THREE from 'three';
import { createBaseScene } from '../src/scene/baseEnvironment.js';
import { INSPECTION_FOCUS_PROFILES } from '../src/scene/inspection/equipmentInspection.js';
import { createRoadAlignment } from '../src/scene/environment/haulRoads.js';
import { RECOVERY_ROAD_FOOTING_CLEARANCE_M } from '../src/scene/infrastructure/pipeRacks.js';
import { BLENDER_REPLACEMENT_SPECS } from '../src/scene/integration/blenderVisualReplacement.js';

function segmentDistance(point, a, b) {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const lengthSq = dx * dx + dz * dz;
  const t = lengthSq <= 1e-12
    ? 0
    : THREE.MathUtils.clamp(((point.x - a.x) * dx + (point.z - a.z) * dz) / lengthSq, 0, 1);
  return Math.hypot(point.x - (a.x + dx * t), point.z - (a.z + dz * t));
}

const checks = [];
const record = (id, ok, details = '') => checks.push({ id, ok: Boolean(ok), details });
const base = createBaseScene();

record('scene-no-fog', base.scene.fog === null);
record('inspection-target-count', base.equipmentInspection.getTargets().length === 38, `${base.equipmentInspection.getTargets().length}`);
record('inspection-focus-profile-count', Object.keys(INSPECTION_FOCUS_PROFILES).length === 7, `${Object.keys(INSPECTION_FOCUS_PROFILES).length}`);

for (const [id, profile] of Object.entries(INSPECTION_FOCUS_PROFILES)) {
  const framing = base.equipmentInspection.getFraming(id);
  const span = framing ? Math.max(framing.size.x, framing.size.z) : Infinity;
  const spanOk = !profile.maxSpanM || span <= profile.maxSpanM + 1e-9;
  record(
    `inspection-focus:${id}`,
    Boolean(framing?.focused) && spanOk,
    framing ? `${framing.source}; span=${span.toFixed(2)} m` : 'missing',
  );
}

for (const id of [
  'CV-01-FEEDER-TO-CRUSHER',
  'CV-02-CRUSHER-TO-STOCKPILE',
  'CV-03-STOCKPILE-TO-GRINDING',
]) {
  const conveyor = base.equipmentSystem.getEquipment(id)?.group3D;
  record(
    `conveyor-v23-detail:${id}`,
    Boolean(conveyor?.userData?.v23MechanicalDetail)
      && Boolean(conveyor?.getObjectByName('conveyor-head-belt-scraper')),
    `${conveyor?.userData?.v23MechanicalDetailParts ?? 0} parts`,
  );
}

const crusher = base.equipmentSystem.getEquipment('PRIMARY-CRUSHER')?.group3D;
record(
  'primary-crusher-v23-safety-overlay',
  Boolean(crusher?.getObjectByName('PRIMARY-CRUSHER-v23-safety-overlay'))
    && Boolean(crusher?.getObjectByName('crusher-service-ladder'))
    && Boolean(crusher?.getObjectByName('crusher-service-flywheel-guard')),
);

const millSpec = BLENDER_REPLACEMENT_SPECS['MILL-01'];
record(
  'mill-minimal-educational-interior',
  JSON.stringify(millSpec.preserveProceduralOverlays) === JSON.stringify(['mill-charge'])
    && millSpec.proceduralOverlayAnchors?.['mill-charge'] === 'MILL-01_ROTATING_GROUP'
    && millSpec.keepProceduralUpdate !== true,
);
for (const id of ['SLURRY-PUMP-01', 'PUMP-01']) {
  const spec = BLENDER_REPLACEMENT_SPECS[id];
  record(
    `pump-minimal-educational-interior:${id}`,
    JSON.stringify(spec.preserveProceduralOverlays) === JSON.stringify(['pump-impeller', 'pump-slurry-path'])
      && spec.proceduralOverlayAnchors?.['pump-impeller'] === 'SLURRY-PUMP-01_ROTATING_GROUP'
      && spec.keepProceduralUpdate !== true,
  );
}
const elutionSpec = BLENDER_REPLACEMENT_SPECS['ELUTION-SKID'];
record(
  'elution-minimal-educational-interior',
  elutionSpec.preserveProceduralOverlays?.length === 11
    && elutionSpec.preserveProceduralOverlays.includes('elution-column-solution')
    && elutionSpec.preserveProceduralOverlays.includes('elution-tank-liquid')
    && elutionSpec.keepProceduralUpdate !== true,
);

const road = createRoadAlignment('ROAD-02');
const roadSamples = Array.from({ length: 901 }, (_, index) => road.getPoint(index / 900));
const rackFootingClearances = [];
const recoveryRoadAwareWidths = [];
base.processPipeRacks.traverse((frame) => {
  if (!frame.userData?.pipeRackFrame || frame.userData.connectionId !== 'P-PUMP-01-TO-CIP') return;
  if (frame.userData.roadSupportMode) recoveryRoadAwareWidths.push(frame.userData.frameWidthM);
  frame.children
    .filter((child) => child.name.includes('-footing-'))
    .forEach((footing) => {
      const point = footing.getWorldPosition(new THREE.Vector3());
      let minimum = Infinity;
      for (let index = 0; index < roadSamples.length - 1; index += 1) {
        minimum = Math.min(minimum, segmentDistance(point, roadSamples[index], roadSamples[index + 1]));
      }
      rackFootingClearances.push(minimum);
    });
});
const minRackClearance = Math.min(...rackFootingClearances);
record(
  'recovery-rack-footings-clear-road02',
  rackFootingClearances.length > 0 && minRackClearance >= RECOVERY_ROAD_FOOTING_CLEARANCE_M - 0.02,
  `min=${minRackClearance.toFixed(2)} m; required=${RECOVERY_ROAD_FOOTING_CLEARANCE_M.toFixed(2)} m; footings=${rackFootingClearances.length}`,
);
record(
  'recovery-road-supports-not-oversized',
  recoveryRoadAwareWidths.length > 0 && Math.max(...recoveryRoadAwareWidths) <= 22,
  `max width=${Math.max(...recoveryRoadAwareWidths).toFixed(2)} m; road-aware frames=${recoveryRoadAwareWidths.length}`,
);

const tallNonRack = [];
base.processPipeRacks.traverse((frame) => {
  if (!frame.userData?.pipeRackFrame || !['local', 'trestle'].includes(frame.userData.policy)) return;
  const columns = frame.children.filter((child) => child.name.includes('-column-'));
  const maximumHeight = Math.max(0, ...columns.map((column) => column.geometry?.parameters?.height ?? 0));
  if (maximumHeight > 3.2) tallNonRack.push(frame);
});
record(
  'tall-local-trestle-bracing',
  tallNonRack.length > 0 && tallNonRack.every((frame) => frame.userData.bracedFrame === true),
  `${tallNonRack.length} tall frames`,
);

const endpointAudit = base.integratedPiping.auditConnectionEndpoints(0.03);
record(
  'piping-endpoints-preserved',
  endpointAudit.length > 0 && endpointAudit.every((item) => item.valid),
  `${endpointAudit.filter((item) => item.valid).length}/${endpointAudit.length}`,
);

const pipe1Three = base.integratedPiping.refreshPipe1({
  innerDiameterM: 0.25,
  lengthM: 20,
  material: 'Acero',
  accessories: { valvesCount: 3 },
});
const visualValvesThree = pipe1Three.children.filter((child) => child.userData?.fittingType === 'isolation-valve').length;
record(
  'pipe1-three-visual-valves',
  pipe1Three.userData.visualValveCount === 3 && visualValvesThree === 3,
  `${visualValvesThree}`,
);
const pipe1Zero = base.integratedPiping.refreshPipe1({
  innerDiameterM: 0.25,
  lengthM: 20,
  material: 'Acero',
  accessories: { valvesCount: 0 },
});
const visualValvesZero = pipe1Zero.children.filter((child) => child.userData?.fittingType === 'isolation-valve').length;
record(
  'pipe1-zero-visual-valves',
  pipe1Zero.userData.visualValveCount === 0 && visualValvesZero === 0,
  `${visualValvesZero}`,
);

const failed = checks.filter((check) => !check.ok);
console.log(JSON.stringify({
  revision: 'V23',
  generatedAt: new Date().toISOString(),
  checks: checks.length,
  passed: checks.length - failed.length,
  failed,
  checksDetail: checks,
}, null, 2));
if (failed.length) process.exit(1);
