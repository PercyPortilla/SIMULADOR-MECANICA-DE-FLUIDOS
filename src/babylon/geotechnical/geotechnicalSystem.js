import { DynamicTexture } from '@babylonjs/core/Materials/Textures/dynamicTexture.js';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial.js';
import { Color3 } from '@babylonjs/core/Maths/math.color.js';
import { Vector3 } from '@babylonjs/core/Maths/math.vector.js';
import { CreateBox } from '@babylonjs/core/Meshes/Builders/boxBuilder.js';
import { CreatePlane } from '@babylonjs/core/Meshes/Builders/planeBuilder.js';
import { Mesh } from '@babylonjs/core/Meshes/mesh.js';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode.js';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData.js';
import { ROAD_DEFINITIONS, MINE_AUXILIARY_AREAS, PIT_DESIGN } from '../../scene/config/siteDesign.js';
import { FINAL_EQUIPMENT_LAYOUT, SUPPORT_LAYOUT } from '../../scene/integration/finalLayout.js';
import { getTerrainHeight } from '../../scene/environment/terrainHeight.js';
import {
  GEOTECH_TRANSECT,
  getCohesiveInfluence,
  getGeotechUnit,
  getGroundwaterElevation,
  sampleNaturalStratigraphy,
} from '../../scene/geotech/geotechModel.js';
import {
  createBabylonGeotechMaterials,
  disposeBabylonGeotechMaterials,
  geotechColorFromHex,
} from './geotechMaterials.js';

const SECTION_WIDTH_M = 5.2;
const LABEL_BASE_WIDTH_M = 14.4;
const LABEL_BASE_HEIGHT_M = 3.0;

function requireRightHandedScene(scene) {
  if (!scene) throw new TypeError('Babylon geotechnical system requires a Scene.');
  if (scene.useRightHandedSystem !== true) {
    throw new Error('Babylon geotechnical system requires a right-handed Scene (scene.useRightHandedSystem = true).');
  }
}
function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function resamplePolyline(points, spacingM = 11) {
  const source = points.map(([x, z]) => ({ x, z }));
  const lengths = [];
  let total = 0;
  for (let index = 0; index < source.length - 1; index += 1) {
    const length = Math.hypot(
      source[index + 1].x - source[index].x,
      source[index + 1].z - source[index].z,
    );
    lengths.push(length);
    total += length;
  }
  const count = Math.max(2, Math.ceil(total / spacingM) + 1);
  const sampled = [];
  for (let index = 0; index < count; index += 1) {
    const target = (index / (count - 1)) * total;
    let walked = 0;
    for (let segmentIndex = 0; segmentIndex < lengths.length; segmentIndex += 1) {
      const segmentLength = lengths[segmentIndex];
      if (target <= walked + segmentLength || segmentIndex === lengths.length - 1) {
        const t = segmentLength > 0 ? clamp((target - walked) / segmentLength, 0, 1) : 0;
        const start = source[segmentIndex];
        const end = source[segmentIndex + 1];
        sampled.push({
          x: start.x + (end.x - start.x) * t,
          z: start.z + (end.z - start.z) * t,
        });
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
  let dx = next.x - previous.x;
  let dz = next.z - previous.z;
  const length = Math.hypot(dx, dz);
  if (length < 1e-8) {
    dx = 1;
    dz = 0;
  } else {
    dx /= length;
    dz /= length;
  }
  return { x: -dz, z: dx };
}

function applyVertexData(mesh, positions, indices, colors = null) {
  const normals = [];
  VertexData.ComputeNormals(positions, indices, normals);
  const data = new VertexData();
  data.positions = positions;
  data.indices = indices;
  data.normals = normals;
  if (colors?.length) data.colors = colors;
  data.applyToMesh(mesh, false);
}

function createLayerVolume(scene, { points, topY, bottomY, material, name, colorAt }) {
  const positions = [];
  const colors = [];
  const indices = [];
  const halfWidth = SECTION_WIDTH_M / 2;
  points.forEach((point, index) => {
    const perpendicular = getPerpendicular(points, index);
    const offsetX = perpendicular.x * halfWidth;
    const offsetZ = perpendicular.z * halfWidth;
    const top = topY(point.x, point.z);
    const bottom = bottomY(point.x, point.z);
    positions.push(
      point.x + offsetX, top, point.z + offsetZ,
      point.x - offsetX, top, point.z - offsetZ,
      point.x + offsetX, bottom, point.z + offsetZ,
      point.x - offsetX, bottom, point.z - offsetZ,
    );
    if (colorAt) {
      const color = colorAt(point.x, point.z);
      for (let repeat = 0; repeat < 4; repeat += 1) colors.push(color.r, color.g, color.b, 1);
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
  const mesh = new Mesh(name, scene);
  applyVertexData(mesh, positions, indices, colors);
  mesh.material = material;
  mesh.receiveShadows = true;
  mesh.isPickable = false;
  mesh.useVertexColors = colors.length > 0;
  mesh.metadata = {
    geotechLayer: true,
    sectionWidthM: SECTION_WIDTH_M,
    renderer: 'babylon',
  };
  return mesh;
}

function createStratigraphicTransect(scene, materials) {
  const group = new TransformNode('geotech-stratigraphic-transect', scene);
  group.metadata = { geotechRole: 'natural-stratigraphy' };
  const points = resamplePolyline(GEOTECH_TRANSECT, 10.5);
  const profile = (x, z) => sampleNaturalStratigraphy(x, z);

  const topsoil = createLayerVolume(scene, {
    points,
    topY: (x, z) => profile(x, z).surfaceY - 0.06,
    bottomY: (x, z) => profile(x, z).topsoilBottomY,
    material: materials.topsoil,
    name: 'geotech-layer-topsoil',
  });
  topsoil.parent = group;

  const granularColor = geotechColorFromHex(getGeotechUnit('granular-soil').color);
  const cohesiveColor = geotechColorFromHex(getGeotechUnit('cohesive-soil').color);
  const naturalSoils = createLayerVolume(scene, {
    points,
    topY: (x, z) => profile(x, z).topsoilBottomY,
    bottomY: (x, z) => profile(x, z).naturalSoilBottomY,
    material: materials['surficial-soil'],
    name: 'geotech-layer-natural-soils',
    colorAt: (x, z) => Color3.Lerp(granularColor, cohesiveColor, getCohesiveInfluence(x, z)),
  });
  naturalSoils.parent = group;

  const weathered = createLayerVolume(scene, {
    points,
    topY: (x, z) => profile(x, z).naturalSoilBottomY,
    bottomY: (x, z) => profile(x, z).weatheredRockBottomY,
    material: materials['weathered-rock'],
    name: 'geotech-layer-weathered-rock',
  });
  weathered.parent = group;

  const competent = createLayerVolume(scene, {
    points,
    topY: (x, z) => profile(x, z).weatheredRockBottomY,
    bottomY: (x, z) => profile(x, z).competentRockBottomY,
    material: materials['competent-rock'],
    name: 'geotech-layer-competent-rock',
  });
  competent.parent = group;
  return group;
}

function createBoxMesh(scene, name, size, position, material, metadata = {}) {
  const mesh = CreateBox(name, { width: size[0], height: size[1], depth: size[2] }, scene);
  mesh.position.set(...position);
  mesh.material = material;
  mesh.receiveShadows = true;
  mesh.metadata = {
    ...metadata,
    geotechObject: true,
    dimensionsM: [...size],
  };
  return mesh;
}

function createFoundationAssembly(scene, { id, x, z, widthM, lengthM, concreteDepthM, label, materials }) {
  const group = new TransformNode(`${id}-geotech-foundation-assembly`, scene);
  group.metadata = { geotechRole: 'foundation', equipmentId: id, label };
  const profile = sampleNaturalStratigraphy(x, z);
  const topY = profile.surfaceY - 0.04;
  const rockContactY = profile.weatheredRockBottomY + 0.20;
  const concreteDepth = Math.min(concreteDepthM, Math.max(1.8, topY - rockContactY - 0.8));
  const concreteBottomY = topY - concreteDepth;
  const fillDepth = Math.max(0.8, concreteBottomY - rockContactY);
  [
    createBoxMesh(scene, `${id}-geotech-concrete-foundation`, [lengthM, concreteDepth, widthM], [x, topY - concreteDepth / 2, z], materials['concrete-foundation'], { geotechUnitId: 'concrete-foundation', natural: false }),
    createBoxMesh(scene, `${id}-geotech-structural-fill`, [lengthM + 1.4, fillDepth, widthM + 1.4], [x, concreteBottomY - fillDepth / 2, z], materials['structural-fill'], { geotechUnitId: 'structural-fill', natural: false }),
    createBoxMesh(scene, `${id}-competent-rock-seat`, [lengthM + 3.2, 0.75, widthM + 3.2], [x, rockContactY - 0.375, z], materials['competent-rock'], { geotechUnitId: 'competent-rock', natural: true, derivedFromStratigraphy: true }),
  ].forEach((mesh) => { mesh.parent = group; });
  const envelopeHeight = Math.max(1.8, topY - rockContactY + 0.8);
  const envelope = createBoxMesh(scene, `${id}-excavation-envelope`, [lengthM + 2.2, envelopeHeight, widthM + 2.2], [x, topY - envelopeHeight / 2, z], materials['excavation-envelope'], { geotechRole: 'excavation-envelope' });
  envelope.receiveShadows = false;
  envelope.parent = group;
  return group;
}

function createComminutionFoundations(scene, materials) {
  const group = new TransformNode('geotech-conminution-foundations', scene);
  const crusher = FINAL_EQUIPMENT_LAYOUT['PRIMARY-CRUSHER'];
  const mill = FINAL_EQUIPMENT_LAYOUT['MILL-01'];
  createFoundationAssembly(scene, {
    id: 'PRIMARY-CRUSHER', x: crusher.x, z: crusher.z,
    widthM: 10.4, lengthM: 11.2, concreteDepthM: 2.4,
    label: 'Cimentación pesada · chancadora primaria', materials,
  }).parent = group;
  createFoundationAssembly(scene, {
    id: 'MILL-01', x: mill.x, z: mill.z,
    widthM: 10.8, lengthM: 15.5, concreteDepthM: 3.0,
    label: 'Cimentación dinámica · MILL-01', materials,
  }).parent = group;
  return group;
}

function createRoadSection(scene, materials) {
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
  const group = new TransformNode('ROAD-01-geotech-section', scene);
  group.metadata = { geotechRole: 'haul-road-section' };
  const layers = [
    { id: 'wearing-course', thickness: 0.22, width: definition.widthM, material: materials['road-surface'] },
    { id: 'base-course', thickness: 0.34, width: definition.widthM + 0.8, material: materials['base-course'] },
    { id: 'subbase-course', thickness: 0.46, width: definition.widthM + 1.8, material: materials['subbase-course'] },
    { id: 'structural-fill', thickness: 0.72, width: definition.widthM + 3.0, material: materials['structural-fill'] },
  ];
  let depth = 0;
  layers.forEach((layer) => {
    const mesh = createBoxMesh(scene, `ROAD-01-${layer.id}`, [lengthM, layer.thickness, layer.width], [x, topY - depth - layer.thickness / 2, z], layer.material, { geotechRoadLayer: layer.id });
    mesh.rotation.y = rotationY;
    mesh.parent = group;
    depth += layer.thickness;
  });
  return group;
}

function createStockpileFoundation(scene, materials) {
  const x = SUPPORT_LAYOUT.stockpile.x;
  const z = SUPPORT_LAYOUT.stockpile.z;
  const topY = getTerrainHeight(x, z) - 0.05;
  const group = new TransformNode('stockpile-geotech-platform', scene);
  group.metadata = { geotechRole: 'stockpile-platform' };
  [
    createBoxMesh(scene, 'stockpile-granular-platform', [44, 0.50, 34], [x, topY - 0.25, z], materials['base-course'], { geotechRoadLayer: 'granular-platform' }),
    createBoxMesh(scene, 'stockpile-drainage-blanket', [45, 0.22, 35], [x, topY - 0.61, z], materials['drainage-blanket'], { geotechRole: 'conceptual-drainage-blanket' }),
    createBoxMesh(scene, 'stockpile-structural-fill', [47, 0.95, 37], [x, topY - 1.195, z], materials['structural-fill'], { geotechUnitId: 'structural-fill' }),
  ].forEach((mesh) => { mesh.parent = group; });
  return group;
}

function createSoftGroundReplacement(scene, materials, uniqueMaterials) {
  const reactor = FINAL_EQUIPMENT_LAYOUT['R-04'];
  const x = reactor.x;
  const z = reactor.z;
  const topY = getTerrainHeight(x, z) - 0.38;
  const group = new TransformNode('R-04-soft-ground-treatment', scene);
  group.metadata = { geotechRole: 'soft-ground-treatment' };
  const clayMaterial = materials['cohesive-soil'].clone('geotech-cohesive-soil-pocket-material');
  clayMaterial.alpha = 0.58;
  clayMaterial.disableDepthWrite = true;
  clayMaterial.metadata = { ...(clayMaterial.metadata ?? {}), geotechOwnedUnique: true };
  uniqueMaterials.push(clayMaterial);
  [
    createBoxMesh(scene, 'R-04-cohesive-soil-pocket', [34, 3.2, 30], [x, topY - 1.6, z], clayMaterial, { geotechUnitId: 'cohesive-soil', natural: true, conceptual: true }),
    createBoxMesh(scene, 'R-04-purge-structural-replacement', [13.5, 3.25, 13.5], [x, topY - 3.25 / 2 + 0.03, z], materials['structural-fill'], { geotechUnitId: 'structural-fill', treatment: 'purge-and-replace' }),
    createBoxMesh(scene, 'R-04-purge-excavation-envelope', [14.4, 3.55, 14.4], [x, topY - 3.25 / 2, z], materials['excavation-envelope'], { geotechRole: 'purge-excavation' }),
  ].forEach((mesh) => { mesh.parent = group; });
  return group;
}

function addContainmentPad(scene, group, { name, x, z, width, depth }, materials) {
  const terrainY = getTerrainHeight(x, z);
  const barrier = createBoxMesh(scene, `${name}-impermeable-barrier`, [width, 0.06, depth], [x, terrainY - 0.19, z], materials['secondary-containment'], {
    geotechUnitId: 'secondary-containment', containmentType: 'secondary', heapLeach: false,
  });
  barrier.parent = group;
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
    const curb = createBoxMesh(scene, `${name}-containment-curb-${index + 1}`, [sx, sy, sz], [px, py, pz], materials['concrete-foundation'], { containmentType: 'secondary' });
    curb.parent = group;
  });
}

function createSecondaryContainment(scene, materials) {
  const group = new TransformNode('geotech-secondary-containment', scene);
  group.metadata = { geotechRole: 'secondary-containment' };
  addContainmentPad(scene, group, { name: 'reactor-train', x: 194, z: 26, width: 78, depth: 42 }, materials);
  addContainmentPad(scene, group, { name: 'recovery-area', x: 208, z: -90, width: 94, depth: 42 }, materials);
  return group;
}

function createPeripheralUncontrolledFill(scene, materials) {
  const x = 286;
  const z = 112;
  const mesh = createBoxMesh(scene, 'peripheral-uncontrolled-fill-example', [28, 2.6, 22], [x, getTerrainHeight(x, z) - 1.35, z], materials['uncontrolled-fill'], {
    geotechUnitId: 'uncontrolled-fill', foundationApproved: false, conceptual: true,
  });
  mesh.material.alpha = 0.88;
  return mesh;
}

function createGroundwaterSurface(scene, materials) {
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
  const mesh = new Mesh('conceptual-groundwater-surface', scene);
  applyVertexData(mesh, positions, indices);
  mesh.material = materials.groundwater;
  mesh.isPickable = false;
  mesh.renderingGroupId = 2;
  mesh.alphaIndex = 12;
  mesh.metadata = {
    geotechRole: 'groundwater', conceptual: true, calibrated: false,
    description: 'Nivel freático conceptual deprimido hacia el tajo y el pit sump.',
    segmentsX, segmentsZ, widthM: width, depthM: depth,
  };
  return mesh;
}

function createLabelTexture(scene, name, title, subtitle) {
  if (typeof document === 'undefined') return null;
  const texture = new DynamicTexture(`${name}-texture`, { width: 720, height: 150 }, scene, true);
  texture.hasAlpha = true;
  const context = texture.getContext();
  context.clearRect(0, 0, 720, 150);
  context.fillStyle = 'rgba(8, 18, 23, 0.94)';
  context.strokeStyle = 'rgba(229, 202, 137, 0.88)';
  context.lineWidth = 4;
  context.beginPath();
  if (typeof context.roundRect === 'function') context.roundRect(10, 10, 700, 130, 18);
  else context.rect(10, 10, 700, 130);
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
  texture.update(false);
  return texture;
}

function createGeotechLabel(scene, definition, labelResources) {
  const { name, title, subtitle, x, y, z, description } = definition;
  const metadata = { geotechLabel: true, title, subtitle, description, baseWidth: LABEL_BASE_WIDTH_M, baseHeight: LABEL_BASE_HEIGHT_M };
  const texture = createLabelTexture(scene, name, title, subtitle);
  if (!texture) {
    const marker = new TransformNode(name, scene);
    marker.position.set(x, y, z);
    marker.metadata = { ...metadata, labelRenderable: false };
    return marker;
  }
  const plane = CreatePlane(name, { width: LABEL_BASE_WIDTH_M, height: LABEL_BASE_HEIGHT_M }, scene);
  plane.position.set(x, y, z);
  plane.billboardMode = Mesh.BILLBOARDMODE_ALL;
  plane.isPickable = false;
  plane.alwaysSelectAsActiveMesh = true;
  plane.renderingGroupId = 3;
  plane.metadata = { ...metadata, labelRenderable: true };
  const material = new StandardMaterial(`${name}-material`, scene);
  material.diffuseTexture = texture;
  material.emissiveTexture = texture;
  material.emissiveColor = Color3.White();
  material.diffuseColor = Color3.White();
  material.specularColor = Color3.Black();
  material.disableLighting = true;
  material.backFaceCulling = false;
  material.useAlphaFromDiffuseTexture = true;
  material.disableDepthWrite = true;
  plane.material = material;
  labelResources.push({ material, texture });
  return plane;
}

function createGeotechLabels(scene, labelResources) {
  const group = new TransformNode('geotech-labels', scene);
  const definitions = [
    { name: 'geotech-label-topsoil', title: 'TOPSOIL', subtitle: 'Natural · capa superficial', x: -175, z: -3, y: getTerrainHeight(-175, -3) + 4.5, description: getGeotechUnit('topsoil').description },
    { name: 'geotech-label-rock', title: 'MACIZO ROCOSO', subtitle: 'Natural · basamento competente', x: 68, z: -6, y: sampleNaturalStratigraphy(68, -6).weatheredRockBottomY - 0.5, description: getGeotechUnit('competent-rock').description },
    { name: 'geotech-label-mill-foundation', title: 'MILL-01', subtitle: 'Cimentación dinámica', x: 80, z: -6, y: getTerrainHeight(80, -6) + 4.2, description: 'La cimentación transmite la carga al terreno competente; no altera la geología natural.' },
    { name: 'geotech-label-road', title: 'ROAD-01', subtitle: 'Base · subbase · subrasante', x: -160, z: -68, y: getTerrainHeight(-160, -68) + 4.0, description: 'Sección conceptual de pavimento minero y relleno estructural.' },
    { name: 'geotech-label-purge', title: 'PURGA / REEMPLAZO', subtitle: 'R-04 · suelo cohesivo localizado', x: 224, z: 26, y: getTerrainHeight(224, 26) + 4.5, description: 'Caso didáctico de excavación de suelo blando y reemplazo con relleno estructural.' },
    { name: 'geotech-label-containment', title: 'CONTENCIÓN SECUNDARIA', subtitle: 'Reactores · no heap leach', x: 194, z: 48, y: getTerrainHeight(194, 48) + 3.6, description: getGeotechUnit('secondary-containment').description },
    { name: 'geotech-label-groundwater', title: 'NIVEL FREÁTICO', subtitle: 'Conceptual · no calibrado', x: MINE_AUXILIARY_AREAS.pitSump.x, z: MINE_AUXILIARY_AREAS.pitSump.z, y: getGroundwaterElevation(MINE_AUXILIARY_AREAS.pitSump.x, MINE_AUXILIARY_AREAS.pitSump.z) + 2.6, description: getGeotechUnit('groundwater').description },
  ];
  const labels = definitions.map((definition) => createGeotechLabel(scene, definition, labelResources));
  labels.forEach((label) => { label.parent = group; });
  group.metadata = { labelCount: labels.length };
  return { group, labels };
}

function materialList(material) {
  if (!material) return [];
  if (Array.isArray(material.subMaterials)) return material.subMaterials.filter(Boolean);
  return [material];
}

function collectMaterials(object) {
  if (!object) return [];
  const nodes = [object, ...(object.getDescendants?.(false) ?? [])];
  const materials = new Set();
  nodes.forEach((node) => materialList(node.material).forEach((material) => materials.add(material)));
  return [...materials];
}

function rememberMaterialState(material) {
  if (!material || material.metadata?.geotechOriginalState) return;
  material.metadata = {
    ...(material.metadata ?? {}),
    geotechOriginalState: {
      alpha: material.alpha,
      disableDepthWrite: material.disableDepthWrite,
    },
  };
}

function setMaterialXray(material, enabled, alpha = 0.34) {
  if (!material) return;
  rememberMaterialState(material);
  const original = material.metadata.geotechOriginalState;
  if (enabled) {
    material.alpha = Math.min(original.alpha ?? 1, alpha);
    material.disableDepthWrite = true;
  } else {
    material.alpha = original.alpha;
    material.disableDepthWrite = original.disableDepthWrite;
  }
}

function setObjectMaterialsXray(object, enabled, alpha) {
  collectMaterials(object).forEach((material) => setMaterialXray(material, enabled, alpha));
}

function setLabelVisible(label, visible) {
  if (label instanceof Mesh) label.isVisible = Boolean(visible);
  else label.setEnabled(Boolean(visible));
}

export function createBabylonGeotechnicalSystem({ scene, ground = null, industrialPads = null, haulRoads = null } = {}) {
  requireRightHandedScene(scene);
  const materials = createBabylonGeotechMaterials(scene);
  const uniqueMaterials = [];
  const labelResources = [];
  const root = new TransformNode('geotechnical-system', scene);
  root.metadata = {
    geotechVisible: false,
    visualOnly: true,
    physicsCoupled: false,
    validationScope: 'conceptual-geotechnical-visualization',
    coordinateSystem: 'right-handed',
    worldUnitsPerMeter: 1,
    fogRequired: false,
  };

  const stratigraphy = createStratigraphicTransect(scene, materials);
  const foundations = createComminutionFoundations(scene, materials);
  const roadSection = createRoadSection(scene, materials);
  const stockpilePlatform = createStockpileFoundation(scene, materials);
  const softGroundTreatment = createSoftGroundReplacement(scene, materials, uniqueMaterials);
  const containment = createSecondaryContainment(scene, materials);
  const uncontrolledFill = createPeripheralUncontrolledFill(scene, materials);
  const groundwater = createGroundwaterSurface(scene, materials);
  const { group: labels, labels: labelNodes } = createGeotechLabels(scene, labelResources);

  [stratigraphy, foundations, roadSection, stockpilePlatform, softGroundTreatment, containment, uncontrolledFill, groundwater, labels]
    .forEach((node) => { node.parent = root; });

  let labelsVisible = true;
  function updateForCamera(camera) {
    if (!camera) return false;
    const presetId = camera.metadata?.presetId ?? 'general';
    const maxDistance = presetId === 'inspection'
      ? 185
      : ['general', 'top', 'oblique'].includes(presetId) ? 1150 : 360;
    let changed = false;
    labelNodes.forEach((label) => {
      const distance = Vector3.Distance(camera.position, label.position);
      const visible = distance <= maxDistance;
      const previousVisible = label instanceof Mesh ? label.isVisible : label.isEnabled();
      if (previousVisible !== visible) changed = true;
      setLabelVisible(label, visible);
      if (label.metadata?.labelRenderable !== true) return;
      const scaleBoost = clamp(distance / 420, 0.82, 1.28);
      if (Math.abs(label.scaling.x - scaleBoost) > 1e-4) changed = true;
      label.scaling.set(scaleBoost, scaleBoost, 1);
      label.metadata.renderedWidthM = (label.metadata.baseWidth ?? LABEL_BASE_WIDTH_M) * scaleBoost;
      label.metadata.renderedHeightM = (label.metadata.baseHeight ?? LABEL_BASE_HEIGHT_M) * scaleBoost;
    });
    return changed;
  }

  function applyVisibility(visible) {
    const next = Boolean(visible);
    root.metadata.geotechVisible = next;
    root.setEnabled(next);
    labels.setEnabled(next && labelsVisible);
    setObjectMaterialsXray(ground, next, 0.30);
    setObjectMaterialsXray(industrialPads, next, 0.72);
    setObjectMaterialsXray(haulRoads, next, 0.88);
  }

  applyVisibility(false);
  return {
    root,
    materials,
    stratigraphy,
    foundations,
    roadSection,
    stockpilePlatform,
    softGroundTreatment,
    containment,
    uncontrolledFill,
    groundwater,
    labels,
    labelNodes,
    get visible() { return root.metadata.geotechVisible === true; },
    setVisible(visible) { applyVisibility(visible); },
    setLabelsVisible(visible) {
      labelsVisible = Boolean(visible);
      labels.setEnabled(root.isEnabled() && labelsVisible);
    },
    updateForCamera,
    dispose() {
      applyVisibility(false);
      labelResources.forEach(({ material, texture }) => {
        texture?.dispose?.();
        material?.dispose?.();
      });
      uniqueMaterials.forEach((material) => material.dispose?.());
      root.dispose(false, false);
      disposeBabylonGeotechMaterials(materials);
    },
  };
}
