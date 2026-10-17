import * as THREE from 'three';
import { createLeachReactor } from './reactor.js';
import { getZoneTransform } from '../layout/plantLayout.js';
import { INDUSTRIAL_PAD_THICKNESS } from '../environment/industrialPads.js';

export const LEACHING_REACTOR_IDS = Object.freeze(['R-01', 'R-02', 'R-03', 'R-04']);
export const LEACHING_TRAIN_NOMINAL_PIPE_DIAMETER_M = 0.05;

const OFFSETS = Object.freeze({
  'R-01': Object.freeze({ x: -24.0, z: 0.0, rotationOffset: 0 }),
  'R-02': Object.freeze({ x: -8.0, z: 0.0, rotationOffset: 0 }),
  'R-03': Object.freeze({ x: 8.0, z: 0.0, rotationOffset: 0 }),
  'R-04': Object.freeze({ x: 24.0, z: 0.0, rotationOffset: 0 }),
});

export function getLeachingReactorPlacement(id) {
  const offset = OFFSETS[id];
  if (!offset) throw new RangeError(`Reactor de lixiviación desconocido: ${id}.`);
  const zone = getZoneTransform('Z6');
  return {
    position: {
      x: zone.position.x + offset.x,
      y: zone.position.y + INDUSTRIAL_PAD_THICKNESS,
      z: zone.position.z + offset.z,
    },
    rotationY: zone.rotationY + offset.rotationOffset,
  };
}

export function createLeachingTrainEquipment() {
  const group = new THREE.Group();
  group.name = 'leaching-train-equipment';

  const reactors = LEACHING_REACTOR_IDS.map((id) => {
    const placement = getLeachingReactorPlacement(id);
    const reactor = createLeachReactor({ id, ...placement });
    reactor.group3D.userData.trainIndex = LEACHING_REACTOR_IDS.indexOf(id);
    group.add(reactor.group3D);
    return reactor;
  });

  return { group, reactors };
}
