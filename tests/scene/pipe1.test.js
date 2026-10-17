import { describe, expect, it } from 'vitest';
import { createEquipmentSystem } from '../../src/scene/equipment/equipmentSystem.js';
import { createPipe1System, getRenderedPipeDiameter } from '../../src/scene/piping/pipe1.js';

function makePipeState(overrides = {}) {
  return {
    innerDiameterM: 0.05,
    lengthM: 2,
    roughnessM: 0.000045,
    material: 'Acero',
    velocityMps: 1.5,
    ...overrides,
  };
}

describe('Pipe 1 renderer', () => {
  it('connects fixed R-01 outlet to fixed R-02 inlet without moving the plant layout', () => {
    const equipment = createEquipmentSystem();
    const system = createPipe1System({ equipmentSystem: equipment });
    const beforeR02 = equipment.getEquipment('R-02').group3D.position.clone();
    const mesh = system.update(makePipeState());
    const start = equipment.getPortWorldPosition('R-01', 'outlet');
    const end = equipment.getPortWorldPosition('R-02', 'inlet');

    expect(mesh.userData.start).toEqual(start.toArray());
    expect(mesh.userData.end).toEqual(end.toArray());
    expect(mesh.userData.requestedHydraulicLengthM).toBe(2);
    expect(equipment.getEquipment('R-02').group3D.position.equals(beforeR02)).toBe(true);
  });

  it('keeps hydraulic input length separate from rendered geometric route length', () => {
    const equipment = createEquipmentSystem();
    const system = createPipe1System({ equipmentSystem: equipment });
    const first = system.update(makePipeState({ lengthM: 1 }));
    const firstStart = [...first.userData.start];
    const second = system.update(makePipeState({ lengthM: 20 }));

    expect(second.userData.start).toEqual(firstStart);
    expect(second.userData.requestedHydraulicLengthM).toBe(20);
    expect(second.userData.visualRouteLengthM).toBeGreaterThan(0);
    expect(Number.isFinite(second.userData.visualRouteLengthM)).toBe(true);
  });

  it('keeps real diameter in state metadata while visual exaggeration stays renderer-only', () => {
    const equipment = createEquipmentSystem();
    const system = createPipe1System({ equipmentSystem: equipment });
    const mesh = system.update(makePipeState({ innerDiameterM: 0.025 }));

    expect(mesh.userData.realDiameterM).toBe(0.025);
    expect(mesh.userData.renderedDiameterM).toBe(getRenderedPipeDiameter(0.025));
    expect(mesh.userData.renderedDiameterM).toBeGreaterThanOrEqual(0.40);
  });

  it('renders no fallback pipe when length or diameter is zero', () => {
    const equipment = createEquipmentSystem();
    const system = createPipe1System({ equipmentSystem: equipment });

    expect(system.update(makePipeState({ lengthM: 0 }))).toBeNull();
    expect(system.root.children).toHaveLength(0);
    expect(system.update(makePipeState({ innerDiameterM: 0 }))).toBeNull();
    expect(system.root.children).toHaveLength(0);
  });
});
