import {
  CRUSHING_CUT,
  RECEPTION_EARTHWORK,
  ROAD_CIVIL_DETAIL,
} from '../src/scene/config/siteDesign.js';
import {
  getTerrainHeight,
  getTerrainMicrorelief,
  getZoneElevation,
} from '../src/scene/environment/terrainHeight.js';
import {
  getRoadCutFillTransitionWidth,
  getRoadDesignMetrics,
  getRoadSafetyBermHeight,
} from '../src/scene/environment/haulRoads.js';
import { createPrimaryRoadAlignment } from '../src/scene/environment/roadEngineering.js';
import { createCivilInfrastructure } from '../src/scene/environment/civilInfrastructure.js';
import { createIndustrialMaterial, SURFACE_MATERIAL_PROFILES } from '../src/scene/materials/industrialMaterials.js';

const checks = [];
const push = (id, ok, details) => checks.push({ id, ok: Boolean(ok), details });

const microSamples = [];
for (let x = -380; x <= 300; x += 47) {
  for (let z = -160; z <= 190; z += 41) microSamples.push(getTerrainMicrorelief(x, z));
}
const maxMicro = Math.max(...microSamples.map(Math.abs));
push('microrelief-bounded', maxMicro < 0.13, `max |microrelief|=${maxMicro.toFixed(4)} m`);

push(
  'reception-datum-preserved',
  Math.abs(getTerrainHeight(...RECEPTION_EARTHWORK.center) - getZoneElevation('reception')) < 0.1,
  `terrain=${getTerrainHeight(...RECEPTION_EARTHWORK.center).toFixed(3)} m`,
);
push(
  'crushing-datum-preserved',
  Math.abs(getTerrainHeight(...CRUSHING_CUT.center) - getZoneElevation('crushing')) < 1e-6,
  `terrain=${getTerrainHeight(...CRUSHING_CUT.center).toFixed(3)} m`,
);

const southEdge = CRUSHING_CUT.center[1] - CRUSHING_CUT.terraceSizeM[1] / 2;
const profileOffsets = [0, 3, 7, 11, 15];
const profile = profileOffsets.map((offset) => getTerrainHeight(CRUSHING_CUT.center[0], southEdge - offset));
const profileMax = Math.max(...profile);
const maxStep = Math.max(...profile.slice(1).map((value, index) => Math.abs(value - profile[index])));
push('crushing-cut-no-hump', profileMax < 7.25, `profile=${profile.map((v) => v.toFixed(3)).join(',')} m`);
push('crushing-cut-continuous', maxStep < 0.75, `max sampled step=${maxStep.toFixed(3)} m`);

const tieWidthStart = getRoadCutFillTransitionWidth('ROAD-01', ROAD_CIVIL_DETAIL.primaryTieInStart - 0.05);
const tieWidthEnd = getRoadCutFillTransitionWidth('ROAD-01', 1);
const bermStart = getRoadSafetyBermHeight('ROAD-01', ROAD_CIVIL_DETAIL.primaryBermTaperStart - 0.05);
const bermEnd = getRoadSafetyBermHeight('ROAD-01', 1);
push('rom-tie-in-flare', tieWidthEnd > tieWidthStart + 3, `${tieWidthStart.toFixed(2)}→${tieWidthEnd.toFixed(2)} m`);
push('rom-tie-in-berm-taper', bermStart > 1 && bermEnd < 0.01, `${bermStart.toFixed(2)}→${bermEnd.toFixed(2)} m`);

const curve = createPrimaryRoadAlignment();
const tieErrors = [0.90, 0.94, 0.97, 1].map((t) => {
  const point = curve.getPointAt(t);
  return Math.abs(getTerrainHeight(point.x, point.z) - point.y);
});
push('rom-road-terrain-continuity', Math.max(...tieErrors) < 0.002, `max error=${Math.max(...tieErrors).toFixed(6)} m`);
const primaryMetrics = getRoadDesignMetrics('ROAD-01');
push(
  'primary-haul-grade-preserved',
  primaryMetrics.maximumGrade <= primaryMetrics.designMaximumGrade,
  `max grade=${(primaryMetrics.maximumGrade * 100).toFixed(2)}% <= ${(primaryMetrics.designMaximumGrade * 100).toFixed(2)}%`,
);

const civil = createCivilInfrastructure();
push(
  'no-duplicate-reception-fill',
  !civil.getObjectByName('reception-engineered-embankment') && civil.userData.receptionEarthworkSource === 'terrainHeight',
  `source=${civil.userData.receptionEarthworkSource ?? 'missing'}`,
);
push('functional-rom-apron-retained', Boolean(civil.getObjectByName('reception-turning-apron')), 'turning apron present');

for (const role of ['terrain', 'road', 'concrete']) {
  const profile = SURFACE_MATERIAL_PROFILES[role];
  const material = createIndustrialMaterial(role);
  const repeats = new Set([
    profile.albedoRepeat.join('x'),
    profile.roughnessRepeat.join('x'),
    profile.bumpRepeat.join('x'),
  ]);
  push(
    `surface-profile:${role}`,
    repeats.size === 3 && material.bumpScale <= 0.08 && material.roughness >= 0.9,
    `albedo=${profile.albedoRepeat.join('x')} rough=${profile.roughnessRepeat.join('x')} bump=${profile.bumpRepeat.join('x')} scale=${material.bumpScale}`,
  );
}

const failed = checks.filter((check) => !check.ok);
console.log(JSON.stringify({
  revision: 'V22',
  checks: checks.length,
  passed: checks.length - failed.length,
  failed,
  details: checks,
}, null, 2));
if (failed.length) process.exit(1);
