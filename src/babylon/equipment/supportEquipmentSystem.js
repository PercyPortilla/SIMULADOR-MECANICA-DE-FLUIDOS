import { TransformNode } from '@babylonjs/core/Meshes/transformNode.js';
import { getTerrainHeight } from '../../scene/environment/terrainHeight.js';
import { SUPPORT_LAYOUT } from '../../scene/integration/finalLayout.js';
import { getSupportEquipmentContract } from '../../scene/integration/equipmentContracts.js';
import { attachBabylonEquipmentVisual } from '../assets/equipmentVisual.js';
import { BabylonEquipmentRegistry } from './equipmentRegistry.js';
import { createBabylonEquipmentVisualCues } from './equipmentVisualCues.js';

const SUPPORT_DEFINITIONS = Object.freeze({
  'STOCKPILE-RECLAIM': Object.freeze({
    x: SUPPORT_LAYOUT.stockpile.x,
    z: SUPPORT_LAYOUT.stockpile.z,
    type: 'stockpile-reclaim',
  }),
  'SUMP-01': Object.freeze({
    x: SUPPORT_LAYOUT.sump.x,
    z: SUPPORT_LAYOUT.sump.z,
    type: 'sump',
  }),
});

export const BABYLON_SUPPORT_EQUIPMENT_IDS = Object.freeze(Object.keys(SUPPORT_DEFINITIONS));

export function createBabylonSupportEquipmentSystem({
  scene,
  loadContainer,
  visualGeometry = true,
} = {}) {
  if (!scene) throw new TypeError('Babylon support equipment system requires a Scene.');
  if (scene.useRightHandedSystem !== true) throw new Error('Babylon support equipment system requires a right-handed Scene.');

  const root = new TransformNode('babylon-support-equipment', scene);
  const registry = new BabylonEquipmentRegistry();
  const visuals = new Map();
  const visualCues = new Map();
  const loadPromises = [];

  BABYLON_SUPPORT_EQUIPMENT_IDS.forEach((instanceId) => {
    const definition = SUPPORT_DEFINITIONS[instanceId];
    const contract = getSupportEquipmentContract(instanceId);
    if (!contract) throw new RangeError(`Contrato de soporte inexistente: ${instanceId}.`);
    const equipmentRoot = new TransformNode(instanceId, scene);
    equipmentRoot.parent = root;
    equipmentRoot.position.set(
      definition.x,
      getTerrainHeight(definition.x, definition.z),
      definition.z,
    );
    equipmentRoot.metadata = {
      authoritativeXZ: [definition.x, definition.z],
      groundedBy: 'getTerrainHeight',
    };
    registry.add({
      id: instanceId,
      root: equipmentRoot,
      ports: contract.ports,
      dimensions: contract.dimensions,
      type: definition.type,
      metadata: { category: definition.type },
    });
    // Keep semantic equipment and hydraulic ports even without legacy meshes.
    if (!visualGeometry) return;
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
