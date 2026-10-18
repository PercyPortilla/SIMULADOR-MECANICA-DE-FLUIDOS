import { describe, expect, it } from 'vitest';
import { FreeCamera } from '@babylonjs/core/Cameras/freeCamera.js';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine.js';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial.js';
import { Vector3 } from '@babylonjs/core/Maths/math.vector.js';
import { CreateBox } from '@babylonjs/core/Meshes/Builders/boxBuilder.js';
import { Scene } from '@babylonjs/core/scene.js';
import { ROAD_DEFINITIONS, MINE_AUXILIARY_AREAS, PIT_DESIGN } from '../../src/scene/config/siteDesign.js';
import { FINAL_EQUIPMENT_LAYOUT, SUPPORT_LAYOUT } from '../../src/scene/integration/finalLayout.js';
import { getTerrainHeight } from '../../src/scene/environment/terrainHeight.js';
import { getGroundwaterElevation, sampleNaturalStratigraphy } from '../../src/scene/geotech/geotechModel.js';
import { createBabylonGeotechnicalSystem } from '../../src/babylon/geotechnical/geotechnicalSystem.js';

function sceneFixture() {
  const engine = new NullEngine();
  const scene = new Scene(engine);
  scene.useRightHandedSystem = true;
  return { engine, scene };
}

function findNode(root, name) {
  return [root, ...root.getDescendants(false)].find((node) => node.name === name) ?? null;
}

function createExternalVisual(scene, name, alpha = 1) {
  const mesh = CreateBox(name, { size: 1 }, scene);
  const material = new StandardMaterial(`${name}-material`, scene);
  material.alpha = alpha;
  material.disableDepthWrite = false;
  mesh.material = material;
  return { mesh, material };
}

describe('Babylon V31 geotechnical parity', () => {
  it('requires RH coordinates and starts hidden as a visual-only, non-physics subsystem', () => {
    const engine = new NullEngine();
    const scene = new Scene(engine);
    expect(() => createBabylonGeotechnicalSystem({ scene })).toThrow(/right-handed/);
    scene.useRightHandedSystem = true;
    const system = createBabylonGeotechnicalSystem({ scene });

    expect(system.root.name).toBe('geotechnical-system');
    expect(system.root.isEnabled()).toBe(false);
    expect(system.visible).toBe(false);
    expect(system.root.metadata).toMatchObject({
      visualOnly: true,
      physicsCoupled: false,
      validationScope: 'conceptual-geotechnical-visualization',
      coordinateSystem: 'right-handed',
      worldUnitsPerMeter: 1,
      fogRequired: false,
    });

    system.dispose();
    scene.dispose();
    engine.dispose();
  });

  it('ports every V30 geotechnical section and keeps secondary containment explicitly non-heap-leach', () => {
    const { engine, scene } = sceneFixture();
    const system = createBabylonGeotechnicalSystem({ scene });
    const names = [system.root, ...system.root.getDescendants(false)].map((node) => node.name);

    expect(names).toContain('geotech-stratigraphic-transect');
    expect(names).toContain('PRIMARY-CRUSHER-geotech-foundation-assembly');
    expect(names).toContain('MILL-01-geotech-foundation-assembly');
    expect(names).toContain('ROAD-01-geotech-section');
    expect(names).toContain('stockpile-geotech-platform');
    expect(names).toContain('stockpile-drainage-blanket');
    expect(names).toContain('R-04-soft-ground-treatment');
    expect(names).toContain('geotech-secondary-containment');
    expect(names).toContain('peripheral-uncontrolled-fill-example');
    expect(names).toContain('conceptual-groundwater-surface');
    expect(names.some((name) => /flotation|heap[- ]?leach/i.test(name))).toBe(false);

    const barrier = findNode(system.root, 'reactor-train-impermeable-barrier');
    expect(barrier.metadata).toMatchObject({ containmentType: 'secondary', heapLeach: false });

    system.dispose();
    scene.dispose();
    engine.dispose();
  });

  it('keeps V30 foundation, road and stockpile geometry at terrain-derived elevations', () => {
    const { engine, scene } = sceneFixture();
    const system = createBabylonGeotechnicalSystem({ scene });

    const mill = FINAL_EQUIPMENT_LAYOUT['MILL-01'];
    const profile = sampleNaturalStratigraphy(mill.x, mill.z);
    const topY = profile.surfaceY - 0.04;
    const rockContactY = profile.weatheredRockBottomY + 0.20;
    const concreteDepth = Math.min(3.0, Math.max(1.8, topY - rockContactY - 0.8));
    const millConcrete = findNode(system.root, 'MILL-01-geotech-concrete-foundation');
    expect(millConcrete.metadata.dimensionsM).toEqual([15.5, concreteDepth, 10.8]);
    expect(millConcrete.position.asArray()).toEqual([mill.x, topY - concreteDepth / 2, mill.z]);

    const road = ROAD_DEFINITIONS['ROAD-01'];
    const start = road.points.at(-3);
    const end = road.points.at(-1);
    const x = (start[0] + end[0]) / 2;
    const z = (start[1] + end[1]) / 2;
    const lengthM = Math.min(34, Math.hypot(end[0] - start[0], end[1] - start[1]));
    const roadSurface = findNode(system.root, 'ROAD-01-wearing-course');
    expect(roadSurface.metadata.dimensionsM).toEqual([lengthM, 0.22, road.widthM]);
    expect(roadSurface.position.y).toBeCloseTo(getTerrainHeight(x, z) + 0.075 - 0.11, 10);
    expect(roadSurface.rotation.y).toBeCloseTo(-Math.atan2(end[1] - start[1], end[0] - start[0]), 12);

    const stockpileTop = getTerrainHeight(SUPPORT_LAYOUT.stockpile.x, SUPPORT_LAYOUT.stockpile.z) - 0.05;
    const drainage = findNode(system.root, 'stockpile-drainage-blanket');
    expect(drainage.metadata.dimensionsM).toEqual([45, 0.22, 35]);
    expect(drainage.position.asArray()).toEqual([SUPPORT_LAYOUT.stockpile.x, stockpileTop - 0.61, SUPPORT_LAYOUT.stockpile.z]);

    system.dispose();
    scene.dispose();
    engine.dispose();
  });

  it('samples the conceptual groundwater surface from the same V30 hydrogeotechnical function', () => {
    const { engine, scene } = sceneFixture();
    const system = createBabylonGeotechnicalSystem({ scene });
    const groundwater = system.groundwater;
    const positions = groundwater.getVerticesData('position');
    const indices = groundwater.getIndices();

    expect(groundwater.metadata).toMatchObject({
      geotechRole: 'groundwater',
      conceptual: true,
      calibrated: false,
      segmentsX: 26,
      segmentsZ: 20,
    });
    expect(positions).toHaveLength((26 + 1) * (20 + 1) * 3);
    expect(indices).toHaveLength(26 * 20 * 6);

    const sampleIndices = [0, 13, (10 * 27) + 13, positions.length / 3 - 1];
    sampleIndices.forEach((vertexIndex) => {
      const offset = vertexIndex * 3;
      const x = positions[offset];
      const y = positions[offset + 1];
      const z = positions[offset + 2];
      expect(y).toBeCloseTo(getGroundwaterElevation(x, z), 5);
    });
    const sump = MINE_AUXILIARY_AREAS.pitSump;
    expect(getGroundwaterElevation(sump.x, sump.z)).toBeLessThan(
      getGroundwaterElevation(PIT_DESIGN.center.x + PIT_DESIGN.radiusX * 1.02, PIT_DESIGN.center.z),
    );

    system.dispose();
    scene.dispose();
    engine.dispose();
  });

  it('ports all seven educational labels and preserves V30 camera-distance visibility rules', () => {
    const { engine, scene } = sceneFixture();
    const system = createBabylonGeotechnicalSystem({ scene });
    system.setVisible(true);

    expect(system.labelNodes).toHaveLength(7);
    expect(system.labelNodes.map((label) => label.name)).toEqual([
      'geotech-label-topsoil',
      'geotech-label-rock',
      'geotech-label-mill-foundation',
      'geotech-label-road',
      'geotech-label-purge',
      'geotech-label-containment',
      'geotech-label-groundwater',
    ]);
    const purge = system.labelNodes.find((label) => label.name === 'geotech-label-purge');
    expect(purge.metadata).toMatchObject({
      geotechLabel: true,
      title: 'PURGA / REEMPLAZO',
      subtitle: 'R-04 · suelo cohesivo localizado',
      baseWidth: 14.4,
      baseHeight: 3.0,
    });
    expect(purge.position.asArray()).toEqual([224, getTerrainHeight(224, 26) + 4.5, 26]);

    const camera = new FreeCamera('geotech-test-camera', purge.position.add(new Vector3(0, 0, 100)), scene);
    camera.metadata = { presetId: 'inspection' };
    expect(typeof system.updateForCamera(camera)).toBe('boolean');
    expect(purge.isEnabled()).toBe(true);
    camera.position.copyFrom(purge.position.add(new Vector3(0, 0, 190)));
    expect(system.updateForCamera(camera)).toBe(true);
    expect(purge.isEnabled()).toBe(false);

    camera.metadata.presetId = 'general';
    camera.position.copyFrom(purge.position.add(new Vector3(0, 0, 900)));
    system.updateForCamera(camera);
    expect(purge.isEnabled()).toBe(true);

    system.setLabelsVisible(false);
    expect(system.labels.isEnabled()).toBe(false);
    system.setLabelsVisible(true);
    expect(system.labels.isEnabled()).toBe(true);

    system.dispose();
    scene.dispose();
    engine.dispose();
  });

  it('applies and restores the V30 x-ray alphas without moving external terrain, pads or roads', () => {
    const { engine, scene } = sceneFixture();
    const ground = createExternalVisual(scene, 'ground', 1);
    const pads = createExternalVisual(scene, 'pads', 0.95);
    const roads = createExternalVisual(scene, 'roads', 1);
    const groundPosition = ground.mesh.position.clone();
    const system = createBabylonGeotechnicalSystem({
      scene,
      ground: ground.mesh,
      industrialPads: pads.mesh,
      haulRoads: roads.mesh,
    });

    system.setVisible(true);
    expect(system.visible).toBe(true);
    expect(ground.material.alpha).toBeCloseTo(0.30);
    expect(pads.material.alpha).toBeCloseTo(0.72);
    expect(roads.material.alpha).toBeCloseTo(0.88);
    expect(ground.material.disableDepthWrite).toBe(true);
    expect(ground.mesh.position.equals(groundPosition)).toBe(true);

    system.setVisible(false);
    expect(system.visible).toBe(false);
    expect(ground.material.alpha).toBeCloseTo(1);
    expect(pads.material.alpha).toBeCloseTo(0.95);
    expect(roads.material.alpha).toBeCloseTo(1);
    expect(ground.material.disableDepthWrite).toBe(false);

    system.setVisible(true);
    system.dispose();
    expect(ground.material.alpha).toBeCloseTo(1);
    expect(pads.material.alpha).toBeCloseTo(0.95);
    expect(roads.material.alpha).toBeCloseTo(1);

    scene.dispose();
    engine.dispose();
  });
});
