import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine.js';
import { Scene } from '@babylonjs/core/scene.js';
import { describe, expect, it } from 'vitest';
import { ROAD_DEFINITIONS } from '../../src/scene/config/siteDesign.js';
import { getTerrainHeight } from '../../src/scene/environment/terrainHeight.js';
import {
  BABYLON_SERVICE_CROSSFALL,
  BABYLON_SERVICE_ROAD_IDS,
  buildBabylonServiceRoadVertexData,
  createBabylonServiceLaneCurve,
  createBabylonServiceRoad,
  createBabylonServiceRoadAlignment,
  getBabylonServiceRoadSurfaceOffset,
} from '../../src/babylon/environment/serviceRoads.js';
import { BABYLON_ROAD_IDS, createBabylonRoadNetwork } from '../../src/babylon/environment/roadNetwork.js';

const SERVICE_ROADS = ['ROAD-02', 'ROAD-03', 'ROAD-04'];

function nearestPoint(curve, x, z, samples = 1200) {
  let nearest = curve.getPointAt(0);
  let distance = Infinity;
  for (let index = 0; index <= samples; index += 1) {
    const point = curve.getPointAt(index / samples);
    const current = Math.hypot(point.x - x, point.z - z);
    if (current < distance) { nearest = point; distance = current; }
  }
  return { point: nearest, distance };
}

describe('Babylon ROAD-02..04 closure contract', () => {
  it('builds finite engineered alignments and lane curves from the renderer-neutral road definitions', () => {
    SERVICE_ROADS.forEach((roadId) => {
      const alignment = createBabylonServiceRoadAlignment(roadId);
      expect(alignment.verticalTargetGrade).toBeCloseTo(ROAD_DEFINITIONS[roadId].maximumGrade * 0.8, 12);
      for (const t of [0, 0.25, 0.5, 0.75, 1]) {
        const p = alignment.getPointAt(t);
        expect([p.x, p.y, p.z].every(Number.isFinite)).toBe(true);
      }
      const halfWidth = ROAD_DEFINITIONS[roadId].widthM / 2;
      expect(getBabylonServiceRoadSurfaceOffset(roadId, -halfWidth, 0))
        .toBeCloseTo(getBabylonServiceRoadSurfaceOffset(roadId, halfWidth, 0), 12);
      const lane = createBabylonServiceLaneCurve(roadId, 2.2);
      expect([lane.getPoint(0).x, lane.getPoint(1).x].every(Number.isFinite)).toBe(true);
    });
  });

  it('keeps shared junction elevations tied to getTerrainHeight + 0.10 m', () => {
    const junctions = [
      { x: -136, z: -48, roads: ['ROAD-02', 'ROAD-03'] },
      { x: 154, z: -66, roads: ['ROAD-02', 'ROAD-04'] },
      { x: 270, z: -56, roads: ['ROAD-02', 'ROAD-03', 'ROAD-04'] },
    ];
    junctions.forEach(({ x, z, roads }) => {
      const expectedY = getTerrainHeight(x, z) + 0.10;
      roads.forEach((roadId) => {
        const { point, distance } = nearestPoint(createBabylonServiceRoadAlignment(roadId), x, z);
        expect(distance).toBeLessThan(0.6);
        expect(point.y).toBeCloseTo(expectedY, 1);
      });
    });
  });

  it('builds validated-width service surfaces and assembles ROAD-01..04 under one RH root', () => {
    const engine = new NullEngine({ renderWidth: 32, renderHeight: 32 });
    const scene = new Scene(engine);
    scene.useRightHandedSystem = true;
    SERVICE_ROADS.forEach((roadId) => {
      const definition = ROAD_DEFINITIONS[roadId];
      const data = buildBabylonServiceRoadVertexData(roadId);
      expect(data.vertexCount).toBeGreaterThan(200);
      expect(data.normals).toHaveLength(data.positions.length);
      const road = createBabylonServiceRoad({ scene, roadId });
      expect(road.mesh.metadata.widthM).toBe(definition.widthM);
      expect(road.mesh.metadata.crossSlopeTarget).toBe(BABYLON_SERVICE_CROSSFALL);
    });
    const network = createBabylonRoadNetwork({ scene, primarySamples: 48 });
    expect(BABYLON_SERVICE_ROAD_IDS).toEqual(SERVICE_ROADS);
    expect(BABYLON_ROAD_IDS).toEqual(['ROAD-01', 'ROAD-02', 'ROAD-03', 'ROAD-04']);
    expect(Object.keys(network.roads)).toEqual(BABYLON_ROAD_IDS);
    expect(network.root.metadata.worldUnitsPerMeter).toBe(1);
    scene.dispose(); engine.dispose();
  });

  it('keeps Babylon road modules free of Three/render-loop coupling', () => {
    const here = path.dirname(fileURLToPath(import.meta.url));
    for (const relative of ['../../src/babylon/environment/serviceRoads.js','../../src/babylon/environment/roadNetwork.js']) {
      const source = fs.readFileSync(path.resolve(here, relative), 'utf8');
      expect(source).not.toMatch(/from\s+['"]three(?:\/|['"])/i);
      expect(source).not.toMatch(/\bTHREE\b|WebGLRenderer|requestAnimationFrame/);
    }
  });
});
