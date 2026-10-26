import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const mainSource = readFileSync(new URL('../../src/main.js', import.meta.url), 'utf8');
const runtimeSource = readFileSync(new URL('../../src/babylon/runtime/baseEnvironment.js', import.meta.url), 'utf8');
const inspectionSource = readFileSync(new URL('../../src/babylon/inspection/equipmentInspection.js', import.meta.url), 'utf8');

describe('B70 operational status beacon', () => {
  it('bridges B69 status into Babylon without recalculating solver values', () => {
    expect(mainSource).toMatch(/const operational = getInspectionOperationalMetrics\(id, getState\(\), getResults\(\)\);/);
    expect(mainSource).toMatch(/environment\.setInspectionOperationalStatus\?\.\(operational\.status\);/);
    expect(mainSource).toMatch(/environment\.setInspectionOperationalStatus\?\.\(null\);/);
    expect(runtimeSource).toContain('function setInspectionOperationalStatus(status)');
    expect(runtimeSource).toMatch(/base\.equipmentInspection\.setOperationalStatus\?\.\(status\)/);
  });

  it('keeps the status beacon separate from selected/upstream/downstream context', () => {
    expect(inspectionSource).toContain("new TransformNode('inspection-operational-status', scene)");
    expect(inspectionSource).toContain("new TransformNode('inspection-circuit-context', scene)");
    expect(inspectionSource).toMatch(/CreateSphere\(`inspection-status-\$\{id\}`/);
    expect(inspectionSource).toMatch(/beacon\.isPickable = false/);
    expect(inspectionSource).toMatch(/visualOnly: true/);
  });

  it('shows the beacon only in Inspection when a selected target has a status', () => {
    expect(runtimeSource).toMatch(/statusOverlay\?\.setEnabled\?\.\([\s\S]*?id === INSPECTION_CAMERA_ID[\s\S]*?operationalStatus/);
    expect(runtimeSource).toMatch(/activeCamera === INSPECTION_CAMERA_ID[\s\S]*?Boolean\(normalized\)/);
  });
});
