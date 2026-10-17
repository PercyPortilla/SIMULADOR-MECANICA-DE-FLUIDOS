import * as THREE from 'three';
import { createConveyor } from './conveyorEngine.js';

function midpoint(a, b, yOffset = 0) {
  return new THREE.Vector3(
    (a.x + b.x) / 2,
    (a.y + b.y) / 2 + yOffset,
    (a.z + b.z) / 2,
  );
}

export function createFrontEndConveyors({ transferPoints }) {
  if (!transferPoints) throw new TypeError('Front-end conveyors requiere transferPoints.');
  const root = new THREE.Group();
  root.name = 'front-end-conveyors';

  const receptionStart = transferPoints.receptionDischarge.clone();
  const crusherEnd = transferPoints.crusherInlet.clone();
  const receptionMid = midpoint(receptionStart, crusherEnd, 1.2);
  const conveyor01 = createConveyor({
    id: 'CV-01-RECEPTION-TO-CRUSHING',
    points: [receptionStart, receptionMid, crusherEnd],
    width: 1.45,
  });

  const crusherStart = transferPoints.crusherDischarge.clone();
  const stockpileEnd = transferPoints.stockpileFeed.clone();
  const stockpileMid = midpoint(crusherStart, stockpileEnd, 2.0);
  const conveyor02 = createConveyor({
    id: 'CV-02-CRUSHING-TO-STOCKPILE',
    points: [crusherStart, stockpileMid, stockpileEnd],
    width: 1.35,
  });

  root.add(conveyor01, conveyor02);
  root.updateMatrixWorld(true);
  return { root, conveyor01, conveyor02 };
}
