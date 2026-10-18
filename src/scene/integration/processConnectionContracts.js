function connection(value) {
  return Object.freeze({
    ...value,
    source: Object.freeze([...value.source]),
    target: Object.freeze([...value.target]),
    corridor: Object.freeze({ ...(value.corridor ?? {}) }),
  });
}

export const PROCESS_PIPE_CONNECTIONS = Object.freeze([
  connection({ id: 'P-MILL-TO-SUMP', source: ['MILL-01', 'slurryOut'], target: ['SUMP-01', 'inlet'], diameter: 0.40, kind: 'slurry', corridor: { z: -12, clearance: 1.6 }, supportPolicy: 'local' }),
  connection({ id: 'P-SUMP-TO-PUMP', source: ['SUMP-01', 'outlet'], target: ['SLURRY-PUMP-01', 'suction'], diameter: 0.30, kind: 'slurry', corridor: { z: -11, clearance: 1.3 }, supportPolicy: 'local' }),
  connection({ id: 'P-PUMP-TO-CYCLONES', source: ['SLURRY-PUMP-01', 'discharge'], target: ['CLASS-01', 'feed'], diameter: 0.25, kind: 'slurry', corridor: { z: -12, clearance: 2.5 }, supportPolicy: 'trestle' }),
  connection({ id: 'P-CYCLONE-UNDERFLOW-RETURN', source: ['CLASS-01', 'underflow'], target: ['MILL-01', 'feedIn'], diameter: 0.26, kind: 'underflow', corridor: { z: -18, clearance: 1.6 }, supportPolicy: 'trestle' }),
  connection({ id: 'P-CLASSIFICATION-TO-LEACH', source: ['CLASS-01', 'overflow'], target: ['R-01', 'feedIn'], diameter: 0.22, kind: 'overflow', corridor: { z: 10, clearance: 2.1 }, supportPolicy: 'rack' }),
  connection({ id: 'P-LEACH-R01-R02', source: ['R-01', 'overflowOut'], target: ['R-02', 'feedIn'], diameter: 0.25, kind: 'interstage', corridor: { clearance: 0.15 }, supportPolicy: 'none' }),
  connection({ id: 'P-LEACH-R02-R03', source: ['R-02', 'overflowOut'], target: ['R-03', 'feedIn'], diameter: 0.25, kind: 'interstage', corridor: { clearance: 0.15 }, supportPolicy: 'none' }),
  connection({ id: 'P-LEACH-R03-R04', source: ['R-03', 'overflowOut'], target: ['R-04', 'feedIn'], diameter: 0.25, kind: 'interstage', corridor: { clearance: 0.15 }, supportPolicy: 'none' }),
  connection({ id: 'P-LEACHING-TO-PUMP-01', source: ['R-04', 'overflowOut'], target: ['PUMP-01', 'suction'], diameter: 0.25, kind: 'slurry', corridor: { slopedApproach: true }, supportPolicy: 'trestle' }),
  connection({ id: 'P-PUMP-01-TO-CIP', source: ['PUMP-01', 'discharge'], target: ['CIP-ADSORPTION', 'feed'], diameter: 0.22, kind: 'slurry', corridor: { z: -62, clearance: 2.4 }, supportPolicy: 'rack' }),
  connection({ id: 'P-ELUTION-TO-EW', source: ['ELUTION-SKID', 'pregnantSolutionOut'], target: ['EW-CELLS', 'electrolyteIn'], diameter: 0.10, kind: 'solution', corridor: { z: -82, clearance: 1.8 }, supportPolicy: 'local' }),
]);

export const PROCESS_SOLID_TRANSFERS = Object.freeze([
  connection({ id: 'MT-CIP-TO-ELUTION-CARBON', source: ['CIP-ADSORPTION', 'loadedCarbonOut'], target: ['ELUTION-SKID', 'loadedCarbonIn'], width: 0.22, color: 0x403a32, kind: 'loaded-carbon' }),
  connection({ id: 'MT-ELUTION-TO-CIP-BARREN-CARBON', source: ['ELUTION-SKID', 'barrenCarbonOut'], target: ['CIP-ADSORPTION', 'barrenCarbonIn'], width: 0.18, color: 0x585248, kind: 'barren-carbon' }),
  connection({ id: 'MT-EW-TO-SMELTING-CATHODE', source: ['EW-CELLS', 'cathodeOut'], target: ['SMELTING-FURNACE', 'feed'], width: 0.42, color: 0xb7a06d, kind: 'cathode' }),
]);

export function getProcessPipeConnection(id) {
  return PROCESS_PIPE_CONNECTIONS.find((item) => item.id === id) ?? null;
}
