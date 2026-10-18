import { TransformNode } from '@babylonjs/core/Meshes/transformNode.js';
import { getTerrainHeight } from '../../scene/environment/terrainHeight.js';
import { FINAL_EQUIPMENT_LAYOUT } from '../../scene/integration/finalLayout.js';
import {
  INSTANCE_PORT_ALIASES,
  getEquipmentRenderContract,
} from '../../scene/integration/equipmentContracts.js';
import { attachBabylonEquipmentVisual } from '../assets/equipmentVisual.js';
import { BabylonEquipmentRegistry } from './equipmentRegistry.js';
import { createBabylonEquipmentVisualCues } from './equipmentVisualCues.js';

export const BABYLON_FIXED_PROCESS_IDS = Object.freeze(Object.keys(FINAL_EQUIPMENT_LAYOUT));

export function createBabylonFixedEquipmentSystem({
  scene,
  instanceIds = BABYLON_FIXED_PROCESS_IDS,
  loadContainer,
} = {}) {
  if (!scene) throw new TypeError('Babylon fixed equipment system requires a Scene.');
  if (scene.useRightHandedSystem !== true) throw new Error('Babylon fixed equipment system requires a right-handed Scene.');

  const root = new TransformNode('babylon-fixed-process-equipment', scene);
  root.metadata = {
    migrationStage: 'V31-fixed-process',
    renderer: 'babylon',
  };
  const registry = new BabylonEquipmentRegistry();
  const visuals = new Map();
  const visualCues = new Map();
  const loadPromises = [];

  instanceIds.forEach((instanceId) => {
    const layout = FINAL_EQUIPMENT_LAYOUT[instanceId];
    if (!layout) throw new RangeError(`Layout inexistente: ${instanceId}.`);
    const contract = getEquipmentRenderContract(layout.asset);
    if (!contract) throw new RangeError(`Contrato físico Babylon inexistente: ${layout.asset}.`);

    const equipmentRoot = new TransformNode(instanceId, scene);
    equipmentRoot.parent = root;
    equipmentRoot.position.set(layout.x, getTerrainHeight(layout.x, layout.z), layout.z);
    equipmentRoot.rotation.y = layout.rotationY ?? 0;
    equipmentRoot.metadata = {
      ...(equipmentRoot.metadata ?? {}),
      groundedBy: 'getTerrainHeight',
      layoutAssetKey: layout.asset,
      authoritativeXZ: [layout.x, layout.z],
    };

    registry.add({
      id: instanceId,
      root: equipmentRoot,
      ports: contract.ports,
      aliases: INSTANCE_PORT_ALIASES[instanceId] ?? {},
      dimensions: contract.dimensions,
      metadata: {
        assetKey: layout.asset,
        groundedBy: 'getTerrainHeight',
      },
    });

    const visual = attachBabylonEquipmentVisual({
      scene,
      instanceId,
      ...(loadContainer ? { loadContainer } : {}),
    });
    visual.host.parent = equipmentRoot;
    visuals.set(instanceId, visual);
    const cues = createBabylonEquipmentVisualCues({
      scene,
      instanceId,
      hostRoot: equipmentRoot,
      dimensions: contract.dimensions,
    });
    visualCues.set(instanceId, cues);
    loadPromises.push(visual.ready.then(() => {
      if (visual.loaded) cues.bindImportedNodes(visual.rootNodes);
      else {
        cues.ensureFallback();
        visual.host.metadata.blenderVisualStatus = 'error-procedural-fallback';
        visual.host.metadata.proceduralFallbackActive = true;
      }
      return visual.host;
    }));
  });

  const ready = Promise.allSettled(loadPromises).then(() => root);

  return {
    root,
    registry,
    visuals,
    visualCues,
    ready,
    getEquipment: (id) => registry.getEquipment(id),
    getPort: (equipmentId, portId) => registry.getPort(equipmentId, portId),
    getPortWorldPosition: (equipmentId, portId) => registry.getPortWorldPosition(equipmentId, portId),
    getPortWorldDirection: (equipmentId, portId) => registry.getPortWorldDirection(equipmentId, portId),
    setAnimationsEnabled(enabled) {
      visuals.forEach((visual) => visual.setAnimationsEnabled(enabled));
      visualCues.forEach((cues) => cues.setAnimationsEnabled(enabled));
    },
    get loadedVisualCount() {
      return [...visuals.values()].filter((visual) => visual.loaded).length;
    },
    dispose() {
      visualCues.forEach((cues) => cues.dispose());
      visualCues.clear();
      visuals.forEach((visual) => visual.dispose());
      visuals.clear();
      registry.clear();
      root.dispose();
    },
  };
}
