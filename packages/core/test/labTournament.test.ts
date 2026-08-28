import { describe, expect, it } from 'vitest';
import {
  createTournament,
  runTournament,
  tournamentGameSetup,
  type TournamentResult,
} from '../src/lab/tournament';
import { mean, p95, round } from '../src/lab/stats';

/** Còpia d'un resultat de torneig sense res que depengui del rellotge. */
function withoutTimes(result: TournamentResult) {
  const clean = structuredClone(result);
  clean.durationMs = 0;
  for (const seat of ['A', 'B'] as const) {
    clean.aggregates[seat].timeMsMean = 0;
    clean.aggregates[seat].timeMsP95 = 0;
    clean.aggregates[seat].timeMsMax = 0;
    for (const summary of clean.summaries) summary.totals[seat].thinkingTimeMs = 0;
  }
  return clean;
}

describe('estadística mínima', () => {
  it('mitjana, p95 i arrodoniment', () => {
    expect(mean([])).toBe(0);
    expect(mean([2, 4])).toBe(3);
    expect(p95([])).toBe(0);
    const values = Array.from({ length: 100 }, (_, i) => i + 1);
    expect(p95(values)).toBe(96);
    expect(p95([7])).toBe(7);
    expect(round(1.2345, 2)).toBe(1.23);
  });
});

describe('torneig Motor A vs Motor B', () => {
  it('el calendari aparellat juga cada llavor dues vegades amb els seients bescanviats', () => {
    const config = {
      engineA: 'medium-v1',
      engineB: 'easy-v1',
      games: 6,
      baseSeed: 100,
      paired: true,
      maxTurns: 1000,
    };
    const setups = [0, 1, 2, 3, 4, 5].map((i) => tournamentGameSetup(config, i));
    expect(setups.map((s) => s.seed)).toEqual([100, 100, 101, 101, 102, 102]);
    expect(setups.map((s) => s.firstSeat)).toEqual(['A', 'B', 'A', 'B', 'A', 'B']);
  });

  it('sense aparellar, cada partida té llavor pròpia i qui comença s’alterna', () => {
    const config = {
      engineA: 'medium-v1',
      engineB: 'easy-v1',
      games: 4,
      baseSeed: 100,
      paired: false,
      maxTurns: 1000,
    };
    const setups = [0, 1, 2, 3].map((i) => tournamentGameSetup(config, i));
    expect(setups.map((s) => s.seed)).toEqual([100, 101, 102, 103]);
    expect(setups.map((s) => s.firstSeat)).toEqual(['A', 'B', 'A', 'B']);
  });

  it('compta bé els resultats: victòries + errors = partides', () => {
    const result = runTournament({
      engineA: 'medium-v1',
      engineB: 'easy-v1',
      games: 6,
      baseSeed: 50,
    });
    expect(result.winsA + result.winsB + result.errors.length).toBe(6);
    expect(result.summaries).toHaveLength(6);
    expect(result.errors).toHaveLength(0);
    // Les victòries del resultat són les de les partides, ni una més.
    expect(result.summaries.filter((s) => s.winner === 'A')).toHaveLength(result.winsA);
    expect(result.summaries.filter((s) => s.winner === 'B')).toHaveLength(result.winsB);
  });

  it('els agregats quadren amb les partides que els formen', () => {
    const result = runTournament({
      engineA: 'medium-v1',
      engineB: 'rookie-v1',
      games: 4,
      baseSeed: 7,
    });
    for (const seat of ['A', 'B'] as const) {
      const aggregate = result.aggregates[seat];
      const totals = result.summaries.map((s) => s.totals[seat]);
      expect(aggregate.moves).toBe(totals.reduce((a, t) => a + t.moves, 0));
      expect(aggregate.hieroglyphs).toBe(totals.reduce((a, t) => a + t.hieroglyphs, 0));
      expect(aggregate.rearranges).toBe(totals.reduce((a, t) => a + t.rearranges, 0));
      expect(aggregate.tilesPerTurn).toBeCloseTo(
        totals.reduce((a, t) => a + t.tilesPlayed, 0) / aggregate.moves,
        10,
      );
      expect(aggregate.pointsMean).toBeCloseTo(
        mean(result.summaries.map((s) => s.points[seat])),
        10,
      );
      expect(aggregate.winRate).toBeCloseTo(aggregate.wins / 4, 10);
    }
    // En un duel, els punts sumen zero partida a partida i també de mitjana.
    expect(result.aggregates.A.pointsMean + result.aggregates.B.pointsMean).toBeCloseTo(0, 10);
    expect(result.turnsMean).toBeCloseTo(mean(result.summaries.map((s) => s.turns)), 10);
  });

  it('és determinista: el mateix torneig dues vegades dona el mateix resultat', () => {
    const config = { engineA: 'medium-v1', engineB: 'easy-v1', games: 4, baseSeed: 33 };
    const first = runTournament(config);
    const second = runTournament(config);
    expect(withoutTimes(second)).toEqual(withoutTimes(first));
  });

  it('les partides interessants surten de les jugades de debò i es poden reproduir', () => {
    const result = runTournament({
      engineA: 'medium-v1',
      engineB: 'rookie-v1',
      games: 6,
      baseSeed: 20,
    });
    const kinds = result.interesting.map((game) => game.kind);
    expect(kinds).toContain('mes-llarga');
    expect(new Set(kinds).size).toBe(kinds.length);

    const llarga = result.interesting.find((game) => game.kind === 'mes-llarga')!;
    expect(llarga.value).toBe(Math.max(...result.summaries.map((s) => s.turns)));
    const summary = result.summaries[llarga.gameIndex];
    expect(llarga.setup.seed).toBe(summary.seed);
    expect(llarga.setup.firstSeat).toBe(summary.firstSeat);
    expect(llarga.setup.engineA).toBe('medium-v1');

    const complexa = result.interesting.find((game) => game.kind === 'jugada-mes-complexa');
    if (complexa) {
      expect(complexa.value).toBe(
        Math.max(result.aggregates.A.maxHieroglyph.score, result.aggregates.B.maxHieroglyph.score),
      );
    }
  });

  it('el progrés avança partida a partida i el resultat només arriba al final', () => {
    const run = createTournament({ engineA: 'easy-v1', engineB: 'rookie-v1', games: 3, baseSeed: 1 });
    expect(run.result()).toBeNull();
    expect(run.progress().completed).toBe(0);
    run.runNext();
    expect(run.progress().completed).toBe(1);
    expect(run.progress().total).toBe(3);
    run.runNext();
    run.runNext();
    expect(run.done).toBe(true);
    expect(run.runNext()).toBeNull();
    expect(run.result()).not.toBeNull();
  });

  it('un nivell més fort guanya el torneig a un de més fluix', () => {
    const result = runTournament({
      engineA: 'medium-v1',
      engineB: 'rookie-v1',
      games: 6,
      baseSeed: 5,
    });
    expect(result.winsA).toBeGreaterThan(result.winsB);
  });

  it('els especs del resultat són serialitzables (informe i workers)', () => {
    const result = runTournament({ engineA: 'easy-v1', engineB: 'rookie-v1', games: 2, baseSeed: 9 });
    const roundTrip = JSON.parse(JSON.stringify(result)) as TournamentResult;
    expect(roundTrip.engineA.id).toBe('easy-v1');
    expect(roundTrip.engineA.params.mistakeRate).toBe(0.2);
    expect(withoutTimes(roundTrip)).toEqual(withoutTimes(result));
  });
});
