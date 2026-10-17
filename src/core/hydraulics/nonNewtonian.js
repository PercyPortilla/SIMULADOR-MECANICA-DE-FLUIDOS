import {
  assertNonNegativeNumber,
  assertPositiveNumber,
} from '../validation.js';
import { solveWallStressForMeanVelocity } from '../rheology/profile.js';
import { STANDARD_GRAVITY_M_S2 } from './advanced.js';

export const DEFAULT_NON_NEWTONIAN_LAMINAR_LIMIT = 2100;
export const DEFAULT_NON_NEWTONIAN_TURBULENT_LIMIT = 4000;

export function calculateReynoldsStar({ densityKgM3, velocityMps, wallStressPa }) {
  assertPositiveNumber(densityKgM3, 'densityKgM3');
  assertNonNegativeNumber(velocityMps, 'velocityMps');
  assertNonNegativeNumber(wallStressPa, 'wallStressPa');
  if (velocityMps === 0) return 0;
  assertPositiveNumber(wallStressPa, 'wallStressPa');
  return 8 * densityKgM3 * velocityMps ** 2 / wallStressPa;
}

export function calculateLocalMetznerReedParameters({
  model,
  parameters,
  radiusM,
  targetMeanVelocityMps,
  densityKgM3,
  nodeCount = 401,
  empiricalStressScale = 1,
  relativePerturbation = 0.01,
}) {
  assertPositiveNumber(radiusM, 'radiusM');
  assertPositiveNumber(targetMeanVelocityMps, 'targetMeanVelocityMps');
  assertPositiveNumber(densityKgM3, 'densityKgM3');
  assertPositiveNumber(empiricalStressScale, 'empiricalStressScale');
  assertPositiveNumber(relativePerturbation, 'relativePerturbation');
  if (relativePerturbation >= 1) {
    throw new RangeError('relativePerturbation debe ser menor que 1.');
  }

  const solve = (velocityMps) => solveWallStressForMeanVelocity({
    model,
    parameters,
    radiusM,
    targetMeanVelocityMps: velocityMps,
    nodeCount,
    empiricalStressScale,
  });

  const lowerVelocity = targetMeanVelocityMps * (1 - relativePerturbation);
  const upperVelocity = targetMeanVelocityMps * (1 + relativePerturbation);
  const [lower, center, upper] = [solve(lowerVelocity), solve(targetMeanVelocityMps), solve(upperVelocity)];
  const lowerNominalRate = 4 * lowerVelocity / radiusM;
  const nominalWallShearRateS_1 = 4 * targetMeanVelocityMps / radiusM;
  const upperNominalRate = 4 * upperVelocity / radiusM;
  const nPrime = Math.log(upper.wallStressPa / lower.wallStressPa)
    / Math.log(upperNominalRate / lowerNominalRate);

  if (!Number.isFinite(nPrime) || nPrime <= 0) {
    throw new RangeError('No se pudo obtener un n\' local positivo a partir de la curva de flujo.');
  }

  const kPrimePaSn = center.wallStressPa / nominalWallShearRateS_1 ** nPrime;
  const innerDiameterM = 2 * radiusM;
  const reynoldsStar = calculateReynoldsStar({
    densityKgM3,
    velocityMps: targetMeanVelocityMps,
    wallStressPa: center.wallStressPa,
  });
  const reynoldsMetznerReed = densityKgM3
    * targetMeanVelocityMps ** (2 - nPrime)
    * innerDiameterM ** nPrime
    / (kPrimePaSn * 8 ** (nPrime - 1));

  return {
    nPrime,
    kPrimePaSn,
    reynoldsStar,
    reynoldsMetznerReed,
    nominalWallShearRateS_1,
    wallStressPa: center.wallStressPa,
    profile: center.profile,
    empiricalStressScale,
    derivativeMethod: 'centered-log-slope-tauw-vs-8V/D',
  };
}

export function calculateDodgeMetznerFanningFactor({
  reynoldsStar,
  nPrime,
  relativeTolerance = 1e-10,
  maxIterations = 120,
}) {
  assertPositiveNumber(reynoldsStar, 'reynoldsStar');
  assertPositiveNumber(nPrime, 'nPrime');
  assertPositiveNumber(relativeTolerance, 'relativeTolerance');
  if (!Number.isInteger(maxIterations) || maxIterations < 1) {
    throw new RangeError('maxIterations debe ser un entero mayor o igual que 1.');
  }

  const coefficientA = 4 / nPrime ** 0.75;
  const coefficientB = 0.4 / nPrime ** 1.2;
  const residual = (fanningFactor) => 1 / Math.sqrt(fanningFactor)
    - coefficientA * Math.log10(
      reynoldsStar * fanningFactor ** (1 - nPrime / 2),
    )
    + coefficientB;

  let lower = 1e-7;
  let upper = 0.25;
  let lowerResidual = residual(lower);
  let upperResidual = residual(upper);
  if (!(lowerResidual > 0 && upperResidual < 0)) {
    throw new RangeError('No se pudo acotar el factor de Fanning de Dodge–Metzner.');
  }

  for (let iteration = 0; iteration < maxIterations; iteration += 1) {
    const midpoint = (lower + upper) / 2;
    const midpointResidual = residual(midpoint);
    if (Math.abs(midpointResidual) <= relativeTolerance) return midpoint;
    if (midpointResidual > 0) {
      lower = midpoint;
      lowerResidual = midpointResidual;
    } else {
      upper = midpoint;
      upperResidual = midpointResidual;
    }
    if ((upper - lower) / midpoint <= relativeTolerance) return (lower + upper) / 2;
  }
  return (lower + upper) / 2;
}

export function calculateNonNewtonianFrictionFactor({
  reynoldsStar,
  nPrime,
  laminarLimit = DEFAULT_NON_NEWTONIAN_LAMINAR_LIMIT,
  turbulentLimit = DEFAULT_NON_NEWTONIAN_TURBULENT_LIMIT,
}) {
  assertNonNegativeNumber(reynoldsStar, 'reynoldsStar');
  assertPositiveNumber(nPrime, 'nPrime');
  assertPositiveNumber(laminarLimit, 'laminarLimit');
  assertPositiveNumber(turbulentLimit, 'turbulentLimit');
  if (turbulentLimit <= laminarLimit) {
    throw new RangeError('turbulentLimit debe ser mayor que laminarLimit.');
  }
  if (reynoldsStar === 0) {
    return {
      regime: 'stagnant',
      fanningFrictionFactor: 0,
      darcyFrictionFactor: 0,
      correlation: 'stagnant',
      educationalTransition: false,
    };
  }

  const laminarFactor = 16 / reynoldsStar;
  if (reynoldsStar < laminarLimit) {
    return {
      regime: 'laminar',
      fanningFrictionFactor: laminarFactor,
      darcyFrictionFactor: 4 * laminarFactor,
      correlation: 'Metzner-Reed laminar, f_F=16/Re*',
      educationalTransition: false,
    };
  }

  const turbulentFactor = calculateDodgeMetznerFanningFactor({ reynoldsStar, nPrime });
  if (reynoldsStar >= turbulentLimit) {
    return {
      regime: 'turbulent',
      fanningFrictionFactor: turbulentFactor,
      darcyFrictionFactor: 4 * turbulentFactor,
      correlation: 'Dodge-Metzner smooth-pipe Fanning',
      educationalTransition: false,
    };
  }

  const transitionFraction = (reynoldsStar - laminarLimit) / (turbulentLimit - laminarLimit);
  const fanningFrictionFactor = laminarFactor
    + transitionFraction * (turbulentFactor - laminarFactor);
  return {
    regime: 'transition',
    fanningFrictionFactor,
    darcyFrictionFactor: 4 * fanningFrictionFactor,
    correlation: 'educational linear blend: Metzner-Reed laminar → Dodge-Metzner',
    educationalTransition: true,
    transitionFraction,
  };
}

export function calculateLegacyDurandCriticalVelocity({
  innerDiameterM,
  solidDensityKgM3,
  liquidDensityKgM3,
  durandFactor,
  gravityMps2 = STANDARD_GRAVITY_M_S2,
}) {
  assertPositiveNumber(innerDiameterM, 'innerDiameterM');
  assertPositiveNumber(solidDensityKgM3, 'solidDensityKgM3');
  assertPositiveNumber(liquidDensityKgM3, 'liquidDensityKgM3');
  assertPositiveNumber(durandFactor, 'durandFactor');
  assertPositiveNumber(gravityMps2, 'gravityMps2');
  if (solidDensityKgM3 <= liquidDensityKgM3) {
    throw new RangeError('solidDensityKgM3 debe ser mayor que liquidDensityKgM3 para Durand.');
  }
  const relativeDensity = solidDensityKgM3 / liquidDensityKgM3;
  return {
    velocityMps: durandFactor * Math.sqrt(
      2 * gravityMps2 * innerDiameterM * (relativeDensity - 1),
    ),
    method: 'Durand F_L (legacy; factor explícito)',
    durandFactor,
    relativeDensity,
  };
}
