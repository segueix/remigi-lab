import { describe, expect, it } from 'vitest';
import { bestRearrangement } from '../src/ai/rearrange';
import { engineSpecById, engineSpecDiff } from '../src/lab/catalog';
import { playMatch, type MatchResult } from '../src/lab/match';
import { joker, t } from './helpers';

/**
 * El desempat per punts (challenger-punts): a igualtat de fitxes jugades,
 * desfer-se de més punts i quedar-se a la mà les fitxes barates. Aquí es fixa
 * (1) que tria bé en un empat construït a mà, (2) que amb la bandera apagada
 * no canvia RES (el baseline de regressió és l'altra meitat d'aquesta prova),
 * i (3) que el challenger juga determinista i sense errors.
 */
describe('desempat per punts', () => {
  /*
   * L'empat de manual: amb [joker, 2r, 3r, 13b, 13k] es poden col·locar
   * exactament 3 fitxes de dues maneres — [2r,3r,J] (queden els dos 13: 26
   * punts) o [13b,13k,J] (queden 2r i 3r: 5 punts). Mateixes fitxes jugades,
   * punts ben diferents.
   */
  const rack = [joker(), t('red', 2), t('red', 3), t('blue', 13), t('black', 13)];

  it('en empat de fitxes, es queda a la mà les barates', () => {
    const result = bestRearrangement([], rack, { preferPoints: true })!;
    expect(result.tilesUsed).toBe(3);
    const played = result.board.flat().map((tile) => tile.id).sort();
    expect(played).toEqual(['black-13-a', 'blue-13-a', 'joker-a']);
  });

  it('sense la bandera, el nombre de fitxes és el mateix (només canvia la tria)', () => {
    const result = bestRearrangement([], rack, {})!;
    expect(result.tilesUsed).toBe(3);
  });

  it('la bandera no fa jugar mai més fitxes: només tria entre empats', () => {
    // En un cas sense empat (tot es pot col·locar), les dues variants coincideixen.
    const clearRack = [t('red', 5), t('red', 6), t('red', 7), t('blue', 9), t('black', 9), t('orange', 9)];
    const off = bestRearrangement([], clearRack, {})!;
    const on = bestRearrangement([], clearRack, { preferPoints: true })!;
    expect(on.tilesUsed).toBe(off.tilesUsed);
    expect(on.tilesUsed).toBe(6);
  });

  it('el challenger-punts juga sencer, determinista i sense errors', { timeout: 60_000 }, () => {
    const setup = { engineA: 'expert-v2', engineB: 'challenger-punts', seed: 3 } as const;
    const strip = (result: MatchResult) => {
      const clean = structuredClone(result);
      clean.totals.A.thinkingTimeMs = 0;
      clean.totals.B.thinkingTimeMs = 0;
      return clean;
    };
    const first = playMatch(setup);
    expect(first.error).toBeUndefined();
    expect(first.winner === 'A' || first.winner === 'B').toBe(true);
    expect(strip(playMatch(setup))).toEqual(strip(first));
  });

  it('la diferència amb el Campió és l’estratègia i la bandera, no el pressupost', () => {
    const diff = engineSpecDiff(engineSpecById('expert-v2'), engineSpecById('challenger-punts'));
    const keys = diff.map((d) => d.key);
    expect(keys).toContain('preferPointsTieBreak');
    expect(keys).toContain('estratègia');
    expect(keys).not.toContain('maxNodes'); // mateix pressupost: 500k tots dos
    const flag = diff.find((d) => d.key === 'preferPointsTieBreak')!;
    expect(flag.a).toBe('—');
    expect(flag.b).toBe('sí');
  });
});
