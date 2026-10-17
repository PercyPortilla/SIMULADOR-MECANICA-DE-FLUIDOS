import * as THREE from 'three';
import { ROAD_DEFINITIONS, MINE_AUXILIARY_AREAS, PIT_DESIGN } from '../config/siteDesign.js';
import { FINAL_EQUIPMENT_LAYOUT, SUPPORT_LAYOUT } from '../integration/finalLayout.js';
import { getTerrainHeight } from '../environment/terrainHeight.js';
import {
  GEOTECH_TRANSECT,
  getCohesiveInfluence,
  getGeotechUnit,
  getGroundwaterElevation,
  sampleNaturalStratigraphy,
} from './geotechModel.js';
import { createGeotechMaterials, disposeGeotechMaterials } from './geotechMaterials.js';

const SECTION_WIDTH_M = 5.2;

function disposeObject(object) {
  object?.traverse?.((child) => {
    child.geometry?.dispose?.();
    const materials = Array.isArray(child.material) ? child.material : [child.material];
    materials.filter(Boolean).forEach((material) => {
      if (!material.userData?.geotechOwnedUnique) return;
      material.map?.dispose?.();
      material.dispose?.();
    });
  });
}

function resamplePolyline(points, spacingM = 11) {
  const source = points.map(([x, z]) => new THREE.Vector2(x, z));
  const lengths = [];
  let total = 0;
  for (let index = 0; index < source.length - 1; index += 1) {
    const length = source[index].distanceTo(source[index + 1]);
    lengths.push(length);
    total += length;
  }
  const count = Math.max(2, Math.ceil(total / spacingM) + 1);
  const sampled = [];
  for (let i = 0; i < count; i += 1) {
    const target = (i / (count - 1)) * total;
    let walked = 0;
    for (let segmentIndex = 0; segmentIndex < lengths.length; segmentIndex += 1) {
      const segmentLength = lengths[segmentIndex];
      if (target <= walked + segmentLength || segmentIndex === lengths.length - 1) {
        const t = segmentLength > 0 ? (target - walked) / segmentLength : 0;
        const point = source[segmentIndex].clone().lerp(source[segmentIndex + 1], THREE.MathUtils.clamp(t, 0, 1));
        sampled.push(point);
        break;
      }
      walked += segmentLength;
    }
  }
  return sampled;
}

function getPerpendicular(points, index) {
  const previous = points[Math.max(0, index - 1)];
  const next = points[Math.min(points.length - 1, index + 1)];
  const tangent = next.clone().sub(previous);
  if (tangent.lengthSq() < 1e-8) tangent.set(1, 0);
  tangent.normalize();
  return new THREE.Vector2(-tangent.y, tangent.x);
}

function createLayerVolume({ points, topY, bottomY, material, name, colorAt }) {
  const positions = [];
  const colors = [];
  const indices = [];
  const halfWidth = SECTION_WIDTH_M / 2;

  points.forEach((point, index) => {
    const perpendicular = getPerpendicular(points, index).multiplyScalar(halfWidth);
    const xLeft = point.x + perpendicular.x;
    const zLeft = point.y + perpendicular.y;
    const xRight = point.x - perpendicular.x;
    const zRight = point.y - perpendicular.y;
    const top = topY(point.x, point.y);
    const bottom = bottomY(point.x, point.y);
    positions.push(
      xLeft, top, zLeft,
      xRight, top, zRight,
      xLeft, bottom, zLeft,
      xRight, bottom, zRight,
    );
    if (colorAt) {
      const color = colorAt(point.x, point.y);
      for (let repeat = 0; repeat < 4; repeat += 1) colors.push(color.r, color.g, color.b);
    }
  });

  for (let index = 0; index < points.length - 1; index += 1) {
    const a = index * 4;
    const b = (index + 1) * 4;
    indices.push(
      a, b, b + 1, a, b + 1, a + 1,
      a + 2, a + 3, b + 3, a + 2, b + 3, b + 2,
      a, a + 2, b + 2, a, b + 2, b,
      a + 1, b + 1, b + 3, a + 1, b + 3, a + 3,
    );
  }
  const last = (points.length - 1) * 4;
  indices.push(0, 1, 3, 0, 3, 2, last, last + 2, last + 3, last, last + 3, last + 1);

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  if (colors.length) geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = name;
  mesh.castShadow = false;
  mesh.receiveShadow = true;
  mesh.userData.geotechLayer = true;
  return mesh;
}

function createStratigraphicTransect(materials) {
  const group = new THREE.Group();
  group.name = 'geotech-stratigraphic-transect';
  group.userData.geotechRole = 'natural-stratigraphy';
  const points = resamplePolyline(GEOTECH_TRANSECT, 10.5);
  const profile = (x, z) => sampleNaturalStratigraphy(x, z);

  group.add(createLayerVolume({
    points,
    topY: (x, z) => profile(x, z).surfaceY - 0.06,
    bottomY: (x, z) => profile(x, z).topsoilBottomY,
    material: materials.topsoil,
    name: 'geotech-layer-topsoil',
  }));

  const granularColor = new THREE.Color(getGeotechUnit('granular-soil').color);
  const cohesiveColor = new THREE.Color(getGeotechUnit('cohesive-soil').color);
  group.add(createLayerVolume({
    points,
    topY: (x, z) => profile(x, z).topsoilBottomY,
    bottomY: (x, z) => profile(x, z).naturalSoilBottomY,
    material: materials['surficial-soil'],
    name: 'geotech-layer-natural-soils',
    colorAt: (x, z) => granularColor.clone().lerp(cohesiveColor, getCohesiveInfluence(x, z)),
  }));

  group.add(createLayerVolume({
    points,
    topY: (x, z) => profile(x, z).naturalSoilBottomY,
    bottomY: (x, z) => profile(x, z).weatheredRockBottomY,
    material: materials['weathered-rock'],
    name: 'geotech-layer-weathered-rock',
  }));

  group.add(createLayerVolume({
    points,
    topY: (x, z) => profile(x, z).weatheredRockBottomY,
    bottomY: (x, z) => profile(x, z).competentRockBottomY,
    material: materials['competent-rock'],
    name: 'geotech-layer-competent-rock',
  }));

  return group;
}

function createBoxMesh(name, size, position, material, userData = {}) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
  mesh.name = name;
  mesh.position.set(...position);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.userData = { ...userData, geotechObject: true };
  return mesh;
}

function createFoundationAssembly({ id, x, z, widthM, lengthM, concreteDepthM, label, materials }) {
  const group = new THREE.Group();
  group.name = `${id}-geotech-foundation-assembly`;
  group.userData.geotechRole = 'foundation';
  group.userData.equipmentId = id;
  group.userData.label = label;

  const profile = sampleNaturalStratigraphy(x, z);
  const topY = profile.surfaceY - 0.04;
  const rockContactY = profile.weatheredRockBottomY + 0.20;
  const concreteDepth = Math.min(concreteDepthM, Math.max(1.8, topY - rockContactY - 0.8));
  const concreteBottomY = topY - concreteDepth;
  const fillDepth = Math.max(0.8, concreteBottomY - rockContactY);

  group.add(createBoxMesh(
    `${id}-geotech-concrete-foundation`,
    [lengthM, concreteDepth, widthM],
    [x, topY - concreteDepth / 2, z],
    materials['concrete-foundation'],
    { geotechUnitId: 'concrete-foundation', natural: false },
  ));

  group.add(createBoxMesh(
    `${id}-geotech-structural-fill`,
    [lengthM + 1.4, fillDepth, widthM + 1.4],
    [x, concreteBottomY - fillDepth / 2, z],
    materials['structural-fill'],
    { geotechUnitId: 'structural-fill', natural: false },
  ));

  group.add(createBoxMesh(
    `${id}-competent-rock-seat`,
    [lengthM + 3.2, 0.75, widthM + 3.2],
    [x, rockContactY - 0.375, z],
    materials['competent-rock'],
    { geotechUnitId: 'competent-rock', natural: true, derivedFromStratigraphy: true },
  ));

  const envelopeHeight = Math.max(1.8, topY - rockContactY + 0.8);
  const envelope = createBoxMesh(
    `${id}-excavation-envelope`,
    [lengthM + 2.2, envelopeHeight, widthM + 2.2],
    [x, topY - envelopeHeight / 2, z],
    materials['excavation-envelope'],
    { geotechRole: 'excavation-envelope' },
  );
  envelope.castShadow = false;
  envelope.receiveShadow = false;
  group.add(envelope);
  return group;
}

function createConminutionFoundations(materials) {
  const group = new THREE.Group();
  group.name = 'geotech-conminution-foundations';
  const crusher = FINAL_EQUIPMENT_LAYOUT['PRIMARY-CRUSHER'];
  const mill = FINAL_EQUIPMENT_LAYOUT['MILL-01'];
  group.add(createFoundationAssembly({
    id: 'PRIMARY-CRUSHER',
    x: crusher.x,
    z: crusher.z,
    widthM: 10.4,
    lengthM: 11.2,
    concreteDepthM: 2.4,
    label: 'Cimentación pesada · chancadora primaria',
    materials,
  }));
  group.add(createFoundationAssembly({
    id: 'MILL-01',
    x: mill.x,
    z: mill.z,
    widthM: 10.8,
    lengthM: 15.5,
    concreteDepthM: 3.0,
    label: 'Cimentación dinámica · MILL-01',
    materials,
  }));
  return group;
}

function createRoadSection(materials) {
  const definition = ROAD_DEFINITIONS['ROAD-01'];
  const start = definition.points[definition.points.length - 3];
  const end = definition.points[definition.points.length - 1];
  const x = (start[0] + end[0]) / 2;
  const z = (start[1] + end[1]) / 2;
  const dx = end[0] - start[0];
  const dz = end[1] - start[1];
  const lengthM = Math.min(34, Math.hypot(dx, dz));
  const rotationY = -Math.atan2(dz, dx);
  const topY = getTerrainHeight(x, z) + 0.075;
  const group = new THREE.Group();
  group.name = 'ROAD-01-geotech-section';
  group.userData.geotechRole = 'haul-road-section';

  const layers = [
    { id: 'wearing-course', thickness: 0.22, width: definition.widthM, material: materials['road-surface'] },
    { id: 'base-course', thickness: 0.34, width: definition.widthM + 0.8, material: materials['base-course'] },
    { id: 'subbase-course', thickness: 0.46, width: definition.widthM + 1.8, material: materials['subbase-course'] },
    { id: 'structural-fill', thickness: 0.72, width: definition.widthM + 3.0, material: materials['structural-fill'] },
  ];
  let depth = 0;
  layers.forEach((layer) => {
    const mesh = createBoxMesh(
      `ROAD-01-${layer.id}`,
      [lengthM, layer.thickness, layer.width],
      [x, topY - depth - layer.thickness / 2, z],
      layer.material,
      { geotechRoadLayer: layer.id },
    );
    mesh.rotation.y = rotationY;
    group.add(mesh);
    depth += layer.thickness;
  });
  return group;
}

function createStockpileFoundation(materials) {
  const x = SUPPORT_LAYOUT.stockpile.x;
  const z = SUPPORT_LAYOUT.stockpile.z;
  const topY = getTerrainHeight(x, z) - 0.05;
  const group = new THREE.Group();
  group.name = 'stockpile-geotech-platform';
  group.userData.geotechRole = 'stockpile-platform';
  group.add(createBoxMesh('stockpile-granular-platform', [44, 0.50, 34], [x, topY - 0.25, z], materials['base-course'], { geotechRoadLayer: 'granular-platform' }));
  group.add(createBoxMesh('stockpile-drainage-blanket', [45, 0.22, 35], [x, topY - 0.61, z], materials['drainage-blanket'], { geotechRole: 'conceptual-drainage-blanket' }));
  group.add(createBoxMesh('stockpile-structural-fill', [47, 0.95, 37], [x, topY - 1.195, z], materials['structural-fill'], { geotechUnitId: 'structural-fill' }));
  return group;
}

function createSoftGroundReplacement(materials) {
  const reactor = FINAL_EQUIPMENT_LAYOUT['R-04'];
  const x = reactor.x;
  const z = reactor.z;
  const topY = getTerrainHeight(x, z) - 0.38;
  const group = new THREE.Group();
  group.name = 'R-04-soft-ground-treatment';
  group.userData.geotechRole = 'soft-ground-treatment';

  const clayMaterial = materials['cohesive-soil'].clone();
  clayMaterial.name = 'geotech-cohesive-soil-pocket-material';
  clayMaterial.transparent = true;
  clayMaterial.opacity = 0.58;
  clayMaterial.depthWrite = false;
  clayMaterial.userData = { ...clayMaterial.userData, geotechOwnedUnique: true };
  const clay = createBoxMesh(
    'R-04-cohesive-soil-pocket',
    [34, 3.2, 30],
    [x, topY - 1.6, z],
    clayMaterial,
    { geotechUnitId: 'cohesive-soil', natural: true, conceptual: true },
  );
  group.add(clay);

  const purgeDepth = 3.25;
  const replacement = createBoxMesh(
    'R-04-purge-structural-replacement',
    [13.5, purgeDepth, 13.5],
    [x, topY - purgeDepth / 2 + 0.03, z],
    materials['structural-fill'],
    { geotechUnitId: 'structural-fill', treatment: 'purge-and-replace' },
  );
  group.add(replacement);

  const envelopeMaterial = materials['excavation-envelope'];
  const envelope = createBoxMesh(
    'R-04-purge-excavation-envelope',
    [14.4, purgeDepth + 0.3, 14.4],
    [x, topY - purgeDepth / 2, z],
    envelopeMaterial,
    { geotechRole: 'purge-excavation' },
  );
  envelope.castShadow = false;
  envelope.receiveShadow = false;
  group.add(envelope);
  return group;
}

function addContainmentPad(group, { name, x, z, width, depth }, materials) {
  const terrainY = getTerrainHeight(x, z);
  const barrier = createBoxMesh(
    `${name}-impermeable-barrier`,
    [width, 0.06, depth],
    [x, terrainY - 0.19, z],
    materials['secondary-containment'],
    { geotechUnitId: 'secondary-containment', containmentType: 'secondary', heapLeach: false },
  );
  group.add(barrier);

  const slabMaterial = materials['concrete-foundation'];
  const curbHeight = 0.32;
  const curbWidth = 0.20;
  const curbY = terrainY + curbHeight / 2 + 0.02;
  const positions = [
    [width, curbHeight, curbWidth, x, curbY, z - depth / 2],
    [width, curbHeight, curbWidth, x, curbY, z + depth / 2],
    [curbWidth, curbHeight, depth, x - width / 2, curbY, z],
    [curbWidth, curbHeight, depth, x + width / 2, curbY, z],
  ];
  positions.forEach(([sx, sy, sz, px, py, pz], index) => {
    group.add(createBoxMesh(`${name}-containment-curb-${index + 1}`, [sx, sy, sz], [px, py, pz], slabMaterial, { containmentType: 'secondary' }));
  });
}

function createSecondaryContainment(materials) {
  const group = new THREE.Group();
  group.name = 'geotech-secondary-containment';
  group.userData.geotechRole = 'secondary-containment';
  addContainmentPad(group, { name: 'reactor-train', x: 194, z: 26, width: 78, depth: 42 }, materials);
  addContainmentPad(group, { name: 'recovery-area', x: 208, z: -90, width: 94, depth: 42 }, materials);
  return group;
}

function createPeripheralUncontrolledFill(materials) {
  const x = 286;
  const z = 112;
  const surfaceY = getTerrainHeight(x, z);
  const mesh = createBoxMesh(
    'peripheral-uncontrolled-fill-example',
    [28, 2.6, 22],
    [x, surfaceY - 1.35, z],
    materials['uncontrolled-fill'],
    { geotechUnitId: 'uncontrolled-fill', foundationApproved: false, conceptual: true },
  );
  mesh.material.transparent = true;
  mesh.material.opacity = 0.88;
  return mesh;
}

function createGroundwaterSurface(materials) {
  const segmentsX = 26;
  const segmentsZ = 20;
  const width = PIT_DESIGN.radiusX * 2.25;
  const depth = PIT_DESIGN.radiusZ * 2.25;
  const positions = [];
  const indices = [];
  for (let iz = 0; iz <= segmentsZ; iz += 1) {
    const v = iz / segmentsZ;
    const z = PIT_DESIGN.center.z - depth / 2 + depth * v;
    for (let ix = 0; ix <= segmentsX; ix += 1) {
      const u = ix / segmentsX;
      const x = PIT_DESIGN.center.x - width / 2 + width * u;
      positions.push(x, getGroundwaterElevation(x, z), z);
    }
  }
  for (let iz = 0; iz < segmentsZ; iz += 1) {
    for (let ix = 0; ix < segmentsX; ix += 1) {
      const a = iz * (segmentsX + 1) + ix;
      const b = a + 1;
      const c = a + segmentsX + 1;
      const d = c + 1;
      indices.push(a, c, d, a, d, b);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const mesh = new THREE.Mesh(geometry, materials.groundwater);
  mesh.name = 'conceptual-groundwater-surface';
  mesh.renderOrder = 12;
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  mesh.userData.geotechRole = 'groundwater';
  mesh.userData.conceptual = true;
  mesh.userData.calibrated = false;
  mesh.userData.description = 'Nivel freático conceptual deprimido hacia el tajo y el pit sump.';
  return mesh;
}

function prepareLabelTexture(title, subtitle) {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = 720;
  canvas.height = 150;
  const context = canvas.getContext('2d');
  if (!context) return null;
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = 'rgba(8, 18, 23, 0.94)';
  context.strokeStyle = 'rgba(229, 202, 137, 0.88)';
  context.lineWidth = 4;
  context.beginPath();
  context.roundRect(10, 10, 700, 130, 18);
  context.fill();
  context.stroke();
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillStyle = '#f3c96f';
  context.font = '800 31px sans-serif';
  context.fillText(title, 360, 54);
  context.fillStyle = '#d9e5e8';
  context.font = '600 22px sans-serif';
  context.fillText(subtitle, 360, 101);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  return texture;
}

function createGeotechLabel({ name, title, subtitle, x, y, z, description }) {
  const texture = prepareLabelTexture(title, subtitle);
  if (!texture) {
    const marker = new THREE.Object3D();
    marker.name = name;
    marker.position.set(x, y, z);
    marker.userData = { geotechLabel: true, title, subtitle, description, baseWidth: 14.4, baseHeight: 3.0 };
    return marker;
  }
  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthWrite: false,
    depthTest: false,
    toneMapped: false,
  });
  material.userData.geotechOwnedUnique = true;
  const sprite = new THREE.Sprite(material);
  sprite.name = name;
  sprite.position.set(x, y, z);
  sprite.scale.set(14.4, 3.0, 1);
  sprite.center.set(0.5, 0.1);
  sprite.renderOrder = 240;
  sprite.userData = { geotechLabel: true, title, subtitle, description, baseWidth: 14.4, baseHeight: 3.0 };
  return sprite;
}

function createGeotechLabels() {
  const group = new THREE.Group();
  group.name = 'geotech-labels';
  const labels = [
    {
      name: 'geotech-label-topsoil', title: 'TOPSOIL', subtitle: 'Natural · capa superficial', x: -175, z: -3,
      y: getTerrainHeight(-175, -3) + 4.5, description: getGeotechUnit('topsoil').description,
    },
    {
      name: 'geotech-label-rock', title: 'MACIZO ROCOSO', subtitle: 'Natural · basamento competente', x: 68, z: -6,
      y: sampleNaturalStratigraphy(68, -6).weatheredRockBottomY - 0.5, description: getGeotechUnit('competent-rock').description,
    },
    {
      name: 'geotech-label-mill-foundation', title: 'MILL-01', subtitle: 'Cimentación dinámica', x: 80, z: -6,
      y: getTerrainHeight(80, -6) + 4.2, description: 'La cimentación transmite la carga al terreno competente; no altera la geología natural.' ,
    },
    {
      name: 'geotech-label-road', title: 'ROAD-01', subtitle: 'Base · subbase · subrasante', x: -160, z: -68,
      y: getTerrainHeight(-160, -68) + 4.0, description: 'Sección conceptual de pavimento minero y relleno estructural.' ,
    },
    {
      name: 'geotech-label-purge', title: 'PURGA / REEMPLAZO', subtitle: 'R-04 · suelo cohesivo localizado', x: 224, z: 26,
      y: getTerrainHeight(224, 26) + 4.5, description: 'Caso didáctico de excavación de suelo blando y reemplazo con relleno estructural.' ,
    },
    {
      name: 'geotech-label-containment', title: 'CONTENCIÓN SECUNDARIA', subtitle: 'Reactores · no heap leach', x: 194, z: 48,
      y: getTerrainHeight(194, 48) + 3.6, description: getGeotechUnit('secondary-containment').description,
    },
    {
      name: 'geotech-label-groundwater', title: 'NIVEL FREÁTICO', subtitle: 'Conceptual · no calibrado', x: MINE_AUXILIARY_AREAS.pitSump.x, z: MINE_AUXILIARY_AREAS.pitSump.z,
      y: getGroundwaterElevation(MINE_AUXILIARY_AREAS.pitSump.x, MINE_AUXILIARY_AREAS.pitSump.z) + 2.6, description: getGeotechUnit('groundwater').description,
    },
  ];
  labels.forEach((definition) => group.add(createGeotechLabel(definition)));
  return group;
}

function rememberMaterialState(material) {
  if (!material || material.userData.geotechOriginalState) return;
  material.userData.geotechOriginalState = {
    transparent: material.transparent,
    opacity: material.opacity,
    depthWrite: material.depthWrite,
  };
}

function setMaterialXray(material, enabled, opacity = 0.34) {
  if (!material) return;
  rememberMaterialState(material);
  const original = material.userData.geotechOriginalState;
  if (enabled) {
    material.transparent = true;
    material.opacity = Math.min(original.opacity ?? 1, opacity);
    material.depthWrite = false;
  } else {
    material.transparent = original.transparent;
    material.opacity = original.opacity;
    material.depthWrite = original.depthWrite;
  }
  material.needsUpdate = true;
}

function setObjectMaterialsXray(object, enabled, opacity) {
  object?.traverse?.((child) => {
    if (!child.isMesh) return;
    const list = Array.isArray(child.material) ? child.material : [child.material];
    list.filter(Boolean).forEach((material) => setMaterialXray(material, enabled, opacity));
  });
}

export function createGeotechnicalSystem({ ground, industrialPads, haulRoads } = {}) {
  const materials = createGeotechMaterials();
  const root = new THREE.Group();
  root.name = 'geotechnical-system';
  root.visible = false;
  root.userData.geotechVisible = false;
  root.userData.visualOnly = true;
  root.userData.physicsCoupled = false;
  root.userData.validationScope = 'conceptual-geotechnical-visualization';

  const stratigraphy = createStratigraphicTransect(materials);
  const foundations = createConminutionFoundations(materials);
  const roadSection = createRoadSection(materials);
  const stockpilePlatform = createStockpileFoundation(materials);
  const softGroundTreatment = createSoftGroundReplacement(materials);
  const containment = createSecondaryContainment(materials);
  const uncontrolledFill = createPeripheralUncontrolledFill(materials);
  const groundwater = createGroundwaterSurface(materials);
  const labels = createGeotechLabels();

  root.add(
    stratigraphy,
    foundations,
    roadSection,
    stockpilePlatform,
    softGroundTreatment,
    containment,
    uncontrolledFill,
    groundwater,
    labels,
  );

  let labelsVisible = true;
  function updateForCamera(camera) {
    if (!camera) return;
    const presetId = camera.userData?.presetId ?? 'general';
    const maxDistance = presetId === 'inspection' ? 185 : ['general', 'top', 'oblique'].includes(presetId) ? 1150 : 360;
    labels.children.forEach((label) => {
      const distance = camera.position.distanceTo(label.position);
      label.visible = distance <= maxDistance;
      if (!label.isSprite) return;
      const scaleBoost = THREE.MathUtils.clamp(distance / 420, 0.82, 1.28);
      label.scale.set(
        (label.userData.baseWidth ?? 14.4) * scaleBoost,
        (label.userData.baseHeight ?? 3.0) * scaleBoost,
        1,
      );
    });
  }

  function applyVisibility(visible) {
    const next = Boolean(visible);
    root.visible = next;
    root.userData.geotechVisible = next;
    labels.visible = next && labelsVisible;
    setObjectMaterialsXray(ground, next, 0.30);
    setObjectMaterialsXray(industrialPads, next, 0.72);
    // Roads remain mostly opaque so ROAD-01 is still readable while its layered edge is visible.
    setObjectMaterialsXray(haulRoads, next, 0.88);
  }

  return {
    root,
    materials,
    stratigraphy,
    foundations,
    roadSection,
    stockpilePlatform,
    softGroundTreatment,
    containment,
    groundwater,
    labels,
    get visible() { return root.userData.geotechVisible === true; },
    setVisible(visible) { applyVisibility(visible); },
    setLabelsVisible(visible) {
      labelsVisible = Boolean(visible);
      labels.visible = root.visible && labelsVisible;
    },
    updateForCamera,
    dispose() {
      applyVisibility(false);
      root.removeFromParent();
      disposeObject(root);
      disposeGeotechMaterials(materials);
    },
  };
}
