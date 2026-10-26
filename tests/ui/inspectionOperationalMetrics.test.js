import { describe, expect, it } from 'vitest';
import { getInspectionOperationalMetrics } from '../../src/ui/inspectionMetrics.js';

function rowByKey(snapshot, key) {
  return snapshot.rows.find((item) => item.key === key);
}

describe('B69 Inspection operational metrics', () => {
  it('keeps imposed flow distinct from Qop and labels power/NPSH on the operating-point basis', () => {
    const snapshot = getInspectionOperationalMetrics('SLURRY-PUMP-01', {}, {
      transport: { flowRateM3s: 0.03 },
      pump: {
        operatingPoint: { flowRateM3s: 0.025, pumpHeadM: 24.5, systemHeadM: 24.5 },
        npshAvailableM: 7.2,
        npsh: { requiredNpshM: 4.1, marginM: 3.1 },
      },
      energy: { basis: 'pump-operating-point', electricalPowerW: 12800 },
    });

    expect(rowByKey(snapshot, 'imposed-flow')).toMatchObject({ label: 'Q impuesto', value: '108.00 m³/h' });
    expect(rowByKey(snapshot, 'operating-flow')).toMatchObject({ label: 'Qop', value: '90.00 m³/h' });
    expect(rowByKey(snapshot, 'head-match').value).toBe('24.50 / 24.50 m');
    expect(rowByKey(snapshot, 'power')).toMatchObject({ label: 'Potencia eléctrica @ Qop', value: '12.80 kW' });
    expect(rowByKey(snapshot, 'npshr').value).toBe('4.10 m');
    expect(rowByKey(snapshot, 'npsh-margin').value).toBe('3.10 m');
    expect(snapshot.status).toMatchObject({ tone: 'valid', label: 'Punto de operación válido' });
    expect(snapshot.summary).toBe('Qop 90.00 m³/h · P 12.80 kW');
  });

  it('falls back to imposed-flow presentation when no H-Q operating point exists', () => {
    const snapshot = getInspectionOperationalMetrics('PUMP-01', {}, {
      transport: { flowRateM3s: 0.03 },
      pump: { status: 'not-configured' },
      energy: { basis: 'imposed-flow', electricalPowerW: 9600 },
    });

    expect(rowByKey(snapshot, 'operating-flow')).toBeUndefined();
    expect(rowByKey(snapshot, 'power')).toMatchObject({ label: 'Potencia eléctrica @ Q impuesto', value: '9.60 kW' });
    expect(snapshot.status.tone).toBe('pending');
    expect(snapshot.summary).toBe('Q 108.00 m³/h');
  });

  it('surfaces hydraulic regime and result quality without changing the calculation', () => {
    const snapshot = getInspectionOperationalMetrics('P-MILL-TO-SUMP', {
      transport: { pipe1: { velocityMps: 2.125 } },
    }, {
      transport: {
        flowRateM3s: 0.02,
        reynoldsNumber: 3400,
        pressureDropPa: 126500,
        flowRegime: 'transition',
        resultQuality: 'educational-estimate',
        modelStatus: 'Fuera de la rama validada.',
      },
    });

    expect(rowByKey(snapshot, 'flow').value).toBe('72.00 m³/h');
    expect(rowByKey(snapshot, 'velocity').value).toBe('2.125 m/s');
    expect(rowByKey(snapshot, 'pressure-drop').value).toBe('126.50 kPa');
    expect(rowByKey(snapshot, 'regime').value).toBe('Transición');
    expect(snapshot.status).toEqual({
      tone: 'educational',
      label: 'Estimación educativa',
      detail: 'Fuera de la rama validada.',
    });
  });

  it('uses process metrics for leaching and recovery stages, including downstream recovery lines', () => {
    const leach = getInspectionOperationalMetrics('R-03', {}, {
      leaching: { residenceTimeH: 18.5, conversion: 0.8125 },
    });
    expect(rowByKey(leach, 'residence').value).toBe('18.50 h');
    expect(rowByKey(leach, 'conversion').value).toBe('81.25 %');
    expect(leach.summary).toBe('Conversión 81.25 %');

    const recovery = getInspectionOperationalMetrics('P-ELUTION-TO-EW', {}, {
      recovery: { overallRecovery: 0.934, finalMetalKgH: 7.81234 },
      transport: { flowRateM3s: 0.04, pressureDropPa: 999999 },
    });
    expect(rowByKey(recovery, 'recovery').value).toBe('93.40 %');
    expect(rowByKey(recovery, 'metal').value).toBe('7.8123 kg/h');
    expect(rowByKey(recovery, 'pressure-drop')).toBeUndefined();
  });

  it('does not invent solver KPIs for mine-handling equipment', () => {
    const snapshot = getInspectionOperationalMetrics('EXCAVATOR-01', {}, {
      transport: { flowRateM3s: 0.04 },
      recovery: { overallRecovery: 0.95 },
    });
    expect(snapshot.rows).toEqual([]);
    expect(snapshot.summary).toBeNull();
    expect(snapshot.status).toMatchObject({ tone: 'neutral', label: 'Sin KPI directo del solver' });
  });
});
