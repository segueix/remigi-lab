import { describe, expect, it } from 'vitest';
import { probeTieBreak } from '../src/lab/tiebreakProbe';

/**
 * La sonda mesura si una variant arriba a canviar jugades. Aquí es fixa que
 * mesura el que diu: que un motor comparat amb ell mateix no canvia res, que
 * el desempat per punts no altera mai el NOMBRE de fitxes jugades (és un
 * desempat, no una estratègia nova) i que és determinista.
 */
describe('sonda del desempat', () => {
  it('un motor comparat amb ell mateix no canvia cap jugada', { timeout: 120_000 }, () => {
    const probe = probeTieBreak({
      variant: 'expert-v2',
      reference: 'expert-v2',
      games: 2,
      baseSeed: 42,
    });
    expect(probe.moves).toBeGreaterThan(10);
    expect(probe.changed).toBe(0);
    expect(probe.changedRate).toBe(0);
    expect(probe.extraPointsShed).toBe(0);
    expect(probe.tilesDelta).toBe(0);
  });

  it('el desempat per punts canvia jugades però mai el nombre de fitxes', { timeout: 120_000 }, () => {
    const probe = probeTieBreak({
      variant: 'challenger-punts',
      reference: 'expert-v2',
      games: 4,
      baseSeed: 42,
    });
    expect(probe.moves).toBeGreaterThan(20);
    // L'invariant que fa que la comparació sigui neta: si això no fos 0, la
    // variant no seria un desempat sinó un canvi d'objectiu.
    expect(probe.tilesDelta).toBe(0);
    expect(probe.changed).toBeLessThanOrEqual(probe.moves);
    expect(probe.changedRate).toBeCloseTo(probe.changed / probe.moves, 10);
  });

  it('és determinista: el mateix sondeig dona el mateix resultat', { timeout: 120_000 }, () => {
    const config = {
      variant: 'challenger-punts',
      reference: 'expert-v2',
      games: 2,
      baseSeed: 7,
    };
    expect(probeTieBreak(config)).toEqual(probeTieBreak(config));
  });
});
