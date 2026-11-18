import { describe, expect, it } from 'vitest';
import { buildReport, reportToMarkdown } from '../src/lab/report';
import {
  significance,
  twoSidedP,
  wilsonInterval,
} from '../src/lab/significance';
import {
  createTournament,
  mergeTournamentShards,
  mergedPercentile,
  runTournament,
  shardRange,
  summarizeSamples,
  tournamentGameSetup,
  type GameSummary,
  type TournamentConfig,
  type TournamentResult,
  type TournamentShard,
} from '../src/lab/tournament';
import { p95 } from '../src/lab/stats';

/** Còpia d'un resultat sense res que depengui del rellotge. */
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

function playShard(config: TournamentConfig, index: number, count: number): TournamentShard {
  const range = shardRange(config.games, config.paired ?? true, index, count);
  const run = createTournament({ ...config, range });
  while (!run.done) run.runNext();
  // Com al disc: el que passa per JSON és el que es fusiona.
  return JSON.parse(JSON.stringify(run.shard()));
}

describe('shardRange: el repartiment de partides', () => {
  it('cobreix totes les partides exactament una vegada, sense forats ni solapaments', () => {
    for (const paired of [true, false]) {
      for (const games of [1, 2, 7, 10, 25, 100]) {
        const units = paired ? Math.ceil(games / 2) : games;
        for (const count of [1, 2, 3, 4, 7]) {
          if (count > units) continue;
          const ranges = Array.from({ length: count }, (_, i) => shardRange(games, paired, i, count));
          expect(ranges[0].start).toBe(0);
          expect(ranges[count - 1].end).toBe(games);
          for (let i = 1; i < count; i++) expect(ranges[i].start).toBe(ranges[i - 1].end);
          for (const range of ranges) expect(range.end).toBeGreaterThan(range.start);
        }
      }
    }
  });

  it('amb llavors aparellades, les dues partides d’una llavor cauen al mateix shard', () => {
    const config = { engineA: 'a', engineB: 'b', baseSeed: 9, paired: true, maxTurns: 1000 };
    const games = 30;
    const shardOfSeed = new Map<number, number>();
    for (let shard = 0; shard < 4; shard++) {
      const { start, end } = shardRange(games, true, shard, 4);
      expect(start % 2).toBe(0);
      for (let index = start; index < end; index++) {
        const { seed } = tournamentGameSetup(config, index);
        expect(shardOfSeed.get(seed) ?? shard).toBe(shard);
        shardOfSeed.set(seed, shard);
      }
    }
  });

  it('el repartiment és equilibrat i rebutja shards impossibles', () => {
    const sizes = Array.from({ length: 4 }, (_, i) => {
      const r = shardRange(1000, true, i, 4);
      return r.end - r.start;
    });
    expect(sizes).toEqual([250, 250, 250, 250]);
    expect(() => shardRange(4, true, 0, 3)).toThrowError(/màxim 2/);
    expect(() => shardRange(10, true, 5, 5)).toThrowError(/no existeix/);
    expect(() => shardRange(10, true, 0, 0)).toThrowError();
  });

  it('un rang invàlid al torneig falla amb un missatge clar', () => {
    const base = { engineA: 'medium-v1', engineB: 'easy-v1', games: 4, baseSeed: 1 };
    expect(() => createTournament({ ...base, range: { start: 2, end: 2 } })).toThrowError(/rang/);
    expect(() => createTournament({ ...base, range: { start: 0, end: 5 } })).toThrowError(/rang/);
  });
});

describe('fusionar shards = jugar el torneig sencer', () => {
  const config: TournamentConfig = { engineA: 'medium-v1', engineB: 'advanced-v1', games: 10, baseSeed: 61 };

  it('dona exactament el mateix resultat (tret dels temps), amb qualsevol nombre de shards', () => {
    const full = runTournament(config);
    for (const count of [1, 2, 5]) {
      const shards = Array.from({ length: count }, (_, i) => playShard(config, i, count));
      const merged = mergeTournamentShards(shards);
      expect(withoutTimes(merged)).toEqual(withoutTimes(full));
    }
  }, 60_000);

  it('l’ordre en què arriben els shards no importa', () => {
    const shards = [0, 1, 2].map((i) => playShard(config, i, 3));
    const a = mergeTournamentShards(shards);
    const b = mergeTournamentShards([shards[2], shards[0], shards[1]]);
    expect(withoutTimes(b)).toEqual(withoutTimes(a));
  });

  it('també amb llavors no aparellades', () => {
    const unpaired = { ...config, paired: false, games: 7 };
    const full = runTournament(unpaired);
    const merged = mergeTournamentShards([0, 1, 2].map((i) => playShard(unpaired, i, 3)));
    expect(withoutTimes(merged)).toEqual(withoutTimes(full));
  });

  it('els índexs de les partides són els absoluts del torneig', () => {
    const shard = playShard(config, 1, 2);
    expect(shard.summaries[0].index).toBe(shard.config.range.start);
    expect(shard.summaries.map((s) => s.index)).toEqual(
      Array.from({ length: shard.summaries.length }, (_, i) => shard.config.range.start + i),
    );
  });
});

describe('la fusió valida els shards', () => {
  const config: TournamentConfig = { engineA: 'medium-v1', engineB: 'easy-v1', games: 8, baseSeed: 5 };
  const shards = [0, 1, 2, 3].map((i) => playShard(config, i, 4));

  it('detecta un shard que falta', () => {
    expect(() => mergeTournamentShards([shards[0], shards[1], shards[3]])).toThrowError(/Falten/);
    expect(() => mergeTournamentShards(shards.slice(0, 3))).toThrowError(/Falten/);
  });

  it('detecta un shard repetit (partides en més d’un)', () => {
    expect(() => mergeTournamentShards([...shards, shards[1]])).toThrowError(/més d'un shard/);
  });

  it('refusa barrejar tornejos diferents', () => {
    const other = playShard({ ...config, baseSeed: 6 }, 0, 4);
    expect(() => mergeTournamentShards([other, shards[1], shards[2], shards[3]])).toThrowError(
      /mateix torneig/,
    );
    const otherEngine = playShard({ ...config, engineB: 'rookie-v1' }, 0, 4);
    expect(() => mergeTournamentShards([otherEngine, shards[1], shards[2], shards[3]])).toThrowError(
      /mateix torneig/,
    );
  });

  it('refusa un shard amb una versió del motor diferent o un esquema desconegut', () => {
    const old = structuredClone(shards);
    old[0].engineVersion = '0.0.1';
    expect(() => mergeTournamentShards(old)).toThrowError(/mateix torneig/);
    const alien = structuredClone(shards);
    (alien[0] as { schema: string }).schema = 'altra-cosa/9';
    expect(() => mergeTournamentShards(alien)).toThrowError(/Esquema/);
  });

  it('refusa fusionar amb un catàleg que ja no és el dels shards', () => {
    const changed = structuredClone(shards);
    changed.forEach((shard) => (shard.engineA.params.mistakeRate += 0.01));
    expect(() => mergeTournamentShards(changed)).toThrowError(/catàleg|mateix commit/);
  });

  it('sense cap shard, falla', () => {
    expect(() => mergeTournamentShards([])).toThrowError(/cap shard/);
  });
});

describe('esbós de mostres (p95 i nodes fusionables)', () => {
  it('és exacte mentre hi caben totes les mostres', () => {
    const values = Array.from({ length: 700 }, (_, i) => ((i * 7919) % 1000) + 0.5);
    const sketch = summarizeSamples(values);
    expect(sketch.count).toBe(700);
    expect(sketch.points).toHaveLength(700);
    expect(mergedPercentile([sketch])).toBe(p95(values));
    // Repartides en tres trossos, igual.
    const parts = [values.slice(0, 100), values.slice(100, 450), values.slice(450)].map(summarizeSamples);
    expect(mergedPercentile(parts)).toBe(p95(values));
  });

  it('amb moltes mostres s’aproxima i conserva el mínim, el màxim i la suma exactes', () => {
    let seed = 12345;
    const random = () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
    const values = Array.from({ length: 20_000 }, () => Math.exp(random() * 6));
    const sketch = summarizeSamples(values);
    expect(sketch.points).toHaveLength(1001);
    expect(sketch.points[0]).toBe(Math.min(...values));
    expect(sketch.points[1000]).toBe(Math.max(...values));
    expect(sketch.sum).toBeCloseTo(values.reduce((a, b) => a + b, 0), 6);

    const exact = p95(values);
    const parts = [0, 1, 2, 3].map((i) => summarizeSamples(values.slice(i * 5000, (i + 1) * 5000)));
    expect(Math.abs(mergedPercentile(parts) - exact) / exact).toBeLessThan(0.01);
  });

  it('un conjunt buit no trenca res', () => {
    expect(mergedPercentile([summarizeSamples([])])).toBe(0);
    expect(summarizeSamples([])).toEqual({ count: 0, sum: 0, points: [] });
  });
});

describe('significació estadística', () => {
  it('el p-valor i l’interval de Wilson coincideixen amb els valors de referència', () => {
    expect(twoSidedP(0)).toBeCloseTo(1, 6);
    expect(twoSidedP(1.959964)).toBeCloseTo(0.05, 4);
    expect(twoSidedP(-2.575829)).toBeCloseTo(0.01, 4);
    const [lo, hi] = wilsonInterval(557, 1000);
    expect(lo).toBeCloseTo(0.5260, 3);
    expect(hi).toBeCloseTo(0.5876, 3);
    expect(wilsonInterval(0, 0)).toEqual([0, 1]);
  });

  /** Resums mínims: només el que mira la significació. */
  const game = (index: number, seed: number, winner: 'A' | 'B' | null, firstSeat: 'A' | 'B'): GameSummary =>
    ({ index, seed, winner, firstSeat }) as GameSummary;

  /** `aWins` victòries d'A sobre `total` partides, amb llavors aparellades. */
  function synthetic(aWins: number, total: number, pairedSplit = false): GameSummary[] {
    return Array.from({ length: total }, (_, i) => {
      const seed = 100 + Math.floor(i / 2);
      const seat = i % 2 === 0 ? 'A' : 'B';
      // Reparteix les victòries d'A: sense «split», les dues d'una llavor sempre al mateix guanyador.
      const aWon = pairedSplit ? i % 2 === 0 && i / 2 < aWins : Math.floor(i / 2) * 2 < aWins;
      return game(i, seed, aWon ? 'A' : 'B', seat);
    });
  }

  it('55,8% sobre 1.000 és significatiu; 50,8% sobre 1.000 és soroll', () => {
    const big = significance(synthetic(558, 1000));
    expect(big.winsA).toBe(558);
    expect(big.verdict).toBe('a-millor');
    expect(big.pValue).toBeLessThan(0.001);
    const noise = significance(synthetic(508, 1000));
    expect(noise.verdict).toBe('sense-diferencia');
    expect(noise.pValue).toBeGreaterThan(0.5);
    expect(noise.ci95[0]).toBeLessThan(0.5);
    expect(noise.ci95[1]).toBeGreaterThan(0.5);
  });

  it('el marge d’error baixa amb l’arrel del nombre de partides', () => {
    const small = significance(synthetic(50, 100)).marginOfError;
    const large = significance(synthetic(5000, 10_000)).marginOfError;
    expect(small / large).toBeCloseTo(10, 6);
    expect(large).toBeCloseTo(0.0098, 3);
  });

  it('les partides amb error o sense guanyador no compten', () => {
    const games = [
      ...synthetic(30, 60),
      { ...game(60, 900, 'A', 'A'), error: { turn: 1, message: 'x' } } as GameSummary,
      game(61, 901, null, 'A'),
    ];
    const sig = significance(games);
    expect(sig.decisiveGames).toBe(60);
  });

  it('l’anàlisi per parells compta qui guanya les dues partides de cada llavor', () => {
    const sig = significance(synthetic(60, 100)); // 30 parells d'A, 20 de B
    expect(sig.paired).not.toBeNull();
    expect(sig.paired!.pairs).toBe(50);
    expect(sig.paired!.aBoth).toBe(30);
    expect(sig.paired!.bBoth).toBe(20);
    expect(sig.paired!.split).toBe(0);
    expect(sig.basis).toBe('parells');
  });

  it('amb pocs parells s’usa el contrast de partides, sense anàlisi per parells', () => {
    const sig = significance(synthetic(6, 12));
    expect(sig.paired).toBeNull();
    expect(sig.basis).toBe('partides');
  });

  it('un torneig sense partides no peta', () => {
    const sig = significance([]);
    expect(sig.decisiveGames).toBe(0);
    expect(sig.verdict).toBe('sense-diferencia');
    expect(sig.pValue).toBe(1);
  });
});

describe('l’informe porta la significació i els shards', () => {
  const result = runTournament({ engineA: 'medium-v1', engineB: 'rookie-v1', games: 6, baseSeed: 77 });

  it('el JSON i el Markdown en parlen', () => {
    const report = buildReport(result, { generatedAt: '2026-11-18T00:00:00.000Z', shards: 3 });
    expect(report.significance.decisiveGames).toBeGreaterThan(0);
    expect(report.shards).toBe(3);
    expect(JSON.parse(JSON.stringify(report))).toEqual(report);
    const markdown = reportToMarkdown(report);
    expect(markdown).toContain('## Significació estadística');
    expect(markdown).toContain('interval de confiança del 95%');
    expect(markdown).toContain('repartit en 3 shards');
  });

  it('sense shards, no ho diu', () => {
    const report = buildReport(result, { generatedAt: '2026-11-18T00:00:00.000Z', shards: 1 });
    expect(report.shards).toBeUndefined();
    expect(reportToMarkdown(report)).not.toContain('shards');
  });
});
