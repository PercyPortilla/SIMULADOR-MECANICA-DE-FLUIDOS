import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getResults } from '../src/controller/simulationController.js';
import { getState, resetState, updateState } from '../src/state/simulationState.js';
import { buildSimulationMemo, simulationMemoToCsv, simulationMemoToPrintableHtml } from '../src/reporting/simulationMemo.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'outputs');
fs.mkdirSync(out, { recursive: true });

resetState();
updateState({
  slurry: { solidsMassFraction: 0.35, solidDensityKgM3: 4200, liquidDensityKgM3: 1000, referenceSolidsMassFraction: 0.35, temperatureC: 25, referenceTemperatureC: 25 },
  rheology: { model: 'hb', yieldStressPa: 20, consistencyIndex: 0.8, flowIndex: 0.55, concentrationExponent: 2, empiricalScalingEnabled: false },
  transport: {
    settlingFactorFl: 1.34,
    pipe1: {
      innerDiameterM: 0.15, lengthM: 100, velocityMps: 1.5, roughnessM: 0.000046, minorLossCoefficient: 0, elevationChangeM: 0,
      accessories: { valvesCount: 1, valveK: 0.2, elbowsCount: 2, elbowK: 0.9, teesCount: 0, teeK: 1.8, reducersCount: 1, reducerK: 0.4, otherK: 0 },
    },
  },
  energy: { pumpEfficiency: 0.75, motorEfficiency: 1, operatingHoursPerYear: 8000, electricityPricePerKwh: 0.12 },
  process: { tankDischargeM3h: 95.43, tankVolumeM3: 50, balanceToleranceFraction: 0.05 },
  leaching: { kineticModel: 'first-order-cstr-series', totalUsefulVolumeM3: 50, reactorCount: 4, firstOrderRateConstantPerH: 0.1, temperatureC: 25, ph: 2, feedGradeGL: 5 },
  recovery: { model: 'stage-efficiency', feedGoldKgH: 10, adsorptionEfficiency: 0.9, elutionEfficiency: 0.8, electrowinningEfficiency: 0.95, smeltingEfficiency: 0.98 },
});

const state = getState();
const results = getResults();
const memo = buildSimulationMemo({ state, results, scenarioName: 'Regresión HB 35%' });
fs.writeFileSync(path.join(out, 'pulpa-memoria-final.csv'), simulationMemoToCsv(memo), 'utf8');
fs.writeFileSync(path.join(out, 'pulpa-memoria-final.html'), simulationMemoToPrintableHtml(memo, { autoPrint: false }), 'utf8');
fs.writeFileSync(path.join(out, 'pulpa-resultados-final.json'), JSON.stringify({ state, results }, null, 2), 'utf8');
console.log(JSON.stringify({
  csv: path.join(out, 'pulpa-memoria-final.csv'),
  html: path.join(out, 'pulpa-memoria-final.html'),
  json: path.join(out, 'pulpa-resultados-final.json'),
  pressureKpa: results.transport?.pressureDropPa / 1000,
  electricalKw: results.energy?.electricalPowerW / 1000,
}));
