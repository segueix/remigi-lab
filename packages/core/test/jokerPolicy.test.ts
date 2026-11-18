import { describe, expect, it } from 'vitest';
import { createEngine } from '../src/engine/engine';
import { applyMove } from '../src/core/game';
import { analyzeMeld } from '../src/core/melds';
import type { Meld, Tile } from '../src/core/types';
import { joker, makeState, t } from './helpers';

const engine = () => createEngine({ rng: () => 0.99 });
const spare = () => t('black', 1);
function play(rack: Tile[], board: Meld[] = [], opened = true) {
  const state = makeState({ racks: [rack, [t('blue', 1)]], board, hasOpened: [opened, true] });
  const result = engine().play(state, { level: 'expert' });
  if (result.move.type === 'play') expect(() => applyMove(state, result.move)).not.toThrow();
  return { state, ...result };
}
function expectPolicy(board: Meld[]) {
  for (const meld of board) {
    const jokers = meld.filter(t => t.kind === 'joker').length;
    expect(jokers).toBeLessThanOrEqual(analyzeMeld(meld).kind === 'group' ? 1 : meld.length - jokers);
  }
}

describe('criteris de comodins dels rivals', () => {
  it.each([false, true])('evita 13 i dos comodins (obert: %s)', opened => {
    expect(play([t('red', 13), joker(), joker('b'), spare()], [], opened).move.type).toBe('draw');
  });
  it('amb dos 13 baixa un sol comodí', () => {
    const { move } = play([t('red', 13), t('orange', 13), joker(), joker('b'), spare()]);
    expect(move.type).toBe('play');
    if (move.type === 'play') {
      expectPolicy(move.board);
      expect(move.board.flat()).toHaveLength(3);
    }
  });
  it('evita una escala amb una sola fitxa numerada i dos comodins', () => {
    const { move } = play([t('red', 5), joker(), joker('b'), spare()]);
    expect(move.type).toBe('draw');
  });
  it('permet dos comodins necessaris: 5, comodí, 7, comodí, 9', () => {
    const { move } = play([t('red', 5), t('red', 7), t('red', 9), joker(), joker('b'), spare()]);
    expect(move.type).toBe('play');
    if (move.type === 'play') {
      expectPolicy(move.board);
      expect(move.board.flat()).toHaveLength(5);
    }
  });
  it.each([false, true])('pot guanyar amb un 13 i dos comodins (obert: %s)', opened => {
    const { state, move } = play([t('red', 13), joker(), joker('b')], [], opened);
    expect(move.type).toBe('play');
    expect(applyMove(state, move).winnerId).toBe('p1');
  });
  it('pot guanyar completant un grup amb el segon comodí', () => {
    const { state, move } = play([joker('b')], [[t('red', 13), t('blue', 13), joker()]]);
    expect(applyMove(state, move).winnerId).toBe('p1');
  });
  it('no afegeix un segon comodí a un grup si no acaba', () => {
    const { move } = play([joker('b'), spare()], [[t('red', 13), t('blue', 13), joker()]]);
    expect(move.type).toBe('draw');
  });
  it('no allarga el grup de dos comodins de la captura', () => {
    const { move } = play([t('orange', 13), spare()], [[t('red', 13), joker(), joker('b')]]);
    if (move.type === 'play') expectPolicy(move.board);
  });
  it('pot deixar intacta una jugada humana amb dos comodins i jugar en una altra', () => {
    const original = [t('red', 13), joker(), joker('b')];
    const { move } = play([t('blue', 5), spare()], [original, [t('blue', 2), t('blue', 3), t('blue', 4)]]);
    expect(move.type).toBe('play');
    if (move.type === 'play') expect(move.board[0]).toEqual(original);
  });
  it('pot reutilitzar els dos comodins de la taula en dues combinacions conformes', () => {
    const { move } = play([t('blue', 13), t('red', 7), t('blue', 7), spare()], [[t('red', 13), joker(), joker('b')]]);
    expect(move.type).toBe('play');
    if (move.type === 'play') { expectPolicy(move.board); expect(move.board.flat()).toHaveLength(6); }
  });
  it('les ajudes i les regles del jugador continuen admetent dos comodins', () => {
    const state = makeState({ racks: [[t('red', 13), joker(), joker('b'), spare()], []] });
    const { bestPlay } = engine().analyze(state);
    expect(bestPlay).not.toBeNull();
    expect(() => applyMove(state, { type: 'play', board: bestPlay!.board })).not.toThrow();
  });
});

describe('el bot conserva els comodins prescindibles', () => {
  it.each(['easy', 'medium', 'advanced', 'expert'] as const)('10–11–12 obre sense comodí al nivell %s', level => {
    const state = makeState({ racks: [[t('orange', 10), t('orange', 11), t('orange', 12), joker(), spare()], []] });
    const { move } = engine().play(state, { level, overrides: { mistakeRate: 0 } });
    expect(move.type).toBe('play');
    const next = applyMove(state, move);
    expect(next.players[0].hasOpened).toBe(true);
    expect(next.players[0].rack.map(t => t.id)).toContain(joker().id);
    expect(next.board.flat()).toHaveLength(3);
  });
  it('no posa un comodí de quart en un grup complet', () => {
    const { state, move } = play([t('red', 11), t('blue', 11), t('black', 11), joker(), spare()], [], false);
    expect(applyMove(state, move).players[0].rack).toContainEqual(joker());
    expect(move.type === 'play' && move.board.flat().length).toBe(3);
  });
  it('pot posar un comodí a l’extrem si és necessari per arribar a 30', () => {
    const { state, move } = play([t('red', 7), t('red', 8), t('red', 9), joker(), spare()], [], false);
    const next = applyMove(state, move);
    expect(next.players[0].hasOpened).toBe(true);
    expect(next.board.flat()).toContainEqual(joker());
  });
  it('calcula els 30 punts amb totes les combinacions de la sortida', () => {
    const { state, move } = play([t('red', 7), t('red', 8), t('red', 9), t('blue', 2), t('blue', 3), t('blue', 4), joker(), spare()], [], false);
    const next = applyMove(state, move);
    expect(next.players[0].hasOpened).toBe(true);
    expect(next.players[0].rack).toContainEqual(joker());
    expect(next.board.flat()).toHaveLength(6);
  });
  it('després d’obrir, no gasta un comodí només per augmentar punts', () => {
    const { state, move } = play([t('red', 7), t('red', 8), t('red', 9), joker(), spare()]);
    expect(applyMove(state, move).players[0].rack).toContainEqual(joker());
  });
  it('no juga només un comodí sobre una escala completa si no guanya', () => {
    expect(play([joker(), spare()], [[t('red', 10), t('red', 11), t('red', 12)]]).move.type).toBe('draw');
  });
  it('elimina els dos comodins sobrers successivament', () => {
    const { state, move } = play([t('red', 10), t('red', 11), t('red', 12), joker(), joker('b'), spare()], [], false);
    expect(applyMove(state, move).players[0].rack.filter(t => t.kind === 'joker')).toHaveLength(2);
  });
  it('manté el comodí que omple un buit intern', () => {
    const { state, move } = play([t('red', 10), t('red', 12), joker(), spare()]);
    expect(applyMove(state, move).board.flat()).toContainEqual(joker());
  });
  it('no retira un comodí preexistent de la taula', () => {
    const { state, move } = play([t('blue', 3), spare()], [[t('red', 10), t('red', 11), t('red', 12), joker()], [t('blue', 4), t('blue', 5), t('blue', 6)]]);
    const next = applyMove(state, move);
    expect(move.type).toBe('play');
    expect(next.board.flat()).toContainEqual(joker());
  });
  it('baixa el comodí sobrer si serveix per guanyar', () => {
    const { state, move } = play([t('orange', 10), t('orange', 11), t('orange', 12), joker()], [], false);
    expect(applyMove(state, move).winnerId).toBe('p1');
  });
});
