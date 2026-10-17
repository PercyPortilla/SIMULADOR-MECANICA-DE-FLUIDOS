import * as THREE from 'three';
import { getReceptionEarthworkBand, getTerrainHeight, PIT_DESIGN, TERRAIN_EXTENT } from './terrainHeight.js';
import { MINE_AUXILIARY_AREAS } from '../config/siteDesign.js';


function angularDistance(a, b) {
  return Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));
}

export function getPitVisualSector(x, z) {
  const dx = x - PIT_DESIGN.center.x;
  const dzScaled = (z - PIT_DESIGN.center.z) * (PIT_DESIGN.radiusX / PIT_DESIGN.radiusZ);
  const radius = Math.hypot(dx, dzScaled);
  const azimuth = Math.atan2(dzScaled, dx);
  const activeAzimuth = Math.atan2(
    (PIT_DESIGN.shovelPoint.z - PIT_DESIGN.center.z) * (PIT_DESIGN.radiusX / PIT_DESIGN.radiusZ),
    PIT_DESIGN.shovelPoint.x - PIT_DESIGN.center.x,
  );
  const finalWallAzimuth = 0.75;
  if (radius < PIT_DESIGN.floorRadiusM * 1.08) return 'pit-floor';
  if (angularDistance(azimuth, activeAzimuth) < 0.58) return 'active-face';
  if (angularDistance(azimuth, finalWallAzimuth) < 0.72 && radius > PIT_DESIGN.floorRadiusM + 18) return 'final-wall';
  return 'bench';
}

function terrainToneVariation(x, z) {
  const broad = Math.sin(x * 0.041 + z * 0.027) * 0.45;
  const medium = Math.sin(x * 0.113 - z * 0.071 + 1.7) * 0.32;
  const fine = Math.cos((x + z) * 0.233 - 0.8) * 0.23;
  return 0.985 + (broad + medium + fine) * 0.025;
}

export function createMineTerrain(material) {
  const segmentsX = 240;
  const segmentsZ = 156;
  const geometry = new THREE.PlaneGeometry(
    TERRAIN_EXTENT.width,
    TERRAIN_EXTENT.depth,
    segmentsX,
    segmentsZ,
  );
  geometry.rotateX(-Math.PI / 2);

  const positions = geometry.attributes.position;
  const colors = [];
  const naturalColor = new THREE.Color(0xf1e2cb);
  const benchColor = new THREE.Color(0xe2c39c);
  const highGroundColor = new THREE.Color(0xd4c6b2);
  const rockColor = new THREE.Color(0x9d9991);
  const pitFloorColor = new THREE.Color(0xc9ad87);
  const dampGroundColor = new THREE.Color(0x756f65);
  const activeFaceColor = new THREE.Color(0xa98462);
  const finalWallColor = new THREE.Color(0x858786);
  const alteredRockColor = new THREE.Color(0xb29d82);
  const compactedFillColor = new THREE.Color(0xb99a73);
  const earthworkFaceColor = new THREE.Color(0x967454);
  const catchBermColor = new THREE.Color(0xaa8861);
  for (let index = 0; index < positions.count; index += 1) {
    const x = positions.getX(index);
    const z = positions.getZ(index);
    const y = getTerrainHeight(x, z);
    positions.setY(index, y);

    const sample = 0.55;
    const dx = Math.abs(getTerrainHeight(x + sample, z) - getTerrainHeight(x - sample, z));
    const dz = Math.abs(getTerrainHeight(x, z + sample) - getTerrainHeight(x, z - sample));
    const slope = Math.min(1, Math.hypot(dx, dz) / (sample * 2));
    const altitude = THREE.MathUtils.clamp((y - PIT_DESIGN.floorElevation) / 52, 0, 1);
    const dxPit = x - PIT_DESIGN.center.x;
    const dzPit = (z - PIT_DESIGN.center.z) * (PIT_DESIGN.radiusX / PIT_DESIGN.radiusZ);
    const pitRadius = Math.hypot(dxPit, dzPit);
    const pitInfluence = 1 - THREE.MathUtils.smoothstep(pitRadius, PIT_DESIGN.radiusX * 0.78, PIT_DESIGN.radiusX * 1.08);
    const flatness = 1 - THREE.MathUtils.smoothstep(slope, 0.08, 0.36);
    const floorInfluence = pitInfluence * (1 - THREE.MathUtils.smoothstep(y, PIT_DESIGN.floorElevation + 2.0, PIT_DESIGN.floorElevation + 8.0));
    const color = naturalColor.clone().lerp(highGroundColor, altitude * 0.34);
    color.lerp(benchColor, pitInfluence * flatness * 0.50);
    color.lerp(pitFloorColor, floorInfluence * 0.78);
    color.lerp(rockColor, THREE.MathUtils.smoothstep(slope, 0.15, 0.62) * (0.60 + pitInfluence * 0.24));
    if (pitInfluence > 0.12) {
      const sector = getPitVisualSector(x, z);
      if (sector === 'active-face') color.lerp(activeFaceColor, pitInfluence * THREE.MathUtils.smoothstep(slope, 0.08, 0.42) * 0.30);
      if (sector === 'final-wall') color.lerp(finalWallColor, pitInfluence * THREE.MathUtils.smoothstep(slope, 0.10, 0.38) * 0.38);
      if (sector === 'bench') {
        const alteration = (Math.sin(x * 0.052 - z * 0.036) + 1) * 0.5;
        color.lerp(alteredRockColor, pitInfluence * flatness * alteration * 0.10);
      }
    }
    const sump = MINE_AUXILIARY_AREAS.pitSump;
    const sumpDistance = Math.hypot(x - sump.x, z - sump.z);
    const dampInfluence = 1 - THREE.MathUtils.smoothstep(sumpDistance, sump.radiusM * 1.2, sump.radiusM * 4.0);
    color.lerp(dampGroundColor, dampInfluence * 0.42);
    const receptionBand = getReceptionEarthworkBand(x, z);
    if (receptionBand === 'crest') color.lerp(compactedFillColor, 0.38);
    if (receptionBand === 'upper-slope' || receptionBand === 'toe-slope') color.lerp(earthworkFaceColor, 0.48);
    if (receptionBand === 'berm') color.lerp(catchBermColor, 0.55);
    color.multiplyScalar(terrainToneVariation(x, z));
    colors.push(color.r, color.g, color.b);
  }
  positions.needsUpdate = true;
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();

  const terrain = new THREE.Mesh(geometry, material);
  terrain.name = 'base-ground';
  terrain.material.vertexColors = true;
  terrain.receiveShadow = true;
  terrain.castShadow = false;
  return terrain;
}
