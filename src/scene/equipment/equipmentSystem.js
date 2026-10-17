import * as THREE from 'three';
import { EquipmentRegistry } from './equipmentRegistry.js';
import { createLeachingTrainEquipment } from './leachingTrain.js';
import { getZoneTransform } from '../layout/plantLayout.js';
import { createGrindingMill, createGenericClassifier } from './grindingClassification.js';
import { createPumpingStationEquipment } from './pumpingStation.js';
import { createRecoveryPlantEquipment } from './recoveryPlant.js';

export function createEquipmentSystem() {
  const root = new THREE.Group();
  root.name = 'plant-equipment';
  const registry = new EquipmentRegistry();

  const leachingTrain = createLeachingTrainEquipment();
  leachingTrain.reactors.forEach((reactor) => registry.add(reactor));
  root.add(leachingTrain.group);

  const grindingZone = getZoneTransform('Z4');
  const mill = createGrindingMill({
    id: 'MILL-01',
    position: { x: grindingZone.position.x, y: grindingZone.position.y + 0.1, z: grindingZone.position.z },
    rotationY: grindingZone.rotationY,
  });
  registry.add(mill);
  root.add(mill.group3D);

  const classificationZone = getZoneTransform('Z5');
  const classifier = createGenericClassifier({
    id: 'CLASS-01',
    position: { x: classificationZone.position.x, y: classificationZone.position.y + 0.1, z: classificationZone.position.z },
    rotationY: classificationZone.rotationY,
  });
  registry.add(classifier);
  root.add(classifier.group3D);

  const pumpingStation = createPumpingStationEquipment();
  pumpingStation.pumps.forEach((pump) => {
    registry.add(pump);
    root.add(pump.group3D);
  });

  const recoveryPlant = createRecoveryPlantEquipment();
  recoveryPlant.equipment.forEach((item) => registry.add(item));
  root.add(recoveryPlant.root);

  root.updateMatrixWorld(true);

  return {
    root,
    registry,
    leachingTrain,
    pumpingStation,
    recoveryPlant,
    getEquipment: (id) => registry.getEquipment(id),
    getPort: (equipmentId, portId) => registry.getPort(equipmentId, portId),
    getPortWorldPosition: (equipmentId, portId) => registry.getPortWorldPosition(equipmentId, portId),
    getPortWorldDirection: (equipmentId, portId) => registry.getPortWorldDirection(equipmentId, portId),
  };
}
