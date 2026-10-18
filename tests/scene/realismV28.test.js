import { describe, expect, it } from 'vitest';
import { createMineProps } from '../../src/scene/environment/mineProps.js';
import { createIndustrialInfrastructure } from '../../src/scene/infrastructure/industrialInfrastructure.js';
import { collectSceneResourceStats, createBaseScene } from '../../src/scene/baseEnvironment.js';

describe('V28 mining and industrial realism', () => {
  it('replaces the exposed ore box with a faceted irregular working face', () => {
    const props = createMineProps();
    const face = props.getObjectByName('pit-exposed-ore-band');
    expect(face).toBeTruthy();
    expect(face.geometry?.type).not.toBe('BoxGeometry');
    expect(face.geometry?.userData?.irregularOreFace).toBe(true);
    expect(face.userData.irregularOreFace).toBe(true);
  });

  it('adds bounded substation containment, weathering and fence cues', () => {
    const root = createIndustrialInfrastructure();
    const yard = root.getObjectByName('v24-transformer-yard');
    expect(yard?.userData.v28SubstationDetail).toBe(true);
    expect(yard.getObjectByName('transformer-yard-oil-weathering')).toBeTruthy();
    expect(yard.children.filter((child) => child.name.startsWith('transformer-bund-'))).toHaveLength(4);
    expect(yard.children.filter((child) => child.name.startsWith('transformer-fence-post-')).length).toBeGreaterThanOrEqual(16);
  });

  it('adds human and light-vehicle scale cues without replacing V24 assets', () => {
    const root = createIndustrialInfrastructure();
    expect(root.userData.v28RealismInfrastructure).toBe(true);
    expect(root.userData.humanScaleCount).toBeGreaterThanOrEqual(4);
    expect(root.userData.lightVehicleCount).toBe(2);
    expect(root.getObjectByName('v24-supervision-pickup')).toBeTruthy();
    expect(root.getObjectByName('v28-utility-pickup')).toBeTruthy();
    expect(root.getObjectByName('v24-human-scale-workshop')).toBeTruthy();
  });

  it('keeps the detail pass inside the existing scene resource envelope', () => {
    const base = createBaseScene();
    const stats = collectSceneResourceStats(base.scene);
    expect(stats.shadowCasters).toBeLessThan(3300);
    expect(base.scene.fog).toBeNull();
  });
});
