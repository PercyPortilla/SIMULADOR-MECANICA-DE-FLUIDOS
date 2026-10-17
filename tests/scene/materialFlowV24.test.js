import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { createIntegratedPlant } from '../../src/scene/integration/integratedPlant.js';
import { createIntegratedMobile } from '../../src/scene/integration/integratedMobile.js';
import { IntegratedEquipmentRegistry } from '../../src/scene/integration/assetIntegrationLayer.js';

function instancePosition(mesh, index = 0) {
  const matrix = new THREE.Matrix4();
  mesh.getMatrixAt(index, matrix);
  return new THREE.Vector3().setFromMatrixPosition(matrix);
}

describe('V24 Bloque 2 - flujo visible de mineral', () => {
  it('closes the visible fixed-equipment transfer gaps without changing ports', () => {
    const plant = createIntegratedPlant();
    const names = [
      'CV-01-TO-CRUSHER-MATERIAL',
      'CV-02-TO-STOCKPILE-MATERIAL',
      'CV-03-TO-MILL-MATERIAL',
    ];
    names.forEach((name) => {
      const group = plant.root.getObjectByName(name);
      expect(group).toBeTruthy();
      expect(group.userData.visualOnly).toBe(true);
      expect(group.userData.educationalMaterialFlow).toBe(true);
      expect(group.userData.sourcePoint).toHaveLength(3);
      expect(group.userData.targetPoint).toHaveLength(3);
    });
    expect(plant.materialTransfers).toHaveLength(3);
  });

  it('moves transfer cascades and stockpile feed/reclaim cues, then freezes with Animaciones OFF', () => {
    const plant = createIntegratedPlant();
    const transfer = plant.root.getObjectByName('CV-03-TO-MILL-MATERIAL-ore-instances');
    const landing = plant.stockpile.group3D.getObjectByName('STOCKPILE-RECLAIM-feed-landing-ore-1');
    const reclaim = plant.stockpile.group3D.getObjectByName('STOCKPILE-RECLAIM-reclaim-ore-1');
    const transferBefore = instancePosition(transfer);
    const landingBefore = landing.position.clone();
    const reclaimBefore = reclaim.position.clone();
    plant.updateAssets(0.1);
    expect(instancePosition(transfer).distanceTo(transferBefore)).toBeGreaterThan(0);
    expect(landing.position.distanceTo(landingBefore)).toBeGreaterThan(0);
    expect(reclaim.position.distanceTo(reclaimBefore)).toBeGreaterThan(0);

    plant.setAnimationsEnabled(false);
    const frozenTransfer = instancePosition(transfer);
    const frozenLanding = landing.position.clone();
    plant.updateAssets(0.1);
    expect(instancePosition(transfer).distanceTo(frozenTransfer)).toBeLessThan(1e-12);
    expect(landing.position.distanceTo(frozenLanding)).toBeLessThan(1e-12);
  });

  it('shows truck and loader dump ore only during their operational discharge windows', () => {
    const mobile = createIntegratedMobile({ plantRoot: new THREE.Group(), registry: new IntegratedEquipmentRegistry() });
    const truckStream = mobile.truck.root.getObjectByName('TRUCK-01-v24-dump-ore');
    const loaderStream = mobile.loader.root.getObjectByName('LOADER-01-v24-dump-ore');
    expect(truckStream.visible).toBe(false);
    expect(loaderStream.visible).toBe(false);

    for (let index = 0; index < 520; index += 1) mobile.update(0.1);
    expect(truckStream.visible).toBe(true);
    for (let index = 0; index < 130; index += 1) mobile.update(0.1);
    expect(truckStream.visible).toBe(false);

    const loaderMobile = createIntegratedMobile({ plantRoot: new THREE.Group(), registry: new IntegratedEquipmentRegistry() });
    const loaderOnlyStream = loaderMobile.loader.root.getObjectByName('LOADER-01-v24-dump-ore');
    for (let index = 0; index < 180; index += 1) loaderMobile.update(0.1);
    expect(loaderOnlyStream.visible).toBe(true);
    loaderMobile.setEnabled(false);
    const before = instancePosition(loaderOnlyStream);
    loaderMobile.update(0.1);
    expect(instancePosition(loaderOnlyStream).distanceTo(before)).toBeLessThan(1e-12);
  });
});
