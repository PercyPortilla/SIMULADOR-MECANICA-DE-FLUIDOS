import * as THREE from 'three';

function asVector3(value, fallback = [0, 0, 0]) {
  if (value instanceof THREE.Vector3) return value.clone();
  const source = Array.isArray(value) ? value : fallback;
  return new THREE.Vector3(source[0] ?? 0, source[1] ?? 0, source[2] ?? 0);
}

function normalizeDirection(value) {
  const direction = asVector3(value, [1, 0, 0]);
  if (direction.lengthSq() === 0) {
    throw new RangeError('La dirección de un puerto no puede ser un vector cero.');
  }
  return direction.normalize();
}

function validatePort(port) {
  if (!port?.id) throw new TypeError('Cada puerto necesita un id.');
  if (!port.type) throw new TypeError(`El puerto ${port.id} necesita un type.`);
  if (!Number.isFinite(port.nominalDiameterM) || port.nominalDiameterM <= 0) {
    throw new RangeError(`El puerto ${port.id} necesita nominalDiameterM > 0.`);
  }
}

export function createEquipment({
  id,
  type,
  dimensions,
  transform = {},
  ports = [],
  metadata = {},
  group3D,
}) {
  if (!id) throw new TypeError('Equipment necesita id.');
  if (!type) throw new TypeError(`Equipment ${id} necesita type.`);
  if (!(group3D instanceof THREE.Object3D)) {
    throw new TypeError(`Equipment ${id} necesita un group3D de Three.js.`);
  }

  const portMap = new Map();
  ports.forEach((port) => {
    validatePort(port);
    if (portMap.has(port.id)) throw new Error(`Puerto duplicado ${id}.${port.id}.`);
    portMap.set(port.id, Object.freeze({
      id: port.id,
      type: port.type,
      localPosition: asVector3(port.localPosition),
      direction: normalizeDirection(port.direction),
      nominalDiameterM: port.nominalDiameterM,
    }));
  });

  const position = transform.position ?? {};
  group3D.position.set(position.x ?? 0, position.y ?? 0, position.z ?? 0);
  group3D.rotation.y = transform.rotationY ?? 0;
  group3D.name = group3D.name || id;
  group3D.userData.equipmentId = id;
  group3D.updateMatrixWorld(true);

  return {
    id,
    type,
    dimensions: Object.freeze({ ...dimensions }),
    transform: group3D,
    ports: portMap,
    metadata: Object.freeze({ ...metadata }),
    group3D,
  };
}

export class EquipmentRegistry {
  constructor() {
    this.items = new Map();
  }

  add(equipment) {
    if (!equipment?.id) throw new TypeError('Equipo inválido.');
    if (this.items.has(equipment.id)) throw new Error(`Equipment duplicado: ${equipment.id}.`);
    this.items.set(equipment.id, equipment);
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
    equipment.group3D.updateMatrixWorld(true);
    return equipment.group3D.localToWorld(port.localPosition.clone());
  }

  getPortWorldDirection(equipmentId, portId) {
    const equipment = this.getEquipment(equipmentId);
    const port = this.getPort(equipmentId, portId);
    equipment.group3D.updateMatrixWorld(true);
    const rotation = new THREE.Quaternion();
    equipment.group3D.getWorldQuaternion(rotation);
    return port.direction.clone().applyQuaternion(rotation).normalize();
  }
}
