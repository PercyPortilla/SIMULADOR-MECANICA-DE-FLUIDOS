import { createBabylonFixedEquipmentSystem } from './fixedEquipmentSystem.js';
import { createBabylonSupportEquipmentSystem } from './supportEquipmentSystem.js';

export function createBabylonProcessEquipmentSystem({
  scene,
  loadContainer,
  visualGeometry = true,
} = {}) {
  const fixed = createBabylonFixedEquipmentSystem({ scene, visualGeometry, ...(loadContainer ? { loadContainer } : {}) });
  const support = createBabylonSupportEquipmentSystem({ scene, visualGeometry, ...(loadContainer ? { loadContainer } : {}) });

  function ownerFor(id) {
    if (fixed.registry.has(id)) return fixed;
    if (support.registry.has(id)) return support;
    throw new RangeError(`Equipment desconocido: ${id}.`);
  }

  const ready = Promise.all([fixed.ready, support.ready]).then(() => ({
    fixed: fixed.root,
    support: support.root,
  }));

  return {
    fixed,
    support,
    ready,
    getEquipment(id) { return ownerFor(id).getEquipment(id); },
    getPort(equipmentId, portId) { return ownerFor(equipmentId).getPort(equipmentId, portId); },
    getPortWorldPosition(equipmentId, portId) { return ownerFor(equipmentId).getPortWorldPosition(equipmentId, portId); },
    getPortWorldDirection(equipmentId, portId) { return ownerFor(equipmentId).getPortWorldDirection(equipmentId, portId); },
    setAnimationsEnabled(enabled) {
      fixed.setAnimationsEnabled(enabled);
      support.setAnimationsEnabled(enabled);
    },
    get loadedVisualCount() { return fixed.loadedVisualCount + support.loadedVisualCount; },
    get visualCount() { return fixed.visuals.size + support.visuals.size; },
    allVisuals() {
      return new Map([...fixed.visuals, ...support.visuals]);
    },
    dispose() {
      fixed.dispose();
      support.dispose();
    },
  };
}
