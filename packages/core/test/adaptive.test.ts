import { describe, expect, it } from 'vitest';
import { suggestOpponents, suggestOpponentRatings } from '../src/adaptive/adaptiveDifficulty';
import { createProfile, kFactor, recordGame, STARTING_RATING } from '../src/adaptive/experience';
import { expectedScore, updateRating } from '../src/adaptive/rating';

describe('valoració Elo', () => {
  it('amb valoracions iguals, la probabilitat esperada és del 50%', () => {
    expect(expectedScore(1200, 1200)).toBeCloseTo(0.5);
  });

  it('guanyar contra un rival més fort puja més que contra un de més fluix', () => {
    const vsStronger = updateRating(1000, 1400, 1, 32) - 1000;
    const vsWeaker = updateRating(1000, 800, 1, 32) - 1000;
    expect(vsStronger).toBeGreaterThan(vsWeaker);
    expect(updateRating(1000, 800, 0, 32)).toBeLessThan(1000);
  });
});

describe('perfil del jugador', () => {
  it('comença amb la valoració inicial i el factor K va baixant amb l’experiència', () => {
    expect(createProfile('u1', 'Anna').rating).toBe(STARTING_RATING);
    expect(kFactor(0)).toBeGreaterThan(kFactor(15));
    expect(kFactor(15)).toBeGreaterThan(kFactor(50));
  });

  it('registra partides sense modificar el perfil original', () => {
    const profile = createProfile('u1', 'Anna');
    const afterWin = recordGame(profile, ['expert'], true, new Date('2026-01-01'));
    expect(afterWin.rating).toBeGreaterThan(profile.rating);
    expect(afterWin.gamesPlayed).toBe(1);
    expect(afterWin.wins).toBe(1);
    expect(afterWin.history).toHaveLength(1);
    expect(profile.gamesPlayed).toBe(0);

    const afterLoss = recordGame(afterWin, ['rookie', 'rookie'], false, new Date('2026-01-02'));
    expect(afterLoss.rating).toBeLessThan(afterWin.rating);
    expect(afterLoss.wins).toBe(1);
  });
});

describe('tria adaptativa d’oponents', () => {
  it('la primera partida és Novell i cada victòria de calibració puja un nivell', () => {
    let profile = createProfile('u1', 'Nou');
    expect(suggestOpponents(profile, 2)).toEqual(['rookie', 'rookie']);

    profile = recordGame(profile, ['rookie', 'rookie'], true);
    expect(suggestOpponents(profile, 2)).toEqual(['easy', 'easy']);

    profile = recordGame(profile, ['easy', 'easy'], true);
    expect(suggestOpponents(profile, 2)).toEqual(['medium', 'medium']);

    profile = recordGame(profile, ['medium', 'medium'], true);
    expect(suggestOpponents(profile, 2)).toEqual(['advanced', 'advanced']);
  });

  it('després del calibratge el número mana i els ajustos són petits', () => {
    let profile = createProfile('u1', 'Anna');
    profile = recordGame(profile, ['rookie', 'rookie'], true);
    profile = recordGame(profile, ['easy', 'easy'], true);
    profile = recordGame(profile, ['medium', 'medium'], false);
    expect(profile.adaptiveCalibrating).toBe(false);
    expect(profile.rating).toBe(1100);
    expect(profile.ratedGames).toBe(0);
    expect(suggestOpponentRatings(profile, 2)).toEqual([1100, 1100]);
    profile = recordGame(profile, ['easy', 'easy'], { won: true, opponentRatings: [1100, 1100] });
    expect(profile.rating).toBe(1127);
    expect(suggestOpponentRatings(profile, 2)).toEqual([1127, 1127]);
    profile = recordGame(profile, ['easy', 'easy'], { won: false, opponentRatings: [1127, 1127] });
    expect(profile.rating).toBe(1114);
  });

  it('la primera derrota fixa el nivell segons si ha estat ajustada o contundent', () => {
    const aMitja = recordGame(
      recordGame(createProfile('u1', 'Anna'), ['rookie'], true),
      ['easy'],
      true,
    );

    const ajustada = recordGame(aMitja, ['medium'], { won: false, margin: 0.15 });
    expect(ajustada.adaptiveStep).toBe(4);
    expect(ajustada.rating).toBe(1200);
    expect(suggestOpponents(ajustada, 2)).toEqual(['medium', 'medium']);

    const intermèdia = recordGame(aMitja, ['medium'], { won: false, margin: 0.5 });
    expect(intermèdia.adaptiveStep).toBe(3);
    expect(intermèdia.rating).toBe(1100);
    expect(suggestOpponentRatings(intermèdia, 2)).toEqual([1100, 1100]);

    const clara = recordGame(aMitja, ['medium'], { won: false, margin: 0.9 });
    expect(clara.adaptiveStep).toBe(2);
    expect(clara.rating).toBe(1000);
    expect(suggestOpponents(clara, 2)).toEqual(['easy', 'easy']);
  });

  it('els perfils antics sense graó adaptatiu conserven el nivell segons l’Elo', () => {
    const strong = {
      ...createProfile('u2', 'Crac'),
      rating: 1650,
      gamesPlayed: 30,
      adaptiveStep: undefined,
      adaptiveCalibrating: undefined,
    };
    expect(suggestOpponents(strong, 2)).toEqual(['expert', 'expert']);
  });

  it('una partida manual mou l’Elo però no l’escala adaptativa', () => {
    const profile = createProfile('u1', 'Anna');
    const after = recordGame(profile, ['expert'], { won: false, adaptive: false });
    expect(after.rating).toBeLessThan(profile.rating);
    expect(after.adaptiveStep).toBe(0);
    expect(after.adaptiveCalibrating).toBe(true);
  });
});
