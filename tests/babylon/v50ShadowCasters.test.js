import { describe, expect, it } from 'vitest';
import { CreateBox, NullEngine, Scene, TransformNode } from '@babylonjs/core';
import {
  V50_MAJOR_SHADOW_EQUIPMENT_IDS,
  selectV50ShadowCasterMeshes,
} from '../../src/babylon/runtime/baseEnvironment.js';

describe('V50 major-equipment shadow budget', () => {
  it('reserves caster slots for every canonical equipment family before large corridor filler', () => {
    const engine = new NullEngine();
    const scene = new Scene(engine);
    scene.useRightHandedSystem = true;
    const root = new TransformNode('PULPA-LAB-V50-SITE', scene);

    const equipmentMeshes = new Map();
    V50_MAJOR_SHADOW_EQUIPMENT_IDS.forEach((id, index) => {
      const equipmentRoot = new TransformNode(id, scene);
      equipmentRoot.parent = root;
      const meshName = id === 'SLURRY-PUMP-01' ? 'SLURRY-PUMP-01_BODY' : `Cubo.${index}`;
      const mesh = CreateBox(meshName, { size: 1.2 + (index % 3) * 0.2 }, scene);
      mesh.parent = equipmentRoot;
      equipmentMeshes.set(id, mesh);
    });

    for (let index = 0; index < 220; index += 1) {
      const filler = CreateBox(`V19_FRAME_COLUMN_${index}`, { size: 8 + (index % 5) }, scene);
      filler.parent = root;
    }

    const selected = selectV50ShadowCasterMeshes(root, { maxCasters: 180, perEquipment: 1 });
    expect(selected.length).toBeLessThanOrEqual(180);
    V50_MAJOR_SHADOW_EQUIPMENT_IDS.forEach((id) => {
      expect(selected, `${id} must keep a reserved shadow caster`).toContain(equipmentMeshes.get(id));
    });

    engine.dispose();
  });
});
