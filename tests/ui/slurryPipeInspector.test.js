import {describe, it, expect} from 'vitest';
import {slurryInspectorModel} from '../../src/ui/slurryPipeInspector.js';

const state = (velocity = 1.2, solidsMassFraction = .30) => ({
  transport: {pipe1: {velocityMps: velocity}},
  slurry: {solidsMassFraction, d50M: .00045},
  rheology: {model: 'newtonian'},
});
const results = ratio => ({
  transport: {flowRateM3s: .02, requiredPressurePa: 86100,
    settling: {status: ratio < 1 ? 'risk' : 'adequate', velocityRatio: ratio}},
});

describe('slurry cutaway stays a visualization, not a fake solver', () => {
  it('reads numeric outputs and labels them as existing solver values', () => {
    const model = slurryInspectorModel(state(), results(1.8));
    expect(model.flowM3h).toBeCloseTo(72);
    expect(model.pressureKpa).toBeCloseTo(86.1);
    expect(model.ratio).toBe(1.8);
    expect(model.solidsMass).toBe(.3);
    expect(model.d50mm).toBeCloseTo(.45);
    expect(model.cfd).toBe(false);
    expect(model.modelClassification).toBe(false);
    expect(model.erosionRateAvailable).toBe(false);
  });
  it('shows the educational bed growing as deposition tendency increases', () => {
    const flowing = slurryInspectorModel(state(2.5, .5), results(2));
    const depositing = slurryInspectorModel(state(.35, .5), results(.5));
    expect(depositing.bed).toBeGreaterThan(flowing.bed);
    expect(depositing.visualRegime).toContain('ilustrativo');
  });
  it('does not invent a critical velocity or a classified regime', () => {
    const model = slurryInspectorModel(state(.35), {transport: {}});
    expect(model.ratio).toBe(null);
    expect(model.visualRegime).toContain('Sin clasificación');
    expect(model.pressureKpa).toBe(null);
    expect(model.flowM3h).toBe(null);
  });
  it('marks missing particle-size input as unavailable instead of zero microns', () => {
    const input=state();
    input.slurry.d50M=0;
    const model=slurryInspectorModel(input,results(1.4));
    expect(model.d50mm).toBe(null);
  });
  it('does not show a plug for power-law fluid with old Bingham yield parameters', () => {
    const input=state();
    input.rheology={model:'power',yieldStressPa:18};
    const r=results(1.1);
    r.rheology={wallStressPa:20,profile:{radiusM:[0,.04,.08],velocityMps:[1.5,1.3,0]}};
    expect(slurryInspectorModel(input,r).plugRadiusRatio).toBe(null);
  });
  it('shows increasing purely visual abrasion exposure as velocity and solids increase', () => {
    const low=slurryInspectorModel(state(.4,.25),results(1.5));
    const high=slurryInspectorModel(state(3,.6),results(1.5));
    expect(high.wearExposureVisual).toBeGreaterThan(low.wearExposureVisual);
    expect(high.erosionRateAvailable).toBe(false);
  });
  it('uses the radial profile and wall stress supplied by the real solver', () => {
    const input=state(1.2,.35);
    input.rheology={model:'bingham',yieldStressPa:6};
    const r=results(1.1);
    r.rheology={wallStressPa:20,profile:{
      radiusM:[0,.04,.08],velocityMps:[1.5,1.3,0]}};
    const model=slurryInspectorModel(input,r);
    expect(model.profile.velocityMps).toEqual([1.5,1.3,0]);
    expect(model.plugRadiusRatio).toBeCloseTo(.3);
    expect(model.cfd).toBe(false);
  });
  it('keeps the input state unmodified', () => {
    const input = state(.5, .55);
    const before = JSON.stringify(input);
    slurryInspectorModel(input, results(.4));
    expect(JSON.stringify(input)).toBe(before);
  });
});
