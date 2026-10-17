import * as THREE from 'three';
const MODES = Object.freeze(['normal', 'transparent', 'cutaway', 'interior']);

export const INSPECTION_CIRCUIT_ORDER = Object.freeze([
  'EXCAVATOR-01',
  'TRUCK-01',
  'ROM-HOPPER',
  'ROM-TO-FEEDER-CHUTE',
  'APRON-FEEDER',
  'CV-01-FEEDER-TO-CRUSHER',
  'PRIMARY-CRUSHER',
  'CV-02-CRUSHER-TO-STOCKPILE',
  'STOCKPILE-RECLAIM',
  'LOADER-01',
  'CV-03-STOCKPILE-TO-GRINDING',
  'MILL-01',
  'P-MILL-TO-SUMP',
  'SUMP-01',
  'P-SUMP-TO-PUMP',
  'SLURRY-PUMP-01',
  'P-PUMP-TO-CYCLONES',
  'CLASS-01',
  'P-CYCLONE-UNDERFLOW-RETURN',
  'P-CLASSIFICATION-TO-LEACH',
  'R-01',
  'P-LEACH-R01-R02',
  'R-02',
  'P-LEACH-R02-R03',
  'R-03',
  'P-LEACH-R03-R04',
  'R-04',
  'P-LEACHING-TO-PUMP-01',
  'PUMP-01',
  'P-PUMP-01-TO-CIP',
  'CIP-ADSORPTION',
  'MT-CIP-TO-ELUTION-CARBON',
  'ELUTION-SKID',
  'MT-ELUTION-TO-CIP-BARREN-CARBON',
  'P-ELUTION-TO-EW',
  'EW-CELLS',
  'MT-EW-TO-SMELTING-CATHODE',
  'SMELTING-FURNACE',
]);

const CIRCUIT_RANK = new Map(INSPECTION_CIRCUIT_ORDER.map((id, index) => [id, index]));

export function getInspectionCircuitContext(id) {
  const index = CIRCUIT_RANK.get(id);
  if (index === undefined) return Object.freeze({ id, previousId: null, nextId: null, index: -1 });
  return Object.freeze({
    id,
    previousId: INSPECTION_CIRCUIT_ORDER[index - 1] ?? null,
    nextId: INSPECTION_CIRCUIT_ORDER[index + 1] ?? null,
    index,
  });
}
const FRIENDLY_TARGET_LABELS = Object.freeze({
  'EXCAVATOR-01': 'Excavadora · EXCAVATOR-01',
  'TRUCK-01': 'Camión mina · TRUCK-01',
  'LOADER-01': 'Cargador · LOADER-01',
  'ROM-HOPPER': 'Tolva ROM · ROM-HOPPER',
  'APRON-FEEDER': 'Alimentador · APRON-FEEDER',
  'PRIMARY-CRUSHER': 'Chancadora primaria · PRIMARY-CRUSHER',
  'STOCKPILE-RECLAIM': 'Stockpile / reclaim',
  'MILL-01': 'Molino · MILL-01',
  'SUMP-01': 'Sump · SUMP-01',
  'SLURRY-PUMP-01': 'Bomba de clasificación · SLURRY-PUMP-01',
  'CLASS-01': 'Ciclones · CLASS-01',
  'PUMP-01': 'Bomba a recuperación · PUMP-01',
  'CIP-ADSORPTION': 'Adsorción CIP',
  'ELUTION-SKID': 'Elución',
  'EW-CELLS': 'Electrowinning',
  'SMELTING-FURNACE': 'Fundición',
});


function isInspectable(object) {
  return object?.userData?.inspectableEquipment === true
    || Boolean(object?.userData?.conveyorId)
    || Boolean(object?.userData?.connectionId)
    || (object?.userData?.mobileEquipment === true && Boolean(object.name));
}

function isInterior(object) {
  return object?.userData?.inspectionInterior === true || object?.userData?.inspectionRole === 'interior';
}

function isInteriorWithin(object, target) {
  let cursor = object;
  while (cursor) {
    if (isInterior(cursor)) return true;
    if (cursor === target) break;
    cursor = cursor.parent;
  }
  return false;
}

function isExplicitShell(object) {
  return object?.userData?.inspectionShell === true || object?.userData?.inspectionRole === 'shell';
}

function isShellLike(object) {
  if (isExplicitShell(object)) return true;
  return /shell|body|casing|hopper|tank|cell|hood|cover|lid|volute|chute|feeder|bed/i.test(object?.name || '');
}

function cloneMaterials(material) {
  if (!material) return material;
  if (Array.isArray(material)) return material.map((item) => item.clone());
  return material.clone();
}

function disposeClonedMaterials(material) {
  if (!material) return;
  if (Array.isArray(material)) material.forEach((item) => item?.dispose?.());
  else material.dispose?.();
}

function mutateMaterials(material, callback) {
  if (!material) return;
  if (Array.isArray(material)) material.forEach(callback);
  else callback(material);
}

function labelFor(object) {
  const id = object.userData?.conveyorId || object.userData?.connectionId || object.name;
  if (FRIENDLY_TARGET_LABELS[id]) return FRIENDLY_TARGET_LABELS[id];
  if (object.userData?.conveyorId) return `Faja · ${object.userData.conveyorId}`;
  if (object.userData?.connectionId) return `Línea · ${object.userData.connectionId}`;
  return object.name;
}

function circuitOrderFor(id) {
  if (CIRCUIT_RANK.has(id)) return CIRCUIT_RANK.get(id);
  if (/^R-0[1-4]$/.test(id)) return 200 + Number(id.slice(-1));
  if (id?.startsWith('P-')) return 800;
  if (id?.startsWith('CV-')) return 850;
  return 1000;
}

export function createEquipmentInspectionSystem({ environmentRoot } = {}) {
  if (!environmentRoot) throw new TypeError('Inspection system requiere environmentRoot.');

  const targets = new Map();
  const contextOverlay = new THREE.Group();
  contextOverlay.name = 'inspection-circuit-context';
  contextOverlay.userData.inspectionOverlay = true;
  environmentRoot.add(contextOverlay);

  function clearContextOverlay() {
    while (contextOverlay.children.length) {
      const child = contextOverlay.children[0];
      contextOverlay.remove(child);
      child.geometry?.dispose?.();
      child.material?.dispose?.();
    }
  }

  function addContextBox(id, color, role) {
    const object = targets.get(id);
    if (!object) return;
    object.updateWorldMatrix?.(true, true);
    const box = new THREE.Box3().setFromObject(object);
    if (box.isEmpty()) return;
    const helper = new THREE.Box3Helper(box, color);
    helper.name = `inspection-${role}-${id}`;
    helper.renderOrder = 180;
    helper.userData = { inspectionContext: true, targetId: id, role, targetObject: object };
    contextOverlay.add(helper);
  }

  function updateContextOverlay(id) {
    clearContextOverlay();
    if (!id) return;
    const context = getInspectionCircuitContext(id);
    addContextBox(id, 0x7de3ed, 'selected');
    if (context.previousId) addContextBox(context.previousId, 0xf0b35a, 'upstream');
    if (context.nextId) addContextBox(context.nextId, 0xa8d18d, 'downstream');
  }

  function refreshContextOverlay() {
    contextOverlay.children.forEach((helper) => {
      const object = helper.userData?.targetObject;
      if (!object || !helper.box) return;
      object.updateWorldMatrix?.(true, true);
      helper.box.setFromObject(object);
      helper.updateMatrixWorld?.(true);
    });
  }

  function rebuildTargets() {
    targets.clear();
    environmentRoot.traverse((object) => {
      if (!isInspectable(object) || !object.name) return;
      if (!targets.has(object.name)) targets.set(object.name, object);
    });
  }

  rebuildTargets();

  let currentTargetId = null;
  let currentMode = 'normal';
  let activeSnapshot = null;

  function snapshotTarget(target) {
    const entries = [];
    target.traverse((object) => {
      entries.push({
        object,
        visible: object.visible,
        material: object.isMesh ? object.material : null,
        renderOrder: object.renderOrder,
      });
    });
    return { target, entries };
  }

  function restore() {
    if (!activeSnapshot) return;
    activeSnapshot.entries.forEach((entry) => {
      if (entry.object.isMesh) {
        const current = entry.object.material;
        if (current !== entry.material) disposeClonedMaterials(current);
        entry.object.material = entry.material;
      }
      entry.object.visible = entry.visible;
      entry.object.renderOrder = entry.renderOrder;
    });
    activeSnapshot = null;
  }

  function applyMode(target, mode) {
    restore();
    if (mode === 'normal') return;
    activeSnapshot = snapshotTarget(target);
    target.updateWorldMatrix?.(true, true);
    const bounds = new THREE.Box3().setFromObject(target);
    const center = bounds.getCenter(new THREE.Vector3());
    const cutPlane = new THREE.Plane(new THREE.Vector3(1, 0, 0), -center.x);

    activeSnapshot.entries.forEach((entry) => {
      const object = entry.object;
      const interior = isInteriorWithin(object, target);
      const shell = isShellLike(object);

      if (interior) {
        object.visible = true;
        object.renderOrder = 4;
        if (!object.isMesh) return;
        object.material = cloneMaterials(entry.material);
        mutateMaterials(object.material, (mat) => {
          mat.transparent = true;
          mat.opacity = Math.max(mat.opacity ?? 1, 0.76);
          mat.depthWrite = true;
          mat.needsUpdate = true;
        });
        return;
      }

      if (!object.isMesh) return;
      object.material = cloneMaterials(entry.material);
      if (mode === 'transparent') {
        mutateMaterials(object.material, (mat) => {
          mat.transparent = true;
          mat.opacity = shell ? 0.26 : Math.min(mat.opacity ?? 1, 0.44);
          mat.depthWrite = false;
          mat.needsUpdate = true;
        });
        object.renderOrder = shell ? 2 : 1;
        return;
      }

      if (mode === 'cutaway') {
        if (shell) {
          mutateMaterials(object.material, (mat) => {
            mat.clippingPlanes = [cutPlane];
            mat.clipShadows = true;
            mat.transparent = false;
            mat.opacity = 1;
            mat.depthWrite = true;
            mat.needsUpdate = true;
          });
          object.renderOrder = 1;
        }
        return;
      }

      if (mode === 'interior') {
        if (isExplicitShell(object)) {
          object.visible = false;
          return;
        }
        mutateMaterials(object.material, (mat) => {
          mat.transparent = true;
          mat.opacity = 0.10;
          mat.depthWrite = false;
          mat.needsUpdate = true;
        });
        object.renderOrder = 1;
      }
    });
  }

  function setTarget(id) {
    restore();
    if (!id) {
      currentTargetId = null;
      currentMode = 'normal';
      updateContextOverlay(null);
      return null;
    }
    if (!targets.has(id)) throw new RangeError(`Equipo no inspeccionable: ${id}.`);
    currentTargetId = id;
    currentMode = 'normal';
    updateContextOverlay(id);
    return targets.get(id);
  }

  function setMode(mode) {
    if (!MODES.includes(mode)) throw new RangeError(`Modo de inspección inválido: ${mode}.`);
    currentMode = mode;
    if (!currentTargetId) {
      restore();
      return;
    }
    applyMode(targets.get(currentTargetId), mode);
  }

  function refreshTargets() {
    const previousId = currentTargetId;
    const previousMode = currentMode;
    restore();
    rebuildTargets();
    if (previousId && targets.has(previousId)) {
      currentTargetId = previousId;
      currentMode = previousMode;
      if (previousMode !== 'normal') applyMode(targets.get(previousId), previousMode);
      updateContextOverlay(previousId);
    } else if (previousId) {
      currentTargetId = null;
      currentMode = 'normal';
      updateContextOverlay(null);
    }
    return getTargets();
  }

  function getTargets() {
    return INSPECTION_CIRCUIT_ORDER
      .filter((id) => targets.has(id))
      .map((id) => {
        const object = targets.get(id);
        const context = getInspectionCircuitContext(id);
        return {
        id,
        label: labelFor(object),
        kind: object.userData?.inspectionKind || object.userData?.type || 'equipment',
          circuitOrder: context.index,
          previousId: context.previousId,
          nextId: context.nextId,
        };
      });
  }

  function dispose() {
    restore();
    clearContextOverlay();
    contextOverlay.removeFromParent();
    targets.clear();
  }

  return {
    modes: MODES,
    getTargets,
    refreshTargets,
    setTarget,
    setMode,
    getContext: (id = currentTargetId) => getInspectionCircuitContext(id),
    contextOverlay,
    refreshContextOverlay,
    get targetId() { return currentTargetId; },
    get mode() { return currentMode; },
    dispose,
  };
}
