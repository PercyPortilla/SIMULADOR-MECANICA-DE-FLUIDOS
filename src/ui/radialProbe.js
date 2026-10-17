function validateProfile(profile) {
  const radius = profile?.radiusM;
  const velocity = profile?.velocityMps;
  if (!Array.isArray(radius) || !Array.isArray(velocity) || radius.length === 0) {
    throw new RangeError('El perfil radial requiere radiusM y velocityMps con datos.');
  }
  if (radius.length !== velocity.length) {
    throw new RangeError('radiusM y velocityMps deben tener la misma longitud.');
  }
  let previousRadius = -Infinity;
  radius.forEach((value, index) => {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
      throw new RangeError(`radiusM[${index}] debe ser finito y no negativo.`);
    }
    if (value < previousRadius) {
      throw new RangeError('radiusM debe estar ordenado de centro a pared.');
    }
    previousRadius = value;
  });
  velocity.forEach((value, index) => {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
      throw new RangeError(`velocityMps[${index}] debe ser finito y no negativo.`);
    }
  });
}

function escapeCsv(value) {
  return `"${String(value ?? '').replaceAll('"', '""')}"`;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function formatNumber(value, decimals) {
  return Number(value).toFixed(decimals);
}

export function buildRadialProbeRows(profile) {
  validateProfile(profile);
  const pipeRadiusM = Math.max(...profile.radiusM);
  const maxVelocityMps = Math.max(...profile.velocityMps);
  return profile.radiusM.map((radiusM, index) => ({
    index,
    radiusM,
    radiusRatio: pipeRadiusM > 0 ? radiusM / pipeRadiusM : 0,
    wallDistanceM: pipeRadiusM - radiusM,
    velocityMps: profile.velocityMps[index],
    velocityRatio: maxVelocityMps > 0 ? profile.velocityMps[index] / maxVelocityMps : 0,
    shearStressPa: profile.shearStressPa?.[index] ?? null,
    shearRateS_1: profile.shearRateS_1?.[index] ?? null,
    apparentViscosityPaS: profile.apparentViscosityPaS?.[index] ?? null,
  }));
}

export function radialProbeToCsv(profile, { decimals = 6 } = {}) {
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 12) {
    throw new RangeError('decimals debe ser un entero entre 0 y 12.');
  }
  const rows = buildRadialProbeRows(profile);
  const headers = [
    'index',
    'radius_m',
    'radius_ratio',
    'wall_distance_m',
    'velocity_m_s',
    'velocity_ratio',
    'shear_stress_pa',
    'shear_rate_1_s',
    'apparent_viscosity_pa_s',
  ];
  return [
    headers.map(escapeCsv).join(','),
    ...rows.map((row) => [
      row.index,
      formatNumber(row.radiusM, decimals),
      formatNumber(row.radiusRatio, decimals),
      formatNumber(row.wallDistanceM, decimals),
      formatNumber(row.velocityMps, decimals),
      formatNumber(row.velocityRatio, decimals),
      row.shearStressPa === null ? '' : formatNumber(row.shearStressPa, decimals),
      row.shearRateS_1 === null ? '' : formatNumber(row.shearRateS_1, decimals),
      row.apparentViscosityPaS === null ? '' : formatNumber(row.apparentViscosityPaS, decimals),
    ].map(escapeCsv).join(',')),
  ].join('\n');
}

export function radialProbeToHtmlTable(profile, { decimals = 4, caption = 'Sonda radial de velocidad' } = {}) {
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 12) {
    throw new RangeError('decimals debe ser un entero entre 0 y 12.');
  }
  const rows = buildRadialProbeRows(profile);
  const body = rows.map((row) => `
      <tr>
        <td>${row.index}</td>
        <td>${formatNumber(row.radiusM, decimals)}</td>
        <td>${formatNumber(row.radiusRatio, decimals)}</td>
        <td>${formatNumber(row.wallDistanceM, decimals)}</td>
        <td>${formatNumber(row.velocityMps, decimals)}</td>
        <td>${formatNumber(row.velocityRatio, decimals)}</td>
        <td>${row.shearStressPa === null ? '—' : formatNumber(row.shearStressPa, decimals)}</td>
        <td>${row.shearRateS_1 === null ? '—' : formatNumber(row.shearRateS_1, decimals)}</td>
        <td>${row.apparentViscosityPaS === null ? 'No definida' : formatNumber(row.apparentViscosityPaS, decimals)}</td>
      </tr>`).join('');
  return `<table class="radial-probe-table">
    <caption>${escapeHtml(caption)}</caption>
    <thead>
      <tr><th>i</th><th>r (m)</th><th>r/R</th><th>R-r (m)</th><th>v (m/s)</th><th>v/vmax</th><th>τ (Pa)</th><th>γ̇ (s⁻¹)</th><th>μa (Pa·s)</th></tr>
    </thead>
    <tbody>${body}
    </tbody>
  </table>`;
}
