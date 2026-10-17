import * as THREE from 'three';
import { createConveyor } from './conveyorEngine.js';

export function createGrindingFeedConveyor({ stockpileReclaim, millFeed }) {
  if (!(stockpileReclaim instanceof THREE.Vector3) || !(millFeed instanceof THREE.Vector3)) {
    throw new TypeError('CV-03 requiere puntos Vector3 válidos.');
  }
  const root = new THREE.Group();
  root.name = 'grinding-feed-conveyor-system';
  const middle = stockpileReclaim.clone().lerp(millFeed, 0.5);
  middle.y += 1.2;
  const conveyor = createConveyor({
    id: 'CV-03-STOCKPILE-TO-GRINDING',
    points: [stockpileReclaim.clone(), middle, millFeed.clone()],
    width: 1.3,
  });
  root.add(conveyor);
  return { root, conveyor };
}
