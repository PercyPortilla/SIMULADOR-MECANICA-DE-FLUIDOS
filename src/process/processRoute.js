/**
 * Fuente única de verdad para la ruta de recuperación de PULPA LAB V2.
 *
 * Fase 19A separa deliberadamente dos conceptos:
 * - topología validada: suficiente para UI/diagrama/3D;
 * - modelo de recuperación validado: necesario para calcular recuperación.
 *
 * El proyecto ya requiere una ruta CIP con elución. Todavía NO existen
 * ecuaciones verificables de recuperación en src/core/recovery, por lo que
 * la topología puede renderizarse sin habilitar cálculos metalúrgicos falsos.
 */

function freezeArray(items) {
  return Object.freeze(items.map((item) => (
    item && typeof item === 'object' ? Object.freeze({ ...item }) : item
  )));
}

function createProcessRoute({
  id,
  label,
  stages = [],
  equipment = [],
  connections = [],
  recoveryModel = null,
  finalProduct = null,
  validation,
}) {
  if (!id || typeof id !== 'string') throw new TypeError('processRoute.id es obligatorio.');
  if (!label || typeof label !== 'string') throw new TypeError('processRoute.label es obligatorio.');
  if (!validation || typeof validation !== 'object') {
    throw new TypeError('processRoute.validation es obligatorio.');
  }

  return Object.freeze({
    id,
    label,
    stages: freezeArray(stages),
    equipment: freezeArray(equipment),
    connections: freezeArray(connections),
    recoveryModel,
    finalProduct: finalProduct && typeof finalProduct === 'object'
      ? Object.freeze({ ...finalProduct })
      : finalProduct,
    validation: Object.freeze({ ...validation }),
  });
}

export const RECOVERY_ROUTE_ID = 'CIP-ELUTION-EW-SMELTING';

export const RECOVERY_PROCESS_ROUTE = createProcessRoute({
  id: RECOVERY_ROUTE_ID,
  label: 'CIP → Elución → Electrowinning → Fundición',
  stages: [
    {
      id: 'REC-ADSORPTION',
      label: 'Adsorción con carbón (CIP)',
      order: 1,
      role: 'adsorption',
    },
    {
      id: 'REC-ELUTION',
      label: 'Elución',
      order: 2,
      role: 'elution',
    },
    {
      id: 'REC-ELECTROWINNING',
      label: 'Electrowinning',
      order: 3,
      role: 'electrowinning',
    },
    {
      id: 'REC-SMELTING',
      label: 'Fundición',
      order: 4,
      role: 'smelting',
    },
  ],
  equipment: [
    { id: 'CIP-ADSORPTION', type: 'adsorption-train', stageId: 'REC-ADSORPTION' },
    { id: 'ELUTION-SKID', type: 'elution-system', stageId: 'REC-ELUTION' },
    { id: 'EW-CELLS', type: 'electrowinning-cells', stageId: 'REC-ELECTROWINNING' },
    { id: 'SMELTING-FURNACE', type: 'smelting-furnace', stageId: 'REC-SMELTING' },
  ],
  connections: [
    { id: 'REC-C01', sourceStageId: 'REC-ADSORPTION', targetStageId: 'REC-ELUTION' },
    { id: 'REC-C02', sourceStageId: 'REC-ELUTION', targetStageId: 'REC-ELECTROWINNING' },
    { id: 'REC-C03', sourceStageId: 'REC-ELECTROWINNING', targetStageId: 'REC-SMELTING' },
  ],
  recoveryModel: Object.freeze({
    id: 'EXPLICIT-STAGE-EFFICIENCY-BALANCE',
    type: 'mass-balance',
    requiresExplicitStageEfficiencies: true,
    predictsIntrinsicEfficiency: false,
  }),
  finalProduct: {
    id: 'DORE',
    label: 'Barra doré',
    physicalState: 'solid',
  },
  validation: {
    status: 'topology-and-explicit-balance-validated',
    isValidated: true,
    topologyValidated: true,
    calculationValidated: true,
    canRender3D: true,
    canCalculateRecovery: true,
    reason: 'Se valida un balance de masa por eficiencias de etapa ingresadas explícitamente; no se predicen eficiencias intrínsecas de CIP/elución/EW/fundición.',
    source: 'Balance de masa de etapa + eficiencias explícitas del usuario.',
  },
});

export function getProcessRoute() {
  return RECOVERY_PROCESS_ROUTE;
}

export function assertRenderableProcessRoute(route = RECOVERY_PROCESS_ROUTE) {
  if (!route.validation?.topologyValidated || !route.validation?.canRender3D) {
    throw new Error(`La topología de ${route.id} no está validada para representación 3D.`);
  }
  return route;
}

export function assertValidatedProcessRoute(route = RECOVERY_PROCESS_ROUTE) {
  if (!route.validation?.isValidated || !route.validation?.calculationValidated) {
    throw new Error(`La ruta ${route.id} no tiene un modelo de recuperación validado para cálculo.`);
  }
  return route;
}
