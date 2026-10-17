import * as THREE from 'three';
import { assertRenderableProcessRoute, getProcessRoute } from '../../process/processRoute.js';
import { getZoneTransform } from '../layout/plantLayout.js';
import { getIndustrialPad, INDUSTRIAL_PAD_THICKNESS } from '../environment/industrialPads.js';
import {
  createCipAdsorptionTrain,
  createElutionSkid,
  createElectrowinningCells,
  createSmeltingFurnace,
} from './recoveryEquipment.js';

export const RECOVERY_EQUIPMENT_IDS = Object.freeze([
  'CIP-ADSORPTION',
  'ELUTION-SKID',
  'EW-CELLS',
  'SMELTING-FURNACE',
]);

export function createRecoveryPlantEquipment() {
  const route = assertRenderableProcessRoute(getProcessRoute());
  const zone = getZoneTransform('Z8');
  // Recovery is placed on the integrated Z8 foundation in the active layout.
  // The reusable legacy factory still needs a finite base elevation when it is
  // exercised directly by unit tests, so fall back to the authoritative zone
  // transform instead of dereferencing a removed standalone pad.
  const pad = getIndustrialPad('recovery') ?? {
    elevation: zone.position.y,
  };
  const baseY = pad.elevation + INDUSTRIAL_PAD_THICKNESS;
  const root = new THREE.Group();
  root.name = 'recovery-plant-equipment';
  root.userData.processRouteId = route.id;

  const equipment = [
    createCipAdsorptionTrain({
      position: { x: zone.position.x - 25.0, y: baseY, z: zone.position.z },
      rotationY: zone.rotationY,
    }),
    createElutionSkid({
      position: { x: zone.position.x - 8.0, y: baseY, z: zone.position.z },
      rotationY: zone.rotationY,
    }),
    createElectrowinningCells({
      position: { x: zone.position.x + 10.0, y: baseY, z: zone.position.z },
      rotationY: zone.rotationY,
    }),
    createSmeltingFurnace({
      position: { x: zone.position.x + 28.0, y: baseY, z: zone.position.z },
      rotationY: zone.rotationY,
    }),
  ];

  equipment.forEach((item) => root.add(item.group3D));
  root.updateMatrixWorld(true);
  return { root, equipment, route, baseY };
}
