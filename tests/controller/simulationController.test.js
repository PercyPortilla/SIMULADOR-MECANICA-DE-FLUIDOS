import { beforeEach, describe, expect, it } from 'vitest';
import { getResults } from '../../src/controller/simulationController.js';
import { resetState, updateState } from '../../src/state/simulationState.js';

describe('simulationController', () => {
  beforeEach(() => resetState());

  it('recalcula resultados derivados cuando cambia el estado', () => {
    updateState({
      slurry: {
        solidsMassFraction: 0.35,
        solidDensityKgM3: 2650,
        liquidDensityKgM3: 1000,
      },
      transport: { pipe1: { innerDiameterM: 0.15, velocityMps: 1.5 } },
    });

    expect(getResults().slurry.densityKgM3).toBeCloseTo(1278.6489746683, 10);
    expect(getResults().transport.flowRateM3s).toBeCloseTo(0.026507188, 9);
  });

  it('mantiene resultados derivados separados del estado de entrada', () => {
    const results = getResults();
    results.slurry = { densityKgM3: 999 };
    expect(getResults().slurry).toBeUndefined();
  });

  it('clasifica el caso Bingham de transición y conserva el perfil laminar equivalente', () => {
    updateState({
      slurry: {
        solidsMassFraction: 0.35,
        solidDensityKgM3: 2650,
        liquidDensityKgM3: 1000,
      },
      rheology: {
        model: 'bingham',
        yieldStressPa: 4,
        plasticViscosityPaS: 0.05,
      },
      transport: {
        pipe1: {
          innerDiameterM: 0.15,
          lengthM: 100,
          velocityMps: 1.7819878125,
        },
      },
    });

    const results = getResults();
    expect(results.rheology.wallStressPa).toBeCloseTo(10, 6);
    expect(results.rheology.profile.radiusM.length).toBeGreaterThan(10);
    expect(results.rheology.profile.radiusM.length).toBe(results.rheology.profile.velocityMps.length);
    expect(results.rheology.profile.velocityMps.at(-1)).toBeCloseTo(0, 12);
    expect(results.transport.flowRegime).toBe('transition');
    const expectedDistributed = results.transport.frictionFactor
      * (100 / 0.15)
      * results.slurry.densityKgM3
      * 1.7819878125 ** 2 / 2;
    expect(results.transport.distributedPressureDropPa).toBeCloseTo(expectedDistributed, 8);
    expect(results.transport.frictionFactor).toBeCloseTo(4 * results.transport.fanningFrictionFactor, 12);
    expect(results.rheology.hydraulicWallStressPa).toBeCloseTo(
      results.transport.fanningFrictionFactor * results.slurry.densityKgM3 * 1.7819878125 ** 2 / 2,
      10,
    );
    expect(results.rheology.equivalentLaminarWallStressPa).toBeCloseTo(10, 6);
    expect(results.rheology.hydraulicWallStressPa).not.toBeCloseTo(results.rheology.equivalentLaminarWallStressPa, 3);
    expect(results.transport.calculationMode).toBe('non-newtonian-educational-transition');
    expect(results.transport.resultQuality).toBe('educational-estimate');
    expect(results.transport.modelStatus).toContain('equivalente laminar');
  });

  it.each([
    ['Bingham laminar', 'bingham', { yieldStressPa: 4, plasticViscosityPaS: 0.05 }, 1.0, 'laminar'],
    ['Bingham transición', 'bingham', { yieldStressPa: 4, plasticViscosityPaS: 0.05 }, 1.5, 'transition'],
    ['Bingham turbulento', 'bingham', { yieldStressPa: 4, plasticViscosityPaS: 0.05 }, 2.5, 'turbulent'],
    ['HB laminar', 'hb', { yieldStressPa: 4, consistencyIndex: 0.2, flowIndex: 0.7 }, 1.0, 'laminar'],
    ['HB transición', 'hb', { yieldStressPa: 4, consistencyIndex: 0.2, flowIndex: 0.7 }, 1.5, 'transition'],
    ['HB turbulento', 'hb', { yieldStressPa: 4, consistencyIndex: 0.2, flowIndex: 0.7 }, 2.5, 'turbulent'],
  ])('%s mantiene coherencia Darcy/Fanning/ΔP', (_label, model, rheology, velocityMps, expectedRegime) => {
    updateState({
      slurry: { solidsMassFraction: 0.35, solidDensityKgM3: 2650, liquidDensityKgM3: 1000 },
      rheology: { model, ...rheology },
      transport: { pipe1: { innerDiameterM: 0.15, lengthM: 100, velocityMps } },
    });
    const results = getResults();
    const expectedDistributed = results.transport.frictionFactor
      * (100 / 0.15)
      * results.slurry.densityKgM3
      * velocityMps ** 2 / 2;
    const expectedHydraulicWallStress = results.transport.fanningFrictionFactor
      * results.slurry.densityKgM3
      * velocityMps ** 2 / 2;

    expect(results.transport.flowRegime).toBe(expectedRegime);
    expect(results.transport.reynoldsKind).toBe('generalized-metzner-reed');
    expect(results.transport.frictionFactor).toBeCloseTo(4 * results.transport.fanningFrictionFactor, 12);
    expect(results.transport.distributedPressureDropPa).toBeCloseTo(expectedDistributed, 8);
    expect(results.rheology.hydraulicWallStressPa).toBeCloseTo(expectedHydraulicWallStress, 10);
    expect(results.transport.distributedPressureDropPa).toBeCloseTo(
      4 * results.rheology.hydraulicWallStressPa * 100 / 0.15,
      8,
    );
    if (expectedRegime === 'laminar') {
      expect(results.rheology.hydraulicWallStressPa).toBeCloseTo(results.rheology.equivalentLaminarWallStressPa, 8);
    }
  });

  it('no inventa ΔP cuando faltan parámetros reológicos válidos', () => {
    updateState({
      rheology: { model: 'hb', yieldStressPa: 4, consistencyIndex: 0, flowIndex: 0.7 },
      transport: { pipe1: { innerDiameterM: 0.15, lengthM: 100, velocityMps: 1.5 } },
    });
    expect(getResults().transport.flowRateM3s).toBeGreaterThan(0);
    expect(getResults().transport.pressureDropPa).toBeUndefined();
    expect(getResults().rheology).toBeUndefined();
  });

  it('resuelve hidráulica Newtoniana con Darcy/Colebrook y términos local/estático', () => {
    updateState({
      slurry: { solidsMassFraction: 0, solidDensityKgM3: 2650, liquidDensityKgM3: 1000 },
      rheology: { model: 'newtonian', newtonianViscosityPaS: 0.001 },
      transport: { pipe1: {
        innerDiameterM: 0.1,
        lengthM: 100,
        roughnessM: 0.0001,
        velocityMps: 1,
        minorLossCoefficient: 2,
        elevationChangeM: 5,
      } },
    });
    const results = getResults();
    expect(results.transport.reynoldsNumber).toBe(100000);
    expect(results.transport.flowRegime).toBe('turbulent');
    expect(results.transport.frictionFactor).toBeGreaterThan(0);
    expect(results.transport.distributedPressureDropPa).toBeGreaterThan(0);
    expect(results.transport.minorLossPressurePa).toBe(1000);
    expect(results.transport.staticPressurePa).toBeCloseTo(49033.25, 5);
    expect(results.transport.pressureDropPa).toBeGreaterThan(results.transport.staticPressurePa);
  });

  it('resuelve el régimen Newtoniano transicional con Churchill', () => {
    updateState({
      slurry: { solidsMassFraction: 0, solidDensityKgM3: 2650, liquidDensityKgM3: 1000 },
      rheology: { model: 'newtonian', newtonianViscosityPaS: 0.001 },
      transport: { pipe1: { innerDiameterM: 0.1, lengthM: 10, velocityMps: 0.03 } },
    });
    const results = getResults();
    expect(results.transport.reynoldsNumber).toBe(3000);
    expect(results.transport.flowRegime).toBe('transition');
    expect(results.transport.frictionFactor).toBeGreaterThan(0);
    expect(results.transport.pressureDropPa).toBeGreaterThan(0);
    expect(results.transport.calculationMode).toBe('newtonian-churchill-transition');
  });

  it('reproduce el benchmark HB histórico y expone Re*, n prima y sonda completa', () => {
    updateState({
      slurry: { solidsMassFraction: 0.35, solidDensityKgM3: 4200, liquidDensityKgM3: 1000 },
      rheology: { model: 'hb', yieldStressPa: 20, consistencyIndex: 0.8, flowIndex: 0.55 },
      transport: { pipe1: { innerDiameterM: 0.15, lengthM: 100, velocityMps: 1.5 } },
    });
    const results = getResults();
    expect(results.slurry.densityKgM3).toBeCloseTo(1363.6363636, 6);
    expect(results.transport.flowRateM3s * 3600).toBeCloseTo(95.4259, 3);
    expect(results.rheology.wallStressPa).toBeCloseTo(33.60542, 5);
    expect(results.rheology.nPrime).toBeGreaterThan(0);
    expect(results.rheology.reynoldsStar).toBeGreaterThan(0);
    expect(results.rheology.profile.shearStressPa.length).toBe(results.rheology.profile.radiusM.length);
    expect(results.rheology.profile.shearRateS_1.length).toBe(results.rheology.profile.radiusM.length);
    expect(results.rheology.profile.apparentViscosityPaS[0]).toBeNull();
  });

  it('resuelve un circuito Newtoniano de varios tramos conservando caudal', () => {
    updateState({
      slurry: { solidsMassFraction: 0, solidDensityKgM3: 2650, liquidDensityKgM3: 1000 },
      rheology: { model: 'newtonian', newtonianViscosityPaS: 0.001 },
      transport: {
        pipe1: { innerDiameterM: 0.2, velocityMps: 1 },
        segments: [
          { id: 'A', innerDiameterM: 0.2, lengthM: 50, roughnessM: 0.00005, material: 'Acero', elevationChangeM: 2, minorLossCoefficient: 0, accessories: { valvesCount: 1, valveK: 0.2, elbowsCount: 1, elbowK: 0.9, teesCount: 0, teeK: 1.8, reducersCount: 0, reducerK: 0.4, otherK: 0 } },
          { id: 'B', innerDiameterM: 0.1, lengthM: 25, roughnessM: 0.00005, material: 'Acero', elevationChangeM: -1, minorLossCoefficient: 0, accessories: { valvesCount: 0, valveK: 0.2, elbowsCount: 0, elbowK: 0.9, teesCount: 0, teeK: 1.8, reducersCount: 1, reducerK: 0.4, otherK: 0 } },
        ],
      },
    });
    const results = getResults();
    expect(results.transport.segments).toHaveLength(2);
    expect(results.transport.segments[1].velocityMps).toBeCloseTo(4, 10);
    expect(results.transport.minorLossPressurePa).toBeGreaterThan(0);
    expect(results.transport.staticPressurePa).toBeCloseTo(1000 * 9.80665, 5);
    expect(results.transport.calculationMode).toBe('multi-segment-newtonian');
  });

  it('reproduce el indicador de asentamiento legado y lo marca como orientativo', () => {
    updateState({
      slurry: {
        solidsMassFraction: 0.35,
        solidDensityKgM3: 4200,
        liquidDensityKgM3: 1000,
        d50M: 0.0001,
      },
      rheology: { model: 'hb', yieldStressPa: 20, consistencyIndex: 0.8, flowIndex: 0.55 },
      transport: {
        settlingFactorFl: 1.34,
        pipe1: { innerDiameterM: 0.15, lengthM: 100, velocityMps: 1.5 },
      },
    });
    const settling = getResults().transport.settling;
    expect(settling.criticalVelocityMps).toBeCloseTo(4.11, 2);
    expect(settling.velocityRatio).toBeLessThan(1);
    expect(settling.status).toBe('risk');
    expect(settling.granulometryAvailable).toBe(true);
    expect(settling.granulometryUsed).toBe(false);
    expect(settling.note).toContain('No se aplica una correlación granulométrica adicional');
  });

  it('resuelve una curva H-Q tabulada y evalúa eficiencia/NPSH sin extrapolar', () => {
    updateState({
      slurry: { solidsMassFraction: 0, solidDensityKgM3: 2650, liquidDensityKgM3: 1000 },
      rheology: { model: 'newtonian', newtonianViscosityPaS: 0.001 },
      transport: { pipe1: { innerDiameterM: 0.1, lengthM: 80, roughnessM: 0.00005, velocityMps: 1, elevationChangeM: 4 } },
      energy: {
        pumpEfficiency: 0.75,
        motorEfficiency: 0.92,
        pumpCurve: [
          { flowRateM3s: 0, headM: 60 }, { flowRateM3s: 0.02, headM: 48 }, { flowRateM3s: 0.04, headM: 22 },
        ],
        efficiencyCurve: [
          { flowRateM3s: 0, efficiency: 0.5 }, { flowRateM3s: 0.02, efficiency: 0.82 }, { flowRateM3s: 0.04, efficiency: 0.7 },
        ],
        npshrCurve: [
          { flowRateM3s: 0, npshM: 1.5 }, { flowRateM3s: 0.02, npshM: 2.5 }, { flowRateM3s: 0.04, npshM: 4.5 },
        ],
      },
    });
    const pump = getResults().pump;
    expect(pump.status).toBe('unique');
    expect(pump.operatingPoint.flowRateM3s).toBeGreaterThan(0);
    expect(pump.operatingPoint.flowRateM3s).toBeLessThanOrEqual(0.04);
    expect(pump.pumpEfficiency).toBeGreaterThan(0);
    expect(pump.npsh.availableNpshM).toBeGreaterThan(0);
    expect(pump.extrapolated).toBe(false);
  });

  it('calcula balance de sólidos/agua y continuidad contra descarga de tanque', () => {
    updateState({
      slurry: { solidsMassFraction: 0.35, solidDensityKgM3: 4200, liquidDensityKgM3: 1000 },
      rheology: { model: 'hb', yieldStressPa: 20, consistencyIndex: 0.8, flowIndex: 0.55 },
      transport: { pipe1: { innerDiameterM: 0.15, lengthM: 100, velocityMps: 1.5 } },
      process: { tankDischargeM3h: 95.43, balanceToleranceFraction: 0.05 },
    });
    const results = getResults();
    expect(results.balance.solidsMassFlowTh).toBeGreaterThan(0);
    expect(results.balance.liquidVolumetricFlowM3h).toBeGreaterThan(0);
    expect(results.balance.continuity.relativeDifference).toBeLessThan(0.001);
    expect(results.balance.continuity.withinTolerance).toBe(true);
    expect(results.balance.continuity.tankLevelIntegrated).toBe(false);
  });

  it('deriva potencia, residencia/CSTR y recuperación solo desde inputs explícitos', () => {
    updateState({
      slurry: { solidsMassFraction: 0, solidDensityKgM3: 2650, liquidDensityKgM3: 1000 },
      rheology: { model: 'newtonian', newtonianViscosityPaS: 0.001 },
      transport: { pipe1: { innerDiameterM: 0.1, lengthM: 100, velocityMps: 1 } },
      energy: { pumpEfficiency: 0.8, motorEfficiency: 0.9, operatingHoursPerYear: 1000, electricityPricePerKwh: 0.12 },
      leaching: { kineticModel: 'first-order-cstr-series', totalUsefulVolumeM3: 360, reactorCount: 4, firstOrderRateConstantPerH: 0.1 },
      recovery: {
        model: 'stage-efficiency',
        feedGoldKgH: 10,
        adsorptionEfficiency: 0.9,
        elutionEfficiency: 0.8,
        electrowinningEfficiency: 0.95,
        smeltingEfficiency: 0.98,
      },
    });
    const results = getResults();
    expect(results.energy.electricalPowerW).toBeGreaterThan(0);
    expect(results.leaching.residenceTimeH).toBeGreaterThan(0);
    expect(results.leaching.conversion).toBeGreaterThan(0);
    expect(results.recovery.overallRecovery).toBeCloseTo(0.9 * 0.8 * 0.95 * 0.98, 12);
  });
});
