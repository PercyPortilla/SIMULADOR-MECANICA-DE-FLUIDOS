import { beforeEach, describe, expect, it } from 'vitest';
import { getResults } from '../../src/controller/simulationController.js';
import { resetState, updateState } from '../../src/state/simulationState.js';

describe('legacy simulator regression case', () => {
  beforeEach(() => resetState());

  it('reproduces the documented HB operating point within engineering tolerances', () => {
    updateState({
      slurry: {
        solidsMassFraction: 0.35,
        solidDensityKgM3: 4200,
        liquidDensityKgM3: 1000,
        referenceSolidsMassFraction: 0.35,
        temperatureC: 25,
        referenceTemperatureC: 25,
      },
      rheology: {
        model: 'hb',
        yieldStressPa: 20,
        consistencyIndex: 0.8,
        flowIndex: 0.55,
        concentrationExponent: 2,
        empiricalScalingEnabled: false,
      },
      transport: {
        settlingFactorFl: 1.34,
        pipe1: {
          innerDiameterM: 0.15,
          lengthM: 100,
          velocityMps: 1.5,
          roughnessM: 0.000046,
          minorLossCoefficient: 0,
          elevationChangeM: 0,
          accessories: {
            valvesCount: 1, valveK: 0.2,
            elbowsCount: 2, elbowK: 0.9,
            teesCount: 0, teeK: 1.8,
            reducersCount: 1, reducerK: 0.4,
            otherK: 0,
          },
        },
      },
      energy: {
        pumpEfficiency: 0.75,
        motorEfficiency: 1,
        operatingHoursPerYear: 8000,
        electricityPricePerKwh: 0.12,
      },
      process: { tankDischargeM3h: 95.43, tankVolumeM3: 50, balanceToleranceFraction: 0.05 },
      leaching: { temperatureC: 25, ph: 2, feedGradeGL: 5 },
    });

    const results = getResults();
    expect(results.transport.flowRateM3s * 3600).toBeCloseTo(95.426, 2);
    expect(results.slurry.densityKgM3).toBeCloseTo(1363.6, 1);
    expect(results.rheology.wallStressPa).toBeCloseTo(33.60542, 4);
    expect(results.rheology.reynoldsStar).toBeCloseTo(730.4, 0);
    expect(results.transport.distributedPressureDropPa / 1000).toBeCloseTo(89.614, 2);
    expect(results.transport.minorLossPressurePa / 1000).toBeCloseTo(3.682, 2);
    expect(results.transport.pressureDropPa / 1000).toBeCloseTo(93.296, 2);
    expect(results.energy.hydraulicPowerW / 1000).toBeCloseTo(2.473, 2);
    expect(results.energy.electricalPowerW / 1000).toBeCloseTo(3.297, 2);
    expect(results.energy.annualEnergyKwh).toBeCloseTo(26378.9, 0);
    expect(results.energy.annualEnergyCost).toBeCloseTo(3165.47, 0);
    expect(results.transport.settling.criticalVelocityMps).toBeCloseTo(4.11, 2);
    expect(results.balance.continuity.withinTolerance).toBe(true);
  });
});
