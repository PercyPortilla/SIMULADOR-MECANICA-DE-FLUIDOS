import { createPipingEngine } from './pipingEngine.js';
import { PUMPING_STATION_NOMINAL_DIAMETER_M } from '../equipment/pumpingStation.js';

export const LEACHING_TO_PUMP_CONNECTION = Object.freeze({
  id: 'P-LEACHING-TO-PUMP-01',
  source: Object.freeze({ equipmentId: 'R-04', portId: 'outlet' }),
  target: Object.freeze({ equipmentId: 'PUMP-01', portId: 'suction' }),
});

export function createPumpingStationConnection({ equipmentSystem }) {
  if (!equipmentSystem) throw new TypeError('Pumping station connection requiere equipmentSystem.');
  const engine = createPipingEngine({ equipmentSystem });
  engine.root.name = 'pumping-station-piping';

  const connection = {
    ...LEACHING_TO_PUMP_CONNECTION,
    source: { ...LEACHING_TO_PUMP_CONNECTION.source },
    target: { ...LEACHING_TO_PUMP_CONNECTION.target },
    nominalDiameterM: PUMPING_STATION_NOMINAL_DIAMETER_M,
    waypoints: [],
  };

  const group = engine.renderConnection(connection, { materialName: 'steel' });
  group.userData.process = 'leaching-to-pumping';

  return {
    root: engine.root,
    engine,
    connection,
    group,
    refresh() {
      return engine.renderConnection(connection, { materialName: 'steel' });
    },
    dispose: () => engine.dispose(),
  };
}
