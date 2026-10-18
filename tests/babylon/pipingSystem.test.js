import { describe, expect, it, vi } from 'vitest';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine.js';
import { Mesh } from '@babylonjs/core/Meshes/mesh.js';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode.js';
import { Scene } from '@babylonjs/core/scene.js';
import { createBabylonProcessEquipmentSystem } from '../../src/babylon/equipment/processEquipmentSystem.js';
import {
  BABYLON_MIN_RENDERED_PIPE_DIAMETER_M,
  createBabylonPipingSystem,
  getBabylonRenderedPipeDiameter,
} from '../../src/babylon/piping/pipingSystem.js';
import {
  PROCESS_PIPE_CONNECTIONS,
  PROCESS_SOLID_TRANSFERS,
} from '../../src/scene/integration/processConnectionContracts.js';

function container(scene, url) {
  const root = new TransformNode(`root-${url}-${Math.random()}`, scene);
  const mesh = new Mesh(`mesh-${url}`, scene);
  mesh.parent = root;
  return {
    rootNodes: [root],
    animationGroups: [],
    addAllToScene: vi.fn(),
    dispose: vi.fn(),
  };
}

describe('Babylon process piping', () => {
  it('keeps physical diameters separate from the renderer-only minimum', () => {
    expect(getBabylonRenderedPipeDiameter(0.1)).toBe(BABYLON_MIN_RENDERED_PIPE_DIAMETER_M);
    expect(getBabylonRenderedPipeDiameter(0.22)).toBe(BABYLON_MIN_RENDERED_PIPE_DIAMETER_M);
    expect(getBabylonRenderedPipeDiameter(0.6)).toBe(0.6);
    expect(getBabylonRenderedPipeDiameter(0)).toBe(0);
  });

  it('renders the same 11 physical connection contracts and lands exactly on Babylon port endpoints', async () => {
    const engine = new NullEngine();
    const scene = new Scene(engine);
    scene.useRightHandedSystem = true;
    const equipmentSystem = createBabylonProcessEquipmentSystem({
      scene,
      loadContainer: async (url) => container(scene, url),
    });
    await equipmentSystem.ready;
    const piping = createBabylonPipingSystem({ scene, equipmentSystem });
    expect(piping.connections.size).toBe(PROCESS_PIPE_CONNECTIONS.length);
    const audits = piping.auditConnectionEndpoints(0.00001);
    expect(audits).toHaveLength(11);
    expect(audits.every((audit) => audit.valid)).toBe(true);
    expect(Math.max(...audits.map((audit) => audit.sourceErrorM))).toBeLessThan(1e-9);
    expect(Math.max(...audits.map((audit) => audit.targetErrorM))).toBeLessThan(1e-9);
    piping.connections.forEach((handle, id) => {
      const definition = PROCESS_PIPE_CONNECTIONS.find((item) => item.id === id);
      expect(handle.root.metadata.physicalDiameterM).toBe(definition.diameter);
      expect(handle.root.metadata.renderedDiameterM).toBeGreaterThanOrEqual(definition.diameter);
      expect(handle.route.length).toBeGreaterThanOrEqual(2);
    });
    piping.dispose();
    equipmentSystem.dispose();
    scene.dispose();
    engine.dispose();
  });

  it('keeps all recovery solid transfers port-to-port, including EW cathodes to smelting', async () => {
    const engine = new NullEngine();
    const scene = new Scene(engine);
    scene.useRightHandedSystem = true;
    const equipmentSystem = createBabylonProcessEquipmentSystem({
      scene,
      loadContainer: async (url) => container(scene, url),
    });
    await equipmentSystem.ready;
    const piping = createBabylonPipingSystem({ scene, equipmentSystem });

    expect(piping.materialTransfers.size).toBe(PROCESS_SOLID_TRANSFERS.length);
    PROCESS_SOLID_TRANSFERS.forEach((definition) => {
      const handle = piping.materialTransfers.get(definition.id);
      expect(handle).toBeTruthy();
      expect(handle.route[0].asArray()).toEqual(
        equipmentSystem.getPortWorldPosition(definition.source[0], definition.source[1]).asArray(),
      );
      expect(handle.route.at(-1).asArray()).toEqual(
        equipmentSystem.getPortWorldPosition(definition.target[0], definition.target[1]).asArray(),
      );
      expect(handle.root.metadata).toMatchObject({
        connectionId: definition.id,
        inspectionKind: 'solid-material-transfer',
        transferKind: definition.kind,
      });
    });
    expect(PROCESS_SOLID_TRANSFERS.find((item) => item.id === 'MT-EW-TO-SMELTING-CATHODE')).toMatchObject({
      source: ['EW-CELLS', 'cathodeOut'],
      target: ['SMELTING-FURNACE', 'feed'],
      kind: 'cathode',
    });

    piping.dispose();
    equipmentSystem.dispose();
    scene.dispose();
    engine.dispose();
  });

  it('honors the dynamic Pipe 1 physical diameter without changing its endpoint contract', async () => {
    const engine = new NullEngine();
    const scene = new Scene(engine);
    scene.useRightHandedSystem = true;
    const equipmentSystem = createBabylonProcessEquipmentSystem({
      scene,
      loadContainer: async (url) => container(scene, url),
    });
    await equipmentSystem.ready;
    const piping = createBabylonPipingSystem({
      scene,
      equipmentSystem,
      pipe1State: { innerDiameterM: 0.31 },
    });
    const pipe1 = piping.connections.get('P-LEACH-R01-R02').root;
    expect(pipe1.metadata.physicalDiameterM).toBe(0.31);
    expect(pipe1.metadata.renderedDiameterM).toBe(0.40);
    expect(piping.auditConnectionEndpoints().find((audit) => audit.id === 'P-LEACH-R01-R02').valid).toBe(true);

    const beforeRoot = piping.connections.get('P-LEACH-R01-R02').root;
    const refreshed = piping.refreshPipe1({
      innerDiameterM: 0.52,
      lengthM: 145,
      material: 'HDPE',
      accessories: { valvesCount: 3 },
    });
    expect(refreshed.root).not.toBe(beforeRoot);
    expect(beforeRoot.isDisposed()).toBe(true);
    expect(refreshed.root.metadata.physicalDiameterM).toBe(0.52);
    expect(refreshed.root.metadata.renderedDiameterM).toBe(0.52);
    expect(refreshed.root.metadata.requestedHydraulicLengthM).toBe(145);
    expect(refreshed.root.metadata.requestedMaterial).toBe('HDPE');
    expect(refreshed.root.metadata.visualValveCount).toBe(3);
    expect(refreshed.root.metadata.flowParticleCount).toBeGreaterThanOrEqual(18);
    expect(refreshed.root.getChildMeshes(false).filter((mesh) => mesh.metadata?.pipeValve)).toHaveLength(3);
    expect(refreshed.root.getChildMeshes(false).some((mesh) => mesh.metadata?.pipeInternalFluid)).toBe(true);
    const particle = refreshed.root.getChildMeshes(false).find((mesh) => mesh.metadata?.pipeParticleFlow);
    const before = particle.position.clone();
    piping.setFlowScale(2);
    expect(piping.updateFlow(0.1)).toBe(true);
    expect(particle.position.equalsWithEpsilon(before, 1e-9)).toBe(false);
    piping.setFlowScale(0);
    const stopped = particle.position.clone();
    expect(piping.updateFlow(0.1)).toBe(false);
    expect(particle.position.equalsWithEpsilon(stopped, 1e-9)).toBe(true);
    expect(piping.auditConnectionEndpoints().find((audit) => audit.id === 'P-LEACH-R01-R02').valid).toBe(true);
    piping.dispose();
    equipmentSystem.dispose();
    scene.dispose();
    engine.dispose();
  });
});
