import { describe, expect, it } from 'vitest';
import { describeNpsh, renderNpshDiagnostic } from '../../src/ui/npshDiagnostic.js';

describe('NPSH comparison, display only', () => {
  it('does not invent a required value when no curve is supplied', () => {
    const result = describeNpsh({ npshAvailableM: 5.5 });
    expect(result.state).toBe('incomplete');
    expect(result.requiredM).toBeNull();
    expect(renderNpshDiagnostic({ npshAvailableM: 5.5 })).toContain('Falta una curva NPSHr');
    expect(renderNpshDiagnostic(null)).toContain('Comparación no disponible');
  });
  it('renders a calculated positive margin without claiming cavitation safety', () => {
    const pump = {
      npshAvailableM: 6.1,
      npshEvaluationFlowRateM3s: 0.02,
      npsh: { requiredNpshM: 3.2, marginM: 2.9, meetsRequirement: true },
    };
    const result = describeNpsh(pump);
    expect(result.state).toBe('meets');
    expect(result.marginM).toBeCloseTo(2.9);
    expect(result.flowM3h).toBeCloseTo(72);
    expect(renderNpshDiagnostic(pump)).toContain('NPSHa es al menos igual');
    expect(renderNpshDiagnostic(pump)).toContain('no sensor ni predicción de cavitación');
  });
  it('flags negative margin without making up alarm sensors', () => {
    const value = { npshAvailableM: 1.4, npsh: { requiredNpshM: 4.3 } };
    const result = describeNpsh(value);
    expect(result.state).toBe('below');
    expect(result.marginM).toBeCloseTo(-2.9);
    expect(renderNpshDiagnostic(value)).toContain('Por debajo del NPSHr');
    expect(renderNpshDiagnostic(value)).toContain('NO cumple');
  });
  it('keeps zero required NPSH explicit and handles negative available head', () => {
    expect(describeNpsh({ npshAvailableM: -2, npsh: { requiredNpshM: 0 } }).state).toBe('below');
    expect(describeNpsh({ npshAvailableM: -2, npsh: { requiredNpshM: 0 } }).ratio).toBeNull();
    expect(describeNpsh({ npshAvailableM: 0, npsh: { requiredNpshM: 0 } }).state).toBe('meets');
  });
});
