import * as THREE from 'three';
import { getCatalogEntry } from '../../equipment/catalog/equipmentCatalog.js';
import { createConveyorAsset } from '../../equipment/conveying/conveyor.js';
import { getTerrainHeight } from '../environment/terrainHeight.js';
import { decorateHandleWithBlenderReplacement } from './blenderVisualReplacement.js';

function normalizePort(port) {
  const nominalDiameterM = Number(port.nominalDiameterM ?? port.nominalDiameter ?? 0.25);
  return Object.freeze({
    id: port.id,
    type: port.type,
    localPosition: new THREE.Vector3(...port.position),
    direction: new THREE.Vector3(...port.direction).normalize(),
    nominalDiameterM: Number.isFinite(nominalDiameterM) && nominalDiameterM > 0 ? nominalDiameterM : 0.25,
  });
}

function createCompatibilityEquipment(instanceId, handle, aliases = {}) {
  const ports = new Map();
  (handle.metadata?.ports ?? []).forEach((port) => ports.set(port.id, normalizePort(port)));
  Object.entries(aliases).forEach(([alias, sourceId]) => {
    const source = ports.get(sourceId);
    if (!source) throw new RangeError(`Alias ${instanceId}.${alias} apunta a puerto inexistente ${sourceId}.`);
    ports.set(alias, Object.freeze({ ...source, id: alias, aliasOf: sourceId }));
  });
  return {
    id: instanceId,
    type: handle.metadata?.category ?? 'equipment',
    dimensions: Object.freeze({ ...(handle.getDimensions?.() ?? handle.metadata?.dimensions ?? {}) }),
    transform: handle.root,
    ports,
    metadata: Object.freeze({ ...(handle.metadata ?? {}), instanceId }),
    group3D: handle.root,
    handle,
  };
}

export class IntegratedEquipmentRegistry {
  constructor() {
    this.items = new Map();
    this.handles = new Map();
  }

  add(instanceId, handle, { aliases = {}, kind = 'equipment' } = {}) {
    if (!instanceId || !handle?.root) throw new TypeError('Instancia integrada inválida.');
    if (this.items.has(instanceId)) throw new Error(`Equipo duplicado: ${instanceId}.`);
    handle.root.name = instanceId;
    handle.root.userData.assetId = handle.id;
    handle.root.userData.instanceId = instanceId;
    handle.root.userData.inspectableEquipment = true;
    handle.root.userData.inspectionKind = kind;
    handle.root.userData.integrationFrozenAsset = true;
    const equipment = createCompatibilityEquipment(instanceId, handle, aliases);
    this.items.set(instanceId, equipment);
    this.handles.set(instanceId, handle);
    return equipment;
  }

  addExternal(equipment) {
    if (!equipment?.id || !equipment.group3D || !(equipment.ports instanceof Map)) {
      throw new TypeError('External equipment necesita id, group3D y ports Map.');
    }
    if (this.items.has(equipment.id)) throw new Error(`Equipo duplicado: ${equipment.id}.`);
    equipment.group3D.userData.inspectableEquipment = true;
    equipment.group3D.userData.instanceId = equipment.id;
    this.items.set(equipment.id, equipment);
    return equipment;
  }

  getEquipment(id) {
    const equipment = this.items.get(id);
    if (!equipment) throw new RangeError(`Equipment desconocido: ${id}.`);
    return equipment;
  }

  getHandle(id) { return this.handles.get(id) ?? null; }

  getPort(equipmentId, portId) {
    const equipment = this.getEquipment(equipmentId);
    const port = equipment.ports.get(portId);
    if (!port) throw new RangeError(`Puerto desconocido: ${equipmentId}.${portId}.`);
    return port;
  }

  getPortWorldPosition(equipmentId, portId) {
    const equipment = this.getEquipment(equipmentId);
    const port = this.getPort(equipmentId, portId);
    equipment.group3D.updateMatrixWorld(true);
    return equipment.group3D.localToWorld(port.localPosition.clone());
  }

  getPortWorldDirection(equipmentId, portId) {
    const equipment = this.getEquipment(equipmentId);
    const port = this.getPort(equipmentId, portId);
    equipment.group3D.updateMatrixWorld(true);
    const q = equipment.group3D.getWorldQuaternion(new THREE.Quaternion());
    return port.direction.clone().applyQuaternion(q).normalize();
  }

  updateAssets(dt) {
    this.handles.forEach((handle) => {
      if (handle.root?.userData?.integrationManagedAnimation) return;
      handle.update?.(dt);
    });
  }

  updateLOD(camera) {
    this.handles.forEach((handle) => handle.updateLOD?.(camera));
  }

  setAnimationsEnabled(enabled) {
    this.handles.forEach((handle) => handle.setAnimationEnabled?.(enabled));
  }
}

export function createCatalogInstance({ instanceId, assetKey, position, rotationY = 0, aliases = {}, registry }) {
  const entry = getCatalogEntry(assetKey);
  if (!entry) throw new RangeError(`Asset desconocido: ${assetKey}.`);
  const handle = entry.create();
  handle.root.position.copy(position);
  handle.root.rotation.y = rotationY;
  handle.root.updateMatrixWorld(true);
  decorateHandleWithBlenderReplacement(handle, instanceId);
  const equipment = registry.add(instanceId, handle, { aliases });
  return { handle, equipment };
}

export function createConveyorInstance({ instanceId, source, target, width = 1.4, walkway = true, registry }) {
  const horizontal = Math.max(0.5, Math.hypot(target.x - source.x, target.z - source.z));
  const deltaY = target.y - source.y;
  const incline = Math.atan2(deltaY, horizontal);
  const handle = createConveyorAsset({ length: horizontal, width, incline, supportSpacing: 4.5, walkway });
  const rotationY = Math.atan2(-(target.z - source.z), target.x - source.x);
  // Root sits at the true midpoint of the authoritative port coordinates.
  // The conveyor asset defines feed/discharge symmetrically around deckCenterY,
  // so this keeps belt, supports, handrails and ports on one local frame.
  handle.root.position.set(
    (source.x + target.x) / 2,
    (source.y + target.y) / 2 - 2.03,
    (source.z + target.z) / 2,
  );
  handle.root.rotation.y = rotationY;
  handle.root.updateMatrixWorld(true);
  handle.groundSupports?.(getTerrainHeight);
  handle.root.updateMatrixWorld(true);
  const equipment = registry.add(instanceId, handle, { kind: 'conveyor' });
  equipment.group3D.userData.conveyorId = instanceId;
  // World-space route metadata supports close Inspection framing without
  // changing the authoritative parametric conveyor geometry.
  equipment.group3D.userData.routePoints = [source.toArray(), target.toArray()];
  return { handle, equipment };
}
