import { getTerrainHeight } from '../environment/terrainHeight.js';
import { MINE_AUXILIARY_AREAS, PIT_DESIGN } from '../config/siteDesign.js';

export const GEOTECH_UNITS = Object.freeze([
  Object.freeze({
    id: 'topsoil',
    name: 'TOPSOIL / SUELO SUPERFICIAL',
    category: 'natural',
    description: 'Capa superficial orgánica o alterada; se retira en áreas de infraestructura pesada.',
    color: 0x5f4a36,
    conceptualDepth: 'superficie; removida en áreas industriales',
    defaultVisible: true,
    priority: 10,
  }),
  Object.freeze({
    id: 'granular-soil',
    name: 'SUELO GRANULAR',
    category: 'natural',
    description: 'Gravas y arenas naturales. En el modelo se distinguen de los agregados estructurales construidos.',
    color: 0xb88947,
    conceptualDepth: 'subsuperficial variable',
    defaultVisible: true,
    priority: 20,
  }),
  Object.freeze({
    id: 'cohesive-soil',
    name: 'ARCILLA / LIMO',
    category: 'natural',
    description: 'Unidad cohesiva conceptual de menor competencia usada para explicar purga y reemplazo.',
    color: 0x9b5945,
    conceptualDepth: 'bolsones subsuperficiales localizados',
    defaultVisible: true,
    priority: 21,
  }),
  Object.freeze({
    id: 'weathered-rock',
    name: 'ROCA METEORIZADA',
    category: 'natural',
    description: 'Transición entre suelo residual y roca competente.',
    color: 0x7f7568,
    conceptualDepth: 'transición bajo suelos naturales',
    defaultVisible: true,
    priority: 30,
  }),
  Object.freeze({
    id: 'competent-rock',
    name: 'MACIZO ROCOSO',
    category: 'natural',
    description: 'Basamento rocoso conceptual y continuo; no se genera en función de la ubicación de los equipos.',
    color: 0x4f504e,
    conceptualDepth: 'basamento profundo continuo',
    defaultVisible: true,
    priority: 40,
  }),
  Object.freeze({
    id: 'uncontrolled-fill',
    name: 'RELLENO NO CONTROLADO',
    category: 'naturalized-fill',
    description: 'Relleno antrópico periférico conceptual, no considerado fundación de equipos pesados.',
    color: 0x756454,
    conceptualDepth: 'bolsón periférico superficial',
    defaultVisible: true,
    priority: 45,
  }),
  Object.freeze({
    id: 'structural-fill',
    name: 'RELLENO ESTRUCTURAL',
    category: 'engineered',
    description: 'Material seleccionado y compactado utilizado como solución de preparación del terreno.',
    color: 0xc29b5b,
    conceptualDepth: 'espesor según solución civil representada',
    defaultVisible: true,
    priority: 50,
  }),
  Object.freeze({
    id: 'concrete-foundation',
    name: 'CIMENTACIÓN DE CONCRETO',
    category: 'engineered',
    description: 'Elemento civil que transfiere las cargas del equipo al terreno preparado o competente.',
    color: 0x8e9390,
    conceptualDepth: 'profundidad de fundación conceptual',
    defaultVisible: true,
    priority: 60,
  }),
  Object.freeze({
    id: 'secondary-containment',
    name: 'CONTENCIÓN SECUNDARIA',
    category: 'engineered',
    description: 'Barrera de contención conceptual asociada a reactores y recuperación; no representa un heap-leach pad.',
    color: 0x344e51,
    conceptualDepth: 'barrera superficial bajo área contenida',
    defaultVisible: true,
    priority: 70,
  }),
  Object.freeze({
    id: 'groundwater',
    name: 'NIVEL FREÁTICO CONCEPTUAL',
    category: 'hydrogeological',
    description: 'Superficie didáctica no calibrada, deprimida hacia el tajo y el pit sump.',
    color: 0x3d89a8,
    conceptualDepth: 'superficie variable bajo terreno',
    defaultVisible: true,
    priority: 80,
  }),
]);

export const GEOTECH_TRANSECT = Object.freeze([
  Object.freeze([-362, 96]),
  Object.freeze([-310, 78]),
  Object.freeze([-250, 45]),
  Object.freeze([-178, -4]),
  Object.freeze([-110, -30]),
  Object.freeze([-40, -34]),
  Object.freeze([28, -28]),
  Object.freeze([90, -6]),
  Object.freeze([150, 12]),
  Object.freeze([205, 26]),
  Object.freeze([238, -24]),
  Object.freeze([230, -92]),
]);

function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}

function smoothstep(edge0, edge1, value) {
  if (edge0 === edge1) return value < edge0 ? 0 : 1;
  const t = clamp01((value - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}

function lerpScalar(a, b, t) {
  return a + (b - a) * clamp01(t);
}

function coherentWave(x, z) {
  return (
    0.52 * Math.sin(x * 0.016 + z * 0.011)
    + 0.31 * Math.cos(x * 0.009 - z * 0.019 + 0.7)
    + 0.17 * Math.sin((x + z) * 0.031 - 1.2)
  );
}

export function getCohesiveInfluence(x, z) {
  // Localized conceptual soft-ground domain centred on the east side of the reactor train.
  const dx = (x - 224) / 42;
  const dz = (z - 26) / 32;
  const radial = Math.sqrt(dx * dx + dz * dz);
  return 1 - smoothstep(0.45, 1.15, radial);
}

export function sampleNaturalStratigraphy(x, z) {
  const surfaceY = getTerrainHeight(x, z);
  const wave = coherentWave(x, z);
  const dxPit = x - PIT_DESIGN.center.x;
  const dzPit = (z - PIT_DESIGN.center.z) * (PIT_DESIGN.radiusX / PIT_DESIGN.radiusZ);
  const pitRadius = Math.hypot(dxPit, dzPit);
  const pitExcavation = 1 - smoothstep(PIT_DESIGN.radiusX * 0.76, PIT_DESIGN.radiusX * 1.04, pitRadius);
  const naturalTopsoil = Math.max(0.28, 0.58 + wave * 0.14);
  const naturalSoil = Math.max(2.1, 3.9 + wave * 0.85 + getCohesiveInfluence(x, z) * 0.75);
  // The open pit is an excavation: benches and floor reveal rock instead of regenerating soil at the cut surface.
  const topsoilThicknessM = lerpScalar(naturalTopsoil, 0.025, pitExcavation);
  const naturalSoilThicknessM = lerpScalar(naturalSoil, 0.32, pitExcavation * 0.96);
  const weatheredRockThicknessM = Math.max(2.2, lerpScalar(5.2 - wave * 0.55, 3.0, pitExcavation));
  const competentRockDisplayThicknessM = 10.5;
  const topsoilBottomY = surfaceY - topsoilThicknessM;
  const naturalSoilBottomY = topsoilBottomY - naturalSoilThicknessM;
  const weatheredRockBottomY = naturalSoilBottomY - weatheredRockThicknessM;
  const competentRockBottomY = weatheredRockBottomY - competentRockDisplayThicknessM;
  return Object.freeze({
    x,
    z,
    surfaceY,
    topsoilThicknessM,
    naturalSoilThicknessM,
    weatheredRockThicknessM,
    topsoilBottomY,
    naturalSoilBottomY,
    weatheredRockBottomY,
    competentRockBottomY,
    cohesiveInfluence: getCohesiveInfluence(x, z),
    surficialSoilId: getCohesiveInfluence(x, z) >= 0.5 ? 'cohesive-soil' : 'granular-soil',
  });
}

export function getGroundwaterElevation(x, z) {
  const sump = MINE_AUXILIARY_AREAS.pitSump;
  const scaledPitDistance = Math.hypot(
    x - PIT_DESIGN.center.x,
    (z - PIT_DESIGN.center.z) * (PIT_DESIGN.radiusX / PIT_DESIGN.radiusZ),
  );
  const pitInfluence = 1 - smoothstep(PIT_DESIGN.floorRadiusM * 0.7, PIT_DESIGN.radiusX * 1.15, scaledPitDistance);
  const sumpDistance = Math.hypot(x - sump.x, z - sump.z);
  const sumpInfluence = 1 - smoothstep(15, 95, sumpDistance);
  const regional = -4.8 + Math.sin(x * 0.013 - z * 0.009) * 0.9;
  const depressed = regional - pitInfluence * 16.5 - sumpInfluence * 5.8;
  const terrainCap = getTerrainHeight(x, z) - 1.8;
  return Math.min(depressed, terrainCap, PIT_DESIGN.floorElevation + 3.6 + (1 - sumpInfluence) * 11.0);
}

export function getGeotechUnit(unitId) {
  const unit = GEOTECH_UNITS.find((item) => item.id === unitId);
  if (!unit) throw new RangeError(`Unidad geotécnica desconocida: ${unitId}.`);
  return unit;
}
