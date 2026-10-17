import * as THREE from 'three';
import { getTerrainZone, getZoneElevation } from './terrainHeight.js';

export const INDUSTRIAL_PAD_THICKNESS = 0.18;

const PAD_DEFINITIONS = Object.freeze([
  { zoneId: 'reception', name: 'rom-hopper-local-pad', center: [-110, -30], width: 12.5, depth: 14, curbs: false },
  { zoneId: 'crushing', name: 'crusher-local-pad', center: [-88, -30], width: 8.5, depth: 9.5, curbs: false },
]);

export function getIndustrialPad(zoneId) {
  const definition = PAD_DEFINITIONS.find((pad) => pad.zoneId === zoneId);
  if (!definition) return null;
  const zone = getTerrainZone(zoneId);
  return {
    ...definition,
    center: definition.center ? [...definition.center] : [...zone.center],
    width: definition.width ?? zone.size[0],
    depth: definition.depth ?? zone.size[1],
    elevation: getZoneElevation(zoneId),
  };
}

function addExpansionJoints(group, pad, topY) {
  const material = new THREE.LineBasicMaterial({ color: 0x6f7470, transparent: true, opacity: 0.32 });
  const spacing = 8;
  for (let x = -pad.width / 2 + spacing; x < pad.width / 2; x += spacing) {
    const geometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(pad.center[0] + x, topY, pad.center[1] - pad.depth / 2),
      new THREE.Vector3(pad.center[0] + x, topY, pad.center[1] + pad.depth / 2),
    ]);
    group.add(new THREE.Line(geometry, material));
  }
  for (let z = -pad.depth / 2 + spacing; z < pad.depth / 2; z += spacing) {
    const geometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(pad.center[0] - pad.width / 2, topY, pad.center[1] + z),
      new THREE.Vector3(pad.center[0] + pad.width / 2, topY, pad.center[1] + z),
    ]);
    group.add(new THREE.Line(geometry, material));
  }
}

export function createIndustrialPads(material) {
  const group = new THREE.Group();
  group.name = 'industrial-pads';
  const curbMaterial = new THREE.MeshStandardMaterial({ color: 0x737875, roughness: 0.94, metalness: 0 });

  PAD_DEFINITIONS.forEach(({ zoneId, name }) => {
    const pad = getIndustrialPad(zoneId);
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(pad.width, INDUSTRIAL_PAD_THICKNESS, pad.depth), material);
    mesh.name = name;
    mesh.position.set(pad.center[0], pad.elevation + INDUSTRIAL_PAD_THICKNESS / 2, pad.center[1]);
    mesh.receiveShadow = true;
    mesh.castShadow = true;
    group.add(mesh);
    addExpansionJoints(group, pad, pad.elevation + INDUSTRIAL_PAD_THICKNESS + 0.012);

    if (!pad.curbs) return;
    const curbHeight = 0.22;
    const curbWidth = 0.16;
    const curbY = pad.elevation + INDUSTRIAL_PAD_THICKNESS + curbHeight / 2;
    [
      [pad.width, curbHeight, curbWidth, pad.center[0], curbY, pad.center[1] - pad.depth / 2],
      [pad.width, curbHeight, curbWidth, pad.center[0], curbY, pad.center[1] + pad.depth / 2],
      [curbWidth, curbHeight, pad.depth, pad.center[0] - pad.width / 2, curbY, pad.center[1]],
      [curbWidth, curbHeight, pad.depth, pad.center[0] + pad.width / 2, curbY, pad.center[1]],
    ].forEach(([sx, sy, sz, x, y, z], index) => {
      const curb = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), curbMaterial);
      curb.name = `${name}-curb-${index + 1}`;
      curb.position.set(x, y, z);
      curb.castShadow = true;
      curb.receiveShadow = true;
      group.add(curb);
    });
  });
  return group;
}
