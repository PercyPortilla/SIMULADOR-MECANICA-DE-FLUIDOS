import { createPipingEngine } from './pipingEngine.js';

export function createGrindingClassificationConnection({ equipmentSystem }) {
  if (!equipmentSystem) throw new TypeError('Grinding/classification piping requiere equipmentSystem.');
  const engine = createPipingEngine({ equipmentSystem });
  engine.root.name = 'grinding-classification-piping';
  const connection = {
    id: 'P-GRINDING-TO-CLASSIFICATION',
    source: { equipmentId: 'MILL-01', portId: 'discharge' },
    target: { equipmentId: 'CLASS-01', portId: 'inlet' },
    nominalDiameterM: 0.20,
    waypoints: [],
  };
  const group = engine.renderConnection(connection, { materialName: 'steel' });
  group.userData.processAssumption = 'visual-transfer-only';
  return { root: engine.root, engine, connection, group };
}
