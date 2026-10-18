import { describe, expect, it, vi } from 'vitest';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine.js';
import { Mesh } from '@babylonjs/core/Meshes/mesh.js';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode.js';
import { Scene } from '@babylonjs/core/scene.js';
import { createBabylonProcessEquipmentSystem } from '../../src/babylon/equipment/processEquipmentSystem.js';
import { createBabylonPipingSystem } from '../../src/babylon/piping/pipingSystem.js';
import { BABYLON_RECOVERY_ROAD_FOOTING_CLEARANCE_M } from '../../src/babylon/piping/pipeRacks.js';

function container(scene, url) {
  const root = new TransformNode(`root-${url}-${Math.random()}`, scene);
  const mesh = new Mesh(`mesh-${url}`, scene);
  mesh.parent = root;
  return { rootNodes: [root], animationGroups: [], addAllToScene: vi.fn(), dispose: vi.fn() };
}

describe('Babylon process pipe racks', () => {
  it('supports physical pipe routes without moving their centerlines and protects ROAD-02 clearance', async () => {
    const engine = new NullEngine();
    const scene = new Scene(engine);
    scene.useRightHandedSystem = true;
    const equipmentSystem = createBabylonProcessEquipmentSystem({
      scene,
      loadContainer: async (url) => container(scene, url),
    });
    await equipmentSystem.ready;
    const piping = createBabylonPipingSystem({ scene, equipmentSystem });
    expect(piping.pipeRacks.totalFrames).toBeGreaterThan(0);
    expect(piping.supportRoot.metadata.terrainHeightSource).toBe('getTerrainHeight');
    const frames = piping.supportRoot.getChildren().filter((node) => node.metadata?.pipeRackFrame);
    expect(frames.length).toBe(piping.pipeRacks.totalFrames);
    frames.flatMap((frame) => frame.getDescendants()).filter((node) => node.metadata?.groundedBy === 'getTerrainHeight')
      .forEach((footing) => expect(Number.isFinite(footing.metadata.terrainY)).toBe(true));
    const roadFrames = frames.filter((frame) => frame.metadata?.clearRoadId === 'ROAD-02');
    expect(roadFrames.length).toBeGreaterThan(0);
    roadFrames.forEach((frame) => {
      expect(frame.metadata.roadFootingClearanceM.every((distance) => distance >= BABYLON_RECOVERY_ROAD_FOOTING_CLEARANCE_M - 1e-6)).toBe(true);
    });
    expect(piping.auditConnectionEndpoints().every((audit) => audit.valid)).toBe(true);
    piping.dispose();
    equipmentSystem.dispose();
    scene.dispose();
    engine.dispose();
  });
});
