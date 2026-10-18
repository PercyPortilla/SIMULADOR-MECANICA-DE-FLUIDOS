import { describe, expect, it } from 'vitest';
import { createJawCrusherAsset } from '../../src/equipment/crushing/jawCrusher.js';
import { createApronFeederAsset } from '../../src/equipment/crushing/apronFeeder.js';
import { createConveyorAsset } from '../../src/equipment/conveying/conveyor.js';
import { createSlurryPumpAsset } from '../../src/equipment/classification/slurryPump.js';

function expectRotorToSpinOnlyOnZ(asset, pivotName, meshName) {
  const pivot = asset.root.getObjectByName(pivotName);
  const mesh = asset.root.getObjectByName(meshName);
  expect(pivot).toBeTruthy();
  expect(mesh).toBeTruthy();
  expect(pivot.userData.rotationAxis).toBe('z');
  const fixedX = mesh.rotation.x;
  const before = pivot.rotation.z;
  asset.update(0.1, 0.1);
  expect(pivot.rotation.z).not.toBe(before);
  expect(mesh.rotation.x).toBeCloseTo(fixedX, 8);
  expect(mesh.rotation.z).toBeCloseTo(0, 8);
}

describe('mechanical rotor axes', () => {
  it('keeps crusher flywheel and eccentric orientation separate from their spin pivots', () => {
    const asset = createJawCrusherAsset();
    expectRotorToSpinOnlyOnZ(asset, 'crusher-flywheel--1.96', 'crusher-flywheel--1.96-hub');
    expectRotorToSpinOnlyOnZ(asset, 'eccentric-shaft-pivot', 'eccentric-shaft');
  });

  it('keeps apron feeder sprockets on explicit z-axis pivots', () => {
    const asset = createApronFeederAsset();
    expectRotorToSpinOnlyOnZ(asset, 'feeder-shaft-pivot--3.82', 'feeder-shaft--3.82');
  });

  it('keeps conveyor head/tail drums on explicit z-axis pivots', () => {
    const asset = createConveyorAsset({ length: 18, width: 1.5, incline: 0.08 });
    expectRotorToSpinOnlyOnZ(asset, 'conveyor-tail-pulley-pivot', 'conveyor-tail-pulley');
    expectRotorToSpinOnlyOnZ(asset, 'conveyor-head-pulley-pivot', 'conveyor-head-pulley');
  });

  it('keeps the slurry-pump impeller on the shaft x-axis pivot', () => {
    const asset = createSlurryPumpAsset();
    const pivot = asset.root.getObjectByName('pump-impeller');
    const visual = asset.root.getObjectByName('pump-impeller-visual');
    expect(pivot).toBeTruthy();
    expect(visual).toBeTruthy();
    expect(pivot.userData.rotationAxis).toBe('x');
    const fixedVisualY = visual.rotation.y;
    const beforeX = pivot.rotation.x;
    asset.update(0.1, 0.1);
    expect(pivot.rotation.x).not.toBe(beforeX);
    expect(pivot.rotation.y).toBeCloseTo(0, 8);
    expect(pivot.rotation.z).toBeCloseTo(0, 8);
    expect(visual.rotation.y).toBeCloseTo(fixedVisualY, 8);
  });
});
