import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getState,
  resetState,
  subscribe,
  updateState,
} from '../../src/state/simulationState.js';

describe('simulationState', () => {
  beforeEach(() => {
    resetState();
  });

  it('expone exactamente las secciones definidas', () => {
    expect(Object.keys(getState())).toEqual([
      'study',
      'slurry',
      'rheology',
      'transport',
      'energy',
      'leaching',
      'recovery',
      'process',
    ]);
  });

  it('actualiza parcialmente el estado sin perder los demás datos', () => {
    updateState({
      slurry: { solidsMassFraction: 0.35, solidDensityKgM3: 2650 },
      transport: { pipe1: { innerDiameterM: 0.2 } },
    });

    expect(getState().slurry).toEqual(expect.objectContaining({
      solidsMassFraction: 0.35,
      solidDensityKgM3: 2650,
      liquidDensityKgM3: 0,
    }));
    expect(getState().slurry.referenceSolidsMassFraction).toBe(0.35);
    expect(getState().slurry.temperatureC).toBe(25);
    expect(getState().transport.pipe1.lengthM).toBe(0);
  });

  it('impide modificar el estado mediante la copia retornada', () => {
    const snapshot = getState();
    snapshot.slurry.solidsMassFraction = 0.8;

    expect(getState().slurry.solidsMassFraction).toBe(0);
  });

  it.each([NaN, Infinity, -Infinity])('rechaza el número no finito %s', (value) => {
    expect(() => updateState({ rheology: { yieldStressPa: value } })).toThrow(
      'debe ser un número finito',
    );
  });

  it('rechaza números negativos cuando no son físicos', () => {
    expect(() => updateState({ transport: { pipe1: { lengthM: -1 } } })).toThrow(
      'no puede ser negativo',
    );
  });

  it('limita la fracción másica al intervalo físico básico', () => {
    expect(() => updateState({ slurry: { solidsMassFraction: 1.01 } })).toThrow(
      'debe estar entre 0 y 1',
    );
  });

  it('rechaza parámetros que no forman parte del estado definido', () => {
    expect(() => updateState({ slurry: { inventedParameter: 1 } })).toThrow(
      'no pertenece al estado definido',
    );
  });

  it('notifica cambios y permite cancelar la suscripción', () => {
    const listener = vi.fn();
    const unsubscribe = subscribe(listener);

    updateState({ rheology: { model: 'bingham' } });
    unsubscribe();
    updateState({ rheology: { model: '' } });

    expect(listener).toHaveBeenCalledOnce();
    expect(listener.mock.calls[0][0].rheology.model).toBe('bingham');
  });

  it('rechaza nombres reológicos que no pertenecen al contrato del core', () => {
    expect(() => updateState({ rheology: { model: 'Bingham' } })).toThrow(
      'rheology.model debe ser',
    );
  });

  it('acepta el contrato Newtoniano e inputs hidráulicos/energéticos explícitos', () => {
    updateState({
      rheology: { model: 'newtonian', newtonianViscosityPaS: 0.001 },
      transport: { pipe1: { minorLossCoefficient: 2.5, elevationChangeM: -3 } },
      energy: { pumpEfficiency: 0.8, motorEfficiency: 0.92 },
    });
    expect(getState().rheology.model).toBe('newtonian');
    expect(getState().transport.pipe1.elevationChangeM).toBe(-3);
  });

  it('acepta Casson y conserva defaults avanzados reproducibles', () => {
    updateState({ rheology: { model: 'casson', yieldStressPa: 20, cassonViscosityPaS: 0.25 } });
    const snapshot = getState();
    expect(snapshot.rheology.model).toBe('casson');
    expect(snapshot.rheology.cassonViscosityPaS).toBe(0.25);
    expect(snapshot.transport.pipe1.accessories.elbowK).toBe(0.9);
    expect(snapshot.process.balanceToleranceFraction).toBe(0.05);
  });

  it('restablece todo el estado inicial', () => {
    updateState({ slurry: { liquidDensityKgM3: 1000 } });

    resetState();

    expect(getState().slurry.liquidDensityKgM3).toBe(0);
  });
});
