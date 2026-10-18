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

export const SURFACE_MATERIAL_PROFILES = Object.freeze({
  // Fewer large-scale repeats keep the mine surface from reading as a tiled
  // procedural carpet in Top/General views. The V26 reception GLB itself remains
  // world-planar and non-repeating; this profile only improves the surrounding
  // procedural terrain so the visual transition is not obvious.
  terrain: Object.freeze({ albedoRepeat: [1, 1], roughnessRepeat: [1.21, 1.07], bumpRepeat: [1.37, 1.19], bumpScale: 0.048 }),
  road: Object.freeze({ albedoRepeat: [9, 4], roughnessRepeat: [7, 3], bumpRepeat: [12, 4], bumpScale: 0.050 }),
  concrete: Object.freeze({ albedoRepeat: [4, 3], roughnessRepeat: [3, 3], bumpRepeat: [5, 4], bumpScale: 0.040 }),
});

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
  const valueNoise = (x, y, cell, seed) => {
    const gx = x / cell;
    const gy = y / cell;
    const ix = Math.floor(gx);
    const iy = Math.floor(gy);
    const tx = gx - ix;
    const ty = gy - iy;
    const sx = tx * tx * (3 - 2 * tx);
    const sy = ty * ty * (3 - 2 * ty);
    const n00 = hash01(ix + seed * 19, iy - seed * 13);
    const n10 = hash01(ix + 1 + seed * 19, iy - seed * 13);
    const n01 = hash01(ix + seed * 19, iy + 1 - seed * 13);
    const n11 = hash01(ix + 1 + seed * 19, iy + 1 - seed * 13);
    return THREE.MathUtils.lerp(
      THREE.MathUtils.lerp(n00, n10, sx),
      THREE.MathUtils.lerp(n01, n11, sx),
      sy,
    ) * 2 - 1;
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
        const broad = (role === 'terrain'
          ? valueNoise(x + 41, y - 29, 61, 5) * 0.55
            + valueNoise(x - 23, y + 57, 27, 11) * 0.31
            + valueNoise(x + 83, y + 17, 11, 17) * 0.14
          : macroNoise(x, y)) * (isGround ? 16 : 8);
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
  const repeat = SURFACE_MATERIAL_PROFILES[role]?.bumpRepeat
    ?? (role === 'terrain' ? [10, 7] : role === 'road' ? [13, 5] : role === 'concrete' ? [6, 5] : [5, 5]);
  texture.repeat.set(repeat[0], repeat[1]);
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  textureCache.set(role, texture);
  return texture;
}

function makeSurfaceTexture(role, kind) {
  if (typeof document === 'undefined' || !SURFACE_MATERIAL_PROFILES[role]) return null;
  const key = `${role}:${kind}`;
  if (textureCache.has(key)) return textureCache.get(key);
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const context = canvas.getContext('2d');
  if (!context) return null;
  const image = context.createImageData(canvas.width, canvas.height);
  const data = image.data;
  const hash01 = (x, y) => {
    let value = Math.imul((x + 71) ^ Math.imul(y + 131, 374761393), 668265263);
    value = Math.imul(value ^ (value >>> 13), 1274126177);
    return ((value ^ (value >>> 16)) >>> 0) / 4294967295;
  };
  const valueNoise = (x, y, cell, seed) => {
    const gx = x / cell;
    const gy = y / cell;
    const ix = Math.floor(gx);
    const iy = Math.floor(gy);
    const tx = gx - ix;
    const ty = gy - iy;
    const sx = tx * tx * (3 - 2 * tx);
    const sy = ty * ty * (3 - 2 * ty);
    const n00 = hash01(ix + seed * 17, iy - seed * 11);
    const n10 = hash01(ix + 1 + seed * 17, iy - seed * 11);
    const n01 = hash01(ix + seed * 17, iy + 1 - seed * 11);
    const n11 = hash01(ix + 1 + seed * 17, iy + 1 - seed * 11);
    const nx0 = THREE.MathUtils.lerp(n00, n10, sx);
    const nx1 = THREE.MathUtils.lerp(n01, n11, sx);
    return THREE.MathUtils.lerp(nx0, nx1, sy) * 2 - 1;
  };
  for (let y = 0; y < canvas.height; y += 1) {
    for (let x = 0; x < canvas.width; x += 1) {
      const index = (y * canvas.width + x) * 4;
      const macro = role === 'terrain'
        ? valueNoise(x + 31, y - 23, 58, 3) * 0.52
          + valueNoise(x - 17, y + 47, 23, 7) * 0.32
          + valueNoise(x + 89, y + 11, 9, 13) * 0.16
        : Math.sin(x * 0.024 + y * 0.017 + 0.6) * 0.55
          + Math.cos(x * 0.011 - y * 0.029 + 1.7) * 0.30
          + Math.sin((x + y) * 0.0063 - 0.5) * 0.15;
      const grain = hash01(x, y) - 0.5;
      const stain = hash01(Math.floor(x / 11) + 3, Math.floor(y / 13) + 9) - 0.5;
      let value;
      if (kind === 'roughness') {
        const base = role === 'road' ? 236 : role === 'terrain' ? 242 : 226;
        value = base + macro * 8 + grain * 10 + stain * 8;
      } else {
        const base = 232;
        const roleRange = role === 'terrain' ? 19 : role === 'road' ? 15 : 12;
        value = base + macro * roleRange + grain * 8 + stain * 10;
      }
      value = Math.max(150, Math.min(255, Math.round(value)));
      data[index] = value;
      data[index + 1] = value;
      data[index + 2] = value;
      data[index + 3] = 255;
    }
  }
  context.putImageData(image, 0, 0);
  const texture = new THREE.CanvasTexture(canvas);
  texture.name = `procedural-${role}-${kind}`;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  const repeat = kind === 'roughness'
    ? SURFACE_MATERIAL_PROFILES[role].roughnessRepeat
    : SURFACE_MATERIAL_PROFILES[role].albedoRepeat;
  texture.repeat.set(repeat[0], repeat[1]);
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  if (kind === 'albedo') texture.colorSpace = THREE.SRGBColorSpace;
  textureCache.set(key, texture);
  return texture;
}

function surfaceMaps(role) {
  const profile = SURFACE_MATERIAL_PROFILES[role];
  if (!profile) return {};
  const map = makeSurfaceTexture(role, 'albedo');
  const roughnessMap = makeSurfaceTexture(role, 'roughness');
  return {
    ...(map ? { map } : {}),
    ...(roughnessMap ? { roughnessMap } : {}),
  };
}

function bumpFor(role, scale) {
  const texture = makeBumpTexture(role);
  return texture ? { bumpMap: texture, bumpScale: scale } : {};
}

export function createIndustrialMaterial(role, overrides = {}) {
  const { preserveColor = false, ...materialOverrides } = overrides;
  const presets = {
    terrain: { color: INDUSTRIAL_PALETTE.terrain, roughness: 0.99, metalness: 0, bumpScale: SURFACE_MATERIAL_PROFILES.terrain.bumpScale, ...surfaceMaps('terrain'), ...bumpFor('terrain', SURFACE_MATERIAL_PROFILES.terrain.bumpScale) },
    road: { color: INDUSTRIAL_PALETTE.road, roughness: 1, metalness: 0, bumpScale: SURFACE_MATERIAL_PROFILES.road.bumpScale, ...surfaceMaps('road'), ...bumpFor('road', SURFACE_MATERIAL_PROFILES.road.bumpScale) },
    concrete: { color: INDUSTRIAL_PALETTE.concrete, roughness: 0.93, metalness: 0, bumpScale: SURFACE_MATERIAL_PROFILES.concrete.bumpScale, ...surfaceMaps('concrete'), ...bumpFor('concrete', SURFACE_MATERIAL_PROFILES.concrete.bumpScale) },
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
    ...materialOverrides,
  });
  material.userData.materialRole = role;
  material.userData.paletteColorLocked = preserveColor === true;
  if (SURFACE_MATERIAL_PROFILES[role]) material.userData.surfaceProfile = { ...SURFACE_MATERIAL_PROFILES[role] };
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
      if (material.userData?.paletteColorLocked === true) return;
      const role = material.userData?.materialRole ?? material.userData?.scenePaletteRole;
      if (role && Object.hasOwn(INDUSTRIAL_PALETTE, role) && material.color) {
        material.color.setHex(INDUSTRIAL_PALETTE[role]);
        material.needsUpdate = true;
      }
    });
  });
  return { ...INDUSTRIAL_PALETTE };
}
