import { describe, expect, it } from 'vitest';
import {
  RECOVERY_PROCESS_ROUTE,
  RECOVERY_ROUTE_ID,
  assertRenderableProcessRoute,
  assertValidatedProcessRoute,
  getProcessRoute,
} from '../src/process/processRoute.js';

describe('recovery processRoute', () => {
  it('exposes one immutable source of truth', () => {
    expect(getProcessRoute()).toBe(RECOVERY_PROCESS_ROUTE);
    expect(Object.isFrozen(RECOVERY_PROCESS_ROUTE)).toBe(true);
    expect(Object.isFrozen(RECOVERY_PROCESS_ROUTE.stages)).toBe(true);
    expect(Object.isFrozen(RECOVERY_PROCESS_ROUTE.finalProduct)).toBe(true);
  });

  it('defines the CIP/elution/EW/smelting topology in one ordered route', () => {
    expect(RECOVERY_PROCESS_ROUTE.id).toBe(RECOVERY_ROUTE_ID);
    expect(RECOVERY_PROCESS_ROUTE.stages.map((stage) => stage.role)).toEqual([
      'adsorption',
      'elution',
      'electrowinning',
      'smelting',
    ]);
    expect(RECOVERY_PROCESS_ROUTE.connections).toHaveLength(3);
    expect(RECOVERY_PROCESS_ROUTE.finalProduct.id).toBe('DORE');
  });

  it('allows rendering and the explicit stage-efficiency balance without inventing efficiencies', () => {
    expect(RECOVERY_PROCESS_ROUTE.validation.topologyValidated).toBe(true);
    expect(RECOVERY_PROCESS_ROUTE.validation.canRender3D).toBe(true);
    expect(RECOVERY_PROCESS_ROUTE.validation.calculationValidated).toBe(true);
    expect(RECOVERY_PROCESS_ROUTE.validation.canCalculateRecovery).toBe(true);
    expect(RECOVERY_PROCESS_ROUTE.recoveryModel.requiresExplicitStageEfficiencies).toBe(true);
    expect(assertRenderableProcessRoute()).toBe(RECOVERY_PROCESS_ROUTE);
  });

  it('validates only the explicit mass-balance contract', () => {
    expect(assertValidatedProcessRoute()).toBe(RECOVERY_PROCESS_ROUTE);
    expect(RECOVERY_PROCESS_ROUTE.recoveryModel.predictsIntrinsicEfficiency).toBe(false);
  });
});
