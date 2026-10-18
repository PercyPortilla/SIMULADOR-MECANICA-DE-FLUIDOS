import { TransformNode } from '@babylonjs/core/Meshes/transformNode.js';
import { createBabylonPrimaryHaulRoad } from './primaryHaulRoad.js';
import {
  BABYLON_SERVICE_ROAD_IDS,
  createBabylonServiceRoads,
} from './serviceRoads.js';
import { createBabylonRoadVisualDetails } from './roadVisualDetails.js';

export const BABYLON_ROAD_IDS = Object.freeze(['ROAD-01', ...BABYLON_SERVICE_ROAD_IDS]);

export function createBabylonRoadNetwork({ scene, primarySamples = 420, serviceSamplesByRoad = {} } = {}) {
  if (!scene) throw new TypeError('Babylon road network requires a Scene.');
  if (scene.useRightHandedSystem !== true) {
    throw new Error('Babylon road network requires scene.useRightHandedSystem = true.');
  }

  const root = new TransformNode('haul-roads', scene);
  const primary = createBabylonPrimaryHaulRoad({ scene, samples: primarySamples });
  primary.mesh.parent = root;
  const services = createBabylonServiceRoads({ scene, samplesByRoad: serviceSamplesByRoad });
  Object.values(services).forEach(({ mesh }) => {
    mesh.parent = root;
  });

  const roads = {
    'ROAD-01': primary,
    ...services,
  };
  const visualDetails = Object.fromEntries(BABYLON_ROAD_IDS.map((roadId) => [
    roadId,
    createBabylonRoadVisualDetails({ scene, parent: root, roadId }),
  ]));
  root.metadata = {
    roadIds: [...BABYLON_ROAD_IDS],
    coordinateSystem: 'right-handed',
    worldUnitsPerMeter: 1,
    terrainHeightSource: 'getTerrainHeight',
  };
  return { root, roads, visualDetails };
}
