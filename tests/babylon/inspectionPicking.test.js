import { describe, expect, it, vi } from 'vitest';
import {
  activateBabylonInspectionPick,
  createBabylonInspectionHoverPayload,
  resolveBabylonInspectionPick,
} from '../../src/babylon/runtime/baseEnvironment.js';

describe('B67 clickable Inspection flow', () => {
  it('resolves a valid mesh click and activates Inspection with smooth framing', () => {
    const equipmentMesh = { name: 'MILL-01_SHELL' };
    const inspectionSystem = {
      resolvePickTargetId: vi.fn((mesh) => mesh === equipmentMesh ? 'MILL-01' : null),
    };
    const scene = {
      activeCamera: { name: 'general' },
      pick: vi.fn((x, y, predicate) => ({
        hit: x === 120 && y === 80 && predicate(equipmentMesh),
        pickedMesh: equipmentMesh,
      })),
    };
    const setTarget = vi.fn();
    const setCamera = vi.fn();
    const onPick = vi.fn();

    const id = resolveBabylonInspectionPick({
      scene,
      inspectionSystem,
      x: 120,
      y: 80,
    });
    expect(id).toBe('MILL-01');
    expect(scene.pick).toHaveBeenCalledTimes(1);

    expect(activateBabylonInspectionPick({
      id,
      setTarget,
      setCamera,
      activeCamera: 'general',
      onPick,
    })).toBe(true);
    expect(setTarget).toHaveBeenCalledWith('MILL-01', { smooth: true });
    expect(setCamera).toHaveBeenCalledWith('inspection');
    expect(onPick).toHaveBeenCalledWith('MILL-01');
  });

  it('changes click objective through the same activation contract', () => {
    let selected = null;
    const setTarget = vi.fn((id) => { selected = id; });
    const setCamera = vi.fn();

    activateBabylonInspectionPick({
      id: 'MILL-01',
      setTarget,
      setCamera,
      activeCamera: 'inspection',
    });
    activateBabylonInspectionPick({
      id: 'SUMP-01',
      setTarget,
      setCamera,
      activeCamera: 'inspection',
    });

    expect(selected).toBe('SUMP-01');
    expect(setTarget).toHaveBeenNthCalledWith(1, 'MILL-01', { smooth: true });
    expect(setTarget).toHaveBeenNthCalledWith(2, 'SUMP-01', { smooth: true });
    expect(setCamera).not.toHaveBeenCalled();
  });

  it('treats empty, invalid and failed picks as safe no-ops', () => {
    const inspectionSystem = { resolvePickTargetId: vi.fn(() => null) };
    const emptyScene = {
      activeCamera: {},
      pick: vi.fn(() => ({ hit: false, pickedMesh: null })),
    };
    const throwingScene = {
      activeCamera: {},
      pick: vi.fn(() => { throw new Error('pick failed'); }),
    };
    const setTarget = vi.fn();
    const setCamera = vi.fn();

    expect(resolveBabylonInspectionPick({
      scene: emptyScene,
      inspectionSystem,
      x: 10,
      y: 20,
    })).toBeNull();
    expect(resolveBabylonInspectionPick({
      scene: throwingScene,
      inspectionSystem,
      x: 10,
      y: 20,
    })).toBeNull();
    expect(resolveBabylonInspectionPick({
      scene: emptyScene,
      inspectionSystem,
      x: Number.NaN,
      y: 20,
    })).toBeNull();
    expect(activateBabylonInspectionPick({
      id: null,
      setTarget,
      setCamera,
      activeCamera: 'general',
    })).toBe(false);
    expect(setTarget).not.toHaveBeenCalled();
    expect(setCamera).not.toHaveBeenCalled();
  });

  it('builds a compact hover payload from the same canonical Inspection metadata', () => {
    expect(createBabylonInspectionHoverPayload({
      id: 'MILL-01',
      target: { label: 'Molino SAG', kind: 'equipment' },
      x: 88,
      y: 42,
    })).toEqual({
      id: 'MILL-01',
      label: 'Molino SAG',
      kind: 'equipment',
      x: 88,
      y: 42,
    });
    expect(createBabylonInspectionHoverPayload({ id: null, target: null, x: 1, y: 2 })).toBeNull();
    expect(createBabylonInspectionHoverPayload({
      id: 'MILL-01',
      target: { label: 'Molino SAG' },
      x: Number.NaN,
      y: 2,
    })).toBeNull();
  });
});
