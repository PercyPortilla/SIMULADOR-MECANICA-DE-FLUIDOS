import * as THREE from 'three';
import { getTerrainHeight } from './terrainHeight.js';
import {
  MINE_AUXILIARY_AREAS,
  MINE_DRAINAGE_PATHS,
  MINE_DUMP_ACCESS_PATHS,
  PIT_DESIGN,
  ROAD_DEFINITIONS,
  SITE_EXTENT,
  TOPOGRAPHIC_ZONES,
} from '../config/siteDesign.js';
import { createIndustrialMaterial } from '../materials/industrialMaterials.js';

function seeded(index, salt = 0) {
  const value = Math.sin((index + 1) * 91.734 + salt * 37.11) * 43758.5453;
  return value - Math.floor(value);
}

function distanceToSegment2D(x, z, a, b) {
  const dx = b[0] - a[0];
  const dz = b[1] - a[1];
  const lengthSq = dx * dx + dz * dz;
  if (lengthSq <= 1e-9) return Math.hypot(x - a[0], z - a[1]);
  const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / lengthSq));
  return Math.hypot(x - (a[0] + dx * t), z - (a[1] + dz * t));
}

function conflictsWithOperationalArea(x, z, radius) {
  const inPlantZone = Object.values(TOPOGRAPHIC_ZONES).some((zone) => {
    const [cx, cz] = zone.center;
    const [width, depth] = zone.size;
    return Math.abs(x - cx) <= width / 2 + radius + 5
      && Math.abs(z - cz) <= depth / 2 + radius + 5;
  });
  if (inPlantZone) return true;
  return Object.values(ROAD_DEFINITIONS).some((road) => {
    const clearance = road.widthM / 2 + road.shoulderM + radius + 1.5;
    for (let index = 0; index < road.points.length - 1; index += 1) {
      if (distanceToSegment2D(x, z, road.points[index], road.points[index + 1]) < clearance) return true;
    }
    return false;
  });
}
function addBox(group, name, size, position, material) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
  mesh.name = name;
  mesh.position.set(...position);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  group.add(mesh);
  return mesh;
}

function createRockField() {
  const geometry = new THREE.DodecahedronGeometry(1, 0);
  const material = createIndustrialMaterial('terrain', { color: 0x8d806f, roughness: 1 });
  const items = [];
  const halfWidth = SITE_EXTENT.width / 2 - 8;
  const halfDepth = SITE_EXTENT.depth / 2 - 8;
  for (let index = 0; index < 260 && items.length < 64; index += 1) {
    const angle = (index / 260) * Math.PI * 2 + seeded(index, 1) * 0.3;
    const radiusX = PIT_DESIGN.radiusX + 18 + seeded(index, 2) * 95;
    const radiusZ = PIT_DESIGN.radiusZ + 12 + seeded(index, 3) * 62;
    const x = PIT_DESIGN.center.x + Math.cos(angle) * radiusX;
    const z = PIT_DESIGN.center.z + Math.sin(angle) * radiusZ;
    const s = 0.45 + seeded(index, 4) * 1.65;
    if (Math.abs(x) > halfWidth || Math.abs(z) > halfDepth) continue;
    if (conflictsWithOperationalArea(x, z, s)) continue;
    items.push({ x, z, s, r: seeded(index, 5) * Math.PI });
  }
  const mesh = new THREE.InstancedMesh(geometry, material, items.length);
  mesh.name = 'pit-perimeter-rock-field';
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  const matrix = new THREE.Matrix4();
  const quaternion = new THREE.Quaternion();
  const scale = new THREE.Vector3();
  items.forEach((item, index) => {
    const y = getTerrainHeight(item.x, item.z) + item.s * 0.62;
    quaternion.setFromEuler(new THREE.Euler(seeded(index, 6) * 0.35, item.r, seeded(index, 7) * 0.3));
    scale.set(item.s * 1.45, item.s * 0.76, item.s);
    matrix.compose(new THREE.Vector3(item.x, y, item.z), quaternion, scale);
    mesh.setMatrixAt(index, matrix);
  });
  mesh.instanceMatrix.needsUpdate = true;
  return mesh;
}


function createPitOreFace() {
  const root = new THREE.Group();
  root.name = 'pit-working-ore-face';
  root.userData.mineSector = 'active-face';
  const ore = createIndustrialMaterial('mineral', { color: 0x8f6b4e, roughness: 0.98, metalness: 0 });
  const darkOre = createIndustrialMaterial('mineral', { color: 0x755a45, roughness: 1, metalness: 0 });
  const centerX = PIT_DESIGN.shovelPoint.x + 17;
  const centerZ = PIT_DESIGN.shovelPoint.z - 13;
  const baseY = getTerrainHeight(centerX, centerZ);

  // Low exposed ore bench immediately in front of the shovel.  It is deliberately
  // irregular so it reads as a working face rather than a decorative stockpile.
  for (let index = 0; index < 34; index += 1) {
    const x = centerX + (seeded(index, 21) - 0.5) * 24;
    const z = centerZ + (seeded(index, 22) - 0.5) * 12;
    const y = getTerrainHeight(x, z);
    const radius = 0.55 + seeded(index, 23) * 1.15;
    const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(radius, 0), index % 4 === 0 ? darkOre : ore);
    rock.name = `pit-run-of-mine-rock-${index + 1}`;
    rock.position.set(x, y + radius * 0.48, z);
    rock.scale.set(1.35 + seeded(index, 24) * 0.5, 0.72 + seeded(index, 25) * 0.35, 1);
    rock.rotation.set(seeded(index, 26) * 0.35, seeded(index, 27) * Math.PI, seeded(index, 28) * 0.28);
    rock.castShadow = true;
    rock.receiveShadow = true;
    root.add(rock);
  }

  const face = new THREE.Mesh(new THREE.BoxGeometry(22, 4.8, 3.0), ore);
  face.name = 'pit-exposed-ore-band';
  face.position.set(centerX + 4, baseY + 2.1, centerZ - 5.0);
  face.rotation.y = -0.20;
  face.rotation.x = -0.08;
  face.castShadow = true;
  face.receiveShadow = true;
  root.add(face);
  return root;
}

function createOperatingPad({ name, center, size, material, rotationY = 0, mineRole }) {
  const y = getTerrainHeight(center.x, center.z);
  const pad = new THREE.Mesh(new THREE.PlaneGeometry(size.x, size.z), material);
  pad.name = name;
  pad.position.set(center.x, y + 0.018, center.z);
  pad.rotation.x = -Math.PI / 2;
  pad.rotation.y = rotationY;
  pad.receiveShadow = true;
  pad.userData.mineRole = mineRole;
  pad.userData.operatingSurface = true;
  return pad;
}

function createPitOperatingAreas() {
  const root = new THREE.Group();
  root.name = 'pit-operating-areas';
  root.userData.mineSector = 'active';

  const compacted = createIndustrialMaterial('road', { color: 0x988976, roughness: 1, metalness: 0 });
  const drillSurface = createIndustrialMaterial('terrain', { color: 0xa09178, roughness: 1, metalness: 0 });
  const trackMaterial = createIndustrialMaterial('terrain', { color: 0x786d5f, roughness: 1, metalness: 0 });
  const collarMaterial = createIndustrialMaterial('darkSteel', { color: 0x4d4b46, roughness: 0.9, metalness: 0.08 });

  const loadingArea = MINE_AUXILIARY_AREAS.loadingPad;
  const loadingCenter = { x: loadingArea.x, z: loadingArea.z };
  const loadingPad = createOperatingPad({
    name: 'pit-loading-platform',
    center: loadingCenter,
    size: { x: loadingArea.widthM, z: loadingArea.depthM },
    material: compacted,
    rotationY: loadingArea.rotationY,
    mineRole: 'loading-and-truck-manoeuvre',
  });
  root.add(loadingPad);

  [-5.0, 5.0].forEach((offset, index) => {
    const track = new THREE.Mesh(new THREE.BoxGeometry(31, 0.025, 0.75), trackMaterial);
    track.name = `pit-loading-wheel-track-${index + 1}`;
    track.position.set(loadingCenter.x, loadingPad.position.y + 0.055, loadingCenter.z + offset);
    track.rotation.y = loadingPad.rotation.y;
    track.receiveShadow = true;
    root.add(track);
  });

  const drillingArea = MINE_AUXILIARY_AREAS.drillingPad;
  const drillCenter = { x: drillingArea.x, z: drillingArea.z };
  const drillPad = createOperatingPad({
    name: 'pit-drilling-platform',
    center: drillCenter,
    size: { x: drillingArea.widthM, z: drillingArea.depthM },
    material: drillSurface,
    rotationY: drillingArea.rotationY,
    mineRole: 'drilling-bench',
  });
  root.add(drillPad);

  const drillY = drillPad.position.y + 0.065;
  let holeIndex = 0;
  [-2.4, 0, 2.4].forEach((dx) => {
    [-9, -3, 3, 9].forEach((dz) => {
      const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.045, 12), collarMaterial);
      collar.name = `pit-drill-hole-collar-${++holeIndex}`;
      collar.position.set(drillCenter.x + dx, drillY, drillCenter.z + dz);
      collar.userData.drillHoleMarker = true;
      root.add(collar);
    });
  });

  const finalWall = new THREE.Group();
  finalWall.name = 'pit-final-wall-rock-scarps';
  finalWall.userData.mineSector = 'final-wall';
  const wallGeometry = new THREE.DodecahedronGeometry(1, 0);
  const wallMaterial = createIndustrialMaterial('terrain', { color: 0x9a958c, roughness: 1, metalness: 0 });
  const wallRock = new THREE.InstancedMesh(wallGeometry, wallMaterial, 18);
  wallRock.name = 'pit-final-wall-rock-instances';
  const matrix = new THREE.Matrix4();
  const quaternion = new THREE.Quaternion();
  const scale = new THREE.Vector3();
  for (let index = 0; index < 18; index += 1) {
    const angle = 0.22 + index / 17 * 1.18;
    const radial = PIT_DESIGN.radiusX - 31 + seeded(index, 41) * 18;
    const x = PIT_DESIGN.center.x + Math.cos(angle) * radial;
    const z = PIT_DESIGN.center.z + Math.sin(angle) * radial * (PIT_DESIGN.radiusZ / PIT_DESIGN.radiusX);
    const s = 0.9 + seeded(index, 42) * 1.6;
    const y = getTerrainHeight(x, z) + s * 0.36;
    quaternion.setFromEuler(new THREE.Euler(seeded(index, 43) * 0.32, angle, seeded(index, 44) * 0.28));
    scale.set(s * 1.65, s * 0.72, s);
    matrix.compose(new THREE.Vector3(x, y, z), quaternion, scale);
    wallRock.setMatrixAt(index, matrix);
  }
  wallRock.instanceMatrix.needsUpdate = true;
  wallRock.castShadow = true;
  wallRock.receiveShadow = true;
  finalWall.add(wallRock);
  root.add(finalWall);

  return root;
}

function createTerracedDumpGeometry({ x, z, radiusX, radiusZ, levels, levelHeightM, salt = 0 }) {
  const segments = 36;
  const rings = [{ scale: 1, y: 0 }];
  for (let level = 0; level < levels; level += 1) {
    const topScale = Math.max(0.24, 1 - level * 0.26 - 0.16);
    const benchScale = Math.max(0.14, topScale - 0.13);
    const y = (level + 1) * levelHeightM;
    rings.push({ scale: topScale, y });
    rings.push({ scale: benchScale, y });
  }

  const vertices = [];
  const indices = [];
  const centerTerrainY = getTerrainHeight(x, z);
  rings.forEach((ring, ringIndex) => {
    for (let index = 0; index < segments; index += 1) {
      const angle = index / segments * Math.PI * 2;
      const irregularity = 1
        + 0.055 * Math.sin(angle * 3 + salt * 0.71)
        + 0.028 * Math.sin(angle * 7 - salt * 0.37)
        + 0.015 * Math.cos(angle * 11 + ringIndex * 0.4);
      const localX = Math.cos(angle) * radiusX * ring.scale * irregularity;
      const localZ = Math.sin(angle) * radiusZ * ring.scale * irregularity;
      const terrainDelta = getTerrainHeight(x + localX, z + localZ) - centerTerrainY;
      vertices.push(localX, ring.y + terrainDelta, localZ);
    }
  });

  for (let ringIndex = 0; ringIndex < rings.length - 1; ringIndex += 1) {
    const current = ringIndex * segments;
    const next = (ringIndex + 1) * segments;
    for (let index = 0; index < segments; index += 1) {
      const n = (index + 1) % segments;
      indices.push(
        current + index, next + index, current + n,
        current + n, next + index, next + n,
      );
    }
  }

  const lastRingStart = (rings.length - 1) * segments;
  const centerIndex = vertices.length / 3;
  vertices.push(0, rings.at(-1).y + 0.05, 0);
  for (let index = 0; index < segments; index += 1) {
    const n = (index + 1) % segments;
    indices.push(lastRingStart + index, centerIndex, lastRingStart + n);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function createWasteDump(name, definition, salt) {
  const material = createIndustrialMaterial('terrain', { color: 0xa28d70, roughness: 1, metalness: 0 });
  const mesh = new THREE.Mesh(createTerracedDumpGeometry({ ...definition, salt }), material);
  mesh.name = name;
  mesh.position.set(definition.x, getTerrainHeight(definition.x, definition.z) - 0.08, definition.z);
  mesh.rotation.y = salt * 0.11;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.userData.mineRole = 'waste-dump';
  mesh.userData.terracedDump = true;
  return mesh;
}

function createOreStagingPiles() {
  const root = new THREE.Group();
  root.name = 'temporary-ore-staging';
  root.userData.mineRole = 'ore-staging';
  const ore = createIndustrialMaterial('mineral', { color: 0x966f4d, roughness: 1, metalness: 0 });
  const geometry = new THREE.DodecahedronGeometry(1, 0);
  const centers = [
    [MINE_AUXILIARY_AREAS.oreStaging.x - 8, MINE_AUXILIARY_AREAS.oreStaging.z - 3],
    [MINE_AUXILIARY_AREAS.oreStaging.x + 9, MINE_AUXILIARY_AREAS.oreStaging.z + 4],
  ];
  let rockId = 0;
  centers.forEach(([cx, cz], pileIndex) => {
    for (let index = 0; index < 26; index += 1) {
      const angle = seeded(index, 60 + pileIndex) * Math.PI * 2;
      const radial = Math.sqrt(seeded(index, 70 + pileIndex)) * 8.5;
      const x = cx + Math.cos(angle) * radial;
      const z = cz + Math.sin(angle) * radial * 0.7;
      const size = 0.65 + seeded(index, 80 + pileIndex) * 1.65;
      const y = getTerrainHeight(x, z) + size * (0.36 + (1 - radial / 8.5) * 0.42);
      const rock = new THREE.Mesh(geometry, ore);
      rock.name = `temporary-ore-rock-${++rockId}`;
      rock.position.set(x, y, z);
      rock.scale.set(size * 1.35, size * 0.78, size);
      rock.rotation.set(seeded(index, 90) * 0.28, angle, seeded(index, 91) * 0.24);
      rock.castShadow = true;
      rock.receiveShadow = true;
      root.add(rock);
    }
  });
  return root;
}

function createGroundRibbon(name, points, width, material, mineRole = 'drainage-channel') {
  const vertices = [];
  const indices = [];
  points.forEach(([x, z], index) => {
    const prev = points[Math.max(0, index - 1)];
    const next = points[Math.min(points.length - 1, index + 1)];
    const dx = next[0] - prev[0];
    const dz = next[1] - prev[1];
    const length = Math.max(1e-6, Math.hypot(dx, dz));
    const sx = -dz / length;
    const sz = dx / length;
    const y = getTerrainHeight(x, z) + 0.012;
    vertices.push(x + sx * width / 2, y, z + sz * width / 2);
    vertices.push(x - sx * width / 2, y, z - sz * width / 2);
    if (index < points.length - 1) {
      const base = index * 2;
      indices.push(base, base + 2, base + 1, base + 1, base + 2, base + 3);
    }
  });
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = name;
  mesh.receiveShadow = true;
  mesh.userData.mineRole = mineRole;
  return mesh;
}

function createPitDrainage() {
  const root = new THREE.Group();
  root.name = 'pit-drainage-system';
  root.userData.mineRole = 'drainage';
  const channelMaterial = createIndustrialMaterial('terrain', { color: 0x74766b, roughness: 1, metalness: 0 });
  const waterMaterial = new THREE.MeshStandardMaterial({
    color: 0x5f7a7c,
    roughness: 0.28,
    metalness: 0,
    transparent: true,
    opacity: 0.72,
  });
  root.add(createGroundRibbon('pit-drain-channel-west', MINE_DRAINAGE_PATHS.west, 0.72, channelMaterial));
  root.add(createGroundRibbon('pit-drain-channel-east', MINE_DRAINAGE_PATHS.east, 0.66, channelMaterial));

  const sump = new THREE.Group();
  sump.name = 'pit-drainage-sump';
  sump.userData.mineRole = 'sump';
  const { x, z, radiusM } = MINE_AUXILIARY_AREAS.pitSump;
  const y = getTerrainHeight(x, z);
  const boundary = [];
  for (let index = 0; index < 18; index += 1) {
    const angle = index / 18 * Math.PI * 2;
    const radius = radiusM * 0.78 * (
      1
      + 0.16 * Math.sin(angle * 3 + 0.45)
      + 0.09 * Math.cos(angle * 5 - 0.8)
      + 0.05 * Math.sin(angle * 8 + 1.1)
    );
    boundary.push(new THREE.Vector2(Math.cos(angle) * radius, Math.sin(angle) * radius));
  }
  const shape = new THREE.Shape(boundary);
  const wetSoil = new THREE.Mesh(
    new THREE.ShapeGeometry(shape),
    createIndustrialMaterial('terrain', { color: 0x756b5c, roughness: 1, metalness: 0 }),
  );
  wetSoil.name = 'pit-sump-wet-soil';
  wetSoil.rotation.x = -Math.PI / 2;
  wetSoil.position.set(x, y + 0.025, z);
  wetSoil.scale.setScalar(1.12);
  wetSoil.receiveShadow = true;
  sump.add(wetSoil);
  const water = new THREE.Mesh(new THREE.ShapeGeometry(shape), waterMaterial);
  water.name = 'pit-sump-water';
  water.rotation.x = -Math.PI / 2;
  water.position.set(x, y + 0.045, z);
  water.scale.setScalar(0.84);
  sump.add(water);
  root.add(sump);
  return root;
}

function createMineAuxiliaryEarthworks() {
  const root = new THREE.Group();
  root.name = 'mine-auxiliary-earthworks';
  const accessMaterial = createIndustrialMaterial('road', { color: 0x8d7e69, roughness: 1, metalness: 0 });
  root.add(createGroundRibbon('north-waste-dump-access', MINE_DUMP_ACCESS_PATHS.north, 5.6, accessMaterial, 'dump-access-road'));
  root.add(createGroundRibbon('south-waste-dump-access', MINE_DUMP_ACCESS_PATHS.south, 5.4, accessMaterial, 'dump-access-road'));
  root.add(createWasteDump('north-waste-dump', MINE_AUXILIARY_AREAS.northWasteDump, 1));
  root.add(createWasteDump('south-waste-dump', MINE_AUXILIARY_AREAS.southWasteDump, 2));
  root.add(createOreStagingPiles());
  root.add(createPitDrainage());
  return root;
}


function createPitWeatheringTraces() {
  const root = new THREE.Group();
  root.name = 'pit-geological-weathering-traces';
  root.userData.mineRole = 'geological-visual-cue';
  const materials = [
    createIndustrialMaterial('terrain', { color: 0x8c8174, roughness: 1, metalness: 0 }),
    createIndustrialMaterial('terrain', { color: 0xaa9276, roughness: 1, metalness: 0 }),
    createIndustrialMaterial('terrain', { color: 0x747879, roughness: 1, metalness: 0 }),
  ];
  const geometry = new THREE.BoxGeometry(4.2, 0.12, 0.72);
  const buckets = materials.map(() => []);
  const azimuths = [0.34, 0.58, 0.84, 1.04, 1.24];
  azimuths.forEach((azimuth, bandIndex) => {
    for (let step = 0; step < 5; step += 1) {
      const radial = PIT_DESIGN.floorRadiusM + 25 + step * 17 + bandIndex * 1.7;
      const x = PIT_DESIGN.center.x + Math.cos(azimuth) * radial;
      const z = PIT_DESIGN.center.z + Math.sin(azimuth) * radial * (PIT_DESIGN.radiusZ / PIT_DESIGN.radiusX);
      const y = getTerrainHeight(x, z) + 0.055;
      const matrix = new THREE.Matrix4();
      const quaternion = new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.02, -azimuth + Math.PI / 2, 0));
      const scale = new THREE.Vector3(0.85 + seeded(step, bandIndex + 120) * 0.65, 1, 1);
      matrix.compose(new THREE.Vector3(x, y, z), quaternion, scale);
      buckets[(bandIndex + step) % materials.length].push(matrix);
    }
  });
  buckets.forEach((matrices, materialIndex) => {
    const mesh = new THREE.InstancedMesh(geometry, materials[materialIndex], matrices.length);
    mesh.name = `pit-weathering-trace-instances-${materialIndex + 1}`;
    matrices.forEach((matrix, index) => mesh.setMatrixAt(index, matrix));
    mesh.instanceMatrix.needsUpdate = true;
    mesh.receiveShadow = true;
    mesh.userData.geologyCue = 'weathering-variation-not-ore-model';
    root.add(mesh);
  });
  return root;
}

function createLampPosts() {
  const root = new THREE.Group();
  root.name = 'mine-lighting-poles';
  const steel = createIndustrialMaterial('darkSteel');
  const lamp = createIndustrialMaterial('safetyYellow', { emissive: 0xffcf70, emissiveIntensity: 0.22 });
  const points = [
    [-112, -26], [-78, -34], [-44, -36], [-8, -38], [46, -34], [92, -30], [138, -28],
    [182, -18], [228, -4], [178, -102], [220, -110], [258, -96], [184, 45], [218, 47],
  ];
  points.forEach(([x, z], index) => {
    const y = getTerrainHeight(x, z);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.10, 0.14, 7.2, 10), steel);
    pole.name = `lighting-pole-${index + 1}`;
    pole.position.set(x, y + 3.6, z);
    pole.castShadow = true;
    root.add(pole);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.2, 0.32), lamp);
    head.name = `lighting-head-${index + 1}`;
    head.position.set(x + 0.26, y + 7.08, z);
    root.add(head);
  });
  return root;
}

function createIndustrialControlBuilding() {
  const root = new THREE.Group();
  root.name = 'plant-utility-area';
  const concrete = createIndustrialMaterial('concrete', { color: 0x90948f });
  const wall = createIndustrialMaterial('processSteel', { color: 0xaeb5b3, metalness: 0.16, roughness: 0.68 });
  const roof = createIndustrialMaterial('structuralSteel', { color: 0x697679 });
  const dark = createIndustrialMaterial('darkSteel', { color: 0x495257 });
  const safety = createIndustrialMaterial('safetyYellow');

  const x = 274; const z = -72; const baseY = getTerrainHeight(x, z);
  addBox(root, 'control-mcc-pad', [18, 0.22, 11], [x, baseY + 0.11, z], concrete);
  addBox(root, 'control-mcc-building', [15, 4.4, 8.5], [x, baseY + 2.42, z], wall);
  addBox(root, 'control-mcc-flat-roof', [15.8, 0.28, 9.3], [x, baseY + 4.74, z], roof);
  addBox(root, 'control-mcc-double-door', [2.2, 2.8, 0.14], [x - 4.1, baseY + 1.52, z - 4.32], dark);
  [-0.5, 2.4, 5.3].forEach((offset, index) => {
    const window = addBox(root, `control-room-window-${index + 1}`, [1.75, 1.15, 0.09], [x + offset, baseY + 2.55, z - 4.36], createIndustrialMaterial('glass'));
    window.userData.industrialWindow = true;
  });
  // Roof HVAC and cable trays make the volume unambiguously industrial, not residential.
  addBox(root, 'control-room-hvac-1', [2.2, 1.0, 1.5], [x - 3.8, baseY + 5.35, z + 0.8], dark);
  addBox(root, 'control-room-hvac-2', [2.2, 1.0, 1.5], [x - 0.8, baseY + 5.35, z + 0.8], dark);
  addBox(root, 'control-room-cable-tray', [9.0, 0.22, 0.55], [x + 1.0, baseY + 4.95, z + 3.7], dark);
  addBox(root, 'control-room-safety-panel', [1.2, 1.8, 0.12], [x + 5.6, baseY + 1.2, z - 4.34], safety);
  return root;
}

function createSparseVegetation() {
  const geometry = new THREE.SphereGeometry(0.45, 8, 6);
  const material = createIndustrialMaterial('terrain', { color: 0x667052, roughness: 1 });
  const count = 34;
  const mesh = new THREE.InstancedMesh(geometry, material, count);
  mesh.name = 'sparse-mine-shrubs';
  const matrix = new THREE.Matrix4();
  for (let index = 0; index < count; index += 1) {
    const x = -30 + seeded(index, 11) * 350;
    const z = 70 + seeded(index, 12) * 95;
    const y = getTerrainHeight(x, z);
    const s = 0.32 + seeded(index, 13) * 0.72;
    matrix.makeScale(s * 1.5, s * 0.55, s);
    matrix.setPosition(x, y + s * 0.18, z);
    mesh.setMatrixAt(index, matrix);
  }
  mesh.instanceMatrix.needsUpdate = true;
  mesh.castShadow = true;
  return mesh;
}

export function createMineProps() {
  const root = new THREE.Group();
  root.name = 'mine-context-props';
  root.add(createRockField());
  root.add(createPitOreFace());
  root.add(createPitOperatingAreas());
  root.add(createPitWeatheringTraces());
  root.add(createMineAuxiliaryEarthworks());
  root.add(createLampPosts());
  root.add(createIndustrialControlBuilding());
  root.add(createSparseVegetation());
  return root;
}
