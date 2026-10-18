import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { IntegratedEquipmentRegistry } from '../../src/scene/integration/assetIntegrationLayer.js';
import { createIntegratedMobile } from '../../src/scene/integration/integratedMobile.js';
import { getTerrainHeight } from '../../src/scene/environment/terrainHeight.js';

function createMobile() {
  return createIntegratedMobile({
    plantRoot: new THREE.Group(),
    registry: new IntegratedEquipmentRegistry(),
  });
}

function wheelSpin(handle, name) {
  return handle.root.getObjectByName(name)?.rotation.z ?? 0;
}

describe('V24 Bloque 1 - vida operativa básica', () => {
  it('operates three staggered haul trucks on the existing ROAD-01 lanes', () => {
    const mobile = createMobile();
    expect(mobile.trucks).toHaveLength(3);
    expect(mobile.trucks.map((truck) => truck.root.name)).toEqual(['TRUCK-01', 'TRUCK-02', 'TRUCK-03']);
    expect(mobile.root.userData.animatedTruckCount).toBe(3);

    const initial = mobile.trucks.map((truck) => truck.root.position.clone());
    expect(initial[0].distanceTo(initial[1])).toBeGreaterThan(20);
    expect(initial[1].distanceTo(initial[2])).toBeGreaterThan(20);
    expect(initial[0].distanceTo(initial[2])).toBeGreaterThan(20);

    for (let index = 0; index < 120; index += 1) mobile.update(0.1);
    mobile.trucks.forEach((truck, index) => {
      expect(truck.root.position.distanceTo(initial[index])).toBeGreaterThan(0.2);
      expect(truck.root.userData.routeId).toBe('ROAD-01');
      expect(truck.root.userData.operationalState).toBeTruthy();
      const terrainY = getTerrainHeight(truck.root.position.x, truck.root.position.z);
      expect(truck.root.position.y).toBeGreaterThanOrEqual(terrainY - 0.02);
      expect(truck.root.position.y - terrainY).toBeLessThan(0.35);
    });
  });

  it('lets all three trucks reach the ROM dump phase without losing road grounding', () => {
    const mobile = createMobile();
    const dumped = new Set();
    for (let step = 0; step < 1100; step += 1) {
      mobile.update(0.1);
      mobile.trucks.forEach((truck) => {
        if (truck.root.userData.operationalState === 'dumping-at-rom') dumped.add(truck.root.name);
        const terrainY = getTerrainHeight(truck.root.position.x, truck.root.position.z);
        expect(truck.root.position.y).toBeGreaterThanOrEqual(terrainY - 0.02);
        expect(truck.root.position.y - terrainY).toBeLessThan(0.35);
      });
    }
    expect([...dumped].sort()).toEqual(['TRUCK-01', 'TRUCK-02', 'TRUCK-03']);
  });

  it('ties truck and loader wheel rotation to actual travel and freezes the fleet with Animaciones OFF', () => {
    const mobile = createMobile();
    const truckWheelName = 'truck-wheel-spin-pivot-1';
    const loaderWheelName = 'loader-wheel-1';
    const truckBefore = wheelSpin(mobile.truck, truckWheelName);
    const loaderBefore = wheelSpin(mobile.loader, loaderWheelName);

    // First 6 s: TRUCK-01 and loader are both in operational pauses.
    for (let index = 0; index < 60; index += 1) mobile.update(0.1);
    expect(wheelSpin(mobile.truck, truckWheelName)).toBeCloseTo(truckBefore, 8);
    expect(wheelSpin(mobile.loader, loaderWheelName)).toBeCloseTo(loaderBefore, 8);

    for (let index = 0; index < 50; index += 1) mobile.update(0.1);
    expect(Math.abs(wheelSpin(mobile.truck, truckWheelName) - truckBefore)).toBeGreaterThan(0.05);
    expect(Math.abs(wheelSpin(mobile.loader, loaderWheelName) - loaderBefore)).toBeGreaterThan(0.05);

    mobile.setEnabled(false);
    const frozenPositions = mobile.trucks.map((truck) => truck.root.position.clone());
    const frozenTruckWheel = wheelSpin(mobile.truck, truckWheelName);
    const frozenLoaderWheel = wheelSpin(mobile.loader, loaderWheelName);
    const shovelBoom = mobile.shovel.root.getObjectByName('boom-pivot');
    const frozenBoom = shovelBoom.rotation.z;
    for (let index = 0; index < 30; index += 1) mobile.update(0.1);
    mobile.trucks.forEach((truck, index) => expect(truck.root.position.distanceTo(frozenPositions[index])).toBeLessThan(1e-12));
    expect(wheelSpin(mobile.truck, truckWheelName)).toBeCloseTo(frozenTruckWheel, 10);
    expect(wheelSpin(mobile.loader, loaderWheelName)).toBeCloseTo(frozenLoaderWheel, 10);
    expect(shovelBoom.rotation.z).toBeCloseTo(frozenBoom, 10);
  });

  it('keeps excavator hierarchy moving and resumes after the global animation toggle', () => {
    const mobile = createMobile();
    const boom = mobile.shovel.root.getObjectByName('boom-pivot');
    const stick = mobile.shovel.root.getObjectByName('stick-pivot');
    const bucket = mobile.shovel.root.getObjectByName('bucket-pivot');
    const before = [boom.rotation.z, stick.rotation.z, bucket.rotation.z];
    for (let index = 0; index < 25; index += 1) mobile.update(0.1);
    expect(Math.abs(boom.rotation.z - before[0])).toBeGreaterThan(0.01);
    expect(Math.abs(stick.rotation.z - before[1])).toBeGreaterThan(0.01);
    expect(Math.abs(bucket.rotation.z - before[2])).toBeGreaterThan(0.01);

    mobile.setEnabled(false);
    const frozen = [boom.rotation.z, stick.rotation.z, bucket.rotation.z];
    mobile.update(0.1);
    expect([boom.rotation.z, stick.rotation.z, bucket.rotation.z]).toEqual(frozen);
    mobile.setEnabled(true);
    mobile.update(0.1);
    expect(Math.abs(boom.rotation.z - frozen[0])).toBeGreaterThan(1e-5);
  });
});
