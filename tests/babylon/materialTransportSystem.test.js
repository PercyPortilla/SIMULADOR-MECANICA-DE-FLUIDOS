import { describe, expect, it, vi } from 'vitest';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine.js';
import { Mesh } from '@babylonjs/core/Meshes/mesh.js';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode.js';
import { Scene } from '@babylonjs/core/scene.js';
import { getTerrainHeight } from '../../src/scene/environment/terrainHeight.js';
import {
  CONVEYOR_CONNECTIONS,
  FIXED_MATERIAL_TRANSFER_CASCADES,
  V30_CONVEYOR_BELT_SPEED_MPS,
} from '../../src/scene/integration/materialTransportContracts.js';
import { createBabylonProcessEquipmentSystem } from '../../src/babylon/equipment/processEquipmentSystem.js';
import { createBabylonMaterialTransportSystem } from '../../src/babylon/conveying/materialTransportSystem.js';

function createContainer(scene, url) {
  const root = new TransformNode(`root-${url}`, scene);
  const mesh = new Mesh(`mesh-${url}`, scene);
  mesh.parent = root;
  return {
    rootNodes: [root],
    animationGroups: [],
    addAllToScene: vi.fn(),
    dispose: vi.fn(),
  };
}

async function fixture() {
  const engine = new NullEngine({ renderWidth: 320, renderHeight: 180 });
  const scene = new Scene(engine);
  scene.useRightHandedSystem = true;
  const equipment = createBabylonProcessEquipmentSystem({
    scene,
    loadContainer: async (url) => createContainer(scene, url),
  });
  await equipment.ready;
  const transport = createBabylonMaterialTransportSystem({ scene, equipmentSystem: equipment });
  return { engine, scene, equipment, transport };
}

describe('Babylon V31 solid material transport', () => {
  it('keeps the three V30 conveyor contracts and lands exactly on authoritative equipment ports', async () => {
    const { engine, scene, equipment, transport } = await fixture();
    expect(CONVEYOR_CONNECTIONS.map((item) => item.id)).toEqual([
      'CV-01-FEEDER-TO-CRUSHER',
      'CV-02-CRUSHER-TO-STOCKPILE',
      'CV-03-STOCKPILE-TO-GRINDING',
    ]);
    expect(transport.conveyors.size).toBe(3);
    transport.auditConnectionEndpoints().forEach((audit) => {
      expect(audit.valid, audit.id).toBe(true);
      expect(audit.sourceErrorM, `${audit.id}.source`).toBeLessThan(1e-5);
      expect(audit.targetErrorM, `${audit.id}.target`).toBeLessThan(1e-5);
    });
    CONVEYOR_CONNECTIONS.forEach((definition) => {
      const conveyor = transport.conveyors.get(definition.id);
      expect(conveyor.root.metadata.routePoints[0]).toEqual(equipment.getPortWorldPosition(...definition.source).asArray());
      expect(conveyor.root.metadata.routePoints[1]).toEqual(equipment.getPortWorldPosition(...definition.target).asArray());
      expect(conveyor.root.metadata.widthM).toBe(definition.widthM);
      expect(conveyor.root.metadata.beltSpeedMps).toBe(V30_CONVEYOR_BELT_SPEED_MPS);
    });
    transport.dispose(); equipment.dispose(); scene.dispose(); engine.dispose();
  });

  it('grounds individual conveyor footings with getTerrainHeight', async () => {
    const { engine, scene, equipment, transport } = await fixture();
    transport.root.computeWorldMatrix(true);
    let footingCount = 0;
    transport.conveyors.forEach((conveyor) => {
      conveyor.root.computeWorldMatrix(true);
      conveyor.root.getChildMeshes(false).filter((mesh) => mesh.name.includes('-footing-')).forEach((footing) => {
        footing.computeWorldMatrix(true);
        const absolute = footing.getAbsolutePosition();
        expect(footing.metadata?.groundedBy).toBe('getTerrainHeight');
        expect(absolute.y - 0.06).toBeCloseTo(getTerrainHeight(absolute.x, absolute.z), 5);
        footingCount += 1;
      });
    });
    expect(footingCount).toBeGreaterThan(8);
    transport.dispose(); equipment.dispose(); scene.dispose(); engine.dispose();
  });

  it('moves belt ore and z-axis pulley cues at the V30 speed, then freezes with Animaciones OFF', async () => {
    const { engine, scene, equipment, transport } = await fixture();
    const conveyor = transport.conveyors.get('CV-01-FEEDER-TO-CRUSHER');
    const ore = conveyor.orePieces[0];
    const pulley = conveyor.pulleys[1];
    const before = { x: ore.position.x, zRotation: pulley.rotation.z, travel: conveyor.root.metadata.beltTravelM };
    transport.update(0.1);
    expect(ore.position.x).toBeGreaterThan(before.x);
    expect(pulley.rotation.z).toBeLessThan(before.zRotation);
    expect(conveyor.root.metadata.beltTravelM - before.travel).toBeCloseTo(V30_CONVEYOR_BELT_SPEED_MPS * 0.1, 8);
    transport.setAnimationsEnabled(false);
    const frozen = { x: ore.position.x, zRotation: pulley.rotation.z, travel: conveyor.root.metadata.beltTravelM };
    transport.update(0.1);
    expect(ore.position.x).toBeCloseTo(frozen.x, 12);
    expect(pulley.rotation.z).toBeCloseTo(frozen.zRotation, 12);
    expect(conveyor.root.metadata.beltTravelM).toBeCloseTo(frozen.travel, 12);
    transport.dispose(); equipment.dispose(); scene.dispose(); engine.dispose();
  });

  it('recreates the three V24 fixed transfer cascades and ROM feeder chute without changing ports', async () => {
    const { engine, scene, equipment, transport } = await fixture();
    expect(transport.transfers).toHaveLength(FIXED_MATERIAL_TRANSFER_CASCADES.length);
    FIXED_MATERIAL_TRANSFER_CASCADES.forEach((definition) => {
      const transfer = transport.transfers.find((item) => item.root.name === definition.name);
      expect(transfer).toBeTruthy();
      expect(transfer.root.metadata.visualOnly).toBe(true);
      expect(transfer.root.metadata.receivingEquipmentId).toBe(definition.equipmentId);
      expect(transfer.particles).toHaveLength(definition.count);
    });
    const romOut = equipment.getPortWorldPosition('ROM-HOPPER', 'dischargeOut');
    const feederIn = equipment.getPortWorldPosition('APRON-FEEDER', 'feedIn');
    expect(transport.romFeederTransfer.start.asArray()).toEqual(romOut.asArray());
    expect(transport.romFeederTransfer.end.asArray()).toEqual(feederIn.asArray());
    expect(transport.stockpileFeedTower.metadata.supportedEndpoint).toEqual(
      equipment.getPortWorldPosition('STOCKPILE-RECLAIM', 'feedIn').asArray(),
    );
    transport.dispose(); equipment.dispose(); scene.dispose(); engine.dispose();
  });
});
