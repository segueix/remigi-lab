import { describe, expect, it } from 'vitest';
import {
  HIEROGLYPH_THRESHOLD,
  emptyHieroglyph,
  hieroglyphBreakdown,
  hieroglyphForMove,
  hieroglyphTier,
} from '../src/lab/hieroglyph';
import type { Meld } from '../src/core/types';
import { joker, makeState, t } from './helpers';

/**
 * La mètrica de jeroglífics és telemetria del laboratori: aquí es fixa que el
 * criteri documentat a docs/AI-LAB.md és exactament el que calcula el codi,
 * cas per cas, i que és deterministe.
 */
describe('jeroglífics: casos de l’escala', () => {
  it('robar és trivial (0)', () => {
    const state = makeState({ racks: [[t('red', 1)], [t('blue', 2)]] });
    const breakdown = hieroglyphForMove(state, { type: 'draw' });
    expect(breakdown).toEqual(emptyHieroglyph());
  });

  it('baixar jugades noves de la mà sense tocar la taula és trivial (0)', () => {
    const before: Meld[] = [[t('red', 5), t('blue', 5), t('black', 5)]];
    const nova: Meld = [t('orange', 1), t('orange', 2), t('orange', 3)];
    const breakdown = hieroglyphBreakdown(before, [...before, nova]);
    expect(breakdown.score).toBe(0);
    expect(breakdown.tier).toBe('trivial');
    expect(breakdown.createdMelds).toBe(1);
    expect(breakdown.newMeldsFromRack).toBe(1);
    expect(breakdown.tilesFromRack).toBe(3);
    expect(breakdown.relocatedTiles).toBe(0);
  });

  it('allargar una jugada existent és simple (1)', () => {
    const grup: Meld = [t('red', 5), t('blue', 5), t('black', 5)];
    const breakdown = hieroglyphBreakdown([grup], [[...grup, t('orange', 5)]]);
    expect(breakdown.score).toBe(1);
    expect(breakdown.tier).toBe('simple');
    expect(breakdown.extendedMelds).toBe(1);
    expect(breakdown.alteredMelds).toBe(0);
    expect(breakdown.playedTileIds).toEqual(['orange-5-a']);
  });

  it('fondre dues escales amb una fitxa pont és simple (2): dues esteses', () => {
    const a: Meld = [t('red', 1), t('red', 2), t('red', 3)];
    const b: Meld = [t('red', 5), t('red', 6), t('red', 7)];
    const fusio: Meld = [...a, t('red', 4), ...b];
    const breakdown = hieroglyphBreakdown([a, b], [fusio]);
    expect(breakdown.score).toBe(2);
    expect(breakdown.extendedMelds).toBe(2);
    expect(breakdown.relocatedTiles).toBe(0);
  });

  it('partir una escala de sis en dues de tres és interessant (5)', () => {
    const escala: Meld = [1, 2, 3, 4, 5, 6].map((v) => t('blue', v));
    const after: Meld[] = [
      [t('blue', 1), t('blue', 2), t('blue', 3)],
      [t('blue', 4), t('blue', 5), t('blue', 6), t('blue', 7)],
    ];
    // La successora és la primera meitat (empat 3–3 → índex més baix): la
    // segona meitat compta com a 3 fitxes recol·locades + 1 jugada alterada.
    const breakdown = hieroglyphBreakdown([escala], after);
    expect(breakdown.alteredMelds).toBe(1);
    expect(breakdown.relocatedTiles).toBe(3);
    expect(breakdown.score).toBe(5);
    expect(breakdown.tier).toBe('interessant');
    expect(breakdown.relocatedTileIds).toEqual(['blue-4-a', 'blue-5-a', 'blue-6-a']);
  });

  it('endur-se el quart d’un grup per allargar una escala és interessant (4)', () => {
    const grup: Meld = [t('red', 7), t('blue', 7), t('black', 7), t('orange', 7)];
    const escala: Meld = [t('orange', 4), t('orange', 5), t('orange', 6)];
    const after: Meld[] = [
      [t('red', 7), t('blue', 7), t('black', 7)],
      [...escala, t('orange', 7), t('orange', 8)],
    ];
    const breakdown = hieroglyphBreakdown([grup, escala], after);
    // El grup queda alterat (+2), la fitxa que marxa és recol·locada (+1) i
    // l’escala que la rep és estesa (+1).
    expect(breakdown.alteredMelds).toBe(1);
    expect(breakdown.extendedMelds).toBe(1);
    expect(breakdown.relocatedTiles).toBe(1);
    expect(breakdown.score).toBe(4);
  });

  it('recol·locar un joker val el doble que una fitxa normal', () => {
    const ambJoker: Meld = [t('red', 9), joker(), t('red', 11)];
    const grup: Meld = [t('blue', 10), t('black', 10), t('orange', 10)];
    const after: Meld[] = [
      [t('red', 9), t('red', 10), t('red', 11)],
      [...grup, joker()],
    ];
    const breakdown = hieroglyphBreakdown([ambJoker, grup], after);
    // L’escala perd el joker (alterada +2), el joker canvia de jugada (+1 +1)
    // i el grup que el rep és estès (+1).
    expect(breakdown.relocatedJokers).toBe(1);
    expect(breakdown.score).toBe(5);
  });

  it('una reorganització profunda passa el llindar de jeroglífic', () => {
    // Tres jugades desfetes del tot i refetes creuades: [grups de 3 per valor]
    // → [escales de 3 per color], amb una fitxa nova de la mà a cada escala.
    const before: Meld[] = [
      [t('red', 1), t('blue', 1), t('black', 1)],
      [t('red', 2), t('blue', 2), t('black', 2)],
      [t('red', 3), t('blue', 3), t('black', 3)],
    ];
    const after: Meld[] = [
      [t('red', 1), t('red', 2), t('red', 3), t('red', 4)],
      [t('blue', 1), t('blue', 2), t('blue', 3), t('blue', 4)],
      [t('black', 1), t('black', 2), t('black', 3), t('black', 4)],
    ];
    const breakdown = hieroglyphBreakdown(before, after);
    // Cada grup és alterat (+2·3) i dues de cada tres fitxes canvien de jugada
    // respecte de la successora (+6).
    expect(breakdown.alteredMelds).toBe(3);
    expect(breakdown.relocatedTiles).toBe(6);
    expect(breakdown.score).toBe(12);
    expect(breakdown.isHieroglyph).toBe(true);
    expect(breakdown.tier).toBe('jeroglific');
    expect(breakdown.score).toBeGreaterThanOrEqual(HIEROGLYPH_THRESHOLD);
  });
});

describe('jeroglífics: propietats', () => {
  it('és determinista: mateixes taules, mateix desglossament', () => {
    const before: Meld[] = [
      [t('red', 7), t('blue', 7), t('black', 7), t('orange', 7)],
      [t('orange', 4), t('orange', 5), t('orange', 6)],
    ];
    const after: Meld[] = [
      [t('red', 7), t('blue', 7), t('black', 7)],
      [t('orange', 4), t('orange', 5), t('orange', 6), t('orange', 7)],
    ];
    expect(hieroglyphBreakdown(before, after)).toEqual(hieroglyphBreakdown(before, after));
  });

  it('no modifica les taules que rep', () => {
    const before: Meld[] = [[t('red', 1), t('red', 2), t('red', 3)]];
    const after: Meld[] = [[t('red', 1), t('red', 2), t('red', 3), t('red', 4)]];
    const beforeSnapshot = JSON.stringify(before);
    const afterSnapshot = JSON.stringify(after);
    hieroglyphBreakdown(before, after);
    expect(JSON.stringify(before)).toBe(beforeSnapshot);
    expect(JSON.stringify(after)).toBe(afterSnapshot);
  });

  it('l’escala de trams és exactament la documentada', () => {
    expect(hieroglyphTier(0)).toBe('trivial');
    expect(hieroglyphTier(1)).toBe('simple');
    expect(hieroglyphTier(2)).toBe('simple');
    expect(hieroglyphTier(3)).toBe('interessant');
    expect(hieroglyphTier(5)).toBe('interessant');
    expect(hieroglyphTier(6)).toBe('complexa');
    expect(hieroglyphTier(9)).toBe('complexa');
    expect(hieroglyphTier(10)).toBe('jeroglific');
    expect(hieroglyphTier(37)).toBe('jeroglific');
  });

  it('un moviment de jugar sobre un estat surt del tauler de l’estat', () => {
    const grup: Meld = [t('red', 5), t('blue', 5), t('black', 5)];
    const state = makeState({
      racks: [[t('orange', 5)], [t('blue', 2)]],
      board: [grup],
      hasOpened: [true, true],
    });
    const breakdown = hieroglyphForMove(state, {
      type: 'play',
      board: [[...grup, t('orange', 5)]],
    });
    expect(breakdown.score).toBe(1);
    expect(breakdown.extendedMelds).toBe(1);
  });
});
