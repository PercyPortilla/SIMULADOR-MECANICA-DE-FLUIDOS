import { createPipingEngine } from './pipingEngine.js';
import { LEACHING_TRAIN_NOMINAL_PIPE_DIAMETER_M } from '../equipment/leachingTrain.js';

const CONNECTIONS = Object.freeze([
  Object.freeze({
    id: 'P-LEACH-R02-R03',
    source: Object.freeze({ equipmentId: 'R-02', portId: 'outlet' }),
    target: Object.freeze({ equipmentId: 'R-03', portId: 'inlet' }),
  }),
  Object.freeze({
    id: 'P-LEACH-R03-R04',
    source: Object.freeze({ equipmentId: 'R-03', portId: 'outlet' }),
    target: Object.freeze({ equipmentId: 'R-04', portId: 'inlet' }),
  }),
]);

export function createLeachingTrainPiping({ equipmentSystem }) {
  if (!equipmentSystem) throw new TypeError('Leaching train piping requiere equipmentSystem.');
  const engine = createPipingEngine({ equipmentSystem });
  engine.root.name = 'leaching-train-piping';

  const groups = [];

  function refresh() {
    const nextGroups = CONNECTIONS.map((definition) => {
      const connection = {
        ...definition,
        source: { ...definition.source },
        target: { ...definition.target },
        nominalDiameterM: LEACHING_TRAIN_NOMINAL_PIPE_DIAMETER_M,
        waypoints: [],
      };
      const group = engine.renderConnection(connection, { materialName: 'steel' });
      group.userData.process = 'leaching-interstage';
      return group;
    });
    groups.splice(0, groups.length, ...nextGroups);
    return groups;
  }

  refresh();
  return {
    root: engine.root,
    engine,
    connections: CONNECTIONS,
    groups,
    refresh,
    dispose: () => engine.dispose(),
  };
}
