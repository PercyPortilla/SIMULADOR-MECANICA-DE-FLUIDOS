import * as THREE from 'three';
import { createPipingEngine } from './pipingEngine.js';
import { createIndustrialMaterial } from '../materials/industrialMaterials.js';
import { getProcessRoute, assertRenderableProcessRoute } from '../../process/processRoute.js';

export const RECOVERY_HYDRAULIC_CONNECTIONS = Object.freeze([
  Object.freeze({
    id: 'P-PUMP-01-TO-CIP',
    source: Object.freeze({ equipmentId: 'PUMP-01', portId: 'discharge' }),
    target: Object.freeze({ equipmentId: 'CIP-ADSORPTION', portId: 'inlet' }),
    nominalDiameterM: 0.05,
  }),
  Object.freeze({
    id: 'P-CIP-TO-ELUTION',
    source: Object.freeze({ equipmentId: 'CIP-ADSORPTION', portId: 'outlet' }),
    target: Object.freeze({ equipmentId: 'ELUTION-SKID', portId: 'inlet' }),
    nominalDiameterM: 0.04,
  }),
  Object.freeze({
    id: 'P-ELUTION-TO-EW',
    source: Object.freeze({ equipmentId: 'ELUTION-SKID', portId: 'outlet' }),
    target: Object.freeze({ equipmentId: 'EW-CELLS', portId: 'inlet' }),
    nominalDiameterM: 0.04,
  }),
]);

const DIAMETER_TOLERANCE_M = 1e-9;

export function validateRecoveryConnectionDiameters({ equipmentSystem, definitions = RECOVERY_HYDRAULIC_CONNECTIONS }) {
  if (!equipmentSystem) throw new TypeError('Validación de recovery piping requiere equipmentSystem.');
  return definitions.map((definition) => {
    const source = equipmentSystem.getPort(definition.source.equipmentId, definition.source.portId);
    const target = equipmentSystem.getPort(definition.target.equipmentId, definition.target.portId);
    const values = [source.nominalDiameterM, definition.nominalDiameterM, target.nominalDiameterM];
    if (!values.every((value) => Number.isFinite(value) && value > 0)) {
      throw new RangeError(`${definition.id} contiene un diámetro nominal inválido.`);
    }
    const mismatch = Math.max(...values) - Math.min(...values);
    if (mismatch > DIAMETER_TOLERANCE_M) {
      throw new RangeError(`${definition.id} requiere reducer explícito: ${values.join(' -> ')} m.`);
    }
    return Object.freeze({
      connectionId: definition.id,
      sourceDiameterM: source.nominalDiameterM,
      nominalDiameterM: definition.nominalDiameterM,
      targetDiameterM: target.nominalDiameterM,
      requiresReducer: false,
    });
  });
}

function createProductTransfer({ equipmentSystem }) {
  const start = equipmentSystem.getPortWorldPosition('EW-CELLS', 'productOutlet');
  const end = equipmentSystem.getPortWorldPosition('SMELTING-FURNACE', 'productInlet');
  const direction = end.clone().sub(start);
  const length = direction.length();
  const material = createIndustrialMaterial('structuralSteel', { roughness: 0.5, metalness: 0.55 });
  const transfer = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.12, length), material);
  transfer.name = 'REC-C03-EW-TO-SMELTING-PRODUCT-TRANSFER';
  transfer.position.copy(start).add(end).multiplyScalar(0.5);
  transfer.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), direction.clone().normalize());
  transfer.castShadow = true;
  transfer.userData = {
    connectionId: 'REC-C03',
    transferType: 'solid-product',
    source: ['EW-CELLS', 'productOutlet'],
    target: ['SMELTING-FURNACE', 'productInlet'],
    start: start.toArray(),
    end: end.toArray(),
  };
  return transfer;
}

export function createRecoveryConnections({ equipmentSystem }) {
  if (!equipmentSystem) throw new TypeError('Recovery connections requiere equipmentSystem.');
  const route = assertRenderableProcessRoute(getProcessRoute());
  const diameterValidation = validateRecoveryConnectionDiameters({ equipmentSystem });
  const root = new THREE.Group();
  root.name = 'recovery-process-connections';
  root.userData.processRouteId = route.id;

  const engine = createPipingEngine({ equipmentSystem });
  engine.root.name = 'recovery-hydraulic-piping';
  root.add(engine.root);

  const groups = RECOVERY_HYDRAULIC_CONNECTIONS.map((definition) => {
    let waypoints = [];
    if (definition.id === 'P-PUMP-01-TO-CIP') {
      const start = equipmentSystem.getPortWorldPosition(definition.source.equipmentId, definition.source.portId);
      const end = equipmentSystem.getPortWorldPosition(definition.target.equipmentId, definition.target.portId);
      const rackZ = -52;
      waypoints = [
        new THREE.Vector3(start.x, start.y, rackZ),
        new THREE.Vector3(end.x, start.y, rackZ),
        new THREE.Vector3(end.x, end.y, rackZ),
      ];
    }
    const connection = {
      ...definition,
      source: { ...definition.source },
      target: { ...definition.target },
      waypoints,
    };
    const group = engine.renderConnection(connection, { materialName: 'steel' });
    group.userData.recoveryRouteId = route.id;
    return group;
  });

  const productTransfer = createProductTransfer({ equipmentSystem });
  root.add(productTransfer);
  root.updateMatrixWorld(true);

  return {
    root,
    engine,
    groups,
    productTransfer,
    route,
    diameterValidation,
    dispose: () => engine.dispose(),
  };
}
