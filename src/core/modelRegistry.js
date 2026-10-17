export const MODEL_RULES = Object.freeze({
  hydraulics: Object.freeze({
    newtonian: Object.freeze({
      regimeClassification: 'Reynolds',
      distributedLoss: 'Darcy-Weisbach',
      frictionFactorLaminar: '64/Re',
      frictionFactorTurbulent: 'Colebrook-White',
      transitionHandling: 'no-friction-factor',
    }),
    nonNewtonian: Object.freeze({
      distributedLoss: 'validated-laminar-profile-only',
      turbulentModel: null,
      regimeClassification: null,
    }),
  }),
  energy: Object.freeze({
    hydraulicPower: 'P=Q*deltaP',
    efficiencies: 'explicit-user-input',
  }),
  leaching: Object.freeze({
    validatedBalance: 'equal-volume-first-order-CSTRs-in-series',
    intrinsicKinetics: 'explicit-user-rate-constant',
  }),
  recovery: Object.freeze({
    validatedBalance: 'stage-efficiency-mass-balance',
    intrinsicStageEfficiencies: 'explicit-user-input',
  }),
});

export function getModelRules() {
  return MODEL_RULES;
}
