import { Vector3 } from '@babylonjs/core/Maths/math.vector.js';
import { CreateLineSystem } from '@babylonjs/core/Meshes/Builders/linesBuilder.js';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode.js';
import { getPlantZone } from '../../scene/layout/plantLayout.js';

export const BABYLON_TECHNICAL_GRID_ZONE_IDS = Object.freeze(['Z4', 'Z5']);
export const BABYLON_TECHNICAL_GRID_SPACING_M = 1.5;

export function createBabylonTechnicalGrid({ scene } = {}) {
  if (!scene) throw new TypeError('Babylon technical grid requires a Scene.');
  if (scene.useRightHandedSystem !== true) throw new Error('Babylon technical grid requires a right-handed Scene.');
  const root = new TransformNode('platform-technical-grid', scene);
  root.metadata = {
    visualOnly: true,
    coordinateSystem: 'right-handed',
    spacingM: BABYLON_TECHNICAL_GRID_SPACING_M,
  };
  const grids = new Map();

  BABYLON_TECHNICAL_GRID_ZONE_IDS.forEach((zoneId) => {
    const zone = getPlantZone(zoneId);
    const width = zone.width - 3.6;
    const depth = zone.depth - 3.6;
    const halfWidth = width / 2 - 0.3;
    const halfDepth = depth / 2 - 0.3;
    const y = zone.elevation + 0.015;
    const lines = [];
    for (let x = -halfWidth; x <= halfWidth + 0.001; x += BABYLON_TECHNICAL_GRID_SPACING_M) {
      lines.push([
        new Vector3(zone.position.x + x, y, zone.position.z - halfDepth),
        new Vector3(zone.position.x + x, y, zone.position.z + halfDepth),
      ]);
    }
    for (let z = -halfDepth; z <= halfDepth + 0.001; z += BABYLON_TECHNICAL_GRID_SPACING_M) {
      lines.push([
        new Vector3(zone.position.x - halfWidth, y, zone.position.z + z),
        new Vector3(zone.position.x + halfWidth, y, zone.position.z + z),
      ]);
    }
    const mesh = CreateLineSystem(`${zone.key}-technical-grid`, { lines, updatable: false }, scene);
    mesh.parent = root;
    mesh.color.set(0x52 / 255, 0x60 / 255, 0x64 / 255);
    mesh.alpha = 0.22;
    mesh.isPickable = false;
    mesh.metadata = {
      visualOnly: true,
      zoneId,
      widthM: width,
      depthM: depth,
      spacingM: BABYLON_TECHNICAL_GRID_SPACING_M,
      engineeringDatumY: zone.elevation,
      renderLiftM: 0.015,
      lineCount: lines.length,
    };
    grids.set(zoneId, mesh);
  });
  return Object.freeze({ root, grids });
}
