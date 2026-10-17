import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { createBaseScene } from '../../src/scene/baseEnvironment.js';
import { applySecondaryShadowPolicy } from '../../src/scene/performance/secondaryShadowPolicy.js';

describe('V24 Bloque 11 - optimización de bajo riesgo', () => {
  it('removes shadow-map work from tiny repeated details but keeps major equipment shadows', () => {
    const root = new THREE.Group();
    const tread = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial());
    tread.name = 'truck-wheel-tread-1';
    tread.castShadow = true;
    const shell = new THREE.Mesh(new THREE.BoxGeometry(4, 2, 2), new THREE.MeshBasicMaterial());
    shell.name = 'pump-major-shell';
    shell.castShadow = true;
    root.add(tread, shell);
    expect(applySecondaryShadowPolicy(root)).toBe(1);
    expect(tread.castShadow).toBe(false);
    expect(tread.userData.v24SecondaryShadowExcluded).toBe(true);
    expect(shell.castShadow).toBe(true);
  });

  it('reduces scene shadow casters while retaining major reception/recovery shadows', () => {
    const base = createBaseScene();
    expect(base.environmentRoot.userData.v24SecondaryShadowExclusions).toBeGreaterThan(500);
    expect(base.resourceStats.shadowCasters).toBeLessThan(3300);
    expect(base.scene.getObjectByName('ROM-HOPPER')).toBeTruthy();
    expect(base.scene.getObjectByName('CIP-ADSORPTION')).toBeTruthy();
    let majorCaster = false;
    base.scene.getObjectByName('ROM-HOPPER').traverse((object) => { if (object.isMesh && object.castShadow) majorCaster = true; });
    expect(majorCaster).toBe(true);
  });
});
