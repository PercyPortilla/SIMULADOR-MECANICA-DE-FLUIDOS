import { Color3 } from '@babylonjs/core/Maths/math.color.js';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial.js';
import { DynamicTexture } from '@babylonjs/core/Materials/Textures/dynamicTexture.js';
import { Texture } from '@babylonjs/core/Materials/Textures/texture.js';
import { GEOTECH_UNITS, getGeotechUnit } from '../../scene/geotech/geotechModel.js';

function colorFromHex(hex) {
  return new Color3(
    ((hex >> 16) & 0xff) / 255,
    ((hex >> 8) & 0xff) / 255,
    (hex & 0xff) / 255,
  );
}

function hash01(x, y, seed = 0) {
  let value = Math.imul((x + 17 + seed) ^ Math.imul(y + 31, 374761393), 668265263);
  value = Math.imul(value ^ (value >>> 13), 1274126177);
  return ((value ^ (value >>> 16)) >>> 0) / 4294967295;
}

function makeGeotechTexture(scene, unitId) {
  if (typeof document === 'undefined') return null;
  const texture = new DynamicTexture(`geotech-${unitId}-texture`, { width: 256, height: 256 }, scene, true);
  const context = texture.getContext();
  const image = context.createImageData(256, 256);
  const data = image.data;
  const seed = [...unitId].reduce((sum, char) => sum + char.charCodeAt(0), 0);
  for (let y = 0; y < 256; y += 1) {
    for (let x = 0; x < 256; x += 1) {
      const index = (y * 256 + x) * 4;
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
  texture.wrapU = Texture.WRAP_ADDRESSMODE;
  texture.wrapV = Texture.WRAP_ADDRESSMODE;
  texture.uScale = unitId === 'competent-rock' ? 4 : 6;
  texture.vScale = unitId === 'cohesive-soil' ? 5 : 6;
  texture.updateSamplingMode(Texture.TRILINEAR_SAMPLINGMODE);
  texture.update(false);
  return texture;
}

function createBaseMaterial(scene, unit, {
  color = unit.color,
  alpha = 1,
  disableDepthWrite = false,
  wireframe = false,
  map = true,
} = {}) {
  const texture = map ? makeGeotechTexture(scene, unit.id) : null;
  const material = new StandardMaterial(`geotech-${unit.id}-material`, scene);
  material.diffuseColor = colorFromHex(color);
  material.diffuseTexture = texture;
  material.specularColor = Color3.Black();
  material.alpha = alpha;
  material.disableDepthWrite = disableDepthWrite;
  material.backFaceCulling = false;
  material.wireframe = wireframe;
  material.metadata = {
    geotechUnitId: unit.id,
    geotechTextureKind: texture ? 'procedural' : 'none',
    sourceContract: 'src/scene/geotech/geotechMaterials.js',
  };
  return material;
}

export function createBabylonGeotechMaterials(scene) {
  if (!scene) throw new TypeError('Babylon geotechnical materials require a Scene.');
  const materials = Object.fromEntries(GEOTECH_UNITS.map((unit) => [
    unit.id,
    createBaseMaterial(scene, unit, unit.id === 'groundwater'
      ? { alpha: 0.30, disableDepthWrite: true, map: false }
      : {}),
  ]));

  materials['surficial-soil'] = createBaseMaterial(scene, getGeotechUnit('granular-soil'), { color: 0xffffff });
  materials['surficial-soil'].name = 'geotech-surficial-soil-material';
  materials['surficial-soil'].metadata.vertexColors = true;

  materials['excavation-envelope'] = createBaseMaterial(scene, getGeotechUnit('concrete-foundation'), {
    color: 0xe0c77d,
    alpha: 0.48,
    disableDepthWrite: true,
    wireframe: true,
    map: false,
  });
  materials['excavation-envelope'].name = 'geotech-excavation-envelope-material';

  materials['road-surface'] = createBaseMaterial(scene, getGeotechUnit('granular-soil'), { color: 0x5c5b55 });
  materials['road-surface'].name = 'geotech-road-surface-material';
  materials['base-course'] = createBaseMaterial(scene, getGeotechUnit('granular-soil'), { color: 0xa57d46 });
  materials['base-course'].name = 'geotech-base-course-material';
  materials['subbase-course'] = createBaseMaterial(scene, getGeotechUnit('granular-soil'), { color: 0xc0a36a });
  materials['subbase-course'].name = 'geotech-subbase-course-material';
  materials['drainage-blanket'] = createBaseMaterial(scene, getGeotechUnit('granular-soil'), { color: 0x716957 });
  materials['drainage-blanket'].name = 'geotech-drainage-blanket-material';
  return materials;
}

export function disposeBabylonGeotechMaterials(materials) {
  const textures = new Set();
  Object.values(materials ?? {}).forEach((material) => {
    if (material?.diffuseTexture) textures.add(material.diffuseTexture);
    material?.dispose?.();
  });
  textures.forEach((texture) => texture.dispose?.());
}

export { colorFromHex as geotechColorFromHex };
