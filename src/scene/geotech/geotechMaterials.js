import * as THREE from 'three';
import { GEOTECH_UNITS, getGeotechUnit } from './geotechModel.js';

function hash01(x, y, seed = 0) {
  let value = Math.imul((x + 17 + seed) ^ Math.imul(y + 31, 374761393), 668265263);
  value = Math.imul(value ^ (value >>> 13), 1274126177);
  return ((value ^ (value >>> 16)) >>> 0) / 4294967295;
}

function makeGeotechTexture(unitId) {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const context = canvas.getContext('2d');
  if (!context) return null;

  const image = context.createImageData(canvas.width, canvas.height);
  const data = image.data;
  const seed = [...unitId].reduce((sum, char) => sum + char.charCodeAt(0), 0);
  for (let y = 0; y < canvas.height; y += 1) {
    for (let x = 0; x < canvas.width; x += 1) {
      const index = (y * canvas.width + x) * 4;
      const broad = Math.sin((x + seed) * 0.035 + y * 0.019) * 8;
      const grain = (hash01(x, y, seed) - 0.5) * 24;
      let value = 228 + broad + grain;
      if (unitId === 'topsoil') value -= hash01(x * 3, y * 5, seed) > 0.94 ? 38 : 0;
      if (unitId === 'granular-soil' || unitId === 'structural-fill') {
        value -= hash01(x * 7, y * 11, seed) > 0.965 ? 45 : 0;
      }
      if (unitId === 'cohesive-soil') value += Math.sin(y * 0.16 + Math.sin(x * 0.025) * 2.3) * 11;
      if (unitId === 'weathered-rock') value += Math.sin(x * 0.075 - y * 0.052) * 10;
      if (unitId === 'competent-rock') {
        const fracture = Math.abs(Math.sin(x * 0.061 + y * 0.094 + seed));
        if (fracture < 0.055) value -= 48;
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
  texture.name = `geotech-${unitId}-texture`;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(unitId === 'competent-rock' ? 4 : 6, unitId === 'cohesive-soil' ? 5 : 6);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  return texture;
}

function createBaseMaterial(unit, options = {}) {
  const map = options.map === false ? null : makeGeotechTexture(unit.id);
  const material = new THREE.MeshStandardMaterial({
    color: options.color ?? unit.color,
    map,
    roughness: options.roughness ?? 0.96,
    metalness: options.metalness ?? 0,
    transparent: Boolean(options.transparent),
    opacity: options.opacity ?? 1,
    depthWrite: options.depthWrite ?? true,
    side: options.side ?? THREE.DoubleSide,
    vertexColors: Boolean(options.vertexColors),
    polygonOffset: true,
    polygonOffsetFactor: 1,
    polygonOffsetUnits: 1,
  });
  material.name = `geotech-${unit.id}-material`;
  material.userData.geotechUnitId = unit.id;
  material.userData.geotechTextureKind = map ? 'procedural' : 'none';
  return material;
}

export function createGeotechMaterials() {
  const materials = Object.fromEntries(GEOTECH_UNITS.map((unit) => [
    unit.id,
    createBaseMaterial(unit, unit.id === 'groundwater'
      ? { transparent: true, opacity: 0.30, depthWrite: false, roughness: 0.3, map: false }
      : {}),
  ]));
  materials['surficial-soil'] = createBaseMaterial(getGeotechUnit('granular-soil'), {
    color: 0xffffff,
    vertexColors: true,
  });
  materials['excavation-envelope'] = new THREE.MeshBasicMaterial({
    color: 0xe0c77d,
    wireframe: true,
    transparent: true,
    opacity: 0.48,
    depthWrite: false,
  });
  materials['road-surface'] = new THREE.MeshStandardMaterial({
    color: 0x5c5b55,
    roughness: 1,
    metalness: 0,
    side: THREE.DoubleSide,
  });
  materials['base-course'] = createBaseMaterial(getGeotechUnit('granular-soil'), { color: 0xa57d46 });
  materials['subbase-course'] = createBaseMaterial(getGeotechUnit('granular-soil'), { color: 0xc0a36a });
  materials['drainage-blanket'] = createBaseMaterial(getGeotechUnit('granular-soil'), { color: 0x716957 });
  return materials;
}

export function disposeGeotechMaterials(materials) {
  const textures = new Set();
  Object.values(materials ?? {}).forEach((material) => {
    if (material?.map) textures.add(material.map);
    material?.dispose?.();
  });
  textures.forEach((texture) => texture.dispose?.());
}
