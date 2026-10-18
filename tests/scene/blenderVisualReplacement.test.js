import { afterEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import {
  attachBlenderVisualReplacement,
  BLENDER_REPLACEMENT_SPECS,
  cloneBlenderReplacementSource,
  decorateHandleWithBlenderReplacement,
  resetBlenderReplacementCacheForTests,
  shouldCastImportedShadow,
  stabilizeImportedRotationPivot,
} from '../../src/scene/integration/blenderVisualReplacement.js';
import { createIntegratedPlant } from '../../src/scene/integration/integratedPlant.js';
import { createJawCrusherAsset } from '../../src/equipment/crushing/jawCrusher.js';
import { createRomHopperAsset } from '../../src/equipment/crushing/romHopper.js';
import { createBallMillAsset } from '../../src/equipment/grinding/ballMill.js';
import { createSlurryPumpAsset } from '../../src/equipment/classification/slurryPump.js';
import { createCycloneClusterAsset } from '../../src/equipment/classification/cycloneCluster.js';
import { createCipAsset } from '../../src/equipment/recovery/cip.js';
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
      'TRUCK-02',
      'TRUCK-03',
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
    expect(BLENDER_REPLACEMENT_SPECS['TRUCK-02'].semanticControl).toBe('haul-truck');
    expect(BLENDER_REPLACEMENT_SPECS['TRUCK-03'].semanticControl).toBe('haul-truck');
    expect(BLENDER_REPLACEMENT_SPECS['LOADER-01'].semanticControl).toBe('wheel-loader');
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
    expect(spec.preserveProceduralOverlays).toContain('CLASS-01-v24-mechanical-access');
    const asset = createCycloneClusterAsset();
    const overlay = asset.root.getObjectByName('CLASS-01-v24-mechanical-access');
    expect(overlay?.userData.v24MechanicalDetail).toBe(true);
    expect(overlay?.getObjectByName('cyclone-service-ladder')).toBeTruthy();
  });

  it('adds only missing CIP access/pump hardware over the Blender train', () => {
    const spec = BLENDER_REPLACEMENT_SPECS['CIP-ADSORPTION'];
    expect(spec.preserveProceduralOverlays).toEqual([
      'cip-access-ladder',
      'cip-service-deck',
      'cip-pump-a-skid',
      'cip-pump-a-motor',
      'cip-pump-b-skid',
      'cip-pump-b-motor',
    ]);
    const asset = createCipAsset();
    spec.preserveProceduralOverlays.forEach((name) => expect(asset.root.getObjectByName(name), name).toBeTruthy());
    expect(spec.preserveProceduralOverlays.some((name) => /shell|tank|rail|agitator/i.test(name))).toBe(false);
  });

  it('keeps the ROM grizzly procedural overlay active over the Blender shell', () => {
    const spec = BLENDER_REPLACEMENT_SPECS['ROM-HOPPER'];
    expect(spec.keepProceduralUpdate).toBe(true);
    expect(spec.preserveProceduralOverlays).toContain('rom-grizzly');
    expect(spec.preserveProceduralOverlays).toContain('rom-truck-dump-throat');
    expect(spec.hideImportedNamePrefixes).toEqual(['ROM-HOPPER_GRIZZLY_']);
  });

  it('preserves primary-crusher safety and procedural ore flow over the Blender machine', () => {
    const spec = BLENDER_REPLACEMENT_SPECS['PRIMARY-CRUSHER'];
    expect(spec.keepProceduralUpdate).toBe(true);
    expect(spec.preserveProceduralOverlays).toEqual([
      'PRIMARY-CRUSHER-v23-safety-overlay',
      'PRIMARY-CRUSHER-v29-ore-flow',
    ]);
    const asset = createJawCrusherAsset();
    const overlay = asset.root.getObjectByName('PRIMARY-CRUSHER-v23-safety-overlay');
    const oreFlow = asset.root.getObjectByName('PRIMARY-CRUSHER-v29-ore-flow');
    expect(overlay?.userData.v23MechanicalDetail).toBe(true);
    expect(oreFlow?.userData.proceduralMaterialFlow).toBe(true);
    expect(oreFlow?.getObjectByName('crusher-ore-0')).toBeTruthy();
    expect(spec.hideImportedNamePrefixes).toEqual(['PRIMARY-CRUSHER_ORE_']);
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
    expect(spec.preserveProceduralOverlays).toEqual(['STOCKPILE-RECLAIM-motion', 'STOCKPILE-RECLAIM-v24-feed-flow']);
    expect(spec.importedScale).toEqual([1, 1, -1]);
    expect(spec.hideImportedNamePrefixes).toEqual([
      'STOCKPILE-RECLAIM_FEEDER',
      'STOCKPILE-RECLAIM_GRIZZLY_',
      'STOCKPILE-RECLAIM_PAN_',
    ]);
  });

  it('preserves only educational interiors for mill, pumps and elution without procedural shell updates', () => {
    const mill = BLENDER_REPLACEMENT_SPECS['MILL-01'];
    expect(mill.preserveProceduralOverlays).toEqual(['mill-charge']);
    expect(mill.proceduralOverlayAnchors).toBeUndefined();
    expect(mill.keepProceduralUpdate).not.toBe(true);
    const millAsset = createBallMillAsset();
    expect(millAsset.root.getObjectByName('mill-charge')?.parent).toBe(millAsset.root);
    expect(millAsset.root.getObjectByName('mill-charge')?.position.y).toBeCloseTo(millAsset.axisY, 8);
    expect(mill.preserveProceduralOverlays).not.toContain('mill-shell');

    for (const id of ['SLURRY-PUMP-01', 'PUMP-01']) {
      const pump = BLENDER_REPLACEMENT_SPECS[id];
      expect(pump.preserveProceduralOverlays).toEqual(['pump-impeller', 'pump-slurry-path']);
      expect(pump.proceduralOverlayAnchors).toBeUndefined();
      expect(pump.proceduralOverlayPositions).toEqual({ 'pump-impeller': [-1.15, 1.18, 0] });
      expect(pump.keepProceduralUpdate).toBe(true);
    }
    const pumpAsset = createSlurryPumpAsset();
    expect(pumpAsset.root.getObjectByName('pump-impeller')).toBeTruthy();
    expect(pumpAsset.root.getObjectByName('pump-slurry-path')).toBeTruthy();
    expect(BLENDER_REPLACEMENT_SPECS['SLURRY-PUMP-01'].preserveProceduralOverlays).not.toContain('pump-volute');

    const elution = BLENDER_REPLACEMENT_SPECS['ELUTION-SKID'];
    expect(elution.keepProceduralUpdate).not.toBe(true);
    expect(elution.educationalHostProcessNodes.map((item) => item.name)).toEqual([
      'elution-column-solution',
      'elution-tank-liquid',
    ]);
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

  it('keeps mill charge gravity-referenced instead of anchoring it to the imported rotating shell', async () => {
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
    expect(charge.parent).toBe(hostRoot);
    expect(charge.userData.blenderProceduralOverlay).toBe(true);
    expect(charge.userData.blenderProceduralOverlayAnchor).toBeUndefined();
    expect(hostRoot.getObjectByName('MILL-01-PROCEDURAL-FALLBACK')?.visible).toBe(false);
    expect(hostRoot.getObjectByName('mill-shell')?.parent?.name).toBe('MILL-01-PROCEDURAL-FALLBACK');
    controller.dispose();
  });

  it('hides duplicate imported flow hardware and mirrors reclaim Blender visuals to the authoritative +Z side', async () => {
    vi.stubGlobal('window', {});
    const sources = {
      'ROM-HOPPER': ['ROM-HOPPER_GRIZZLY_01', 'ROM-HOPPER_SHELL'],
      'PRIMARY-CRUSHER': ['PRIMARY-CRUSHER_ORE_01', 'PRIMARY-CRUSHER_FRAME'],
      'STOCKPILE-RECLAIM': ['STOCKPILE-RECLAIM_HOPPER', 'STOCKPILE-RECLAIM_FEEDER', 'STOCKPILE-RECLAIM_GRIZZLY_01'],
    };
    vi.spyOn(GLTFLoader.prototype, 'load').mockImplementation(function mockLoad(url, onLoad) {
      const instanceId = Object.entries(BLENDER_REPLACEMENT_SPECS).find(([, spec]) => spec.url === url)?.[0];
      const scene = new THREE.Group();
      for (const name of sources[instanceId]) {
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial());
        mesh.name = name;
        if (instanceId === 'STOCKPILE-RECLAIM') mesh.position.z = -12;
        scene.add(mesh);
      }
      onLoad({ scene, animations: [] });
      return this;
    });

    const rom = createRomHopperAsset();
    const romController = attachBlenderVisualReplacement({ hostRoot: rom.root, instanceId: 'ROM-HOPPER' });
    const crusher = createJawCrusherAsset();
    const crusherController = attachBlenderVisualReplacement({ hostRoot: crusher.root, instanceId: 'PRIMARY-CRUSHER' });
    const stockRoot = new THREE.Group();
    const reclaimController = attachBlenderVisualReplacement({ hostRoot: stockRoot, instanceId: 'STOCKPILE-RECLAIM' });
    await Promise.resolve();
    await Promise.resolve();

    expect(romController.scene.getObjectByName('ROM-HOPPER_GRIZZLY_01').visible).toBe(false);
    expect(rom.root.getObjectByName('rom-grizzly')?.visible).toBe(true);
    expect(crusherController.scene.getObjectByName('PRIMARY-CRUSHER_ORE_01').visible).toBe(false);
    expect(crusher.root.getObjectByName('PRIMARY-CRUSHER-v29-ore-flow')?.visible).toBe(true);
    const hopper = reclaimController.scene.getObjectByName('STOCKPILE-RECLAIM_HOPPER');
    hopper.getWorldPosition(new THREE.Vector3());
    reclaimController.scene.updateMatrixWorld(true);
    expect(hopper.getWorldPosition(new THREE.Vector3()).z).toBeCloseTo(12, 6);
    expect(reclaimController.scene.getObjectByName('STOCKPILE-RECLAIM_FEEDER').visible).toBe(false);
    expect(reclaimController.scene.getObjectByName('STOCKPILE-RECLAIM_GRIZZLY_01').visible).toBe(false);
  });

  it('keeps the preserved pump impeller centered on the shaft and animated after the Blender shell loads', async () => {
    const source = new THREE.Group();
    const rotating = new THREE.Group();
    rotating.name = 'SLURRY-PUMP-01_ROTATING_GROUP';
    rotating.position.set(0.2, 1.18, 0);
    rotating.add(new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.3, 0.3), new THREE.MeshBasicMaterial()));
    source.add(rotating);
    vi.stubGlobal('window', {});
    vi.spyOn(GLTFLoader.prototype, 'load').mockImplementation(function mockLoad(_url, onLoad) {
      onLoad({ scene: source, animations: [] });
      return this;
    });

    const pump = createSlurryPumpAsset();
    const controller = decorateHandleWithBlenderReplacement(pump, 'SLURRY-PUMP-01');
    await Promise.resolve();
    await Promise.resolve();
    expect(controller.loaded).toBe(true);
    const impeller = pump.root.getObjectByName('pump-impeller');
    expect(impeller.parent).toBe(pump.root);
    expect(impeller.position.toArray()).toEqual([-1.15, 1.18, 0]);
    const before = impeller.rotation.x;
    pump.update(0.1);
    expect(impeller.rotation.x).not.toBeCloseTo(before, 8);
    const frozen = impeller.rotation.x;
    pump.setAnimationEnabled(false);
    pump.update(0.1);
    expect(impeller.rotation.x).toBeCloseTo(frozen, 12);
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
    expect(BLENDER_REPLACEMENT_SPECS['EXCAVATOR-01'].initialMaterialLoadVisible).toBe(false);
    expect(BLENDER_REPLACEMENT_SPECS['LOADER-01'].initialMaterialLoadVisible).toBe(false);
  });

  it('paces the imported smelting tilt on the validated 16-second operating cycle', () => {
    expect(BLENDER_REPLACEMENT_SPECS['SMELTING-FURNACE'].animationPacing).toEqual({
      cycleSeconds: 16,
      activeStartSeconds: 8.8,
      activeEndSeconds: 13.12,
    });
  });

  it('assigns deterministic staggered animation phases to the four leach reactors', () => {
    const plant = createIntegratedPlant();
    ['R-01', 'R-02', 'R-03', 'R-04'].forEach((id, index) => {
      expect(plant.getEquipment(id).group3D.userData.animationPhaseOffset)
        .toBeCloseTo([0.63, 1.26, 1.89, 2.52][index], 10);
    });
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
