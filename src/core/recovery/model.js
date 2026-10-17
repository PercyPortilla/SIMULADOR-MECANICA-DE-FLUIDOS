import { assertFraction, assertNonNegativeNumber } from '../validation.js';

export function calculateStageEfficiencyBalance({ feedMetalKgH, efficiencies }) {
  assertNonNegativeNumber(feedMetalKgH, 'feedMetalKgH');
  if (!Array.isArray(efficiencies) || efficiencies.length === 0) {
    throw new TypeError('efficiencies debe contener al menos una eficiencia de etapa.');
  }
  let current = feedMetalKgH;
  const stages = efficiencies.map((efficiency, index) => {
    assertFraction(efficiency, `efficiencies[${index}]`);
    const inputKgH = current;
    const recoveredKgH = inputKgH * efficiency;
    const lossKgH = inputKgH - recoveredKgH;
    current = recoveredKgH;
    return { inputKgH, efficiency, recoveredKgH, lossKgH };
  });
  return {
    feedMetalKgH,
    stages,
    finalMetalKgH: current,
    overallRecovery: feedMetalKgH === 0 ? 0 : current / feedMetalKgH,
  };
}
