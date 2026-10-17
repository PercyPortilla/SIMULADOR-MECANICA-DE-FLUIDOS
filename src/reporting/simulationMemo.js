import { calculationMemoToCsv, calculationMemoToHtml } from './calculationMemo.js';

function num(value, digits = 6) {
  return typeof value === 'number' && Number.isFinite(value) ? Number(value.toPrecision(digits)).toString() : '—';
}

function row(key, label, value, unit = '') { return { key, label, value: String(value), unit }; }

function rheologyEquation(model) {
  if (model === 'hb') return 'τ = τy + K·γ̇ⁿ';
  if (model === 'bingham') return 'τ = τy + μp·γ̇';
  if (model === 'power') return 'τ = K·γ̇ⁿ';
  if (model === 'casson') return '√τ = √τy + √(μc·γ̇)';
  if (model === 'newtonian') return 'τ = μ·γ̇';
  return 'Modelo no seleccionado';
}

export function buildSimulationMemo({ state, results, scenarioName = 'Escenario actual' }) {
  const warnings = [];
  const assumptions = [
    'Unidades internas SI.',
    'Modelo estacionario y homogéneo; no constituye CFD tridimensional.',
    'La geometría 3D es representativa y no reemplaza diseño mecánico certificado.',
  ];
  if (results.transport?.resultQuality === 'educational-estimate') warnings.push('La hidráulica no newtoniana fuera de laminar se reporta como estimación educativa; el perfil radial es laminar equivalente.');
  if (results.transport?.settling) warnings.push(results.transport.settling.note);
  if (results.rheology?.empiricalScale?.method !== 'disabled' && results.rheology?.empiricalScale) warnings.push('Escalado reológico empírico activo; requiere calibración experimental.');
  if (results.leaching?.rateConstantCorrection?.couplingEnabled) warnings.push('k de lixiviación usa correcciones empíricas activadas por el usuario; los β requieren calibración.');
  if (results.pump?.status === 'multiple-intersections') warnings.push('La curva H–Q presenta múltiples intersecciones con el sistema.');

  const inputRows = [
    row('slurry.Cw', 'Sólidos Cw', num(state.slurry.solidsMassFraction * 100), '% masa'),
    row('slurry.rhoS', 'Densidad sólido', num(state.slurry.solidDensityKgM3), 'kg/m³'),
    row('slurry.rhoL', 'Densidad líquido', num(state.slurry.liquidDensityKgM3), 'kg/m³'),
    row('rheology.model', 'Modelo reológico', state.rheology.model || '—'),
    row('pipe.D', 'Diámetro Pipe 1', num(state.transport.pipe1.innerDiameterM), 'm'),
    row('pipe.L', 'Longitud Pipe 1', num(state.transport.pipe1.lengthM), 'm'),
    row('pipe.V', 'Velocidad Pipe 1', num(state.transport.pipe1.velocityMps), 'm/s'),
    row('pipe.dz', 'Desnivel Pipe 1', num(state.transport.pipe1.elevationChangeM), 'm'),
    row('energy.etaPump', 'Eficiencia bomba', num(state.energy.pumpEfficiency), '0–1'),
    row('energy.etaMotor', 'Eficiencia motor', num(state.energy.motorEfficiency), '0–1'),
    row('leaching.k', 'k lixiviación ingresado', num(state.leaching.firstOrderRateConstantPerH), 'h⁻¹'),
  ];
  const equationRows = [];
  if (results.slurry?.densityKgM3) {
    const w = state.slurry.solidsMassFraction;
    equationRows.push(row('eq.density', 'Densidad de mezcla', 'ρm = 1/[w/ρs + (1−w)/ρl]'));
    equationRows.push(row('sub.density', 'Sustitución densidad', `1/[${num(w)}/${num(state.slurry.solidDensityKgM3)} + ${num(1 - w)}/${num(state.slurry.liquidDensityKgM3)}] = ${num(results.slurry.densityKgM3)}`, 'kg/m³'));
  }
  if (results.transport?.flowRateM3s !== undefined) {
    equationRows.push(row('eq.flow', 'Caudal', 'Q = V·πD²/4'));
    equationRows.push(row('sub.flow', 'Sustitución caudal', `${num(state.transport.pipe1.velocityMps)}·π·${num(state.transport.pipe1.innerDiameterM)}²/4 = ${num(results.transport.flowRateM3s)}`, 'm³/s'));
  }
  equationRows.push(row('eq.rheology', 'Ley constitutiva', rheologyEquation(state.rheology.model)));
  if (results.rheology?.wallStressPa !== undefined) equationRows.push(row('sub.tauw', 'Esfuerzo de pared resuelto', `τw = ${num(results.rheology.wallStressPa)}`, 'Pa'));
  if (results.transport?.pressureDropPa !== undefined) {
    equationRows.push(row('eq.dp', 'Presión total', 'ΔPtotal = ΣΔPdistribuida + ΣΔPmenor + ΣΔPestática'));
    equationRows.push(row('sub.dp', 'Sustitución presión', `${num(results.transport.distributedPressureDropPa)} + ${num(results.transport.minorLossPressurePa)} + ${num(results.transport.staticPressurePa)} = ${num(results.transport.pressureDropPa)}`, 'Pa'));
  }
  if (results.energy?.electricalPowerW !== undefined) {
    equationRows.push(row('eq.power', 'Potencia', 'Ph = ΔP·Q; Pe = Ph/(ηbomba·ηmotor)'));
    equationRows.push(row('sub.power', 'Sustitución potencia eléctrica', `${num(results.transport.requiredPressurePa)}·${num(results.transport.flowRateM3s)}/(${num(state.energy.pumpEfficiency)}·${num(state.energy.motorEfficiency)}) = ${num(results.energy.electricalPowerW)}`, 'W'));
  }
  if (results.leaching?.conversion !== undefined) equationRows.push(row('eq.leach', 'CSTRs en serie', 'X = 1 − [1/(1 + k·τ/N)]ᴺ'));

  const resultRows = [
    row('result.rho', 'Densidad mezcla', num(results.slurry?.densityKgM3), 'kg/m³'),
    row('result.q', 'Caudal', num(results.transport?.flowRateM3s), 'm³/s'),
    row('result.dp', 'Presión total', num(results.transport?.pressureDropPa), 'Pa'),
    row('result.head', 'Carga total', num(results.transport?.totalHeadM), 'm'),
    row('result.regime', 'Régimen', results.transport?.flowRegime ?? '—'),
    row('result.restar', 'Re* / Reynolds', num(results.transport?.reynoldsNumber)),
    row('result.power', 'Potencia eléctrica', num(results.energy?.electricalPowerW), 'W'),
    row('result.energy', 'Energía anual', num(results.energy?.annualEnergyKwh), 'kWh/año'),
    row('result.solids', 'Sólidos', num(results.balance?.solidsMassFlowTh), 't/h'),
    row('result.residence', 'Tiempo residencia', num(results.leaching?.residenceTimeH), 'h'),
    row('result.keff', 'k efectivo', num(results.leaching?.effectiveRateConstantPerH), 'h⁻¹'),
    row('result.conversion', 'Conversión lixiviación', num(results.leaching?.conversion), 'fracción'),
    row('result.recovery', 'Recuperación global', num(results.recovery?.overallRecovery), 'fracción'),
  ];
  const references = [];
  if (String(results.transport?.calculationMode).includes('churchill')) references.push('Churchill, S. W. (1977). Friction-factor equation spans all fluid-flow regimes.');
  if (String(results.transport?.calculationMode).includes('non-newtonian') || results.rheology?.fanningFrictionFactor) references.push('Dodge–Metzner smooth-pipe Fanning correlation; implementation educativa con transición explícita.');
  if (results.transport?.settling) references.push('Durand F_L legacy/orientativo; F_L es entrada explícita y no una calibración automática.');

  return {
    title: `PULPA LAB · Memoria de cálculo · ${scenarioName}`,
    sections: [
      { id: 'metadata', title: 'Trazabilidad del modelo', rows: [row('scenario', 'Escenario', scenarioName), row('quality', 'Calidad del resultado', results.transport?.resultQuality ?? 'validated'), row('mode', 'Modo hidráulico', results.transport?.calculationMode ?? '—')] },
      { id: 'inputs', title: 'Datos de entrada', rows: inputRows },
      { id: 'equations', title: 'Ecuaciones y sustitución', rows: equationRows },
      { id: 'results', title: 'Resultados', rows: resultRows },
      { id: 'assumptions', title: 'Supuestos y alcance', rows: assumptions.map((text, index) => row(`assumption.${index + 1}`, String(index + 1), text)) },
      { id: 'warnings', title: 'Advertencias', rows: warnings.map((text, index) => row(`warning.${index + 1}`, String(index + 1), text)) },
      { id: 'references', title: 'Referencias aplicables', rows: references.map((text, index) => row(`reference.${index + 1}`, String(index + 1), text)) },
    ].filter((section) => section.rows.length),
  };
}

export function simulationMemoToCsv(memo) { return calculationMemoToCsv(memo); }
export function simulationMemoToHtml(memo) { return calculationMemoToHtml(memo); }

export function simulationMemoToPrintableHtml(memo, { autoPrint = true } = {}) {
  return `<!doctype html><html><head><meta charset="utf-8"><title>${memo.title}</title><style>body{font-family:Arial,sans-serif;color:#17212a;margin:32px}header{border-bottom:8px solid #ffb81c;padding-bottom:14px;margin-bottom:24px}header strong{font-size:28px}article>h1{display:none}section{break-inside:avoid;margin:0 0 24px}h2{font-size:16px}table{width:100%;border-collapse:collapse;font-size:10px}th,td{padding:6px;border-bottom:1px solid #ccd2d6;text-align:left}thead th{background:#eef2f5}@page{size:A4;margin:14mm}@media print{body{margin:0}}</style></head><body><header><strong>UPN · PULPA LAB</strong><p>Memoria técnica reproducible · Unidades SI</p></header>${simulationMemoToHtml(memo)}${autoPrint ? '<script>window.addEventListener(\'load\',()=>setTimeout(()=>window.print(),150));</script>' : ''}</body></html>`;
}
