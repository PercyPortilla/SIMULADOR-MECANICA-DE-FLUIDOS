import { CreateBox, NullEngine, Scene, TransformNode } from '@babylonjs/core';
import { describe, expect, it } from 'vitest';
import {
  B75_EQUIPMENT_SPECS,
  applyB75EquipmentSlurryVisual,
} from '../../src/babylon/assets/b75EquipmentSlurryVisual.js';

function addEquipment(scene, top, rootName, position, size, interiorName) {
  const root = new TransformNode(rootName, scene);
  root.parent = top;
  root.position.set(...position);
  const shell = CreateBox(rootName + '_SHELL', { width: size[0], height: size[1], depth: size[2] }, scene);
  shell.parent = root;
  const interior = CreateBox(interiorName, {
    width: size[0] * 0.68,
    height: size[1] * 0.52,
    depth: size[2] * 0.68,
  }, scene);
  interior.parent = root;
  interior.position.y = -size[1] * 0.08;
  return { root, shell, interior };
}

describe('B75 equipment slurry visualization', () => {
  it('covers the core slurry-bearing process equipment', () => {
    const ids = B75_EQUIPMENT_SPECS.map((spec) => spec.id);
    expect(ids).toEqual(expect.arrayContaining([
      'MILL-01',
      'SUMP-01',
      'SLURRY-PUMP-01',
      'CLASS-01',
      'R-01',
      'R-02',
      'R-03',
      'R-04',
      'CIP-ADSORPTION',
    ]));
  });

  it('animates equipment internals with different motion families', () => {
    const engine = new NullEngine();
    const scene = new Scene(engine);
    scene.useRightHandedSystem = true;
    const host = new TransformNode('PULPA-LAB-V57-SITE', scene);
    const top = new TransformNode('V57_FIXTURE_ROOT', scene);

    addEquipment(scene, top, 'MILL-01_ROOT', [151, 25, -88], [16, 8, 8], 'MILL-01_CHARGE');
    addEquipment(scene, top, 'SUMP-01_ROOT', [178, 23, -90], [7, 4, 7], 'SUMP-01_SLURRY');
    addEquipment(scene, top, 'SLURRY-PUMP-01_ROOT', [207, 24, -90], [8, 5, 5], 'SLURRY-PUMP-01_FLUID');
    const klass = addEquipment(scene, top, 'CLASS-01_ROOT', [228, 27, -103], [10, 10, 10], 'CLASS-01_FLUID');
    for (let index = 0; index < 6; index += 1) {
      const angle = Math.PI * 2 * index / 6;
      const cyclone = CreateBox(
        'CLASS-01_CYCLONE_' + String(index).padStart(2, '0') + '_BARREL',
        { width: 0.7, height: 3.4, depth: 0.7 },
        scene,
      );
      cyclone.parent = klass.root;
      cyclone.position.set(Math.cos(angle) * 2.1, 1.2, Math.sin(angle) * 2.1);
    }

    ['R-01','R-02','R-03','R-04'].forEach((id, index) => {
      addEquipment(scene, top, id + '_ROOT', [268 + index * 22, 30, -104], [12, 10, 12], id + '_SLURRY');
    });
    const cip = addEquipment(scene, top, 'CIP-ADSORPTION_ROOT', [392, 29, -104], [28, 10, 12], 'CIP-ADSORPTION_SLURRY_-5.00');
    for (let index = 1; index < 4; index += 1) {
      const tank = CreateBox('CIP-ADSORPTION_SLURRY_' + index, { width: 4, height: 5, depth: 5 }, scene);
      tank.parent = cip.root;
      tank.position.x = -7 + index * 4.7;
    }

    const visual = applyB75EquipmentSlurryVisual({ scene, rootNodes: [top], host });
    expect(visual.equipment.size).toBe(9);
    expect(visual.motions.length).toBeGreaterThan(60);
    expect(host.metadata.b75EquipmentSlurry.equipmentCount).toBe(9);

    visual.setMetrics({
      flowRateM3s: 0.04,
      solidsMassFraction: 0.40,
      solidVolumeFraction: 0.20,
      densityKgM3: 1470,
      feedGoldKgH: 1.1,
    });

    const pumpParticle = visual.motions.find((motion) => motion.equipmentId === 'SLURRY-PUMP-01').mesh;
    const cycloneParticle = visual.motions.find((motion) => motion.mode === 'cyclone').mesh;
    const reactorParticle = visual.motions.find((motion) => motion.equipmentId === 'R-01').mesh;
    const pumpBefore = pumpParticle.position.clone();
    const cycloneBefore = cycloneParticle.position.clone();
    const reactorBefore = reactorParticle.position.clone();

    expect(visual.update(0.1)).toBe(true);
    expect(pumpParticle.position.equalsWithEpsilon(pumpBefore, 1e-7)).toBe(false);
    expect(cycloneParticle.position.equalsWithEpsilon(cycloneBefore, 1e-7)).toBe(false);
    expect(reactorParticle.position.equalsWithEpsilon(reactorBefore, 1e-7)).toBe(false);
    expect(visual.motions.some((motion) => motion.mesh.metadata?.mineral === 'gold')).toBe(true);
    expect(visual.motions.every((motion) => motion.mesh.metadata?.concentrationNotToScale === true)).toBe(true);

    visual.setAnimationsEnabled(false);
    const stopped = pumpParticle.position.clone();
    expect(visual.update(0.1)).toBe(false);
    expect(pumpParticle.position.equalsWithEpsilon(stopped, 1e-7)).toBe(true);

    visual.dispose();
    scene.dispose();
    engine.dispose();
  });
});
