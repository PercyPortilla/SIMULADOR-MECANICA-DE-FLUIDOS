import { describe, expect, it } from 'vitest';
import { createBaseScene } from '../../src/scene/baseEnvironment.js';

const RECOVERY_CONNECTIONS = Object.freeze([
  Object.freeze({ id: 'P-LEACHING-TO-PUMP-01', source: ['R-04', 'overflowOut'], target: ['PUMP-01', 'suction'] }),
  Object.freeze({ id: 'P-PUMP-01-TO-CIP', source: ['PUMP-01', 'discharge'], target: ['CIP-ADSORPTION', 'feed'] }),
  Object.freeze({ id: 'P-ELUTION-TO-EW', source: ['ELUTION-SKID', 'pregnantSolutionOut'], target: ['EW-CELLS', 'electrolyteIn'] }),
]);

describe('Fase 20 - integración final de recuperación', () => {
  it('modela explícitamente los reducers requeridos por los diámetros físicos actuales', () => {
    const base = createBaseScene();
    const leachToPump = base.integratedPiping.engine.getConnectionGroup('P-LEACHING-TO-PUMP-01');
    const pumpToCip = base.integratedPiping.engine.getConnectionGroup('P-PUMP-01-TO-CIP');

    expect(leachToPump.userData.requiresReducer).toBe(true);
    expect(leachToPump.getObjectByName('P-LEACHING-TO-PUMP-01-target-reducer')).toBeTruthy();
    expect(pumpToCip.userData.requiresReducer).toBe(true);
    expect(pumpToCip.getObjectByName('P-PUMP-01-TO-CIP-source-reducer')).toBeTruthy();
  });

  it('mantiene racks físicos en el corredor de recuperación', () => {
    const base = createBaseScene();
    const racks = [];
    base.processPipeRacks.traverse((object) => {
      if (object.userData?.pipeRackFrame && object.userData.connectionId === 'P-PUMP-01-TO-CIP') racks.push(object);
    });
    expect(racks.length).toBeGreaterThanOrEqual(6);
    expect(base.integratedPiping.engine.getConnectionGroup('P-PUMP-01-TO-CIP')).toBeTruthy();
  });

  it('mantiene cada recovery pipe exactamente port-to-port y con puntos finitos', () => {
    const base = createBaseScene();
    RECOVERY_CONNECTIONS.forEach(({ id, source, target }) => {
      const group = base.integratedPiping.engine.getConnectionGroup(id);
      const points = group.userData.routePoints;
      const start = base.equipmentSystem.getPortWorldPosition(source[0], source[1]).toArray();
      const end = base.equipmentSystem.getPortWorldPosition(target[0], target[1]).toArray();
      expect(points[0]).toEqual(start);
      expect(points.at(-1)).toEqual(end);
      points.flat().forEach((value) => expect(Number.isFinite(value)).toBe(true));
    });
  });

  it('evita retrocesos artificiales en la línea PUMP-01 → CIP', () => {
    const base = createBaseScene();
    const group = base.integratedPiping.engine.getConnectionGroup('P-PUMP-01-TO-CIP');
    const points = group.userData.routePoints;
    const xs = points.map((point) => point[0]);
    const startX = xs[0];
    const endX = xs.at(-1);
    expect(Math.max(...xs)).toBeLessThanOrEqual(Math.max(startX, endX) + 1e-9);
    expect(Math.min(...xs)).toBeGreaterThanOrEqual(Math.min(startX, endX) - 1e-9);
  });

  it('no añade postes automáticos entre reactores anclados por boquillas', () => {
    const base = createBaseScene();
    ['P-LEACH-R01-R02', 'P-LEACH-R02-R03', 'P-LEACH-R03-R04'].forEach((id) => {
      const group = base.integratedPiping.engine.getConnectionGroup(id);
      const support = group.children.find((child) => child.name?.startsWith(`${id}-support-`));
      expect(support).toBeUndefined();
    });
  });

  it('transfiere cátodos de EW a fundición desde un puerto de material, no desde el electrolito', () => {
    const base = createBaseScene();
    const transfer = base.integratedPiping.materialTransfers.getObjectByName('MT-EW-TO-SMELTING-CATHODE');
    const cathodeOut = base.equipmentSystem.getPortWorldPosition('EW-CELLS', 'cathodeOut').toArray();
    expect(transfer.userData.routePoints[0]).toEqual(cathodeOut);
    expect(transfer.userData.inspectionKind).toBe('solid-material-transfer');
    expect(transfer.children.length).toBeGreaterThan(0);
  });
});
