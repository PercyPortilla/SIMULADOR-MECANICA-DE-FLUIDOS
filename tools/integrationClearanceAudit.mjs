import { FINAL_EQUIPMENT_LAYOUT, MOBILE_ROUTE_LAYOUT, PIPE_CORRIDORS, SUPPORT_LAYOUT } from '../src/scene/integration/finalLayout.js';
import { ROAD_DEFINITIONS } from '../src/scene/config/siteDesign.js';
import { createRoadAlignment } from '../src/scene/environment/haulRoads.js';
import { createBaseScene } from '../src/scene/baseEnvironment.js';
import { RECOVERY_ROAD_FOOTING_CLEARANCE_M, RECOVERY_ROAD_SPAN_WIDTH_M } from '../src/scene/infrastructure/pipeRacks.js';

const dimensions = Object.freeze({
  'ROM-HOPPER': [11.5, 9.2], 'APRON-FEEDER': [8.4, 2.8], 'PRIMARY-CRUSHER': [5.4, 4.2],
  'MILL-01': [10.6, 6.1], 'SLURRY-PUMP-01': [4.8, 2.65], 'CLASS-01': [5.4, 5.4], 'PUMP-01': [4.8, 2.65],
  'R-01': [7.6, 7.6], 'R-02': [7.6, 7.6], 'R-03': [7.6, 7.6], 'R-04': [7.6, 7.6],
  'CIP-ADSORPTION': [13.8, 7.4], 'ELUTION-SKID': [9.4, 5.6], 'EW-CELLS': [10.8, 5.8], 'SMELTING-FURNACE': [7.4, 5.8],
});

function segmentDistance(px, pz, a, b) {
  const dx = b[0] - a[0]; const dz = b[1] - a[1]; const l2 = dx * dx + dz * dz;
  const t = l2 ? Math.max(0, Math.min(1, ((px - a[0]) * dx + (pz - a[1]) * dz) / l2)) : 0;
  return Math.hypot(px - (a[0] + dx * t), pz - (a[1] + dz * t));
}
function lineDistance(x, z, points) { return Math.min(...points.slice(0, -1).map((a, i) => segmentDistance(x, z, a, points[i + 1]))); }

const checks = [];
for (const [aId, a] of Object.entries(FINAL_EQUIPMENT_LAYOUT)) {
  for (const [bId, b] of Object.entries(FINAL_EQUIPMENT_LAYOUT)) {
    if (aId >= bId) continue;
    const [al, aw] = dimensions[aId]; const [bl, bw] = dimensions[bId];
    const gx = Math.abs(a.x - b.x) - (al + bl) / 2;
    const gz = Math.abs(a.z - b.z) - (aw + bw) / 2;
    checks.push({ id: `fixed-overlap:${aId}:${bId}`, ok: !(gx < 0 && gz < 0), details: `gapX=${gx.toFixed(2)} gapZ=${gz.toFixed(2)}` });
  }
}

for (const [roadId, road] of Object.entries(ROAD_DEFINITIONS)) {
  if (roadId === 'ROAD-01') continue; // ROAD-01 intentionally enters the ROM dump apron.
  for (const [id, item] of Object.entries(FINAL_EQUIPMENT_LAYOUT)) {
    const radius = Math.hypot(dimensions[id][0] / 2, dimensions[id][1] / 2);
    const distance = lineDistance(item.x, item.z, road.points);
    const minimum = road.widthM / 2 + road.shoulderM + radius + 0.75;
    checks.push({ id: `${roadId}-clearance:${id}`, ok: distance >= minimum, details: `distance=${distance.toFixed(2)} required=${minimum.toFixed(2)}` });
  }
}

const service = ROAD_DEFINITIONS['ROAD-02'];
const rackDistance = lineDistance(196, PIPE_CORRIDORS.recoveryRackZ, service.points);
const requiredPortalWidth = service.widthM + service.shoulderM * 2 + 2.0;
checks.push({
  id: 'recovery-rack-vs-service-road',
  ok: rackDistance <= service.widthM / 2 + service.shoulderM + 4 && RECOVERY_ROAD_SPAN_WIDTH_M >= requiredPortalWidth,
  details: `elevated corridor distance=${rackDistance.toFixed(2)} m; portal=${RECOVERY_ROAD_SPAN_WIDTH_M.toFixed(2)} m; required=${requiredPortalWidth.toFixed(2)} m`,
});

// V23: validate the actual runtime footing positions against the same curved
// Catmull-Rom ROAD-02 alignment rendered by the scene. The earlier width-only
// portal check could pass while a column still landed inside a curved shoulder.
const runtimeBase = createBaseScene();
runtimeBase.processPipeRacks.updateMatrixWorld(true);
const road02Curve = createRoadAlignment('ROAD-02');
const road02Samples = Array.from({ length: 901 }, (_, index) => {
  const point = road02Curve.getPoint(index / 900);
  return [point.x, point.z];
});
const recoveryFootingClearances = [];
runtimeBase.processPipeRacks.traverse((frame) => {
  if (!frame.userData?.pipeRackFrame || frame.userData.connectionId !== 'P-PUMP-01-TO-CIP') return;
  frame.children
    .filter((child) => child.name.includes('-footing-'))
    .forEach((footing) => {
      const world = road02Curve.getPoint(0);
      footing.getWorldPosition(world);
      recoveryFootingClearances.push(lineDistance(world.x, world.z, road02Samples));
    });
});
const minimumRecoveryFootingClearance = Math.min(...recoveryFootingClearances);
checks.push({
  id: 'recovery-rack-footings-vs-ROAD-02-curved-alignment',
  ok: recoveryFootingClearances.length > 0
    && minimumRecoveryFootingClearance >= RECOVERY_ROAD_FOOTING_CLEARANCE_M - 0.02,
  details: `min footing clearance=${minimumRecoveryFootingClearance.toFixed(2)} m; required=${RECOVERY_ROAD_FOOTING_CLEARANCE_M.toFixed(2)} m; footings=${recoveryFootingClearances.length}`,
});

const loaderLeg = Math.hypot(SUPPORT_LAYOUT.loaderDump.x - SUPPORT_LAYOUT.loaderPickup.x, SUPPORT_LAYOUT.loaderDump.z - SUPPORT_LAYOUT.loaderPickup.z);
checks.push({ id: 'loader-operating-cycle-length', ok: loaderLeg >= 12 && loaderLeg <= 30, details: `${loaderLeg.toFixed(2)} m` });

// Post-video loader QA: vehicle root stays outside the pile envelope except for the bucket reach.
const stockpileCenter = [6, -38];
const stockpileRadiusX = 13.5;
const stockpileRadiusZ = 13.5 * 1.16;
function normalizedEllipseDistance(x, z) {
  return Math.hypot((x - stockpileCenter[0]) / stockpileRadiusX, (z - stockpileCenter[1]) / stockpileRadiusZ);
}
for (const [routeName, points] of Object.entries(MOBILE_ROUTE_LAYOUT)) {
  const samples = [];
  points.slice(0, -1).forEach((a, index) => {
    const b = points[index + 1];
    for (let i = 0; i <= 20; i += 1) {
      const t = i / 20;
      samples.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
    }
  });
  const minimumEllipse = Math.min(...samples.map(([x, z]) => normalizedEllipseDistance(x, z)));
  checks.push({ id: `loader-route-vs-stockpile:${routeName}`, ok: minimumEllipse >= 1.03, details: `normalized clearance=${minimumEllipse.toFixed(3)}` });
}

const reclaimHopper = [29.5, -26];
const dumpStandOff = Math.hypot(SUPPORT_LAYOUT.loaderDump.x - reclaimHopper[0], SUPPORT_LAYOUT.loaderDump.z - reclaimHopper[1]);
checks.push({ id: 'loader-dump-standoff', ok: dumpStandOff >= 5.5 && dumpStandOff <= 10.5, details: `${dumpStandOff.toFixed(2)} m to reclaim hopper` });

const shovelRoot = [SUPPORT_LAYOUT.truckLoad.x + 10, SUPPORT_LAYOUT.truckLoad.z - 2];
const truckLoad = [SUPPORT_LAYOUT.truckLoad.x, SUPPORT_LAYOUT.truckLoad.z];
const shovelTruckSpacing = Math.hypot(shovelRoot[0] - truckLoad[0], shovelRoot[1] - truckLoad[1]);
checks.push({ id: 'shovel-truck-loading-spacing', ok: shovelTruckSpacing >= 8 && shovelTruckSpacing <= 14, details: `${shovelTruckSpacing.toFixed(2)} m root spacing` });

const failed = checks.filter((c) => !c.ok);
console.log(JSON.stringify({ generatedAt: new Date().toISOString(), checks: checks.length, passed: checks.length - failed.length, failed, checksDetail: checks }, null, 2));
if (failed.length) process.exit(1);
