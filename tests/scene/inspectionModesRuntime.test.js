import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { createBaseScene } from '../../src/scene/baseEnvironment.js';

describe('equipment internal inspection runtime modes', () => {
  it('focuses stockpile Inspection on reclaim hardware instead of the full ore-pile envelope', () => {
    const scene = createBaseScene();
    const stockpile = scene.scene.getObjectByName('STOCKPILE-RECLAIM');
    const framing = scene.equipmentInspection.getFraming('STOCKPILE-RECLAIM');
    expect(framing.focused).toBe(true);
    expect(framing.source).toBe('object:STOCKPILE-RECLAIM-motion');
    expect(framing.size.length()).toBeLessThan(framing.fullSize.length() * 0.5);
    expect(stockpile.getObjectByName('STOCKPILE-RECLAIM-motion')).toBeTruthy();
  });

  it('refreshes context boxes when an inspected mobile target moves', () => {
    const scene = createBaseScene();
    const excavator = scene.scene.getObjectByName('EXCAVATOR-01');
    scene.equipmentInspection.setTarget('EXCAVATOR-01');
    const helper = scene.equipmentInspection.contextOverlay.children.find((child) => child.userData.role === 'selected');
    const before = helper.box.getCenter(new THREE.Vector3());
    excavator.position.x += 3;
    scene.equipmentInspection.refreshContextOverlay();
    const after = helper.box.getCenter(new THREE.Vector3());
    expect(after.x - before.x).toBeCloseTo(3, 1);
  });

  it('reveals a pump impeller in cutaway and restores normal visibility', () => {
    const scene = createBaseScene();
    const pump = scene.equipmentSystem.getEquipment('PUMP-01').group3D;
    const impeller = pump.getObjectByName('pump-impeller');
    expect(impeller).toBeTruthy();
    scene.equipmentInspection.setTarget('PUMP-01');
    scene.equipmentInspection.setMode('cutaway');
    expect(impeller.visible).toBe(true);
    const casing = pump.getObjectByName('pump-volute');
    const clipping = Array.isArray(casing.material) ? casing.material[0].clippingPlanes : casing.material.clippingPlanes;
    expect(clipping?.length).toBe(1);
    scene.equipmentInspection.setMode('normal');
    const restored = Array.isArray(casing.material) ? casing.material[0].clippingPlanes : casing.material.clippingPlanes;
    expect(restored ?? []).toHaveLength(0);
  });

  it('keeps Inspection interior shell visibility intact across LOD refreshes', () => {
    const scene = createBaseScene();
    const pump = scene.equipmentSystem.getEquipment('PUMP-01').group3D;
    const casing = pump.getObjectByName('pump-volute');
    expect(casing).toBeTruthy();

    scene.equipmentInspection.setTarget('PUMP-01');
    scene.equipmentInspection.setMode('interior');
    expect(casing.visible).toBe(false);
    expect(pump.userData.inspectionMode).toBe('interior');

    scene.equipmentSystem.updateLOD(scene.cameras.inspection);
    expect(casing.visible).toBe(false);

    scene.equipmentInspection.setMode('normal');
    expect(pump.userData.inspectionMode).toBe('normal');
  });

  it('reveals internal pipe slurry without changing physical diameter metadata', () => {
    const scene = createBaseScene();
    const pipe = scene.scene.getObjectByName('P-PUMP-01-TO-CIP');
    const fluid = pipe.getObjectByName('P-PUMP-01-TO-CIP-slurry-stream-1');
    expect(fluid.visible).toBe(false);
    const physical = pipe.userData.physicalDiameterM;
    scene.equipmentInspection.setTarget('P-PUMP-01-TO-CIP');
    scene.equipmentInspection.setMode('transparent');
    expect(fluid.visible).toBe(true);
    expect(pipe.userData.physicalDiameterM).toBe(physical);
    expect(pipe.userData.visualDiameterM).toBeGreaterThanOrEqual(physical);
  });
});
