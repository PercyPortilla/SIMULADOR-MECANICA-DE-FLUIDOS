import { createBaseScene } from '../src/scene/baseEnvironment.js';
import { INSPECTION_FOCUS_PROFILES } from '../src/scene/inspection/equipmentInspection.js';
import { INSTRUMENT_SPECS } from '../src/scene/infrastructure/processInstrumentation.js';

const scene = createBaseScene();
const checks = [];
const add = (id, ok, details = '') => checks.push({ id, ok: Boolean(ok), details });

add('scene-no-fog', scene.scene.fog === null);
add('inspection-target-count', scene.equipmentInspection.getTargets().length === 38, String(scene.equipmentInspection.getTargets().length));
add('inspection-focus-profile-count', Object.keys(INSPECTION_FOCUS_PROFILES).length === 7, String(Object.keys(INSPECTION_FOCUS_PROFILES).length));
add('mobile-three-trucks', scene.mobileEquipment.trucks?.length === 3, String(scene.mobileEquipment.trucks?.length ?? 0));
add('mobile-v24-fleet', scene.mobileEquipment.root.userData.v24OperationalFleet === true);
add('material-transfer-count', scene.equipmentSystem.materialTransfers?.length === 3, String(scene.equipmentSystem.materialTransfers?.length ?? 0));
add('stockpile-feed-flow', Boolean(scene.scene.getObjectByName('STOCKPILE-RECLAIM-v24-feed-flow')));
add('classification-mechanical-access', Boolean(scene.scene.getObjectByName('CLASS-01-v24-mechanical-access')));
add('cip-service-deck', Boolean(scene.scene.getObjectByName('cip-service-deck')));
add('instrument-count', scene.processInstrumentation.instruments?.length === INSTRUMENT_SPECS.length, `${scene.processInstrumentation.instruments?.length ?? 0}/${INSTRUMENT_SPECS.length}`);
add('instrumentation-visual-only', scene.processInstrumentation.root.userData.visualOnly === true && scene.processInstrumentation.root.userData.solverCoupled === false);
add('industrial-safety', scene.industrialSafety.userData.v24IndustrialSafety === true);
add('industrial-infrastructure', scene.industrialInfrastructure.userData.v24IndustrialInfrastructure === true);
add('operational-surface-visual-only', scene.operationalSurfaceDetails.userData.visualOnly === true && scene.operationalSurfaceDetails.userData.authoritativeTerrain === false);
add('inspection-priority-hotspot-ui', Boolean(scene.scene.getObjectByName('MILL-01')) && Boolean(scene.scene.getObjectByName('PRIMARY-CRUSHER')));
add('secondary-shadow-policy', Number(scene.environmentRoot.userData.v24SecondaryShadowExclusions || 0) > 500, String(scene.environmentRoot.userData.v24SecondaryShadowExclusions || 0));
add('shadow-caster-budget', Number(scene.resourceStats.shadowCasters || Infinity) < 3300, String(scene.resourceStats.shadowCasters));
add('key-sun', scene.environmentRoot.getObjectByName('mine-sun-key-light')?.userData?.lightingRole === 'key-sun');
add('soft-fill', scene.environmentRoot.getObjectByName('soft-fill-light')?.castShadow === false);

for (const id of ['TRUCK-01', 'TRUCK-02', 'TRUCK-03', 'EXCAVATOR-01', 'LOADER-01']) {
  add(`mobile:${id}`, Boolean(scene.scene.getObjectByName(id)));
}
for (const id of ['SLURRY-PUMP-01', 'PUMP-01', 'CLASS-01', 'R-01', 'R-02', 'R-03', 'R-04', 'CIP-ADSORPTION', 'ELUTION-SKID', 'EW-CELLS']) {
  add(`instrument-priority:${id}`, Boolean(scene.scene.getObjectByName(id)));
}

const failed = checks.filter((check) => !check.ok);
const result = {
  revision: 'V24',
  generatedAt: new Date().toISOString(),
  checks: checks.length,
  passed: checks.length - failed.length,
  failed,
  checksDetail: checks,
};
console.log(JSON.stringify(result, null, 2));
if (failed.length) process.exitCode = 1;
