import { describe, expect, it } from 'vitest';
import {
  DEFAULT_DIFFICULTY,
  DIFFICULTIES,
  DIFFICULTY_ORDER,
  difficultyByKey,
} from '../src/ai/difficulty';

describe('taula de nivells de dificultat', () => {
  it('l’ordre inclou tots els nivells definits, sense repetir-ne cap', () => {
    expect(new Set(DIFFICULTY_ORDER).size).toBe(DIFFICULTY_ORDER.length);
    expect([...DIFFICULTY_ORDER].sort()).toEqual(Object.keys(DIFFICULTIES).sort());
    DIFFICULTY_ORDER.forEach((key) => expect(DIFFICULTIES[key].key).toBe(key));
  });

  /**
   * Aquest és l'invariant que fa que el sistema adaptatiu tingui sentit: si un
   * nivell més ben valorat pogués jugar pitjor, la tria per Elo no equilibraria
   * res. Qualsevol nivell nou s'hi ha de sotmetre.
   */
  it('com més alt és el nivell, més bo juga: Elo puja i els errors baixen', () => {
    for (let i = 1; i < DIFFICULTY_ORDER.length; i++) {
      const weaker = DIFFICULTIES[DIFFICULTY_ORDER[i - 1]];
      const stronger = DIFFICULTIES[DIFFICULTY_ORDER[i]];
      expect(stronger.rating).toBeGreaterThan(weaker.rating);
      expect(stronger.mistakeRate).toBeLessThanOrEqual(weaker.mistakeRate);
      // Cap capacitat no es pot perdre en pujar de nivell.
      expect(Number(stronger.extendsBoard)).toBeGreaterThanOrEqual(Number(weaker.extendsBoard));
      expect(Number(stronger.usesJokers)).toBeGreaterThanOrEqual(Number(weaker.usesJokers));
      expect(Number(stronger.rearrangesTable)).toBeGreaterThanOrEqual(Number(weaker.rearrangesTable));
      expect(stronger.rearrangeRate).toBeGreaterThanOrEqual(weaker.rearrangeRate);
    }
  });

  it('tots els nivells tenen una etiqueta i una probabilitat d’error entre 0 i 1', () => {
    for (const key of DIFFICULTY_ORDER) {
      const params = DIFFICULTIES[key];
      expect(params.label.length).toBeGreaterThan(0);
      expect(params.mistakeRate).toBeGreaterThanOrEqual(0);
      expect(params.mistakeRate).toBeLessThanOrEqual(1);
    }
  });

  it('la proporció de reordenació és entre 0 i 1, i només és positiva si en sap', () => {
    for (const key of DIFFICULTY_ORDER) {
      const params = DIFFICULTIES[key];
      expect(params.rearrangeRate).toBeGreaterThanOrEqual(0);
      expect(params.rearrangeRate).toBeLessThanOrEqual(1);
      expect(params.rearrangeRate > 0).toBe(params.rearrangesTable);
    }
  });
});

describe('difficultyByKey', () => {
  it('retorna el nivell demanat', () => {
    expect(difficultyByKey('expert').key).toBe('expert');
  });

  it('cau al nivell per defecte amb una clau desconeguda o absent', () => {
    expect(difficultyByKey(undefined).key).toBe(DEFAULT_DIFFICULTY);
    expect(difficultyByKey('impossible').key).toBe(DEFAULT_DIFFICULTY);
  });
});
