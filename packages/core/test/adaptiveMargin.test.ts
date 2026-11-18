import { describe, expect, it } from 'vitest';
import {
  STARTING_RATING,
  createProfile,
  marginFromPoints,
  recordGame,
} from '../src/adaptive/experience';

const RIVALS = ['medium', 'medium'] as const;

describe('marge del resultat', () => {
  it('creix amb els punts i es reparteix entre els oponents', () => {
    expect(marginFromPoints(0, 2)).toBe(0);
    expect(marginFromPoints(50, 2)).toBe(0.5);
    expect(marginFromPoints(100, 2)).toBe(1);
    // Per molt que s'hi guanyi, no passa d'1.
    expect(marginFromPoints(500, 2)).toBe(1);
    // Amb un sol oponent, la mateixa diferència compta el doble.
    expect(marginFromPoints(50, 1)).toBe(1);
  });

  it('un resultat negatiu té el mateix marge que el positiu equivalent', () => {
    expect(marginFromPoints(-80, 2)).toBe(marginFromPoints(80, 2));
  });
});

describe('la valoració té en compte el marge', () => {
  // L'Elo per marge s'aplica un cop acabada la calibració inicial.
  const profile = {
    ...createProfile('u1', 'Anna'),
    adaptiveStep: 3,
    adaptiveCalibrating: false,
  };

  it('guanyar de pallissa puja més que guanyar per poc', () => {
    const ajustada = recordGame(profile, [...RIVALS], { won: true, margin: 0 });
    const contundent = recordGame(profile, [...RIVALS], { won: true, margin: 1 });
    expect(contundent.rating).toBeGreaterThan(ajustada.rating);
    expect(ajustada.rating).toBeGreaterThan(STARTING_RATING);
  });

  it('perdre de pallissa baixa més que perdre per poc', () => {
    const ajustada = recordGame(profile, [...RIVALS], { won: false, margin: 0 });
    const contundent = recordGame(profile, [...RIVALS], { won: false, margin: 1 });
    expect(contundent.rating).toBeLessThan(ajustada.rating);
    expect(ajustada.rating).toBeLessThan(STARTING_RATING);
  });

  it('sense marge es comporta exactament com abans', () => {
    const booleà = recordGame(profile, [...RIVALS], true);
    const neutre = recordGame(profile, [...RIVALS], { won: true, margin: 0.5 });
    expect(booleà.rating).toBe(neutre.rating);
  });

  it('el marge queda desat a l’historial', () => {
    const after = recordGame(profile, [...RIVALS], { won: true, margin: 0.8 });
    expect(after.history[0].margin).toBe(0.8);
  });
});
