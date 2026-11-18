import { describe, expect, it } from 'vitest';
import { createProfile, recordGame, kFactor } from '../src/adaptive/experience';
import { expectedTableScore, updateTableRating } from '../src/adaptive/rating';
import { suggestOpponentRatings } from '../src/adaptive/adaptiveDifficulty';
import { createEngine, createGame, difficultyByRating, DIFFICULTIES, DIFFICULTY_ORDER } from '../src/engine';

const settled = (rating = 1200, ratedGames = 0) => ({
  ...createProfile('u', 'Anna'), rating, ratedGames, adaptiveCalibrating: false,
});

describe('equilibri del nivell', () => {
  it.each([1, 2, 3])('una victòria compensa %i derrotes contra rivals equivalents', (count) => {
    const opponents = Array(count).fill(1200);
    expect(expectedTableScore(1200, opponents)).toBeCloseTo(1 / (count + 1));
    const win = updateTableRating(1200, opponents, true, 40) - 1200;
    const loss = updateTableRating(1200, opponents, false, 40) - 1200;
    expect(Math.abs(win + count * loss)).toBeLessThanOrEqual(1);
  });

  it('les primeres deu partides es mouen més i el factor baixa progressivament', () => {
    expect(kFactor(0)).toBe(40);
    expect(kFactor(9)).toBe(40);
    expect(kFactor(10)).toBe(39);
    expect(kFactor(29)).toBe(20);
    expect(recordGame(settled(), ['medium'], true).rating).toBe(1220);
    expect(recordGame(settled(1200, 30), ['medium'], true).rating).toBe(1210);
  });

  it('una recalibració conserva els totals però reinicia la confiança', () => {
    const profile = { ...createProfile('u', 'Anna'), gamesPlayed: 300, ratedGames: 0 };
    const after = recordGame(profile, ['rookie'], false);
    expect(after.gamesPlayed).toBe(301);
    expect(after.ratedGames).toBe(0);
    expect(recordGame(after, ['rookie'], true).rating).toBe(820);
  });

  it('guanyar tota l’escala acaba el calibratge a Expert', () => {
    let profile = createProfile('u', 'Anna');
    for (const key of DIFFICULTY_ORDER) profile = recordGame(profile, [key], true);
    expect(profile.adaptiveCalibrating).toBe(false);
    expect(profile.rating).toBe(1600);
    expect(recordGame(profile, ['expert'], true).rating).toBe(1600);
    expect(recordGame(profile, ['expert'], false).rating).toBe(1580);
  });

  it('un graó antic divergent no substitueix la valoració del jugador', () => {
    expect(suggestOpponentRatings({ ...settled(1130), adaptiveStep: 8 }, 3)).toEqual([1130, 1130, 1130]);
    expect(recordGame(settled(1700), ['expert'], true).rating).toBeGreaterThanOrEqual(1700);
  });

  it('valora els rivals realment jugats i els conserva a l’historial', () => {
    const profile = settled(1100);
    const exact = recordGame(profile, ['easy'], { won: true, opponentRatings: [1190] });
    const nominal = recordGame(profile, ['easy'], true);
    expect(exact.rating).toBeGreaterThan(nominal.rating);
    expect(exact.history[0].opponentRatings).toEqual([1190]);
    expect(suggestOpponentRatings(exact, 1)).toEqual([exact.rating]);
  });
});

describe('força contínua del motor', () => {
  it('manté exactament els cinc nivells de referència', () => {
    for (const key of DIFFICULTY_ORDER) {
      expect(difficultyByRating(DIFFICULTIES[key].rating)).toEqual(DIFFICULTIES[key]);
    }
  });

  it('gradua els jokers, les extensions i la reordenació sense salts de capacitat', () => {
    expect(difficultyByRating(900).jokerRate).toBeCloseTo(0.125);
    // Fàcil (1000) ja allarga jugades en un 60% dels torns i Mitjà (1200), sempre.
    expect(difficultyByRating(1100).extensionRate).toBeCloseTo(0.8);
    expect(difficultyByRating(900).extensionRate).toBeCloseTo(0.525);
    expect(difficultyByRating(1300).rearrangeRate).toBeCloseTo(0.1);
    expect(difficultyByRating(1500).rearrangeRate).toBeCloseTo(0.6);
    expect(difficultyByRating(1145).extensionRate).toBeGreaterThan(difficultyByRating(1130).extensionRate!);
  });

  it('rating arriba fins al motor i preval sobre la clau descriptiva', () => {
    const game = createGame({ seed: 9, players: [
      { name: 'A', kind: 'ai', aiLevel: 'rookie' }, { name: 'B', kind: 'ai', aiLevel: 'rookie' },
    ] });
    const exact = createEngine({ seed: 10 }).play(game, { rating: 1130 });
    const override = createEngine({ seed: 10 }).play(game, { overrides: difficultyByRating(1130) });
    expect(exact.move).toEqual(override.move);
  });
});
