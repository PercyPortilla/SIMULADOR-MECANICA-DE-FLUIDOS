import { Color3 } from '@babylonjs/core/Maths/math.color.js';

export const BABYLON_SCENE_PALETTE_ROLES = Object.freeze([
  'terrain',
  'road',
  'concrete',
  'structuralSteel',
  'processSteel',
  'pipeSteel',
  'pipeHdpe',
  'safetyYellow',
  'mineral',
  'vehicleYellow',
]);

function validHexNumber(value) {
  return Number.isInteger(value) && value >= 0 && value <= 0xffffff;
}

function color3FromHexNumber(value) {
  return new Color3(
    ((value >> 16) & 0xff) / 255,
    ((value >> 8) & 0xff) / 255,
    (value & 0xff) / 255,
  );
}

function recolor(material, value, applied, role) {
  if (!material?.diffuseColor || !validHexNumber(value)) return;
  material.diffuseColor.copyFrom(color3FromHexNumber(value));
  material.metadata = {
    ...(material.metadata ?? {}),
    scenePaletteRole: role,
  };
  applied.add(material);
}

function compact(values) {
  return values.flat(Infinity).filter(Boolean);
}

export function applyBabylonScenePalette(base, palette = {}, { pipe1MaterialName = '' } = {}) {
  if (!base?.scene) throw new TypeError('Babylon scene palette requires a base scene handle.');
  const applied = new Set();
  const roadMaterials = Object.values(base.roadNetwork?.roads ?? {}).map((road) => road?.material);
  const civil = base.civilInfrastructure?.materials ?? {};
  const mine = base.mineProps?.materials ?? {};
  const infra = base.industrialInfrastructure?.materials ?? {};
  const transport = base.materialTransportSystem?.materials ?? {};
  const instrumentation = base.processInstrumentation?.materials ?? {};
  const safety = base.industrialSafety?.materials ?? {};

  const targets = {
    terrain: [base.terrainMaterial],
    road: [...roadMaterials, civil.road],
    concrete: [
      base.industrialPads?.material,
      base.plantFoundations?.material,
      civil.concrete,
      mine.concrete,
      infra.concrete,
    ],
    structuralSteel: [
      transport.steel,
      infra.steel,
      infra.dark,
      instrumentation.structuralSteel,
      safety.structuralSteel,
    ],
    processSteel: [
      infra.process,
      instrumentation.processSteel,
      safety.processSteel,
    ],
    safetyYellow: [
      transport.safety,
      infra.safety,
      mine.safety,
      instrumentation.levelMarker,
      instrumentation.tagPlate,
      safety.signYellow,
      safety.yellow,
      safety.pedestrian,
    ],
    mineral: [
      transport.ore,
      mine.ore,
      mine.darkOre,
      mine.stagingOre,
    ],
    vehicleYellow: [],
  };

  Object.entries(targets).forEach(([role, materials]) => {
    compact(materials).forEach((material) => recolor(material, palette[role], applied, role));
  });

  const pipe1 = base.pipingSystem?.connections?.get?.('P-LEACH-R01-R02');
  if (pipe1?.material) {
    const normalized = String(pipe1MaterialName).trim().toLowerCase();
    const role = normalized.includes('hdpe') || normalized.includes('pead') ? 'pipeHdpe' : 'pipeSteel';
    recolor(pipe1.material, palette[role], applied, role);
  }

  base.scene.metadata = {
    ...(base.scene.metadata ?? {}),
    scenePalette: Object.fromEntries(BABYLON_SCENE_PALETTE_ROLES
      .filter((role) => validHexNumber(palette[role]))
      .map((role) => [role, palette[role]])),
    scenePaletteMaterialCount: applied.size,
  };
  return Object.freeze({
    palette: Object.freeze({ ...(base.scene.metadata.scenePalette ?? {}) }),
    materialCount: applied.size,
  });
}
