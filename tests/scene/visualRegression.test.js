import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { createBaseScene } from '../../src/scene/baseEnvironment.js';

function boxFor(object) {
  object.updateWorldMatrix(true, true);
  return new THREE.Box3().setFromObject(object);
}

function overlapSize(a, b) {
  const A = boxFor(a);
  const B = boxFor(b);
  if (!A.intersectsBox(B)) return new THREE.Vector3(0, 0, 0);
  return new THREE.Vector3(
    Math.max(0, Math.min(A.max.x, B.max.x) - Math.max(A.min.x, B.min.x)),
    Math.max(0, Math.min(A.max.y, B.max.y) - Math.max(A.min.y, B.min.y)),
    Math.max(0, Math.min(A.max.z, B.max.z) - Math.max(A.min.z, B.min.z)),
  );
}

function hasMeaningfulOverlap(a, b, epsilon = 0.05) {
  const size = overlapSize(a, b);
  return size.x > epsilon && size.y > epsilon && size.z > epsilon;
}

describe('Fase 21 - regresión visual geométrica', () => {
  it('keeps recovery equipment envelopes separated', () => {
    const scene = createBaseScene();
    const ids = ['CIP-ADSORPTION', 'ELUTION-SKID', 'EW-CELLS', 'SMELTING-FURNACE'];
    const equipment = ids.map((id) => scene.equipmentSystem.getEquipment(id).group3D);

    for (let i = 0; i < equipment.length; i += 1) {
      for (let j = i + 1; j < equipment.length; j += 1) {
        expect(hasMeaningfulOverlap(equipment[i], equipment[j])).toBe(false);
      }
    }
  });

  it('keeps mobile equipment separated from each other and from physical ROM structures', () => {
    const scene = createBaseScene();
    const vehicles = [scene.mobileEquipment.truck.root, scene.mobileEquipment.loader.root];

    for (let i = 0; i < vehicles.length; i += 1) {
      for (let j = i + 1; j < vehicles.length; j += 1) {
        expect(hasMeaningfulOverlap(vehicles[i], vehicles[j])).toBe(false);
      }
    }

    const physicalMeshes = [];
    ['ROM-HOPPER', 'APRON-FEEDER', 'PRIMARY-CRUSHER'].forEach((id) => {
      scene.equipmentSystem.getEquipment(id).group3D.traverse((object) => {
        if (object.isMesh) physicalMeshes.push(object);
      });
    });

    vehicles.forEach((vehicle) => {
      physicalMeshes.forEach((mesh) => {
        expect(hasMeaningfulOverlap(vehicle, mesh)).toBe(false);
      });
    });
  });

  it('moves the integrated haul truck continuously through both lane turnarounds', () => {
    const scene = createBaseScene();
    const truck = scene.mobileEquipment.truck.root;
    const laneStart = scene.mobileEquipment.truckRoute.getPoint(0);
    expect(truck.position.distanceTo(laneStart)).toBeLessThan(0.01);
    let previous = truck.position.clone();
    let maxStep = 0;
    for (let index = 0; index < 1080; index += 1) {
      scene.mobileEquipment.update(0.1);
      maxStep = Math.max(maxStep, truck.position.distanceTo(previous));
      previous = truck.position.clone();
    }
    expect(maxStep).toBeLessThan(2.2);
  });
});
