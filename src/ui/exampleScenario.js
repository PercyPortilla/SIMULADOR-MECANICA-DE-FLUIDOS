export const EXAMPLE_SIMULATION_INPUTS = Object.freeze({
  slurry: Object.freeze({
    solidsMassFraction: 0.35,
    solidDensityKgM3: 2650,
    liquidDensityKgM3: 1000,
  }),
  rheology: Object.freeze({
    model: 'bingham',
    yieldStressPa: 4,
    plasticViscosityPaS: 0.05,
  }),
  transport: Object.freeze({
    pipe1: Object.freeze({
      innerDiameterM: 0.15,
      lengthM: 100,
      roughnessM: 0.000045,
      material: 'Acero',
      velocityMps: 1.2,
      minorLossCoefficient: 2,
      elevationChangeM: 5,
    }),
  }),
  energy: Object.freeze({
    pumpEfficiency: 0.78,
    motorEfficiency: 0.92,
    operatingHoursPerYear: 8000,
    electricityPricePerKwh: 0.12,
  }),
  leaching: Object.freeze({
    kineticModel: 'first-order-cstr-series',
    totalUsefulVolumeM3: 360,
    reactorCount: 4,
    firstOrderRateConstantPerH: 0.1,
  }),
  recovery: Object.freeze({
    model: 'stage-efficiency',
    feedGoldKgH: 10,
    adsorptionEfficiency: 0.90,
    elutionEfficiency: 0.80,
    electrowinningEfficiency: 0.95,
    smeltingEfficiency: 0.98,
  }),
});

export function loadExampleSimulation(updateState, resetState = null) {
  resetState?.();
  return updateState(EXAMPLE_SIMULATION_INPUTS);
}
