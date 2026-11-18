import { describe, expect, it } from 'vitest';
import { decideAiMove, rubberBandedMistakeRate, rubberBandedRearrangeRate } from '../src/ai/aiPlayer';
import type { GameState } from '../src/core/types';
import { makeState, t } from './helpers';

/** Taula amb un humà i un bot, amb les mans que es demanin. */
function table(humanTiles: number, botTiles: number): GameState {
  const fill = (n: number) => Array.from({ length: n }, (_, i) => t('red', (i % 13) + 1, 'a'));
  const state = makeState({ racks: [fill(humanTiles), fill(botTiles)], hasOpened: [true, true] });
  return {
    ...state,
    players: state.players.map((player, i) =>
      i === 0 ? { ...player, kind: 'human' as const } : { ...player, aiLevel: 'medium' },
    ),
  };
}

describe('ajust de dificultat dins de la partida', () => {
  it('si el jugador va endarrerit, el bot s’equivoca més', () => {
    expect(rubberBandedMistakeRate(table(14, 6), 1, 0.1)).toBeGreaterThan(0.1);
  });

  it('si el jugador va avançat, el bot afina', () => {
    expect(rubberBandedMistakeRate(table(4, 12), 1, 0.3)).toBeLessThan(0.3);
  });

  it('amb les mans igualades no canvia res', () => {
    expect(rubberBandedMistakeRate(table(8, 8), 1, 0.2)).toBeCloseTo(0.2);
  });

  it('no se’n va de mare per molt desigual que estigui', () => {
    expect(rubberBandedMistakeRate(table(14, 1), 1, 0.35)).toBeLessThanOrEqual(0.5);
    expect(rubberBandedMistakeRate(table(1, 14), 1, 0.05)).toBeGreaterThanOrEqual(0);
  });

  it('sense cap humà a la taula no s’aplica', () => {
    const state = makeState({ racks: [[t('red', 1)], Array(12).fill(t('blue', 2))] });
    expect(rubberBandedMistakeRate(state, 1, 0.2)).toBe(0.2);
  });

  it('està desactivat si no es demana', () => {
    // Amb el jugador molt endarrerit i un dau que sempre dona 0,25: el nivell
    // mitjà (error del 10%) juga si no hi ha ajust, i s'equivoca si n'hi ha.
    const state = table(14, 3);
    const rng = () => 0.25;
    const board = [[t('blue', 5), t('blue', 6), t('blue', 7)]];
    const withPlay: GameState = {
      ...state,
      board,
      players: state.players.map((p, i) =>
        i === 1 ? { ...p, rack: [t('blue', 8), t('red', 1)] } : p,
      ),
      currentPlayer: 1,
    };
    expect(decideAiMove(withPlay, 1, rng).type).toBe('play');
    expect(decideAiMove(withPlay, 1, rng, { rubberBanding: true }).type).toBe('draw');
  });
});

describe('ajust de la reordenació dins de la partida', () => {
  it('si el jugador va endarrerit, el bot reordena menys sovint', () => {
    expect(rubberBandedRearrangeRate(table(14, 12), 1, 1)).toBeCloseTo(0.5);
  });

  it('si el jugador va avançat, el bot reordena més sovint', () => {
    expect(rubberBandedRearrangeRate(table(4, 5), 1, 0.2)).toBeCloseTo(0.45);
  });

  it('amb les mans igualades no canvia res', () => {
    expect(rubberBandedRearrangeRate(table(8, 8), 1, 0.2)).toBeCloseTo(0.2);
  });

  it('es queda sempre entre 0 i 1', () => {
    expect(rubberBandedRearrangeRate(table(14, 1), 1, 1)).toBe(0);
    expect(rubberBandedRearrangeRate(table(1, 14), 1, 0.2)).toBe(1);
  });

  it('sense cap humà a la taula no s’aplica', () => {
    const state = makeState({ racks: [[t('red', 1)], Array(12).fill(t('blue', 2))] });
    expect(rubberBandedRearrangeRate(state, 1, 0.2)).toBe(0.2);
  });

  it('un expert amb l’humà molt endarrerit deixa de reordenar, i sense ajust no', () => {
    // Només la reordenació troba jugada: partir l'escala per fer el grup de quatres.
    const state = table(14, 2);
    const expertNeedingRearrange: GameState = {
      ...state,
      board: [[1, 2, 3, 4, 5, 6, 7].map((value) => t('red', value))],
      players: state.players.map((p, i) =>
        i === 1 ? { ...p, aiLevel: 'expert', rack: [t('blue', 4), t('black', 4)] } : p,
      ),
      currentPlayer: 1,
    };
    const rng = () => 0.99;
    expect(decideAiMove(expertNeedingRearrange, 1, rng).type).toBe('play');
    expect(decideAiMove(expertNeedingRearrange, 1, rng, { rubberBanding: true }).type).toBe('draw');
  });
});
