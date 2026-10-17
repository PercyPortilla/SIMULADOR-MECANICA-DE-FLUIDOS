import { getState, subscribe as subscribeState } from '../state/simulationState.js';
import {
  calculateMixtureDensity,
  calculateSolidVolumeFraction,
} from '../core/slurry/index.js';
import {
  calculateDarcyFrictionFactor,
  calculateChurchillDarcyFrictionFactor,
  calculateDarcyWeisbachPressureDrop,
  calculateLaminarPressureDrop,
  calculateMinorLossPressureDrop,
  calculatePipeFlowRate,
  calculatePressureHead,
  calculatePressureProfile,
  calculateReynoldsNumber,
  calculateStaticPressureChange,
  classifyNewtonianRegime,
  calculateLocalMetznerReedParameters,
  calculateLegacyDurandCriticalVelocity,
  calculateNonNewtonianFrictionFactor,
  buildCircuitHydraulicInputs,
  calculateAccessoryCoefficient,
  assessNpsh,
  calculateNpshAvailable,
  interpolateTabulatedCurve,
  sampleTabulatedPumpSystemCurves,
  solveTabulatedPumpSystemOperatingPoint,
} from '../core/hydraulics/index.js';
import { calculateEmpiricalRheologyScale, solveWallStressForMeanVelocity } from '../core/rheology/index.js';
import { calculatePumpEnergy } from '../core/energy/index.js';
import {
  calculateCstrSeriesStages,
  calculateCstrsInSeriesConversion,
  calculateEmpiricalLeachingRateConstant,
  calculateResidenceTimeHours,
} from '../core/leaching/index.js';
import { calculateStageEfficiencyBalance } from '../core/recovery/index.js';

let derivedResults = calculateSimulationResults(getState());
const listeners = new Set();

function getRheologyParameters(rheology) {
  if (rheology.model === 'hb') {
    if (rheology.consistencyIndex <= 0 || rheology.flowIndex <= 0) return null;
    return {
      yieldStressPa: rheology.yieldStressPa,
      consistencyIndex: rheology.consistencyIndex,
      flowIndex: rheology.flowIndex,
    };
  }
  if (rheology.model === 'bingham') {
    if (rheology.plasticViscosityPaS <= 0) return null;
    return {
      yieldStressPa: rheology.yieldStressPa,
      plasticViscosityPaS: rheology.plasticViscosityPaS,
    };
  }
  if (rheology.model === 'power') {
    if (rheology.consistencyIndex <= 0 || rheology.flowIndex <= 0) return null;
    return {
      consistencyIndex: rheology.consistencyIndex,
      flowIndex: rheology.flowIndex,
    };
  }
  if (rheology.model === 'casson') {
    if (rheology.cassonViscosityPaS <= 0) return null;
    return {
      yieldStressPa: rheology.yieldStressPa,
      cassonViscosityPaS: rheology.cassonViscosityPaS,
    };
  }
  return null;
}

function calculateAuxiliaryHydraulics({ pipe, densityKgM3 }) {
  if (!densityKgM3) return { minorLossPressurePa: 0, staticPressurePa: 0 };
  const accessories = calculateAccessoryCoefficient(pipe.accessories, pipe.minorLossCoefficient);
  return {
    minorLossPressurePa: calculateMinorLossPressureDrop({
      lossCoefficient: accessories.totalK,
      densityKgM3,
      velocityMps: pipe.velocityMps,
    }),
    staticPressurePa: calculateStaticPressureChange({
      densityKgM3,
      elevationChangeM: pipe.elevationChangeM,
    }),
    totalK: accessories.totalK,
    accessoryBreakdown: accessories.breakdown,
  };
}

function finalizeHydraulicResults({ results, pipe, densityKgM3, distributedPressureDropPa, mode }) {
  if (!densityKgM3 && (pipe.minorLossCoefficient > 0 || pipe.elevationChangeM !== 0)) {
    results.transport.distributedPressureDropPa = distributedPressureDropPa;
    results.transport.frictionGradientPaM = distributedPressureDropPa / pipe.lengthM;
    results.transport.calculationMode = mode;
    results.transport.modelStatus = `${results.transport.modelStatus ? `${results.transport.modelStatus} ` : ''}Falta densidad para pérdidas locales/estáticas; no se publica ΔP total.`;
    results.transport.pressureProfile = calculatePressureProfile({
      distributedPressureDropPa,
      lengthM: pipe.lengthM,
    });
    return;
  }
  const auxiliary = calculateAuxiliaryHydraulics({ pipe, densityKgM3 });
  const totalPressurePa = distributedPressureDropPa
    + auxiliary.minorLossPressurePa
    + auxiliary.staticPressurePa;
  results.transport.distributedPressureDropPa = distributedPressureDropPa;
  results.transport.minorLossPressurePa = auxiliary.minorLossPressurePa;
  results.transport.staticPressurePa = auxiliary.staticPressurePa;
  results.transport.totalLossCoefficient = auxiliary.totalK;
  results.transport.accessoryBreakdown = auxiliary.accessoryBreakdown;
  results.transport.pressureDropPa = totalPressurePa;
  results.transport.requiredPressurePa = Math.max(totalPressurePa, 0);
  results.transport.pressureGradientPaM = totalPressurePa / pipe.lengthM;
  results.transport.frictionGradientPaM = distributedPressureDropPa / pipe.lengthM;
  results.transport.calculationMode = mode;
  results.transport.pressureProfile = calculatePressureProfile({
    distributedPressureDropPa,
    lengthM: pipe.lengthM,
  });
  results.transport.pressureProfileAssumption = 'distributed-friction-only';
  if (densityKgM3) {
    results.transport.totalHeadM = calculatePressureHead({
      pressurePa: totalPressurePa,
      densityKgM3,
    });
  }
}

function sampleProfile(profile, maxPoints = 41) {
  const length = profile.radiusM.length;
  const step = Math.max(1, Math.ceil((length - 1) / (maxPoints - 1)));
  const indexes = [];
  for (let index = 0; index < length; index += step) indexes.push(index);
  if (indexes.at(-1) !== length - 1) indexes.push(length - 1);
  return {
    radiusM: indexes.map((index) => profile.radiusM[index]),
    velocityMps: indexes.map((index) => profile.velocityMps[index]),
    shearStressPa: profile.shearStressPa ? indexes.map((index) => profile.shearStressPa[index]) : undefined,
    shearRateS_1: profile.shearRateS_1 ? indexes.map((index) => profile.shearRateS_1[index]) : undefined,
    apparentViscosityPaS: profile.apparentViscosityPaS ? indexes.map((index) => profile.apparentViscosityPaS[index]) : undefined,
  };
}

function calculateRheologyScale(state, results) {
  if (!state.rheology.empiricalScalingEnabled) return { factor: 1, calibrated: true, method: 'disabled' };
  const { slurry, rheology, leaching } = state;
  if (!(results.slurry?.solidVolumeFraction >= 0) || !(slurry.referenceSolidsMassFraction > 0)) return { factor: 1, calibrated: false, method: 'insufficient-reference-data' };
  const referenceSolidVolumeFraction = calculateSolidVolumeFraction({
    solidsMassFraction: slurry.referenceSolidsMassFraction,
    solidDensityKgM3: slurry.solidDensityKgM3,
    liquidDensityKgM3: slurry.liquidDensityKgM3,
  });
  return calculateEmpiricalRheologyScale({
    solidVolumeFraction: results.slurry.solidVolumeFraction,
    referenceSolidVolumeFraction,
    concentrationExponent: rheology.concentrationExponent,
    temperatureC: slurry.temperatureC,
    referenceTemperatureC: slurry.referenceTemperatureC,
    ph: leaching.ph,
    referencePh: leaching.referencePh,
    dissolvedGradeGL: leaching.feedGradeGL,
    referenceDissolvedGradeGL: leaching.referenceGradeGL,
    betaTemperaturePerC: rheology.betaTemperaturePerC,
    betaPhPerUnit: rheology.betaPhPerUnit,
    betaConcentrationPerGL: rheology.betaConcentrationPerGL,
  });
}

function finalizeExplicitCircuit({ results, segmentResults, densityKgM3, mode, modelStatus, resultQuality }) {
  const distributedPressureDropPa = segmentResults.reduce((sum, segment) => sum + segment.distributedPressureDropPa, 0);
  const minorLossPressurePa = segmentResults.reduce((sum, segment) => sum + segment.minorLossPressurePa, 0);
  const staticPressurePa = segmentResults.reduce((sum, segment) => sum + segment.staticPressurePa, 0);
  const pressureDropPa = distributedPressureDropPa + minorLossPressurePa + staticPressurePa;
  const totalLengthM = segmentResults.reduce((sum, segment) => sum + segment.lengthM, 0);
  let distance = 0;
  let cumulative = 0;
  const distanceM = [0];
  const requiredPressurePa = [0];
  segmentResults.forEach((segment) => {
    distance += segment.lengthM;
    cumulative += segment.distributedPressureDropPa + segment.minorLossPressurePa + segment.staticPressurePa;
    distanceM.push(distance);
    requiredPressurePa.push(cumulative);
  });
  results.transport = {
    ...results.transport,
    segments: segmentResults,
    distributedPressureDropPa,
    minorLossPressurePa,
    staticPressurePa,
    pressureDropPa,
    requiredPressurePa: Math.max(pressureDropPa, 0),
    pressureGradientPaM: totalLengthM > 0 ? pressureDropPa / totalLengthM : 0,
    frictionGradientPaM: totalLengthM > 0 ? distributedPressureDropPa / totalLengthM : 0,
    totalLengthM,
    totalHeadM: densityKgM3 ? calculatePressureHead({ pressurePa: pressureDropPa, densityKgM3 }) : undefined,
    calculationMode: mode,
    pressureProfile: { distanceM, requiredPressurePa },
    pressureProfileAssumption: 'segment-total-including-local-static',
    modelStatus,
    resultQuality,
  };
}

function calculateExplicitCircuitHydraulics({ state, results }) {
  const { transport, rheology } = state;
  const densityKgM3 = results.slurry?.densityKgM3;
  if (!densityKgM3 || !(results.transport?.flowRateM3s >= 0)) return;
  const segments = buildCircuitHydraulicInputs({ transport, flowRateM3s: results.transport.flowRateM3s });
  const rheologyParameters = getRheologyParameters(rheology);
  const rheologyScale = rheologyParameters ? calculateRheologyScale(state, results) : null;
  const segmentResults = [];
  let worstRegime = 'laminar';
  let educational = false;
  let firstNonNewtonian = null;

  for (const segment of segments) {
    let distributedPressureDropPa = 0;
    let regime = 'stagnant';
    let frictionFactor = 0;
    let fanningFrictionFactor;
    let reynoldsNumber;
    let wallStressPa;
    let nPrime;
    let segmentMode = 'unresolved';
    if (segment.lengthM > 0 && rheology.model === 'newtonian' && rheology.newtonianViscosityPaS > 0) {
      reynoldsNumber = calculateReynoldsNumber({
        densityKgM3,
        velocityMps: segment.velocityMps,
        innerDiameterM: segment.innerDiameterM,
        viscosityPaS: rheology.newtonianViscosityPaS,
      });
      regime = classifyNewtonianRegime(reynoldsNumber);
      const relativeRoughness = segment.roughnessM / segment.innerDiameterM;
      frictionFactor = regime === 'transition'
        ? calculateChurchillDarcyFrictionFactor({ reynoldsNumber, relativeRoughness })
        : calculateDarcyFrictionFactor({ reynoldsNumber, relativeRoughness });
      distributedPressureDropPa = calculateDarcyWeisbachPressureDrop({
        frictionFactor,
        lengthM: segment.lengthM,
        innerDiameterM: segment.innerDiameterM,
        densityKgM3,
        velocityMps: segment.velocityMps,
      });
      segmentMode = regime === 'transition' ? 'newtonian-churchill-transition' : regime === 'turbulent' ? 'newtonian-darcy-colebrook' : 'newtonian-darcy-laminar';
    } else if (segment.lengthM > 0 && rheologyParameters && segment.velocityMps > 0) {
      const local = calculateLocalMetznerReedParameters({
        model: rheology.model,
        parameters: rheologyParameters,
        radiusM: segment.innerDiameterM / 2,
        targetMeanVelocityMps: segment.velocityMps,
        densityKgM3,
        empiricalStressScale: rheologyScale.factor,
      });
      const friction = calculateNonNewtonianFrictionFactor({ reynoldsStar: local.reynoldsStar, nPrime: local.nPrime });
      const laminarPressure = calculateLaminarPressureDrop({ wallStressPa: local.wallStressPa, lengthM: segment.lengthM, innerDiameterM: segment.innerDiameterM });
      const turbulentPressure = 2 * friction.fanningFrictionFactor * densityKgM3 * segment.velocityMps ** 2 * segment.lengthM / segment.innerDiameterM;
      distributedPressureDropPa = friction.regime === 'transition'
        ? laminarPressure + friction.transitionFraction * (Math.max(laminarPressure, turbulentPressure) - laminarPressure)
        : friction.regime === 'turbulent' ? Math.max(laminarPressure, turbulentPressure) : laminarPressure;
      regime = friction.regime;
      reynoldsNumber = local.reynoldsStar;
      frictionFactor = friction.darcyFrictionFactor;
      fanningFrictionFactor = friction.fanningFrictionFactor;
      wallStressPa = local.wallStressPa;
      nPrime = local.nPrime;
      segmentMode = regime === 'laminar' ? 'laminar-rheology' : regime === 'transition' ? 'non-newtonian-educational-transition' : 'non-newtonian-dodge-metzner-estimate';
      if (!firstNonNewtonian) firstNonNewtonian = { local, friction };
      if (regime !== 'laminar') educational = true;
    }
    if (regime === 'turbulent' || (regime === 'transition' && worstRegime !== 'turbulent')) worstRegime = regime;
    const minorLossPressurePa = calculateMinorLossPressureDrop({ lossCoefficient: segment.totalK, densityKgM3, velocityMps: segment.velocityMps });
    const staticPressurePa = calculateStaticPressureChange({ densityKgM3, elevationChangeM: segment.elevationChangeM });
    segmentResults.push({
      id: segment.id,
      innerDiameterM: segment.innerDiameterM,
      lengthM: segment.lengthM,
      elevationChangeM: segment.elevationChangeM,
      velocityMps: segment.velocityMps,
      totalK: segment.totalK,
      accessoryBreakdown: segment.accessoryBreakdown,
      distributedPressureDropPa,
      minorLossPressurePa,
      staticPressurePa,
      pressureDropPa: distributedPressureDropPa + minorLossPressurePa + staticPressurePa,
      reynoldsNumber,
      flowRegime: regime,
      frictionFactor,
      fanningFrictionFactor,
      wallStressPa,
      nPrime,
      calculationMode: segmentMode,
    });
  }

  if (rheology.model === 'newtonian') results.rheology = { model: 'newtonian', viscosityPaS: rheology.newtonianViscosityPaS };
  if (firstNonNewtonian) {
    results.rheology = {
      model: rheology.model,
      wallStressPa: firstNonNewtonian.local.wallStressPa,
      reproducedMeanVelocityMps: firstNonNewtonian.local.profile.meanVelocityMps,
      profile: sampleProfile(firstNonNewtonian.local.profile),
      nPrime: firstNonNewtonian.local.nPrime,
      reynoldsStar: firstNonNewtonian.local.reynoldsStar,
      fanningFrictionFactor: firstNonNewtonian.friction.fanningFrictionFactor,
      empiricalScale: rheologyScale,
    };
  }
  results.transport.flowRegime = worstRegime;
  results.transport.regimeValidated = !educational;
  const resultQuality = educational ? 'educational-estimate' : 'validated';
  finalizeExplicitCircuit({
    results,
    segmentResults,
    densityKgM3,
    mode: `multi-segment-${rheology.model || 'unresolved'}`,
    resultQuality,
    modelStatus: educational
      ? 'Circuito por tramos con al menos una estimación no newtoniana educativa fuera de laminar.'
      : 'Circuito por tramos resuelto con conservación de caudal y pérdidas por segmento.',
  });
}

function calculatePumpAssessment({ state, results }) {
  const { energy, transport } = state;
  const densityKgM3 = results.slurry?.densityKgM3;
  if (!densityKgM3 || !Array.isArray(energy.pumpCurve) || energy.pumpCurve.length < 2 || !(transport.pipe1.innerDiameterM > 0)) return;

  const systemHeadAtFlow = (flowRateM3s) => {
    const candidate = structuredClone(state);
    const areaM2 = Math.PI * candidate.transport.pipe1.innerDiameterM ** 2 / 4;
    candidate.transport.pipe1.velocityMps = areaM2 > 0 ? flowRateM3s / areaM2 : 0;
    candidate.energy.pumpCurve = [];
    candidate.energy.efficiencyCurve = [];
    candidate.energy.npshrCurve = [];
    const nested = calculateSimulationResults(candidate);
    const requiredPressurePa = nested.transport?.requiredPressurePa;
    if (requiredPressurePa === undefined) throw new RangeError('La curva del sistema no tiene un modelo hidráulico aplicable en todo el intervalo de bomba.');
    return requiredPressurePa / (densityKgM3 * 9.80665);
  };

  try {
    const solution = solveTabulatedPumpSystemOperatingPoint({ pumpCurve: energy.pumpCurve, systemHeadAtFlow });
    const curves = sampleTabulatedPumpSystemCurves({ pumpCurve: energy.pumpCurve, systemHeadAtFlow, pointCount: 21 });
    results.pump = {
      status: solution.status,
      operatingPoint: solution.operatingPoint,
      intersections: solution.intersections,
      curves,
      curveSource: 'user-tabulated',
      extrapolated: false,
    };
    if (!solution.operatingPoint) {
      results.pump.modelStatus = 'No existe intersección H–Q dentro del dominio tabulado; no se extrapola.';
      return;
    }
    const q = solution.operatingPoint.flowRateM3s;
    const pumpEfficiency = energy.efficiencyCurve.length >= 2
      ? interpolateTabulatedCurve(energy.efficiencyCurve, q, 'efficiency', { name: 'efficiencyCurve' })
      : energy.pumpEfficiency;
    results.pump.pumpEfficiency = pumpEfficiency;
    if (pumpEfficiency > 0 && energy.motorEfficiency > 0) {
      results.pump.energy = calculatePumpEnergy({
        flowRateM3s: q,
        requiredPressurePa: densityKgM3 * 9.80665 * solution.operatingPoint.pumpHeadM,
        pumpEfficiency,
        motorEfficiency: energy.motorEfficiency,
        operatingHoursPerYear: energy.operatingHoursPerYear,
        electricityPricePerKwh: energy.electricityPricePerKwh,
      });
    }
    const availableNpshM = calculateNpshAvailable({
      surfaceAbsolutePressurePa: energy.suctionAbsolutePressurePa,
      vaporPressurePa: energy.vaporPressurePa,
      densityKgM3,
      suctionStaticHeadM: energy.suctionElevationHeadM,
      suctionHeadLossM: energy.suctionHeadLossM,
    });
    const requiredNpshM = energy.npshrCurve.length >= 2
      ? interpolateTabulatedCurve(energy.npshrCurve, q, 'npshM', { name: 'npshrCurve' })
      : null;
    results.pump.npshAvailableM = availableNpshM;
    if (requiredNpshM !== null) results.pump.npsh = assessNpsh({ availableNpshM, requiredNpshM });
    results.pump.modelStatus = solution.status === 'multiple-intersections'
      ? 'Se detectaron múltiples intersecciones; se reporta la primera y deben revisarse las curvas.'
      : 'Punto de operación resuelto dentro del dominio tabulado. NPSH es una comparación de margen, no una predicción de cavitación.';
  } catch (error) {
    results.pump = { status: 'invalid', modelStatus: error.message, operatingPoint: null, extrapolated: false };
  }
}

function calculateSettlingAssessment({ state, results }) {
  const { slurry, transport } = state;
  if (!(slurry.solidDensityKgM3 > slurry.liquidDensityKgM3)
    || !(slurry.liquidDensityKgM3 > 0)
    || !(transport.settlingFactorFl > 0)
    || !(results.transport?.flowRateM3s >= 0)) return;

  const sources = Array.isArray(results.transport.segments) && results.transport.segments.length
    ? results.transport.segments.map((segment) => ({
      id: segment.id,
      innerDiameterM: segment.innerDiameterM,
      velocityMps: segment.velocityMps,
    }))
    : [{
      id: 'Pipe 1',
      innerDiameterM: transport.pipe1.innerDiameterM,
      velocityMps: transport.pipe1.velocityMps,
    }];
  const assessments = sources.filter((source) => source.innerDiameterM > 0).map((source) => {
    const critical = calculateLegacyDurandCriticalVelocity({
      innerDiameterM: source.innerDiameterM,
      solidDensityKgM3: slurry.solidDensityKgM3,
      liquidDensityKgM3: slurry.liquidDensityKgM3,
      durandFactor: transport.settlingFactorFl,
    });
    const ratio = critical.velocityMps > 0 ? source.velocityMps / critical.velocityMps : null;
    const status = ratio === null ? 'unavailable' : ratio < 1 ? 'risk' : ratio < 1.15 ? 'near-limit' : 'adequate';
    return {
      id: source.id,
      velocityMps: source.velocityMps,
      criticalVelocityMps: critical.velocityMps,
      velocityRatio: ratio,
      status,
      method: critical.method,
    };
  });
  if (!assessments.length) return;
  const worst = assessments.reduce((a, b) => ((a.velocityRatio ?? Infinity) <= (b.velocityRatio ?? Infinity) ? a : b));
  results.transport.settling = {
    method: 'Durand F_L legacy / orientativo',
    calibrated: false,
    granulometryAvailable: slurry.d50M > 0 || slurry.d80M > 0,
    granulometryUsed: false,
    segments: assessments,
    criticalVelocityMps: worst.criticalVelocityMps,
    velocityRatio: worst.velocityRatio,
    status: worst.status,
    limitingSegmentId: worst.id,
    note: slurry.d50M > 0 || slurry.d80M > 0
      ? 'd50/d80 registrados. No se aplica una correlación granulométrica adicional sin modelo documentado/calibrado.'
      : 'Método orientativo legado; no incluye granulometría ni calibración de planta.',
  };
}

function calculateMassBalance({ state, results }) {
  const qOutM3s = results.transport?.flowRateM3s;
  const densityKgM3 = results.slurry?.densityKgM3;
  if (!(qOutM3s >= 0) || !(densityKgM3 > 0)) return;
  const slurryMassFlowKgS = densityKgM3 * qOutM3s;
  const solidsMassFlowKgS = slurryMassFlowKgS * state.slurry.solidsMassFraction;
  const liquidMassFlowKgS = slurryMassFlowKgS - solidsMassFlowKgS;
  const liquidVolumetricFlowM3h = state.slurry.liquidDensityKgM3 > 0
    ? liquidMassFlowKgS / state.slurry.liquidDensityKgM3 * 3600
    : undefined;
  const qInM3s = state.process.tankDischargeM3h > 0 ? state.process.tankDischargeM3h / 3600 : null;
  const continuity = qInM3s === null ? null : (() => {
    const differenceM3s = qInM3s - qOutM3s;
    const denominator = Math.max(qInM3s, qOutM3s, 1e-12);
    const relativeDifference = Math.abs(differenceM3s) / denominator;
    return {
      inletFlowM3s: qInM3s,
      outletFlowM3s: qOutM3s,
      differenceM3s,
      accumulationKgS: densityKgM3 * differenceM3s,
      relativeDifference,
      toleranceFraction: state.process.balanceToleranceFraction,
      withinTolerance: relativeDifference <= state.process.balanceToleranceFraction,
      tankLevelIntegrated: false,
    };
  })();
  results.balance = {
    slurryMassFlowKgS,
    solidsMassFlowKgS,
    solidsMassFlowTh: solidsMassFlowKgS * 3.6,
    liquidMassFlowKgS,
    liquidVolumetricFlowM3h,
    outletFlowM3h: qOutM3s * 3600,
    continuity,
  };
}

export function calculateSimulationResults(state) {
  const results = {};
  const { slurry, transport, rheology, energy, leaching, recovery } = state;

  if (
    slurry.solidDensityKgM3 > 0
    && slurry.liquidDensityKgM3 > 0
  ) {
    results.slurry = {
      densityKgM3: calculateMixtureDensity(slurry),
      solidVolumeFraction: calculateSolidVolumeFraction(slurry),
    };
  }

  const pipe = transport.pipe1;
  if (pipe.innerDiameterM > 0 && pipe.velocityMps >= 0) {
    results.transport = {
      flowRateM3s: calculatePipeFlowRate({
        velocityMps: pipe.velocityMps,
        innerDiameterM: pipe.innerDiameterM,
      }),
    };

    const densityKgM3 = results.slurry?.densityKgM3;
    if (
      rheology.model === 'newtonian'
      && rheology.newtonianViscosityPaS > 0
      && densityKgM3
      && pipe.lengthM > 0
    ) {
      const reynoldsNumber = calculateReynoldsNumber({
        densityKgM3,
        velocityMps: pipe.velocityMps,
        innerDiameterM: pipe.innerDiameterM,
        viscosityPaS: rheology.newtonianViscosityPaS,
      });
      const regime = classifyNewtonianRegime(reynoldsNumber);
      const relativeRoughness = pipe.roughnessM / pipe.innerDiameterM;
      const frictionFactor = regime === 'transition'
        ? calculateChurchillDarcyFrictionFactor({ reynoldsNumber, relativeRoughness })
        : calculateDarcyFrictionFactor({ reynoldsNumber, relativeRoughness });
      results.rheology = {
        model: rheology.model,
        viscosityPaS: rheology.newtonianViscosityPaS,
      };
      results.transport.reynoldsNumber = reynoldsNumber;
      results.transport.flowRegime = regime;
      results.transport.regimeValidated = true;
      results.transport.relativeRoughness = relativeRoughness;
      results.transport.frictionFactor = frictionFactor;
      if (frictionFactor !== null) {
        const distributedPressureDropPa = calculateDarcyWeisbachPressureDrop({
          frictionFactor,
          lengthM: pipe.lengthM,
          innerDiameterM: pipe.innerDiameterM,
          densityKgM3,
          velocityMps: pipe.velocityMps,
        });
        finalizeHydraulicResults({
          results,
          pipe,
          densityKgM3,
          distributedPressureDropPa,
          mode: regime === 'turbulent' ? 'newtonian-darcy-colebrook' : regime === 'transition' ? 'newtonian-churchill-transition' : 'newtonian-darcy-laminar',
        });
      }
    }

    const rheologyParameters = getRheologyParameters(rheology);
    if (rheologyParameters && pipe.lengthM > 0) {
      const rheologyScale = calculateRheologyScale(state, results);
      const solved = solveWallStressForMeanVelocity({
        model: rheology.model,
        parameters: rheologyParameters,
        radiusM: pipe.innerDiameterM / 2,
        targetMeanVelocityMps: pipe.velocityMps,
        empiricalStressScale: rheologyScale.factor,
      });
      const laminarPressureDropPa = calculateLaminarPressureDrop({
        wallStressPa: solved.wallStressPa,
        lengthM: pipe.lengthM,
        innerDiameterM: pipe.innerDiameterM,
      });
      results.rheology = {
        model: rheology.model,
        wallStressPa: solved.wallStressPa,
        reproducedMeanVelocityMps: solved.profile.meanVelocityMps,
        profile: sampleProfile(solved.profile),
        empiricalScale: rheologyScale,
      };
      let distributedPressureDropPa = laminarPressureDropPa;
      let mode = 'laminar-rheology';
      if (densityKgM3 && pipe.velocityMps > 0) {
        const local = calculateLocalMetznerReedParameters({
          model: rheology.model,
          parameters: rheologyParameters,
          radiusM: pipe.innerDiameterM / 2,
          targetMeanVelocityMps: pipe.velocityMps,
          densityKgM3,
          empiricalStressScale: rheologyScale.factor,
        });
        const friction = calculateNonNewtonianFrictionFactor({ reynoldsStar: local.reynoldsStar, nPrime: local.nPrime });
        const turbulentPressureDropPa = 2 * friction.fanningFrictionFactor * densityKgM3 * pipe.velocityMps ** 2 * pipe.lengthM / pipe.innerDiameterM;
        if (friction.regime === 'transition') {
          distributedPressureDropPa = laminarPressureDropPa + friction.transitionFraction * (Math.max(laminarPressureDropPa, turbulentPressureDropPa) - laminarPressureDropPa);
          mode = 'non-newtonian-educational-transition';
        } else if (friction.regime === 'turbulent') {
          distributedPressureDropPa = Math.max(laminarPressureDropPa, turbulentPressureDropPa);
          mode = 'non-newtonian-dodge-metzner-estimate';
        }
        results.rheology.nPrime = local.nPrime;
        results.rheology.reynoldsStar = local.reynoldsStar;
        results.rheology.fanningFrictionFactor = friction.fanningFrictionFactor;
        results.transport.reynoldsNumber = local.reynoldsStar;
        results.transport.flowRegime = friction.regime;
        results.transport.fanningFrictionFactor = friction.fanningFrictionFactor;
        results.transport.frictionFactor = friction.darcyFrictionFactor;
        results.transport.regimeValidated = friction.regime === 'laminar';
        results.transport.resultQuality = friction.regime === 'laminar' ? 'validated-laminar' : 'educational-estimate';
        results.transport.modelStatus = friction.regime === 'laminar'
          ? 'Perfil e hidráulica no newtoniana en rama laminar.'
          : 'Estimación educativa no newtoniana fuera de laminar; perfil radial mostrado como equivalente laminar, no CFD turbulento.';
      } else {
        results.transport.flowRegime = 'laminar-model-only';
        results.transport.regimeValidated = false;
        results.transport.resultQuality = 'laminar-profile-only';
        results.transport.modelStatus = 'Perfil no newtoniano disponible; falta densidad/flujo para clasificar régimen.';
      }
      if (rheologyScale.method !== 'disabled') {
        results.transport.modelStatus += ' Escalado reológico empírico activo; requiere calibración.';
      }
      finalizeHydraulicResults({
        results,
        pipe,
        densityKgM3,
        distributedPressureDropPa,
        mode,
      });
    }

    if (Array.isArray(transport.segments) && transport.segments.length > 0) {
      calculateExplicitCircuitHydraulics({ state, results });
    }

    calculateSettlingAssessment({ state, results });
    calculateMassBalance({ state, results });

    if (
      results.transport.requiredPressurePa !== undefined
      && energy.pumpEfficiency > 0
      && energy.motorEfficiency > 0
    ) {
      results.energy = calculatePumpEnergy({
        flowRateM3s: results.transport.flowRateM3s,
        requiredPressurePa: results.transport.requiredPressurePa,
        pumpEfficiency: energy.pumpEfficiency,
        motorEfficiency: energy.motorEfficiency,
        operatingHoursPerYear: energy.operatingHoursPerYear,
        electricityPricePerKwh: energy.electricityPricePerKwh,
      });
      results.energy.resultQuality = results.transport.resultQuality ?? 'validated';
      if (results.transport.resultQuality === 'educational-estimate') results.energy.modelStatus = 'Potencia derivada de una estimación hidráulica educativa fuera de rama laminar.';
    }

    if (leaching.totalUsefulVolumeM3 > 0 && results.transport.flowRateM3s > 0) {
      const residenceTimeH = calculateResidenceTimeHours({
        usefulVolumeM3: leaching.totalUsefulVolumeM3,
        flowRateM3s: results.transport.flowRateM3s,
      });
      results.leaching = {
        residenceTimeH,
        reactorCount: leaching.reactorCount,
        model: leaching.kineticModel || null,
      };
      if (leaching.kineticModel === 'first-order-cstr-series' && leaching.firstOrderRateConstantPerH > 0) {
        const effectiveRate = calculateEmpiricalLeachingRateConstant({
          baseRateConstantPerH: leaching.firstOrderRateConstantPerH,
          temperatureC: leaching.temperatureC,
          referenceTemperatureC: leaching.referenceTemperatureC,
          ph: leaching.ph,
          referencePh: leaching.referencePh,
          freeCyanideGL: leaching.freeCyanideGL,
          referenceCyanideGL: leaching.referenceCyanideGL,
          dissolvedOxygenMgL: leaching.dissolvedOxygenMgL,
          referenceOxygenMgL: leaching.referenceOxygenMgL,
          coupleTemperature: leaching.coupleTemperature,
          couplePh: leaching.couplePh,
          coupleCyanide: leaching.coupleCyanide,
          coupleOxygen: leaching.coupleOxygen,
          betaTemperaturePerC: leaching.betaTemperaturePerC,
          betaPhPerUnit: leaching.betaPhPerUnit,
          betaCyanidePerGL: leaching.betaCyanidePerGL,
          betaOxygenPerMgL: leaching.betaOxygenPerMgL,
        });
        results.leaching.baseRateConstantPerH = leaching.firstOrderRateConstantPerH;
        results.leaching.effectiveRateConstantPerH = effectiveRate.effectiveRateConstantPerH;
        results.leaching.rateConstantCorrection = effectiveRate;
        results.leaching.conversion = calculateCstrsInSeriesConversion({
          rateConstantPerH: effectiveRate.effectiveRateConstantPerH,
          residenceTimeH,
          reactorCount: leaching.reactorCount,
        });
        results.leaching.stages = calculateCstrSeriesStages({
          rateConstantPerH: effectiveRate.effectiveRateConstantPerH,
          residenceTimeH,
          reactorCount: leaching.reactorCount,
          feedGradeGL: leaching.feedGradeGL > 0 ? leaching.feedGradeGL : null,
        });
        results.leaching.modelStatus = effectiveRate.modelStatus;
      }
    }

    calculatePumpAssessment({ state, results });
  }

  if (
    recovery.model === 'stage-efficiency'
    && recovery.feedGoldKgH > 0
  ) {
    results.recovery = calculateStageEfficiencyBalance({
      feedMetalKgH: recovery.feedGoldKgH,
      efficiencies: [
        recovery.adsorptionEfficiency,
        recovery.elutionEfficiency,
        recovery.electrowinningEfficiency,
        recovery.smeltingEfficiency,
      ],
    });
    results.recovery.model = 'explicit-stage-efficiency-balance';
  }

  return results;
}

const calculateResults = calculateSimulationResults;

function publish() {
  const snapshot = getResults();
  listeners.forEach((listener) => listener(snapshot));
}

subscribeState((state) => {
  derivedResults = calculateResults(state);
  publish();
});

export function getResults() {
  return structuredClone(derivedResults);
}

export function subscribe(listener) {
  if (typeof listener !== 'function') {
    throw new TypeError('subscribe requiere una función.');
  }
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function recalculate() {
  derivedResults = calculateResults(getState());
  publish();
  return getResults();
}
