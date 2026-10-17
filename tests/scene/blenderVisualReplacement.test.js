import { afterEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import {
  attachBlenderVisualReplacement,
  BLENDER_REPLACEMENT_SPECS,
  cloneBlenderReplacementSource,
  resetBlenderReplacementCacheForTests,
  shouldCastImportedShadow,
  stabilizeImportedRotationPivot,
} from '../../src/scene/integration/blenderVisualReplacement.js';
import { createIntegratedPlant } from '../../src/scene/integration/integratedPlant.js';
import { createJawCrusherAsset } from '../../src/equipment/crushing/jawCrusher.js';
import { createBallMillAsset } from '../../src/equipment/grinding/ballMill.js';
import { createSlurryPumpAsset } from '../../src/equipment/classification/slurryPump.js';
import { createElutionAsset } from '../../src/equipment/recovery/elution.js';

afterEach(() => {
  resetBlenderReplacementCacheForTests();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('Blender visual replacements', () => {
  it('registers rheology-core and leaching GLB assets', () => {
    expect(Object.keys(BLENDER_REPLACEMENT_SPECS)).toEqual([
      'ROM-HOPPER',
      'APRON-FEEDER',
      'PRIMARY-CRUSHER',
      'STOCKPILE-RECLAIM',
      'EXCAVATOR-01',
      'TRUCK-01',
      'LOADER-01',
      'MILL-01',
      'SUMP-01',
      'SLURRY-PUMP-01',
      'CLASS-01',
      'R-01',
      'R-02',
      'R-03',
      'R-04',
      'PUMP-01',
      'CIP-ADSORPTION',
      'ELUTION-SKID',
      'EW-CELLS',
      'SMELTING-FURNACE',
    ]);
    Object.values(BLENDER_REPLACEMENT_SPECS).forEach((spec) => {
      expect(spec.url).toMatch(/^models\/pulpa-blender\/.+\.glb$/);
    });
  });

  it('keeps procedural fallback active outside a browser', () => {
    const plant = createIntegratedPlant();
    for (const id of [
      'ROM-HOPPER',
      'APRON-FEEDER',
      'PRIMARY-CRUSHER',
      'STOCKPILE-RECLAIM',
      'MILL-01',
      'SUMP-01',
      'SLURRY-PUMP-01',
      'CLASS-01',
      'R-01',
      'R-02',
      'R-03',
      'R-04',
      'PUMP-01',
      'CIP-ADSORPTION',
      'ELUTION-SKID',
      'EW-CELLS',
      'SMELTING-FURNACE',
    ]) {
      const equipment = plant.getEquipment(id);
      expect(equipment.group3D.userData.blenderReplacement).toBe(true);
      expect(equipment.group3D.userData.blenderVisualStatus).toBe('ssr-fallback');
    }
  });

  it('keeps haul-truck dynamics under semantic control instead of a canned clip', () => {
    expect(BLENDER_REPLACEMENT_SPECS['TRUCK-01'].semanticControl).toBe('haul-truck');
    expect(BLENDER_REPLACEMENT_SPECS['EXCAVATOR-01'].playAllAnimations).toBe(true);
    expect(BLENDER_REPLACEMENT_SPECS['LOADER-01'].playAllAnimations).toBe(true);
  });

  it('repairs the imported X-axis pivots for the mill and both slurry-pump instances', () => {
    expect(BLENDER_REPLACEMENT_SPECS['MILL-01'].rotationPivotRepair)
      .toEqual({ nodeName: 'MILL-01_ROTATING_GROUP', axis: 'x' });
    expect(BLENDER_REPLACEMENT_SPECS['SLURRY-PUMP-01'].rotationPivotRepair)
      .toEqual({ nodeName: 'SLURRY-PUMP-01_ROTATING_GROUP', axis: 'x' });
    expect(BLENDER_REPLACEMENT_SPECS['PUMP-01'].rotationPivotRepair)
      .toEqual({ nodeName: 'SLURRY-PUMP-01_ROTATING_GROUP', axis: 'x' });
  });

  it('preserves the cyclone process-flow overlay when the static Blender shell loads', () => {
    const spec = BLENDER_REPLACEMENT_SPECS['CLASS-01'];
    expect(spec.keepProceduralUpdate).toBe(true);
    expect(spec.preserveProceduralOverlays).toContain('cyclone-1-swirl');
    expect(spec.preserveProceduralOverlays).toContain('cyclone-manifold-suspended-solids');
  });

  it('keeps the ROM grizzly procedural overlay active over the Blender shell', () => {
    const spec = BLENDER_REPLACEMENT_SPECS['ROM-HOPPER'];
    expect(spec.keepProceduralUpdate).toBe(true);
    expect(spec.preserveProceduralOverlays).toContain('rom-grizzly');
  });

  it('preserves the V23 primary-crusher access/safety overlay over the Blender machine', () => {
    const spec = BLENDER_REPLACEMENT_SPECS['PRIMARY-CRUSHER'];
    expect(spec.preserveProceduralOverlays).toEqual(['PRIMARY-CRUSHER-v23-safety-overlay']);
    const asset = createJawCrusherAsset();
    const overlay = asset.root.getObjectByName('PRIMARY-CRUSHER-v23-safety-overlay');
    expect(overlay?.userData.v23MechanicalDetail).toBe(true);
    expect(asset.root.getObjectByName('crusher-service-ladder')).toBeTruthy();
    expect(asset.root.getObjectByName('crusher-service-flywheel-guard')).toBeTruthy();
    expect(asset.root.getObjectByName('crusher-emergency-stop-box')).toBeTruthy();
    expect(asset.root.getObjectByName('crusher-service-work-light')).toBeTruthy();
  });

  it('keeps the sump liquid as the only animated process overlay over its static Blender shell', () => {
    const spec = BLENDER_REPLACEMENT_SPECS['SUMP-01'];
    expect(spec.preserveProceduralOverlays).toEqual(['SUMP-01-slurry', 'SUMP-01-suspended-solids']);
  });

  it('preserves only the stockpile reclaim motion overlay over its static GLB shell', () => {
    const spec = BLENDER_REPLACEMENT_SPECS['STOCKPILE-RECLAIM'];
    expect(spec.preserveProceduralOverlays).toEqual(['STOCKPILE-RECLAIM-motion']);
  });

  it('preserves only educational interiors for mill, pumps and elution without procedural shell updates', () => {
    const mill = BLENDER_REPLACEMENT_SPECS['MILL-01'];
    expect(mill.preserveProceduralOverlays).toEqual(['mill-charge']);
    expect(mill.proceduralOverlayAnchors).toEqual({ 'mill-charge': 'MILL-01_ROTATING_GROUP' });
    expect(mill.keepProceduralUpdate).not.toBe(true);
    expect(createBallMillAsset().root.getObjectByName('mill-charge')).toBeTruthy();
    expect(mill.preserveProceduralOverlays).not.toContain('mill-shell');

    for (const id of ['SLURRY-PUMP-01', 'PUMP-01']) {
      const pump = BLENDER_REPLACEMENT_SPECS[id];
      expect(pump.preserveProceduralOverlays).toEqual(['pump-impeller', 'pump-slurry-path']);
      expect(pump.proceduralOverlayAnchors).toEqual({ 'pump-impeller': 'SLURRY-PUMP-01_ROTATING_GROUP' });
      expect(pump.keepProceduralUpdate).not.toBe(true);
    }
    const pumpAsset = createSlurryPumpAsset();
    expect(pumpAsset.root.getObjectByName('pump-impeller')).toBeTruthy();
    expect(pumpAsset.root.getObjectByName('pump-slurry-path')).toBeTruthy();
    expect(BLENDER_REPLACEMENT_SPECS['SLURRY-PUMP-01'].preserveProceduralOverlays).not.toContain('pump-volute');

    const elution = BLENDER_REPLACEMENT_SPECS['ELUTION-SKID'];
    expect(elution.keepProceduralUpdate).not.toBe(true);
    expect(elution.preserveProceduralOverlays).toContain('elution-column-solution');
    expect(elution.preserveProceduralOverlays).toContain('elution-tank-liquid');
    expect(elution.preserveProceduralOverlays.filter((name) => name.startsWith('elution-hx-tube-'))).toHaveLength(9);
    const elutionAsset = createElutionAsset();
    elution.preserveProceduralOverlays.forEach((name) => {
      expect(elutionAsset.root.getObjectByName(name), `missing ${name}`).toBeTruthy();
    });
    expect(elution.preserveProceduralOverlays).not.toContain('elution-column');
    expect(elution.preserveProceduralOverlays).not.toContain('elution-heat-exchanger-shell');
  });

  it('can anchor a preserved interior group to the imported Blender rotation pivot without keeping the fallback shell', async () => {
    const source = new THREE.Group();
    const pivot = new THREE.Group();
    pivot.name = 'MILL-01_ROTATING_GROUP';
    pivot.add(new THREE.Mesh(new THREE.BoxGeometry(2, 2, 2), new THREE.MeshBasicMaterial()));
    source.add(pivot);
    vi.stubGlobal('window', {});
    vi.spyOn(GLTFLoader.prototype, 'load').mockImplementation(function mockLoad(_url, onLoad) {
      onLoad({ scene: source, animations: [] });
      return this;
    });

    const hostRoot = new THREE.Group();
    const shell = new THREE.Mesh(new THREE.BoxGeometry(5, 5, 5), new THREE.MeshBasicMaterial());
    shell.name = 'mill-shell';
    const charge = new THREE.Group();
    charge.name = 'mill-charge';
    charge.add(new THREE.Mesh(new THREE.SphereGeometry(0.3), new THREE.MeshBasicMaterial()));
    hostRoot.add(shell, charge);
    const controller = attachBlenderVisualReplacement({ hostRoot, instanceId: 'MILL-01' });
    await Promise.resolve();
    await Promise.resolve();

    expect(controller.loaded).toBe(true);
    expect(charge.parent?.name).toBe('MILL-01_ROTATING_GROUP');
    expect(charge.userData.blenderProceduralOverlay).toBe(true);
    expect(charge.userData.blenderProceduralOverlayAnchor).toBe('MILL-01_ROTATING_GROUP');
    expect(hostRoot.getObjectByName('MILL-01-PROCEDURAL-FALLBACK')?.visible).toBe(false);
    expect(hostRoot.getObjectByName('mill-shell')?.parent?.name).toBe('MILL-01-PROCEDURAL-FALLBACK');
    controller.dispose();
  });

  it('recenters only the transverse coordinates of a bad rotating GLB pivot', () => {
    const scene = new THREE.Group();
    const pivot = new THREE.Group();
    pivot.name = 'bad-pivot';
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(4, 2, 2), new THREE.MeshBasicMaterial());
    mesh.position.set(0, 3, 0);
    pivot.add(mesh);
    scene.add(pivot);
    scene.updateMatrixWorld(true);
    const before = new THREE.Box3().setFromObject(mesh).clone();

    stabilizeImportedRotationPivot(scene, { nodeName: 'bad-pivot', axis: 'x' });
    scene.updateMatrixWorld(true);
    const after = new THREE.Box3().setFromObject(mesh);

    expect(pivot.position.x).toBeCloseTo(0, 12);
    expect(pivot.position.y).toBeCloseTo(3, 12);
    expect(pivot.position.z).toBeCloseTo(0, 12);
    expect(after.min.distanceTo(before.min)).toBeLessThan(1e-9);
    expect(after.max.distanceTo(before.max)).toBeLessThan(1e-9);
    expect(pivot.userData.rotationPivotStabilized).toBe(true);
  });

  it('maps shovel and loader ore loads onto their Blender nodes', () => {
    expect(BLENDER_REPLACEMENT_SPECS['EXCAVATOR-01'].materialLoadNode).toBe('MINING-SHOVEL_BUCKET_ORE');
    expect(BLENDER_REPLACEMENT_SPECS['LOADER-01'].materialLoadNode).toBe('WHEEL-LOADER_BUCKET_ORE');
  });

  it('keeps instance transforms independent while sharing immutable GLB resources', () => {
    const source = new THREE.Group();
    const pivot = new THREE.Group();
    pivot.name = 'animated-pivot';
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    const material = new THREE.MeshStandardMaterial();
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = 'shared-mesh';
    pivot.add(mesh);
    source.add(pivot);

    const first = cloneBlenderReplacementSource(source);
    const second = cloneBlenderReplacementSource(source);
    first.getObjectByName('animated-pivot').rotation.x = 0.75;

    expect(second.getObjectByName('animated-pivot').rotation.x).toBeCloseTo(0, 10);
    expect(first.getObjectByName('shared-mesh').geometry).toBe(geometry);
    expect(second.getObjectByName('shared-mesh').geometry).toBe(geometry);
    expect(first.getObjectByName('shared-mesh').material).toBe(material);
    expect(second.getObjectByName('shared-mesh').material).toBe(material);

    geometry.dispose();
    material.dispose();
  });

  it('keeps shadows on major equipment while skipping tiny repeated details', () => {
    expect(shouldCastImportedShadow({ name: 'PRIMARY-CRUSHER_MOVING_JAW' })).toBe(true);
    expect(shouldCastImportedShadow({ name: 'MILL-01_SHELL' })).toBe(true);
    expect(shouldCastImportedShadow({ name: 'LEACH-REACTOR_LADDER_RUNG_12' })).toBe(false);
    expect(shouldCastImportedShadow({ name: 'CIP-ADSORPTION_RAIL_POST_95.0_2.95' })).toBe(false);
    expect(shouldCastImportedShadow({ name: 'PRIMARY-CRUSHER_FLYWHEEL_SPOKE_02_4' })).toBe(false);
    expect(shouldCastImportedShadow({ name: 'SLURRY-PUMP-01_DETAIL_MOTOR_FIN_05' })).toBe(false);
  });
});
