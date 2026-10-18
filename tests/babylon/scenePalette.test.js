import { describe, expect, it } from 'vitest';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine.js';
import { Scene } from '@babylonjs/core/scene.js';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial.js';
import { applyBabylonScenePalette } from '../../src/babylon/materials/scenePalette.js';

function material(scene, name) {
  return new StandardMaterial(name, scene);
}

describe('Babylon scene palette adapter', () => {
  it('recolors explicit Babylon material roles without touching process geometry', () => {
    const engine = new NullEngine();
    const scene = new Scene(engine);
    scene.useRightHandedSystem = true;
    const pipeMaterial = material(scene, 'pipe1');
    const base = {
      scene,
      terrainMaterial: material(scene, 'terrain'),
      roadNetwork: { roads: { 'ROAD-01': { material: material(scene, 'road') } } },
      industrialPads: { material: material(scene, 'pad') },
      plantFoundations: { material: material(scene, 'foundation') },
      civilInfrastructure: { materials: {} },
      mineProps: { materials: { ore: material(scene, 'ore') } },
      industrialInfrastructure: { materials: { steel: material(scene, 'steel') } },
      materialTransportSystem: { materials: {} },
      processInstrumentation: { materials: {} },
      industrialSafety: { materials: {} },
      pipingSystem: { connections: new Map([['P-LEACH-R01-R02', { material: pipeMaterial }]]) },
    };
    const result = applyBabylonScenePalette(base, {
      terrain: 0x112233,
      road: 0x223344,
      concrete: 0x334455,
      structuralSteel: 0x445566,
      processSteel: 0x556677,
      pipeSteel: 0x667788,
      pipeHdpe: 0x101112,
      safetyYellow: 0x778899,
      mineral: 0x8899aa,
      vehicleYellow: 0x99aabb,
    }, { pipe1MaterialName: 'HDPE' });

    expect(base.terrainMaterial.diffuseColor.toHexString()).toBe('#112233');
    expect(base.roadNetwork.roads['ROAD-01'].material.diffuseColor.toHexString()).toBe('#223344');
    expect(base.industrialPads.material.diffuseColor.toHexString()).toBe('#334455');
    expect(base.industrialInfrastructure.materials.steel.diffuseColor.toHexString()).toBe('#445566');
    expect(base.mineProps.materials.ore.diffuseColor.toHexString()).toBe('#8899AA');
    expect(pipeMaterial.diffuseColor.toHexString()).toBe('#101112');
    expect(pipeMaterial.metadata.scenePaletteRole).toBe('pipeHdpe');
    expect(result.materialCount).toBeGreaterThanOrEqual(6);
    engine.dispose();
  });
});
