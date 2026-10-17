import * as THREE from 'three';
import { tagObject } from './assetUtils.js';

export function createWedgeBody({ name = 'wedge', length = 4, width = 3, bottomY = 0, topY = 1.8, frontHeight = 1.6, rearHeight = 1.1, material, role = 'shell' } = {}) {
  const x0 = -length / 2;
  const x1 = length / 2;
  const z0 = -width / 2;
  const z1 = width / 2;
  const vertices = new Float32Array([
    x0, bottomY, z0, x1, bottomY, z0, x1, bottomY, z1, x0, bottomY, z1,
    x0, bottomY + rearHeight, z0, x1, bottomY + frontHeight, z0, x1, bottomY + frontHeight, z1, x0, bottomY + rearHeight, z1,
  ]);
  const indices = [0,1,2, 0,2,3, 4,6,5, 4,7,6, 0,4,5, 0,5,1, 1,5,6, 1,6,2, 2,6,7, 2,7,3, 3,7,4, 3,4,0];
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = name;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  tagObject(mesh, { role });
  return mesh;
}

export function createBucketGeometry({ width = 3.2, depth = 1.7, height = 1.4, material, name = 'bucket' } = {}) {
  const group = new THREE.Group();
  group.name = name;
  const floorGeo = new THREE.BoxGeometry(depth, 0.12, width);
  const floor = new THREE.Mesh(floorGeo, material);
  floor.name = `${name}-floor`;
  floor.rotation.z = -0.18;
  floor.castShadow = true;
  tagObject(floor, { role: 'shell' });
  group.add(floor);
  const back = new THREE.Mesh(new THREE.BoxGeometry(0.12, height, width), material.clone());
  back.position.set(-depth * 0.45, height * 0.42, 0);
  back.rotation.z = -0.14;
  back.castShadow = true;
  tagObject(back, { role: 'shell' });
  group.add(back);
  for (const z of [-width / 2, width / 2]) {
    const side = new THREE.Mesh(new THREE.BoxGeometry(depth, height * 0.9, 0.09), material.clone());
    side.position.set(0, height * 0.3, z);
    side.castShadow = true;
    tagObject(side, { role: 'shell' });
    group.add(side);
  }
  for (let i = 0; i < 7; i += 1) {
    const tooth = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.12, 0.14), material.clone());
    tooth.position.set(depth * 0.68, -0.05, -width * 0.43 + (i * width * 0.86) / 6);
    tooth.rotation.z = -0.12;
    tooth.castShadow = true;
    tagObject(tooth, { role: 'structure', lodTier: 1 });
    group.add(tooth);
  }
  return group;
}
