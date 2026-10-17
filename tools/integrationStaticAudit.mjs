import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ROAD_DEFINITIONS, REFERENCE_EQUIPMENT_DIMENSIONS, PLANT_ZONE_DEFINITIONS, PLANT_CLEARANCES } from '../src/scene/config/siteDesign.js';
import { FINAL_EQUIPMENT_LAYOUT } from '../src/scene/integration/finalLayout.js';
import { getTerrainHeight } from '../src/scene/environment/terrainHeight.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const checks = [];
const push = (id, ok, details) => checks.push({ id, ok: Boolean(ok), details });

function distancePointSegment(px, pz, ax, az, bx, bz) {
  const dx = bx - ax; const dz = bz - az;
  const l2 = dx * dx + dz * dz;
  const t = l2 > 1e-9 ? Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / l2)) : 0;
  const x = ax + dx * t; const z = az + dz * t;
  return Math.hypot(px - x, pz - z);
}

function minDistanceToPolyline(x, z, points) {
  let best = Infinity;
  for (let i = 0; i < points.length - 1; i += 1) {
    const a = points[i]; const b = points[i + 1];
    best = Math.min(best, distancePointSegment(x, z, a[0], a[1], b[0], b[1]));
  }
  return best;
}

const road = ROAD_DEFINITIONS['ROAD-01'];
const truck = REFERENCE_EQUIPMENT_DIMENSIONS.haulTruck;
push('haul-road-width-ratio', road.widthM / truck.widthM >= 3.5, `ratio=${(road.widthM / truck.widthM).toFixed(3)}x`);
push('haul-road-width-m', road.widthM >= 18, `${road.widthM} m`);

let maxGrade = 0;
for (let i = 0; i < road.points.length - 1; i += 1) {
  const [ax, az] = road.points[i];
  const [bx, bz] = road.points[i + 1];
  const horizontal = Math.hypot(bx - ax, bz - az);
  const grade = horizontal > 0 ? Math.abs(getTerrainHeight(bx, bz) - getTerrainHeight(ax, az)) / horizontal : 0;
  maxGrade = Math.max(maxGrade, grade);
}
push('haul-road-grade', maxGrade <= 0.10 + 1e-6, `max centerline segment grade=${(maxGrade * 100).toFixed(2)}%`);

const roadClearanceTargets = [
  ['ROM-HOPPER', 8.9],
  ['APRON-FEEDER', 10.5],
  ['PRIMARY-CRUSHER', 11.0],
];
for (const [id, minimum] of roadClearanceTargets) {
  const item = FINAL_EQUIPMENT_LAYOUT[id];
  const distance = minDistanceToPolyline(item.x, item.z, road.points);
  push(`road-clearance:${id}`, distance >= minimum, `centerline distance=${distance.toFixed(2)} m; required=${minimum} m`);
}

const zoneEntries = Object.values(PLANT_ZONE_DEFINITIONS);
let minZoneGap = Infinity;
for (let i = 0; i < zoneEntries.length; i += 1) {
  for (let j = i + 1; j < zoneEntries.length; j += 1) {
    const a = zoneEntries[i]; const b = zoneEntries[j];
    if (a.connections.includes(b.id) || b.connections.includes(a.id)) continue;
    const dx = Math.max(0, Math.abs(a.position.x - b.position.x) - (a.width + b.width) / 2);
    const dz = Math.max(0, Math.abs(a.position.z - b.position.z) - (a.depth + b.depth) / 2);
    const gap = Math.hypot(dx, dz);
    minZoneGap = Math.min(minZoneGap, gap);
  }
}
push('masterplan-nonconnected-gap', minZoneGap >= 1, `minimum non-connected zone gap=${minZoneGap.toFixed(2)} m`);
push('configured-module-gap', PLANT_CLEARANCES.minimumModuleGapM >= 8, `${PLANT_CLEARANCES.minimumModuleGapM} m`);

const millText = fs.readFileSync(path.join(root, 'src/equipment/grinding/ballMill.js'), 'utf8');
push('mill-static-group', millText.includes("staticGroup.name = 'mill-static-group'"), 'static group exists');
push('mill-rotating-group', millText.includes("rotatingGroup.name = 'mill-rotating-group'"), 'rotating group exists');
push('mill-only-local-rotating-group', millText.includes('rotatingGroup.rotation.x -= dt') && !/root\.rotation\.[xyz]\s*[+\-]?=/.test(millText), 'root not animated');

const pipingText = fs.readFileSync(path.join(root, 'src/scene/integration/integratedPiping.js'), 'utf8');
for (const id of [
  'P-MILL-TO-SUMP', 'P-SUMP-TO-PUMP', 'P-PUMP-TO-CYCLONES', 'P-CYCLONE-UNDERFLOW-RETURN',
  'P-CLASSIFICATION-TO-LEACH', 'P-LEACH-R01-R02', 'P-LEACH-R02-R03', 'P-LEACH-R03-R04',
  'P-R04-TO-CIP', 'P-ELUTION-TO-EW', 'MT-CIP-TO-ELUTION-CARBON', 'MT-EW-TO-SMELTING-CATHODE',
]) push(`connection:${id}`, pipingText.includes(id), id);

const integratedPlantText = fs.readFileSync(path.join(root, 'src/scene/integration/integratedPlant.js'), 'utf8');
for (const id of ['CV-01-FEEDER-TO-CRUSHER', 'CV-02-CRUSHER-TO-STOCKPILE', 'CV-03-STOCKPILE-TO-GRINDING']) {
  push(`conveyor:${id}`, integratedPlantText.includes(id), id);
}
push('catalog-frozen-integration', integratedPlantText.includes('createCatalogInstance'), 'catalog assets instantiated through integration layer');

const mobileText = fs.readFileSync(path.join(root, 'src/scene/integration/integratedMobile.js'), 'utf8');
push('truck-no-legacy-route', mobileText.includes("ROAD_DEFINITIONS['ROAD-01']"), 'truck route derives from redesigned ROAD-01');
push('truck-dump-state', mobileText.includes('setDumpAngle'), 'dump state integrated at ROM');
push('loader-route', mobileText.includes('loaderCurve') && mobileText.includes('loaderReturn'), 'loader has explicit safe cycle');

const baseText = fs.readFileSync(path.join(root, 'src/scene/baseEnvironment.js'), 'utf8');
push('scene-fog-null', baseText.includes('scene.fog = null'), 'fog remains disabled');
push('single-main-loop', (baseText.match(/requestAnimationFrame\(/g) || []).length === 2, 'one recurring loop plus one initial scheduling call');
push('integrated-system-active', baseText.includes('createIntegratedPlant') && !baseText.includes('createEquipmentSystem()'), 'legacy equipment system not instantiated');

const processRouteText = fs.readFileSync(path.join(root, 'src/process/processRoute.js'), 'utf8');
push('recovery-model-null', /recoveryModel:\s*null/.test(processRouteText), 'no fake recovery calculation');

const summary = {
  generatedAt: new Date().toISOString(),
  checks: checks.length,
  passed: checks.filter((c) => c.ok).length,
  failed: checks.filter((c) => !c.ok),
  maxRoadGradePct: Number((maxGrade * 100).toFixed(3)),
  roadWidthRatio: Number((road.widthM / truck.widthM).toFixed(3)),
  checksDetail: checks,
};
console.log(JSON.stringify(summary, null, 2));
if (summary.failed.length) process.exit(1);
