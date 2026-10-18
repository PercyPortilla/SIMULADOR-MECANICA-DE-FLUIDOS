import { describe, expect, it } from 'vitest';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine.js';
import { Quaternion, Vector3 } from '@babylonjs/core/Maths/math.vector.js';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode.js';
import { Scene } from '@babylonjs/core/scene.js';
import {
  BabylonEquipmentRegistry,
  normalizeBabylonPort,
} from '../../src/babylon/equipment/equipmentRegistry.js';

function createScene() {
  const engine = new NullEngine();
  const scene = new Scene(engine);
  scene.useRightHandedSystem = true;
  return { engine, scene };
}

describe('Babylon equipment registry', () => {
  it('normalizes numeric ports and preserves hydraulic diameter', () => {
    const port = normalizeBabylonPort({
      id: 'feedIn',
      position: [1, 2, 3],
      direction: [2, 0, 0],
      nominalDiameterM: 0.22,
    });
    expect(port.localPosition.asArray()).toEqual([1, 2, 3]);
    expect(port.direction.asArray()).toEqual([1, 0, 0]);
    expect(port.nominalDiameterM).toBe(0.22);
  });

  it('computes translated world-space port positions and aliases', () => {
    const { engine, scene } = createScene();
    const root = new TransformNode('host', scene);
    root.position.set(10, 5, -7);
    const registry = new BabylonEquipmentRegistry();
    registry.add({
      id: 'PUMP-TEST',
      root,
      ports: [
        { id: 'suction', position: [-1, 1, 0], direction: [-1, 0, 0], nominalDiameterM: 0.3 },
        { id: 'discharge', position: [1, 1, 0], direction: [1, 0, 0], nominalDiameterM: 0.25 },
      ],
      aliases: { inlet: 'suction', outlet: 'discharge' },
      dimensions: { length: 2.5, width: 1.4, height: 1.8 },
    });

    expect(registry.getPortWorldPosition('PUMP-TEST', 'inlet').asArray()).toEqual([9, 6, -7]);
    expect(registry.getPortWorldPosition('PUMP-TEST', 'outlet').asArray()).toEqual([11, 6, -7]);
    expect(registry.getPort('PUMP-TEST', 'inlet').aliasOf).toBe('suction');
    expect(registry.getPort('PUMP-TEST', 'outlet').nominalDiameterM).toBe(0.25);
    expect(registry.getEquipment('PUMP-TEST').dimensions.length).toBe(2.5);

    scene.dispose();
    engine.dispose();
  });

  it('applies rotation and scale to world positions while keeping direction normalized', () => {
    const { engine, scene } = createScene();
    const root = new TransformNode('rotated', scene);
    root.position.set(4, 2, 9);
    root.scaling.set(2, 1, 0.5);
    root.rotationQuaternion = Quaternion.FromEulerAngles(0, Math.PI / 2, 0);
    const registry = new BabylonEquipmentRegistry();
    registry.add({
      id: 'ROTATED',
      root,
      ports: [{ id: 'out', position: [1, 0, 0], direction: [1, 0, 0], nominalDiameterM: 0.1 }],
    });

    const position = registry.getPortWorldPosition('ROTATED', 'out');
    const direction = registry.getPortWorldDirection('ROTATED', 'out');
    expect(Vector3.Distance(position, new Vector3(4, 2, 7))).toBeLessThan(1e-8);
    expect(Vector3.Distance(direction, new Vector3(0, 0, -1))).toBeLessThan(1e-8);
    expect(direction.length()).toBeCloseTo(1, 10);

    scene.dispose();
    engine.dispose();
  });

  it('rejects duplicate equipment and bad aliases', () => {
    const { engine, scene } = createScene();
    const registry = new BabylonEquipmentRegistry();
    const first = new TransformNode('first', scene);
    registry.add({ id: 'E-01', root: first, ports: [{ id: 'p1', position: [0, 0, 0], direction: [1, 0, 0] }] });
    expect(() => registry.add({ id: 'E-01', root: new TransformNode('second', scene) })).toThrow(/duplicado/);
    expect(() => registry.add({
      id: 'E-02',
      root: new TransformNode('third', scene),
      ports: [{ id: 'p1', position: [0, 0, 0], direction: [1, 0, 0] }],
      aliases: { inlet: 'missing' },
    })).toThrow(/inexistente/);
    scene.dispose();
    engine.dispose();
  });
});
