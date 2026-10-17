import * as THREE from 'three';

export const DEFAULT_INDUSTRIAL_PALETTE = Object.freeze({
  terrain: 0xc8b28f,
  road: 0x857766,
  concrete: 0x969994,
  structuralSteel: 0x768589,
  darkSteel: 0x4b585d,
  processSteel: 0x9ca8a8,
  pipeSteel: 0x638c9c,
  pipeHdpe: 0x30383b,
  safetyYellow: 0xd5a51e,
  conveyorBelt: 0x33393c,
  mineral: 0x84664b,
  vehicleYellow: 0xd49a1e,
  tire: 0x242729,
  glass: 0x35515c,
});

export const INDUSTRIAL_PALETTE = { ...DEFAULT_INDUSTRIAL_PALETTE };

const textureCache = new Map();

function makeBumpTexture(role) {
  if (typeof document === 'undefined') return null;
  if (textureCache.has(role)) return textureCache.get(role);

  const canvas = document.createElement('canvas');
  canvas.width = 384;
  canvas.height = 384;
  const context = canvas.getContext('2d');
  if (!context) return null;
  const image = context.createImageData(canvas.width, canvas.height);
  const data = image.data;
  const hash01 = (x, y) => {
    let value = Math.imul((x + 23) ^ Math.imul(y + 47, 374761393), 668265263);
    value = Math.imul(value ^ (value >>> 13), 1274126177);
    return ((value ^ (value >>> 16)) >>> 0) / 4294967295;
  };
  const brushed = role.includes('Steel') || role === 'safetyYellow' || role === 'vehicleYellow';
  const isGround = role === 'terrain' || role === 'road';
  const isConcrete = role === 'concrete';
  const macroNoise = (x, y) => {
    const a = Math.sin(x * 0.031 + y * 0.017 + 0.7);
    const b = Math.cos(x * 0.013 - y * 0.027 + 1.9);
    const c = Math.sin((x + y) * 0.0065 - 0.4);
    return a * 0.48 + b * 0.34 + c * 0.18;
  };

  for (let y = 0; y < canvas.height; y += 1) {
    for (let x = 0; x < canvas.width; x += 1) {
      const index = (y * canvas.width + x) * 4;
      let value;
      if (brushed) {
        const brush = Math.sin(y * 0.72) * 5 + Math.sin(y * 0.19 + x * 0.012) * 3;
        const grain = (hash01(x, y) - 0.5) * 8;
        value = 128 + brush + grain;
      } else {
        const broad = macroNoise(x, y) * (isGround ? 16 : 8);
        const medium = (
          Math.sin(x * 0.081 + y * 0.049 + 0.5)
          + Math.cos(x * 0.037 - y * 0.069 - 0.8)
        ) * (isGround ? 3.6 : 2.4);
        const grain = (hash01(x, y) - 0.5) * (isConcrete ? 16 : isGround ? 22 : 18);
        const fragmentSeed = hash01(x * 5 + 3, y * 7 + 9);
        const pebble = fragmentSeed > (isGround ? 0.992 : 0.994) ? -13 : 0;
        value = 128 + broad + medium + grain + pebble;
      }
      value = Math.max(0, Math.min(255, Math.round(value)));
      data[index] = value;
      data[index + 1] = value;
      data[index + 2] = value;
      data[index + 3] = 255;
    }
  }
  context.putImageData(image, 0, 0);

  const texture = new THREE.CanvasTexture(canvas);
  texture.name = `procedural-${role}-bump`;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  const repeat = role === 'terrain' ? [10, 7] : role === 'road' ? [13, 5] : role === 'concrete' ? [6, 5] : [5, 5];
  texture.repeat.set(repeat[0], repeat[1]);
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  textureCache.set(role, texture);
  return texture;
}

function bumpFor(role, scale) {
  const texture = makeBumpTexture(role);
  return texture ? { bumpMap: texture, bumpScale: scale } : {};
}

export function createIndustrialMaterial(role, overrides = {}) {
  const presets = {
    terrain: { color: INDUSTRIAL_PALETTE.terrain, roughness: 0.99, metalness: 0, bumpScale: 0.085, ...bumpFor('terrain', 0.085) },
    road: { color: INDUSTRIAL_PALETTE.road, roughness: 1, metalness: 0, ...bumpFor('road', 0.055) },
    concrete: { color: INDUSTRIAL_PALETTE.concrete, roughness: 0.91, metalness: 0, ...bumpFor('concrete', 0.045) },
    structuralSteel: { color: INDUSTRIAL_PALETTE.structuralSteel, roughness: 0.43, metalness: 0.7, ...bumpFor('structuralSteel', 0.018) },
    darkSteel: { color: INDUSTRIAL_PALETTE.darkSteel, roughness: 0.4, metalness: 0.72, ...bumpFor('darkSteel', 0.018) },
    processSteel: { color: INDUSTRIAL_PALETTE.processSteel, roughness: 0.46, metalness: 0.42, ...bumpFor('processSteel', 0.014) },
    safetyYellow: { color: INDUSTRIAL_PALETTE.safetyYellow, roughness: 0.48, metalness: 0.24, ...bumpFor('safetyYellow', 0.012) },
    conveyorBelt: { color: INDUSTRIAL_PALETTE.conveyorBelt, roughness: 0.9, metalness: 0.02, ...bumpFor('conveyorBelt', 0.03) },
    mineral: { color: INDUSTRIAL_PALETTE.mineral, roughness: 1, metalness: 0, ...bumpFor('mineral', 0.12) },
    vehicleYellow: { color: INDUSTRIAL_PALETTE.vehicleYellow, roughness: 0.5, metalness: 0.3, ...bumpFor('vehicleYellow', 0.012) },
    tire: { color: INDUSTRIAL_PALETTE.tire, roughness: 0.96, metalness: 0.02, ...bumpFor('tire', 0.04) },
    glass: {
      color: INDUSTRIAL_PALETTE.glass,
      roughness: 0.2,
      metalness: 0.08,
      transparent: true,
      opacity: 0.82,
    },
  };
  const preset = presets[role];
  if (!preset) throw new RangeError(`Rol de material industrial desconocido: ${role}`);
  const material = new THREE.MeshStandardMaterial({
    ...preset,
    envMapIntensity: role === 'glass' ? 0.65 : 0.9,
    ...overrides,
  });
  material.userData.materialRole = role;
  return material;
}

export function createPipeMaterial(materialName = '') {
  const normalized = String(materialName).trim().toLowerCase();
  const isHdpe = normalized.includes('hdpe') || normalized.includes('pead');
  const isSteel = normalized.includes('acero') || normalized.includes('steel');
  const role = isHdpe ? 'pipeHdpe' : 'pipeSteel';
  const bump = makeBumpTexture(isHdpe ? 'conveyorBelt' : 'structuralSteel');
  const material = new THREE.MeshStandardMaterial({
    color: isHdpe ? INDUSTRIAL_PALETTE.pipeHdpe : INDUSTRIAL_PALETTE.pipeSteel,
    roughness: isHdpe ? 0.74 : 0.38,
    metalness: isSteel ? 0.68 : (isHdpe ? 0.02 : 0.3),
    bumpMap: bump,
    bumpScale: isHdpe ? 0.012 : 0.008,
    envMapIntensity: 0.92,
    name: `${role}-material`,
  });
  material.userData.materialRole = role;
  return material;
}

export function setIndustrialPalette(overrides = {}) {
  for (const [role, color] of Object.entries(overrides)) {
    if (!Object.hasOwn(INDUSTRIAL_PALETTE, role)) continue;
    if (!Number.isInteger(color) || color < 0 || color > 0xffffff) {
      throw new RangeError(`Color inválido para ${role}.`);
    }
    INDUSTRIAL_PALETTE[role] = color;
  }
  return { ...INDUSTRIAL_PALETTE };
}

export function resetIndustrialPalette() {
  Object.assign(INDUSTRIAL_PALETTE, DEFAULT_INDUSTRIAL_PALETTE);
  return { ...INDUSTRIAL_PALETTE };
}

export function applyIndustrialPaletteToScene(root, overrides = {}) {
  setIndustrialPalette(overrides);
  root?.traverse?.((object) => {
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    materials.filter(Boolean).forEach((material) => {
      const role = material.userData?.materialRole ?? material.userData?.scenePaletteRole;
      if (role && Object.hasOwn(INDUSTRIAL_PALETTE, role) && material.color) {
        material.color.setHex(INDUSTRIAL_PALETTE[role]);
        material.needsUpdate = true;
      }
    });
  });
  return { ...INDUSTRIAL_PALETTE };
}
