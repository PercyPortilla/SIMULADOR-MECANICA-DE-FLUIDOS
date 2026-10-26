const MODEL_LABELS = Object.freeze({
  newtonian: 'Newtoniano',
  hb: 'Herschel–Bulkley',
  bingham: 'Bingham plástico',
  power: 'Ley de potencia',
  casson: 'Casson',
});

const REGIME_LABELS = Object.freeze({
  stagnant: 'Sin flujo',
  laminar: 'Laminar',
  transition: 'Transición',
  turbulent: 'Turbulento',
  'laminar-model-only': 'Laminar · alcance del modelo',
});

const PUMP_IDS = new Set(['SLURRY-PUMP-01', 'PUMP-01']);
const RECOVERY_IDS = new Set([
  'CIP-ADSORPTION',
  'MT-CIP-TO-ELUTION-CARBON',
  'ELUTION-SKID',
  'MT-ELUTION-TO-CIP-BARREN-CARBON',
  'P-ELUTION-TO-EW',
  'EW-CELLS',
  'MT-EW-TO-SMELTING-CATHODE',
  'SMELTING-FURNACE',
]);

function fixed(value, digits = 2) {
  return Number.isFinite(value) ? Number(value).toFixed(digits) : null;
}

function row(label, value, key) {
  return value === null || value === undefined ? null : Object.freeze({ label, value, key });
}

function compact(rows) {
  return Object.freeze(rows.filter(Boolean));
}

function qualityStatus(transport = {}) {
  if (transport.pressureDropPa === undefined) {
    return Object.freeze({ tone: 'pending', label: 'Hidráulica pendiente', detail: 'No hay resultado hidráulico calculable para el escenario activo.' });
  }
  if (transport.resultQuality === 'educational-estimate') {
    return Object.freeze({ tone: 'educational', label: 'Estimación educativa', detail: transport.modelStatus || 'Resultado fuera de la rama validada; interpretar con cautela.' });
  }
  if (transport.resultQuality === 'laminar-profile-only') {
    return Object.freeze({ tone: 'limited', label: 'Alcance hidráulico limitado', detail: transport.modelStatus || 'El resultado disponible corresponde al alcance laminar implementado.' });
  }
  return Object.freeze({ tone: 'valid', label: 'Hidráulica calculada', detail: transport.calculationMode || 'Resultado del modelo hidráulico activo.' });
}

function pumpSnapshot(results) {
  const transport = results.transport ?? {};
  const pump = results.pump ?? {};
  const energy = results.energy ?? {};
  const npsh = pump.npsh ?? {};
  const imposedFlowM3h = Number.isFinite(transport.flowRateM3s) ? transport.flowRateM3s * 3600 : null;
  const operatingFlowM3h = Number.isFinite(pump.operatingPoint?.flowRateM3s) ? pump.operatingPoint.flowRateM3s * 3600 : null;
  const powerKw = Number.isFinite(energy.electricalPowerW) ? energy.electricalPowerW / 1000 : null;
  const energyAtQop = energy.basis === 'pump-operating-point';
  const rows = compact([
    row('Q impuesto', imposedFlowM3h === null ? null : `${fixed(imposedFlowM3h)} m³/h`, 'imposed-flow'),
    row('Qop', operatingFlowM3h === null ? null : `${fixed(operatingFlowM3h)} m³/h`, 'operating-flow'),
    pump.operatingPoint ? row('H bomba / H sistema', `${fixed(pump.operatingPoint.pumpHeadM)} / ${fixed(pump.operatingPoint.systemHeadM)} m`, 'head-match') : null,
    row(energyAtQop ? 'Potencia eléctrica @ Qop' : 'Potencia eléctrica @ Q impuesto', powerKw === null ? null : `${fixed(powerKw)} kW`, 'power'),
    row('NPSH-A', Number.isFinite(pump.npshAvailableM) ? `${fixed(pump.npshAvailableM)} m` : null, 'npsha'),
    row('NPSH-R @ Qop', Number.isFinite(npsh.requiredNpshM) ? `${fixed(npsh.requiredNpshM)} m` : null, 'npshr'),
    row('Margen NPSH', Number.isFinite(npsh.marginM) ? `${fixed(npsh.marginM)} m` : null, 'npsh-margin'),
  ]);
  const status = pump.operatingPoint
    ? Object.freeze({ tone: 'valid', label: 'Punto de operación válido', detail: 'Potencia, energía y NPSH se muestran en la base operativa resuelta por la curva H–Q.' })
    : pump.status === 'invalid'
      ? Object.freeze({ tone: 'invalid', label: 'Bomba no calculable', detail: pump.modelStatus || 'No se pudo resolver un punto de operación válido.' })
      : Object.freeze({ tone: 'pending', label: 'Sin punto de operación H–Q', detail: pump.modelStatus || 'Se conserva la base de caudal impuesto cuando no existe una curva de bomba válida.' });
  const summary = operatingFlowM3h !== null
    ? `Qop ${fixed(operatingFlowM3h)} m³/h${powerKw === null ? '' : ` · P ${fixed(powerKw)} kW`}`
    : imposedFlowM3h !== null ? `Q ${fixed(imposedFlowM3h)} m³/h` : null;
  return Object.freeze({ rows, status, summary });
}

function hydraulicSnapshot(state, results) {
  const transport = results.transport ?? {};
  const qM3h = Number.isFinite(transport.flowRateM3s) ? transport.flowRateM3s * 3600 : null;
  const rows = compact([
    row('Q circuito', qM3h === null ? null : `${fixed(qM3h)} m³/h`, 'flow'),
    row('V Pipe 1', Number.isFinite(state.transport?.pipe1?.velocityMps) ? `${fixed(state.transport.pipe1.velocityMps, 3)} m/s` : null, 'velocity'),
    row('Re', Number.isFinite(transport.reynoldsNumber) ? fixed(transport.reynoldsNumber, 0) : null, 'reynolds'),
    row('ΔP circuito', Number.isFinite(transport.pressureDropPa) ? `${fixed(transport.pressureDropPa / 1000)} kPa` : null, 'pressure-drop'),
    row('Régimen', REGIME_LABELS[transport.flowRegime] || transport.flowRegime || null, 'regime'),
    row('Calidad', transport.resultQuality || null, 'quality'),
  ]);
  const summary = qM3h === null ? null : `Q ${fixed(qM3h)} m³/h${Number.isFinite(transport.pressureDropPa) ? ` · ΔP ${fixed(transport.pressureDropPa / 1000)} kPa` : ''}`;
  return Object.freeze({ rows, status: qualityStatus(transport), summary });
}

function slurrySnapshot(results) {
  const slurry = results.slurry ?? {};
  const rheology = results.rheology ?? {};
  const rows = compact([
    row('ρ pulpa', Number.isFinite(slurry.densityKgM3) ? `${fixed(slurry.densityKgM3, 1)} kg/m³` : null, 'density'),
    row('Sólidos vol.', Number.isFinite(slurry.solidVolumeFraction) ? `${fixed(slurry.solidVolumeFraction * 100)} %` : null, 'solids'),
    row('Modelo reológico', MODEL_LABELS[rheology.model] || rheology.model || null, 'rheology'),
  ]);
  const status = rows.length
    ? Object.freeze({ tone: 'valid', label: 'Pulpa caracterizada', detail: 'Valores procedentes del escenario de pulpa y del modelo reológico activo.' })
    : Object.freeze({ tone: 'pending', label: 'Pulpa pendiente', detail: 'Faltan resultados de pulpa/reología para este escenario.' });
  const summary = Number.isFinite(slurry.densityKgM3) ? `ρ ${fixed(slurry.densityKgM3, 1)} kg/m³` : null;
  return Object.freeze({ rows, status, summary });
}

function leachSnapshot(results) {
  const leaching = results.leaching ?? {};
  const rows = compact([
    row('Residencia tren', Number.isFinite(leaching.residenceTimeH) ? `${fixed(leaching.residenceTimeH)} h` : null, 'residence'),
    row('Conversión tren', Number.isFinite(leaching.conversion) ? `${fixed(leaching.conversion * 100)} %` : null, 'conversion'),
  ]);
  const status = rows.length
    ? Object.freeze({ tone: 'valid', label: 'Lixiviación calculada', detail: 'La residencia y conversión corresponden al tren de reactores del escenario activo.' })
    : Object.freeze({ tone: 'pending', label: 'Lixiviación pendiente', detail: 'No hay resultados de lixiviación disponibles.' });
  const summary = Number.isFinite(leaching.conversion) ? `Conversión ${fixed(leaching.conversion * 100)} %` : null;
  return Object.freeze({ rows, status, summary });
}

function recoverySnapshot(results) {
  const recovery = results.recovery ?? {};
  const rows = compact([
    row('Recuperación global', Number.isFinite(recovery.overallRecovery) ? `${fixed(recovery.overallRecovery * 100)} %` : null, 'recovery'),
    row('Metal final', Number.isFinite(recovery.finalMetalKgH) ? `${fixed(recovery.finalMetalKgH, 4)} kg/h` : null, 'metal'),
  ]);
  const status = rows.length
    ? Object.freeze({ tone: 'valid', label: 'Recuperación calculada', detail: 'Valores globales del circuito de recuperación del escenario activo.' })
    : Object.freeze({ tone: 'pending', label: 'Recuperación pendiente', detail: 'No hay balance de recuperación calculado.' });
  const summary = Number.isFinite(recovery.overallRecovery) ? `Rec. ${fixed(recovery.overallRecovery * 100)} %` : null;
  return Object.freeze({ rows, status, summary });
}

export function getInspectionOperationalMetrics(id, state = {}, results = {}) {
  if (!id) return Object.freeze({ rows: Object.freeze([]), status: null, summary: null });
  if (PUMP_IDS.has(id)) return pumpSnapshot(results);
  if (RECOVERY_IDS.has(id)) return recoverySnapshot(results);
  if (/^R-0[1-4]$/.test(id)) return leachSnapshot(results);
  if (id === 'MILL-01') return slurrySnapshot(results);
  if (id.startsWith('P-') || id === 'SUMP-01' || id === 'CLASS-01') return hydraulicSnapshot(state, results);
  return Object.freeze({
    rows: Object.freeze([]),
    status: Object.freeze({ tone: 'neutral', label: 'Sin KPI directo del solver', detail: 'Este equipo forma parte del gemelo 3D, pero el modelo actual no calcula un KPI operativo específico para él.' }),
    summary: null,
  });
}
