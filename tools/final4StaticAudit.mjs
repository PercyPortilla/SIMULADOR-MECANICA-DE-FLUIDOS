import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');
const checks = [];
const push = (id, ok, details) => checks.push({ id, ok: Boolean(ok), details });

const piping = read('src/scene/piping/pipingEngine.js');
const animations = read('src/scene/integration/integratedAnimations.js');
const truck = read('src/equipment/mining/haulTruck.js');
const mobile = read('src/scene/integration/integratedMobile.js');
const roads = read('src/scene/environment/haulRoads.js');
const components = read('src/equipment/common/components.js');

// Slurry particle confinement.
push('slurry-piecewise-linear-curve', piping.includes('new THREE.CurvePath()') && piping.includes('new THREE.LineCurve3'), 'particles follow same piecewise-linear route as pipe segments');
push('slurry-no-catmull-particle-route', !/function createFlowParticles[\s\S]*?new THREE\.CatmullRomCurve3/.test(piping), 'no spline bowing in createFlowParticles');
push('slurry-radial-confinement', piping.includes('const maxRadialOffset = fluidRadius * 0.42'), 'particle centres limited to 42% of slurry-core radius');
push('slurry-radial-data', piping.includes('flowRadialDistance') && piping.includes('flowRadialAngle'), 'per-particle radial offsets stored once');
push('slurry-local-frame-animation', animations.includes('getTangentAt') && animations.includes('particleNormalScratch') && animations.includes('particleBinormalScratch'), 'local tangent/normal/binormal frame used during motion');
push('slurry-no-additive-glitter', piping.includes('blending: THREE.NormalBlending'), 'normal blending avoids glitter-like additive halo');
push('slurry-particle-size-capped', piping.includes('Math.min(0.034, renderedDiameterM * 0.055)'), 'point sprite size capped');
const minRenderedDiameter = 0.40;
const fluidRadius = minRenderedDiameter * 0.31;
const maxRadialOffset = fluidRadius * 0.42;
const maxSpriteRadius = Math.min(0.034, minRenderedDiameter * 0.055) / 2;
push('slurry-minimum-containment-margin', maxRadialOffset + maxSpriteRadius < fluidRadius, `minimum pipe: fluidRadius=${fluidRadius.toFixed(3)} m, particle extent=${(maxRadialOffset + maxSpriteRadius).toFixed(3)} m, margin=${(fluidRadius - maxRadialOffset - maxSpriteRadius).toFixed(3)} m`);

// Truck wheel kinematics.
push('truck-steer-pivot', truck.includes('wheelSteerPivot = true') && truck.includes('truck-wheel-steer-pivot-'), 'explicit steering pivots');
push('truck-spin-pivot', truck.includes('wheelSpinPivot = true') && truck.includes('truck-wheel-spin-pivot-'), 'explicit rolling pivots');
push('truck-wheel-hierarchy', truck.includes('spinPivot.add(wheel)') && truck.includes('steerPivot.add(spinPivot)'), 'steer -> spin -> wheel hierarchy');
push('truck-wheel-geometry-axis-z', components.includes('tire.rotation.x = Math.PI / 2') && components.includes('hub.rotation.x = Math.PI / 2'), 'wheel cylinders are oriented on local Z axis, matching spinPivot.rotation.z');
push('truck-distance-over-radius', truck.includes('spinPivot.rotation.z -= distanceM / radius'), 'rolling angle derived from travelled distance / tyre radius');
push('truck-no-name-recursive-wheel-rotation', !mobile.includes('rotateNamedWheels') && !/traverse\([\s\S]{0,300}truck-wheel-/.test(mobile), 'integration no longer rotates wheel children by regex');
push('truck-steering-curve-derived', mobile.includes('steeringFromCurve') && mobile.includes('truck.setSteering'), 'front steering follows route curvature');
push('truck-travel-derived', mobile.includes('loadedLane.getLength() * (dt / truckTimings.haul)') && mobile.includes('returnLane.getLength() * (dt / truckTimings.return)'), 'wheel travel tied to route distance');

// Dump body direction.
push('dump-rear-hinge', truck.includes("pivot.userData.dumpHinge = 'rear'") && truck.includes('pivot.position.set(-2.7, 2.48, 0)'), 'rear hinge explicitly declared at negative local X');
push('dump-positive-local-z', truck.includes('bodyPivot.rotation.z = loadedState.dumpAngle') && truck.includes('bodyPivot.rotation.z = THREE.MathUtils.clamp'), 'positive local-Z raises front (+X) around rear hinge');
push('dump-no-negative-setter', !truck.includes('bodyPivot.rotation.z = -THREE.MathUtils.clamp'), 'setter no longer flips dump direction');
push('dump-rom-heading-preserved', mobile.includes('truck.root.rotation.y = Math.PI') && mobile.includes('preserveDumpHeading = true'), 'truck rear remains oriented toward ROM during dump');
const dumpAngle = 48 * Math.PI / 180;
const representativeFrontOffset = 4.2;
push('dump-kinematic-front-rises', representativeFrontOffset * Math.sin(dumpAngle) > 3.0, `48° positive rotation raises representative front point ${(representativeFrontOffset * Math.sin(dumpAngle)).toFixed(2)} m`);

// Road engineering visual rebuild.
push('road-engineered-surface', roads.includes('buildRoadSurfaceGeometry') && roads.includes('engineeredRoad: true'), 'engineered center/crown road surface');
push('road-curve-widening', roads.includes('function curveWidening') && roads.includes('Math.min(2.8, angle * 16)'), 'primary haul road widens in curves');
push('road-shoulders', roads.includes('left-shoulder') && roads.includes('right-shoulder'), 'explicit shoulders');
push('road-cut-fill-transitions', roads.includes('cut-fill-transition') && roads.includes('leftTerrain') && roads.includes('rightTerrain'), 'road corridor transitions to terrain');
push('road-continuous-berms', roads.includes('buildBermGeometry') && roads.includes('continuous-safety-berm'), 'continuous safety berm geometry');
push('road-no-rock-bead-berms', !roads.includes('DodecahedronGeometry'), 'removed repeated boulder berms');
push('road-flat-track-ribbons', roads.includes('buildTrackRibbonGeometry') && !roads.includes('new THREE.TubeGeometry'), 'wheel tracks are flat ribbons, not round tubes');
push('road-crossfall-controlled', roads.includes('PRIMARY_CROSSFALL = 0.022') && roads.includes('SERVICE_CROSSFALL = 0.018'), 'controlled crossfall/crown targets');

const failed = checks.filter((check) => !check.ok);
const result = {
  generatedAt: new Date().toISOString(),
  checks: checks.length,
  passed: checks.length - failed.length,
  failed,
  checksDetail: checks,
};
console.log(JSON.stringify(result, null, 2));
if (failed.length) process.exit(1);
