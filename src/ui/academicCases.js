import { EXAMPLE_SIMULATION_INPUTS } from './exampleScenario.js';

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function merge(base, patch) {
  const result = structuredClone(base);
  Object.entries(patch ?? {}).forEach(([key, value]) => {
    result[key] = isPlainObject(value) && isPlainObject(result[key])
      ? merge(result[key], value)
      : structuredClone(value);
  });
  return result;
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}

function academicCase({
  id,
  name,
  shortName,
  objective,
  question,
  observe,
  caution,
  presentationStartId,
  patch,
}) {
  return deepFreeze({
    id,
    name,
    shortName,
    objective,
    question,
    observe,
    caution,
    presentationStartId,
    inputs: merge(EXAMPLE_SIMULATION_INPUTS, patch),
  });
}

export const ACADEMIC_CASES = Object.freeze([
  academicCase({
    id: 'metallurgical-scope',
    name: 'Caso 1 · Lixiviación y recuperación desacopladas',
    shortName: 'Alcance metalúrgico',
    objective: 'Distinguir el efecto del tiempo de residencia y de las eficiencias por etapa sin asumir un modelo metalúrgico end-to-end.',
    question: '¿Qué mejora al duplicar el volumen útil de lixiviación y elevar la eficiencia de elución, y qué variables siguen siendo entradas independientes?',
    observe: ['Tiempo de residencia', 'Conversión CSTR', 'Recuperación global', 'Oro final'],
    caution: 'k y las eficiencias son entradas explícitas. feedGoldKgH no se deriva de la conversión de lixiviación; este caso enseña alcance y balances, no una predicción metalúrgica integrada.',
    presentationStartId: 'R-01',
    patch: {
      leaching: { totalUsefulVolumeM3: 720 },
      recovery: { elutionEfficiency: 0.95 },
    },
  }),
  academicCase({
    id: 'newtonian-reference',
    name: 'Caso 2 · Referencia Newtoniana',
    shortName: 'Newtoniano',
    objective: 'Usar Darcy–Weisbach y Reynolds como referencia para comparar la respuesta hidráulica con modelos de pulpa.',
    question: 'Con la misma geometría y velocidad, ¿cómo cambia la pérdida de presión al eliminar el esfuerzo de cedencia?',
    observe: ['Reynolds', 'Factor Darcy', 'ΔP total', 'Carga total'],
    caution: 'La viscosidad de 0.008 Pa·s es un valor didáctico para comparación; no representa automáticamente la viscosidad de una pulpa real.',
    presentationStartId: 'SLURRY-PUMP-01',
    patch: {
      rheology: {
        model: 'newtonian',
        yieldStressPa: 0,
        consistencyIndex: 0,
        flowIndex: 0,
        plasticViscosityPaS: 0,
        newtonianViscosityPaS: 0.008,
      },
    },
  }),
  academicCase({
    id: 'high-solids-bingham',
    name: 'Caso 3 · Mayor concentración de sólidos',
    shortName: 'Sólidos altos',
    objective: 'Examinar el efecto combinado de mayor densidad y una reología Bingham más resistente.',
    question: '¿Por qué una pulpa con más sólidos puede exigir más presión incluso si se reduce la velocidad?',
    observe: ['Densidad de pulpa', 'Esfuerzo de pared', 'ΔP total', 'Potencia eléctrica'],
    caution: 'Cw = 50 %, τ₀ = 12 Pa y μp = 0.12 Pa·s son entradas didácticas independientes; PULPA LAB no infiere reología desde Cw sin una correlación calibrada.',
    presentationStartId: 'MILL-01',
    patch: {
      slurry: { solidsMassFraction: 0.50 },
      rheology: {
        model: 'bingham',
        yieldStressPa: 12,
        plasticViscosityPaS: 0.12,
        consistencyIndex: 0,
        flowIndex: 0,
        newtonianViscosityPaS: 0,
      },
      transport: { pipe1: { velocityMps: 0.9 } },
    },
  }),
  academicCase({
    id: 'herschel-bulkley',
    name: 'Caso 4 · Herschel–Bulkley shear-thinning',
    shortName: 'Herschel–Bulkley',
    objective: 'Visualizar una pulpa con esfuerzo de cedencia y comportamiento pseudoplástico.',
    question: '¿Cómo cambia la respuesta cuando la viscosidad aparente disminuye al aumentar la tasa de corte?',
    observe: ['Perfil radial', 'n local', 'Reynolds generalizado', 'ΔP total'],
    caution: 'El caso se configuró para permanecer en la rama laminar validada del modelo no Newtoniano.',
    presentationStartId: 'MILL-01',
    patch: {
      slurry: { solidsMassFraction: 0.45 },
      rheology: {
        model: 'hb',
        yieldStressPa: 6,
        consistencyIndex: 0.18,
        flowIndex: 0.55,
        plasticViscosityPaS: 0,
        newtonianViscosityPaS: 0,
      },
      transport: { pipe1: { velocityMps: 0.9 } },
    },
  }),
  academicCase({
    id: 'power-law-scope',
    name: 'Caso 5 · Ley de Potencia y límite de alcance',
    shortName: 'Power Law',
    objective: 'Distinguir entre un resultado validado y una estimación educativa fuera de la rama laminar.',
    question: '¿Qué debe reportar un ingeniero cuando el régimen calculado sale del dominio validado del modelo?',
    observe: ['Reynolds generalizado', 'Régimen', 'Estado del modelo', 'Calidad del resultado'],
    caution: 'Este caso está preparado deliberadamente para mostrar una estimación no Newtoniana fuera de laminar; no debe presentarse como CFD turbulento validado.',
    presentationStartId: 'SLURRY-PUMP-01',
    patch: {
      slurry: { solidsMassFraction: 0.40 },
      rheology: {
        model: 'power',
        yieldStressPa: 0,
        consistencyIndex: 0.12,
        flowIndex: 0.65,
        plasticViscosityPaS: 0,
        newtonianViscosityPaS: 0,
      },
      transport: { pipe1: { velocityMps: 1.0 } },
    },
  }),
  academicCase({
    id: 'static-head-energy',
    name: 'Caso 6 · Elevación y consumo energético',
    shortName: 'Carga estática',
    objective: 'Separar pérdidas por fricción de la componente estática de elevación y observar su impacto energético.',
    question: '¿Cuánto aumenta la demanda de bombeo cuando crecen longitud y desnivel aunque el diámetro no cambie?',
    observe: ['Componente estática', 'Carga total', 'Potencia eléctrica', 'Energía anual'],
    caution: 'Caso comparativo con reología Newtoniana didáctica para aislar el efecto hidráulico de L y Δz.',
    presentationStartId: 'SLURRY-PUMP-01',
    patch: {
      rheology: {
        model: 'newtonian',
        yieldStressPa: 0,
        consistencyIndex: 0,
        flowIndex: 0,
        plasticViscosityPaS: 0,
        newtonianViscosityPaS: 0.008,
      },
      transport: {
        pipe1: {
          lengthM: 180,
          elevationChangeM: 20,
          velocityMps: 1.2,
        },
      },
    },
  }),
]);

export function getAcademicCase(id) {
  return ACADEMIC_CASES.find((item) => item.id === id) ?? null;
}

export function loadAcademicCase(id, updateState, resetState = null) {
  const selected = getAcademicCase(id);
  if (!selected) throw new RangeError(`Caso académico no disponible: ${id}.`);
  resetState?.();
  updateState(structuredClone(selected.inputs));
  return selected;
}
