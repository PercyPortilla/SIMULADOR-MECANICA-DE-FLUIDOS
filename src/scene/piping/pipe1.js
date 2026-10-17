import * as THREE from 'three';
import { createPipingEngine, getRenderedPipeDiameter } from './pipingEngine.js';
import { getTerrainHeight } from '../environment/terrainHeight.js';
import { createIndustrialMaterial } from '../materials/industrialMaterials.js';

export { getRenderedPipeDiameter } from './pipingEngine.js';

export function createPipe1System({ equipmentSystem }) {
  if (!equipmentSystem) throw new TypeError('Pipe 1 requiere equipmentSystem.');

  const engine = createPipingEngine({ equipmentSystem });
  engine.root.name = 'pipe-1-system';
  let mesh = null;
  let lastState = null;

  function clear() {
    engine.clearConnection('pipe1');
    mesh = null;
  }

  function update(pipeState) {
    if (!pipeState || typeof pipeState !== 'object') throw new TypeError('Pipe 1 requiere state.transport.pipe1.');
    const lengthM = pipeState.lengthM;
    const realDiameterM = pipeState.innerDiameterM;
    if (!Number.isFinite(lengthM) || lengthM < 0) throw new RangeError('Pipe 1 lengthM inválida.');
    if (!Number.isFinite(realDiameterM) || realDiameterM < 0) throw new RangeError('Pipe 1 innerDiameterM inválido.');

    lastState = { ...pipeState };
    clear();
    if (lengthM <= 0 || realDiameterM <= 0) return null;

    // Plant layout is authoritative. Hydraulic input must never drag a reactor across
    // its civil pad; the physical input length and the rendered route are separate data.
    const start = equipmentSystem.getPortWorldPosition('R-01', 'outlet');
    const end = equipmentSystem.getPortWorldPosition('R-02', 'inlet');
    const directDistanceM = start.distanceTo(end);
    const connection = {
      id: 'pipe1',
      source: { equipmentId: 'R-01', portId: 'outlet' },
      target: { equipmentId: 'R-02', portId: 'inlet' },
      nominalDiameterM: realDiameterM,
      waypoints: [],
    };
    const group = engine.renderConnection(connection, { materialName: pipeState.material });
    const routePoints = group.userData.routePoints.map((point) => new THREE.Vector3(...point));
    const visualRouteLengthM = routePoints.slice(0, -1)
      .reduce((sum, point, index) => sum + point.distanceTo(routePoints[index + 1]), 0);

    group.userData.realDiameterM = realDiameterM;
    group.userData.physicalDiameterM = realDiameterM;
    group.userData.requestedHydraulicLengthM = lengthM;
    group.userData.lengthM = lengthM;
    group.userData.visualRouteLengthM = visualRouteLengthM;
    group.userData.minimumGeometricLengthM = directDistanceM;
    group.userData.layoutLengthMismatch = lengthM < directDistanceM - 1e-6;
    group.userData.material = pipeState.material;
    group.userData.start = start.toArray();
    group.userData.end = end.toArray();
    group.userData.renderedDiameterM = getRenderedPipeDiameter(realDiameterM);

    const renderedDiameter = getRenderedPipeDiameter(realDiameterM);
    const supportMaterial = createIndustrialMaterial('structuralSteel');
    const supportSpacing = 4.5;
    let accumulated = 0;
    routePoints.slice(0, -1).forEach((a, segmentIndex) => {
      const b = routePoints[segmentIndex + 1];
      const span = a.distanceTo(b);
      const supportCount = Math.floor(span / supportSpacing);
      for (let index = 1; index <= supportCount; index += 1) {
        const t = index / (supportCount + 1);
        const point = a.clone().lerp(b, t);
        const terrainY = getTerrainHeight(point.x, point.z);
        const topY = point.y - renderedDiameter * 0.62;
        const height = topY - terrainY;
        if (height <= 0.25) continue;
        const pedestal = new THREE.Mesh(new THREE.BoxGeometry(0.18, height, 0.72), supportMaterial);
        pedestal.name = `pipe1-support-${segmentIndex + 1}-${index}`;
        pedestal.position.set(point.x, terrainY + height / 2, point.z);
        pedestal.castShadow = true;
        pedestal.receiveShadow = true;
        group.add(pedestal);
        const saddle = new THREE.Mesh(new THREE.BoxGeometry(0.30, 0.13, 0.90), supportMaterial);
        saddle.name = `pipe1-saddle-${segmentIndex + 1}-${index}`;
        saddle.position.set(point.x, topY, point.z);
        saddle.castShadow = true;
        group.add(saddle);
      }
      accumulated += span;
    });

    mesh = group.children.find((child) => child.name.includes('-segment-')) ?? null;
    if (mesh) {
      mesh.userData = {
        ...mesh.userData,
        pipeId: 'pipe1',
        sourceEquipmentId: 'R-01',
        sourcePortId: 'outlet',
        targetEquipmentId: 'R-02',
        targetPortId: 'inlet',
        realDiameterM,
        renderedDiameterM: getRenderedPipeDiameter(realDiameterM),
        requestedHydraulicLengthM: lengthM,
        lengthM,
        visualRouteLengthM,
        material: pipeState.material,
        start: start.toArray(),
        end: end.toArray(),
      };
    }
    return mesh;
  }

  return {
    root: engine.root,
    engine,
    update,
    clear,
    getMesh: () => mesh,
    getLastState: () => (lastState ? { ...lastState } : null),
    dispose() { clear(); engine.dispose(); },
  };
}
