import * as THREE from 'three';

export const EQUIPMENT_COLORS = Object.freeze({
  paintedYellowSteel: 0xd79b1e,
  paintedOrangeSteel: 0xd86f1c,
  paintedBlueSteel: 0x2f6679,
  paintedGreySteel: 0x839096,
  darkStructuralSteel: 0x46545a,
  bareSteel: 0x8b9699,
  stainlessSteel: 0xb5c0c1,
  rubber: 0x24292b,
  tireRubber: 0x202426,
  hydraulicHose: 0x252a2d,
  glass: 0x426774,
  safetyGlass: 0x507b88,
  concrete: 0x999b96,
  wearLiner: 0x5d6467,
  ore: 0x6b513a,
  crushedOre: 0x765d43,
  slurry: 0x765c39,
  carbonSteelPipe: 0x5e7f8a,
  copper: 0xb46f3b,
  refractory: 0x63554a,
  warningRed: 0xc14f43,
  safetyYellow: 0xd8ad28,
});

const PRESETS = Object.freeze({
  paintedYellowSteel: { roughness: 0.36, metalness: 0.56 },
  paintedOrangeSteel: { roughness: 0.38, metalness: 0.54 },
  paintedBlueSteel: { roughness: 0.4, metalness: 0.52 },
  paintedGreySteel: { roughness: 0.43, metalness: 0.58 },
  darkStructuralSteel: { roughness: 0.42, metalness: 0.76 },
  bareSteel: { roughness: 0.34, metalness: 0.88 },
  stainlessSteel: { roughness: 0.24, metalness: 0.93 },
  rubber: { roughness: 0.91, metalness: 0.01 },
  tireRubber: { roughness: 0.96, metalness: 0.01 },
  hydraulicHose: { roughness: 0.88, metalness: 0.02 },
  glass: { roughness: 0.12, metalness: 0.05, transparent: true, opacity: 0.68, transmission: 0.1 },
  safetyGlass: { roughness: 0.15, metalness: 0.04, transparent: true, opacity: 0.74, transmission: 0.08 },
  concrete: { roughness: 0.96, metalness: 0 },
  wearLiner: { roughness: 0.62, metalness: 0.46 },
  ore: { roughness: 1, metalness: 0 },
  crushedOre: { roughness: 1, metalness: 0 },
  slurry: { roughness: 0.42, metalness: 0, transparent: true, opacity: 0.88 },
  carbonSteelPipe: { roughness: 0.38, metalness: 0.72 },
  copper: { roughness: 0.3, metalness: 0.9 },
  refractory: { roughness: 0.94, metalness: 0 },
  warningRed: { roughness: 0.42, metalness: 0.44 },
  safetyYellow: { roughness: 0.42, metalness: 0.48 },
});

const microBumpCache = new Map();
const SCENE_ROLE_MAP = Object.freeze({
  paintedYellowSteel: 'vehicleYellow',
  paintedOrangeSteel: 'safetyYellow',
  paintedBlueSteel: 'processSteel',
  paintedGreySteel: 'processSteel',
  darkStructuralSteel: 'structuralSteel',
  bareSteel: 'processSteel',
  stainlessSteel: 'processSteel',
  concrete: 'concrete',
  ore: 'mineral',
  crushedOre: 'mineral',
  slurry: 'mineral',
  carbonSteelPipe: 'pipeSteel',
  safetyYellow: 'safetyYellow',
});

function makeMicroBump(role) {
  if (typeof document === 'undefined') return null;
  if (microBumpCache.has(role)) return microBumpCache.get(role);
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.fillStyle = '#808080';
  ctx.fillRect(0, 0, 64, 64);
  const rough = ['ore', 'crushedOre', 'concrete', 'refractory', 'tireRubber'].includes(role);
  const count = rough ? 480 : 160;
  for (let i = 0; i < count; i += 1) {
    const x = (i * 37) % 64;
    const y = (i * 53) % 64;
    const delta = ((i * 19) % (rough ? 42 : 18)) - (rough ? 21 : 9);
    const v = Math.max(72, Math.min(184, 128 + delta));
    ctx.fillStyle = `rgb(${v},${v},${v})`;
    ctx.fillRect(x, y, rough && i % 4 === 0 ? 2 : 1, rough && i % 5 === 0 ? 2 : 1);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(4, 4);
  texture.name = `equipment-${role}-micro-bump`;
  microBumpCache.set(role, texture);
  return texture;
}

export function createEquipmentMaterial(role, overrides = {}) {
  const preset = PRESETS[role];
  if (!preset) throw new RangeError(`Unknown equipment material role: ${role}`);
  const bumpMap = makeMicroBump(role);
  const Material = ['glass', 'safetyGlass'].includes(role) ? THREE.MeshPhysicalMaterial : THREE.MeshStandardMaterial;
  const material = new Material({
    color: EQUIPMENT_COLORS[role],
    envMapIntensity: 1,
    ...preset,
    ...(bumpMap ? { bumpMap, bumpScale: ['ore', 'crushedOre', 'concrete', 'refractory'].includes(role) ? 0.045 : 0.012 } : {}),
    ...overrides,
  });
  material.userData.equipmentMaterialRole = role;
  if (SCENE_ROLE_MAP[role]) material.userData.scenePaletteRole = SCENE_ROLE_MAP[role];
  return material;
}

export function cloneEquipmentMaterial(material, overrides = {}) {
  const copy = material.clone();
  Object.assign(copy, overrides);
  copy.needsUpdate = true;
  return copy;
}
