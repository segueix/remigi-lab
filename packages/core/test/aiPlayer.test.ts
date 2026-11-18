import { describe, expect, it } from 'vitest';
import { aiParamsForPlayer, decideAiMove } from '../src/ai/aiPlayer';
import { DIFFICULTIES, withOverrides } from '../src/ai/difficulty';
import type { GameState } from '../src/core/types';
import { makeState, t } from './helpers';

/** Estat amb una jugada evident a la mà del jugador 0, que ja ha obert. */
function stateWithObviousPlay(aiLevel: string): GameState {
  const state = makeState({
    racks: [[t('red', 9), t('blue', 9), t('black', 9), t('orange', 2)], []],
    hasOpened: [true, true],
  });
  return { ...state, players: state.players.map((p, i) => (i === 0 ? { ...p, aiLevel } : p)) };
}

/** RNG fals: sempre retorna el mateix valor, per controlar els errors "humans". */
const constantRng = (value: number) => () => value;

describe('paràmetres de la IA', () => {
  it('agafa el nivell del jugador i cau al nivell per defecte si no en té', () => {
    expect(aiParamsForPlayer(stateWithObviousPlay('rookie'), 0).key).toBe('rookie');
    const noLevel = makeState({ racks: [[], []] });
    expect(aiParamsForPlayer(noLevel, 0).key).toBe('medium');
  });
});

describe('decisió de moviment', () => {
  it('juga la jugada que té quan no s’equivoca', () => {
    const move = decideAiMove(stateWithObviousPlay('rookie'), 0, constantRng(0.99));
    expect(move.type).toBe('play');
  });

  it('el nivell novell, quan s’equivoca, roba tot i tenir jugada', () => {
    expect(decideAiMove(stateWithObviousPlay('rookie'), 0, constantRng(0)).type).toBe('draw');
  });

  it('l’expert no s’equivoca mai: sempre juga si pot', () => {
    for (const roll of [0, 0.5, 0.99]) {
      expect(decideAiMove(stateWithObviousPlay('expert'), 0, constantRng(roll)).type).toBe('play');
    }
  });

  it('roba quan no té cap jugada possible', () => {
    const state = makeState({ racks: [[t('red', 2), t('blue', 7)], []], hasOpened: [true, true] });
    expect(decideAiMove(state, 0, constantRng(0.99)).type).toBe('draw');
  });

  it('sense haver obert, no juga si no arriba als 30 punts', () => {
    const state = makeState({ racks: [[t('red', 5), t('blue', 5), t('black', 5)], []] });
    expect(decideAiMove(state, 0, constantRng(0.99)).type).toBe('draw');
  });
});

/**
 * Posició on només la reordenació troba jugada: cal partir l'escala de la
 * taula per alliberar-ne el 4 vermell i fer un grup amb els dos quatres de la mà.
 */
function stateNeedingRearrange(aiLevel: string): GameState {
  const state = makeState({
    board: [[1, 2, 3, 4, 5, 6, 7].map((value) => t('red', value))],
    racks: [[t('blue', 4), t('black', 4)], []],
    hasOpened: [true, true],
  });
  return { ...state, players: state.players.map((p, i) => (i === 0 ? { ...p, aiLevel } : p)) };
}

describe('reordenació en una part dels torns', () => {
  it('l’avançat reordena quan el dau cau dins de la seva proporció', () => {
    // El primer dau decideix la reordenació (0,1 < 0,2) i el segon, l'error (0,1 ≥ 0,04).
    expect(decideAiMove(stateNeedingRearrange('advanced'), 0, constantRng(0.1)).type).toBe('play');
  });

  it('l’avançat no reordena quan el dau en queda fora, i llavors roba', () => {
    expect(decideAiMove(stateNeedingRearrange('advanced'), 0, constantRng(0.5)).type).toBe('draw');
  });

  it('l’expert reordena sempre, i el mitjà mai', () => {
    for (const roll of [0, 0.5, 0.99]) {
      expect(decideAiMove(stateNeedingRearrange('expert'), 0, constantRng(roll)).type).toBe('play');
      expect(decideAiMove(stateNeedingRearrange('medium'), 0, constantRng(roll)).type).toBe('draw');
    }
  });

  it('amb proporció 0 o 1 no es tira cap dau de reordenació', () => {
    // L'expert ha de consumir el RNG exactament com abans que existís la proporció.
    let rolls = 0;
    const counting = () => {
      rolls++;
      return 0.5;
    };
    decideAiMove(stateNeedingRearrange('expert'), 0, counting);
    expect(rolls).toBe(1); // només el de l'error
  });

  it('una substitució que només diu `rearrangesTable` vol dir sempre o mai', () => {
    expect(withOverrides(DIFFICULTIES.medium, { rearrangesTable: true }).rearrangeRate).toBe(1);
    expect(withOverrides(DIFFICULTIES.expert, { rearrangesTable: false }).rearrangeRate).toBe(0);
    expect(
      withOverrides(DIFFICULTIES.medium, { rearrangesTable: true, rearrangeRate: 0.5 }).rearrangeRate,
    ).toBe(0.5);
    const move = decideAiMove(stateNeedingRearrange('medium'), 0, constantRng(0.99), {
      overrides: { rearrangesTable: true },
    });
    expect(move.type).toBe('play');
  });
});
