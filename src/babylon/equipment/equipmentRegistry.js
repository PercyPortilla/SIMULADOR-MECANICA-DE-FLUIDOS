import { Vector3 } from '@babylonjs/core/Maths/math.vector.js';

function finiteVector3(value, label) {
  const source = value instanceof Vector3 ? value : Array.isArray(value) ? Vector3.FromArray(value) : null;
  if (!source || ![source.x, source.y, source.z].every(Number.isFinite)) {
    throw new TypeError(`${label} debe ser Vector3 o [x,y,z] finito.`);
  }
  return source.clone();
}

export function normalizeBabylonPort(port) {
  if (!port?.id) throw new TypeError('Puerto Babylon requiere id.');
  const nominalDiameterM = Number(port.nominalDiameterM ?? port.nominalDiameter ?? 0.25);
  return Object.freeze({
    id: port.id,
    type: port.type ?? 'process',
    localPosition: finiteVector3(port.localPosition ?? port.position, `${port.id}.position`),
    direction: finiteVector3(port.direction ?? [1, 0, 0], `${port.id}.direction`).normalize(),
    nominalDiameterM: Number.isFinite(nominalDiameterM) && nominalDiameterM > 0 ? nominalDiameterM : 0.25,
  });
}

function buildPortMap(instanceId, sourcePorts = [], aliases = {}) {
  const ports = new Map();
  sourcePorts.forEach((port) => {
    const normalized = normalizeBabylonPort(port);
    if (ports.has(normalized.id)) throw new Error(`Puerto duplicado: ${instanceId}.${normalized.id}`);
    ports.set(normalized.id, normalized);
  });
  Object.entries(aliases).forEach(([alias, sourceId]) => {
    const source = ports.get(sourceId);
    if (!source) throw new RangeError(`Alias ${instanceId}.${alias} apunta a puerto inexistente ${sourceId}.`);
    ports.set(alias, Object.freeze({ ...source, id: alias, aliasOf: sourceId }));
  });
  return ports;
}

export class BabylonEquipmentRegistry {
  constructor() {
    this.items = new Map();
  }

  add({
    id,
    root,
    ports = [],
    aliases = {},
    dimensions = {},
    metadata = {},
    type = 'equipment',
  } = {}) {
    if (!id || !root?.computeWorldMatrix) throw new TypeError('Equipo Babylon requiere id y root TransformNode/Mesh.');
    if (this.items.has(id)) throw new Error(`Equipo duplicado: ${id}.`);
    const portMap = ports instanceof Map
      ? new Map([...ports].map(([portId, port]) => [portId, normalizeBabylonPort({ ...port, id: portId })]))
      : buildPortMap(id, ports, aliases);

    if (ports instanceof Map && Object.keys(aliases).length) {
      Object.entries(aliases).forEach(([alias, sourceId]) => {
        const source = portMap.get(sourceId);
        if (!source) throw new RangeError(`Alias ${id}.${alias} apunta a puerto inexistente ${sourceId}.`);
        portMap.set(alias, Object.freeze({ ...source, id: alias, aliasOf: sourceId }));
      });
    }

    root.name = id;
    root.metadata = {
      ...(root.metadata ?? {}),
      inspectableEquipment: true,
      instanceId: id,
    };
    const equipment = {
      id,
      type,
      root,
      group3D: root,
      transform: root,
      ports: portMap,
      dimensions: Object.freeze({ ...dimensions }),
      metadata: Object.freeze({ ...metadata, instanceId: id }),
    };
    this.items.set(id, equipment);
    return equipment;
  }

  getEquipment(id) {
    const equipment = this.items.get(id);
    if (!equipment) throw new RangeError(`Equipment desconocido: ${id}.`);
    return equipment;
  }

  getPort(equipmentId, portId) {
    const equipment = this.getEquipment(equipmentId);
    const port = equipment.ports.get(portId);
    if (!port) throw new RangeError(`Puerto desconocido: ${equipmentId}.${portId}.`);
    return port;
  }

  getPortWorldPosition(equipmentId, portId) {
    const equipment = this.getEquipment(equipmentId);
    const port = this.getPort(equipmentId, portId);
    const world = equipment.root.computeWorldMatrix(true);
    return Vector3.TransformCoordinates(port.localPosition, world);
  }

  getPortWorldDirection(equipmentId, portId) {
    const equipment = this.getEquipment(equipmentId);
    const port = this.getPort(equipmentId, portId);
    const world = equipment.root.computeWorldMatrix(true);
    return Vector3.TransformNormal(port.direction, world).normalize();
  }

  has(id) {
    return this.items.has(id);
  }

  entries() {
    return [...this.items.entries()];
  }

  clear() {
    this.items.clear();
  }
}
