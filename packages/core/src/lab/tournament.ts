import { ENGINE_VERSION } from '../engine';
import { engineSpecById, resolveEngineParams, type EngineSpec } from './catalog';
import { createMatch, type MatchSetup, type Seat, type SeatTotals } from './match';
import { max, mean, p95, sum } from './stats';

/**
 * Torneig del laboratori: N partides Motor A contra Motor B en condicions
 * comparables, amb els agregats per motor i la llista de partides
 * interessants (cadascuna amb el `MatchSetup` exacte per reproduir-la).
 *
 * Justícia (vegeu docs/AI-LAB.md):
 * - les llavors surten de `baseSeed` en una seqüència fixa i reproduïble;
 * - qui comença s'alterna a cada partida;
 * - amb `paired` (per defecte), cada llavor es juga **dues vegades amb els
 *   seients bescanviats**: els dos motors juguen exactament els mateixos
 *   repartiments des dels dos costats, i cap posició no pot decidir la
 *   comparativa.
 */

export interface TournamentConfig {
  engineA: string;
  engineB: string;
  games: number;
  baseSeed: number;
  /** Cada llavor es juga dues vegades amb els seients bescanviats. */
  paired?: boolean;
  maxTurns?: number;
  /**
   * Només per repartir el torneig entre processos (shards): rang d'índexs de
   * partida `[start, end)` que aquest procés juga. `games` continua sent el
   * total del torneig sencer, i les llavors surten de l'índex absolut, així
   * que els rangs es poden jugar a llocs diferents i fusionar després amb el
   * mateix resultat que un torneig d'una tirada (vegeu `mergeTournamentShards`).
   * Per defecte, tot: `[0, games)`.
   */
  range?: { start: number; end: number };
}

/** El que cal d'una configuració per saber la llavor i el seient d'una partida. */
export type GameSetupConfig = Pick<
  Required<TournamentConfig>,
  'engineA' | 'engineB' | 'baseSeed' | 'paired' | 'maxTurns'
>;

/** Llavor i seient de la partida i-èsima del torneig. */
export function tournamentGameSetup(config: GameSetupConfig, index: number): MatchSetup {
  const seed = config.paired ? config.baseSeed + Math.floor(index / 2) : config.baseSeed + index;
  return {
    engineA: config.engineA,
    engineB: config.engineB,
    seed,
    firstSeat: index % 2 === 0 ? 'A' : 'B',
    maxTurns: config.maxTurns,
  };
}

export interface GameSummary {
  index: number;
  seed: number;
  firstSeat: Seat;
  winner: Seat | null;
  blocked: boolean;
  points: Record<Seat, number>;
  turns: number;
  totals: Record<Seat, SeatTotals>;
  error?: { turn: number; message: string };
}

/** Agregats d'un motor sobre totes les partides del torneig. */
export interface EngineAggregate {
  wins: number;
  /** Percentatge de victòries sobre les partides vàlides (sense errors). */
  winRate: number;
  /** Punts finals per partida, de mitjana (en duel sumen zero entre motors). */
  pointsMean: number;
  moves: number;
  playMoves: number;
  drawMoves: number;
  mistakes: number;
  /** Fitxes baixades per torn propi, de mitjana. */
  tilesPerTurn: number;
  /** Temps de decisió (ms): mitjana, p95 i pitjor cas, per moviment. */
  timeMsMean: number;
  timeMsP95: number;
  timeMsMax: number;
  /** Nodes de cerca: total, mitjana sobre les cerques engegades i màxim. */
  nodesTotal: number;
  nodesMeanPerSearch: number;
  nodesMax: number;
  /** Decisions que han tocat el sostre de cerca. */
  searchLimited: number;
  searchLimitedRate: number;
  /** Jugades sortides de la reordenació completa. */
  rearranges: number;
  rearrangesPerGame: number;
  /** Jeroglífics (jugades amb complexitat ≥ 10). */
  hieroglyphs: number;
  hieroglyphsPerGame: number;
  /** Complexitat mitjana de les jugades de baixar (draw no hi compta). */
  complexityMean: number;
  /** La jugada més complexa del motor a tot el torneig, i on trobar-la. */
  maxHieroglyph: { score: number; turn: number; gameIndex: number; seed: number; firstSeat: Seat };
  maxRelocatedTiles: number;
  maxAlteredMelds: number;
}

export type InterestingKind =
  | 'victoria-a'
  | 'victoria-b'
  | 'mes-llarga'
  | 'mes-nodes'
  | 'mes-jeroglifics'
  | 'jugada-mes-complexa'
  | 'error';

export interface InterestingGame {
  kind: InterestingKind;
  label: string;
  description: string;
  gameIndex: number;
  value: number;
  /** Tot el que cal per tornar a veure exactament aquesta partida. */
  setup: MatchSetup;
}

/** Còpia serialitzable d'un espec (sense `factory`), per a informes i workers. */
export interface EngineSpecSummary {
  id: string;
  name: string;
  version: string;
  strategy: string;
  engineVersion: string;
  description: string;
  color: string;
  role?: 'champion' | 'challenger';
  config: EngineSpec['config'];
  params: ReturnType<typeof resolveEngineParams>;
}

export function engineSpecSummary(spec: EngineSpec): EngineSpecSummary {
  const { factory: _factory, ...rest } = spec;
  return { ...rest, params: resolveEngineParams(spec) };
}

export interface TournamentProgress {
  completed: number;
  total: number;
  winsA: number;
  winsB: number;
  errors: number;
  /** Mil·lisegons de rellotge des de l'inici del torneig. */
  elapsedMs: number;
}

export interface TournamentResult {
  config: Required<TournamentConfig>;
  engineVersion: string;
  engineA: EngineSpecSummary;
  engineB: EngineSpecSummary;
  summaries: GameSummary[];
  winsA: number;
  winsB: number;
  errors: { gameIndex: number; seed: number; firstSeat: Seat; turn: number; message: string }[];
  turnsMean: number;
  aggregates: Record<Seat, EngineAggregate>;
  interesting: InterestingGame[];
  durationMs: number;
}

/*
 * ── Shards: un torneig repartit entre processos ───────────────────────────
 *
 * Cada shard juga un rang d'índexs de partida i en desa els resums (que ja
 * porten tot el que cal per als agregats) més un esbós de les mostres per
 * decisió: amb 100.000 partides n'hi ha milions i no caben en un fitxer, però
 * el p95 de temps i la mitjana de nodes es poden refer a partir de l'esbós.
 */

export const SHARD_SCHEMA = 'remigi-ai-lab-shard/1';

/** Quants punts conserva, com a màxim, l'esbós d'un conjunt de mostres. */
const SKETCH_POINTS = 1001;

/**
 * Resum compacte i fusionable d'un conjunt de mostres numèriques: el nombre,
 * la suma i fins a `SKETCH_POINTS` estadístics d'ordre equidistants (el mínim
 * i el màxim hi són sempre, exactes). Si hi caben totes, no es perd res.
 */
export interface SampleSummary {
  count: number;
  sum: number;
  points: number[];
}

export function summarizeSamples(values: readonly number[]): SampleSummary {
  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;
  const points =
    n <= SKETCH_POINTS
      ? sorted
      : Array.from(
          { length: SKETCH_POINTS },
          (_, i) => sorted[Math.round((i * (n - 1)) / (SKETCH_POINTS - 1))],
        );
  return { count: n, sum: sum(sorted), points };
}

/**
 * Percentil ponderat sobre diversos esbossos (mateixa regla que `p95`: la
 * primera mostra amb més del 95% acumulat; exacte si cap esbós no s'ha
 * retallat, i amb un error de l'ordre de 1/1001 en cas contrari).
 */
export function mergedPercentile(summaries: readonly SampleSummary[], quantile = 0.95): number {
  const weighted = summaries.flatMap((summary) =>
    summary.points.map((value) => ({ value, weight: summary.count / summary.points.length })),
  );
  if (weighted.length === 0) return 0;
  weighted.sort((a, b) => a.value - b.value);
  const total = sum(summaries.map((summary) => summary.count));
  let cumulative = 0;
  for (const item of weighted) {
    cumulative += item.weight;
    if (cumulative > total * quantile + 1e-9) return item.value;
  }
  return weighted[weighted.length - 1].value;
}

/** El que desa un procés que ha jugat només un rang de partides del torneig. */
export interface TournamentShard {
  schema: typeof SHARD_SCHEMA;
  config: Required<TournamentConfig>;
  engineVersion: string;
  engineA: EngineSpecSummary;
  engineB: EngineSpecSummary;
  summaries: GameSummary[];
  samples: Record<Seat, { time: SampleSummary; nodes: SampleSummary }>;
  durationMs: number;
}

/**
 * Rang de partides del shard `shardIndex` (0-based) de `shardCount`. Amb
 * llavors aparellades el repartiment és per **parells** (cada llavor es juga
 * als dos seients dins del mateix shard); els shards en surten el més iguals
 * possible. Falla si hi ha més shards que unitats de feina.
 */
export function shardRange(
  games: number,
  paired: boolean,
  shardIndex: number,
  shardCount: number,
): { start: number; end: number } {
  const unit = paired ? 2 : 1;
  const units = Math.ceil(games / unit);
  if (!Number.isInteger(shardCount) || shardCount < 1 || shardCount > units) {
    throw new Error(
      `No es poden fer ${shardCount} shards d'un torneig de ${games} partides${paired ? ' aparellades' : ''} (màxim ${units}).`,
    );
  }
  if (!Number.isInteger(shardIndex) || shardIndex < 0 || shardIndex >= shardCount) {
    throw new Error(`El shard ${shardIndex + 1} no existeix (n'hi ha ${shardCount}).`);
  }
  const from = Math.floor((shardIndex * units) / shardCount);
  const to = Math.floor(((shardIndex + 1) * units) / shardCount);
  return { start: from * unit, end: Math.min(games, to * unit) };
}

/**
 * Fusiona shards d'un mateix torneig en el resultat que hauria donat jugar-lo
 * d'una tirada: mateixes victòries, mateixos agregats i mateixes partides
 * interessants (només difereixen els temps de rellotge). Comprova que tots els
 * shards són del mateix torneig, del mateix motor i que cobreixen totes les
 * partides exactament una vegada; si no, falla amb el motiu.
 *
 * El p95 de temps es refà de l'esbós (vegeu `mergedPercentile`); la durada és
 * la suma del càlcul de tots els shards, no el temps de rellotge.
 */
export function mergeTournamentShards(shards: readonly TournamentShard[]): TournamentResult {
  if (shards.length === 0) throw new Error('No hi ha cap shard per fusionar.');
  const [first] = shards;
  const identity = (shard: TournamentShard) =>
    JSON.stringify({
      engineA: shard.config.engineA,
      engineB: shard.config.engineB,
      games: shard.config.games,
      baseSeed: shard.config.baseSeed,
      paired: shard.config.paired,
      maxTurns: shard.config.maxTurns,
      engineVersion: shard.engineVersion,
      specA: shard.engineA,
      specB: shard.engineB,
    });
  const expected = identity(first);
  for (const shard of shards) {
    if (shard.schema !== SHARD_SCHEMA) {
      throw new Error(`Esquema de shard desconegut: ${String(shard.schema)}.`);
    }
    if (identity(shard) !== expected) {
      throw new Error(
        'Els shards no són del mateix torneig (motors, partides, llavor base, aparellament, versió del motor o configuració difereixen).',
      );
    }
  }

  // El catàleg d'ara ha de ser el que va fer jugar els shards: si algú l'ha
  // tocat entre mig (o es fusiona amb un altre commit), la mesura no val.
  const specA = engineSpecById(first.config.engineA);
  const specB = engineSpecById(first.config.engineB);
  if (
    JSON.stringify(engineSpecSummary(specA)) !== JSON.stringify(first.engineA) ||
    JSON.stringify(engineSpecSummary(specB)) !== JSON.stringify(first.engineB)
  ) {
    throw new Error(
      'La definició dels motors al catàleg no coincideix amb la dels shards: s\'ha de fusionar amb el mateix commit que els ha generat.',
    );
  }

  const ordered = [...shards].sort((a, b) => a.config.range.start - b.config.range.start);
  let next = 0;
  for (const shard of ordered) {
    const { start, end } = shard.config.range;
    if (start !== next) {
      throw new Error(
        start > next
          ? `Falten les partides ${next}–${start - 1}: hi ha un shard que no s'ha rebut.`
          : `Les partides ${start}–${Math.min(end, next) - 1} són en més d'un shard.`,
      );
    }
    if (shard.summaries.length !== end - start) {
      throw new Error(`El shard [${start}, ${end}) té ${shard.summaries.length} partides en lloc de ${end - start}.`);
    }
    next = end;
  }
  if (next !== first.config.games) {
    throw new Error(`Falten les partides ${next}–${first.config.games - 1}: hi ha un shard que no s'ha rebut.`);
  }

  const summaries = ordered.flatMap((shard) => shard.summaries);
  const stat = (seat: Seat): SeatSampleStats => {
    const time = ordered.map((shard) => shard.samples[seat].time);
    const nodes = ordered.map((shard) => shard.samples[seat].nodes);
    const nodeCount = sum(nodes.map((n) => n.count));
    return {
      timeP95: mergedPercentile(time),
      timeMax: max(time.map((t) => t.points[t.points.length - 1] ?? 0)),
      nodesMean: nodeCount === 0 ? 0 : sum(nodes.map((n) => n.sum)) / nodeCount,
      nodesMax: max(nodes.map((n) => n.points[n.points.length - 1] ?? 0)),
    };
  };
  const config: Required<TournamentConfig> = {
    ...first.config,
    range: { start: 0, end: first.config.games },
  };
  return assembleResult(
    config,
    specA,
    specB,
    summaries,
    { A: stat('A'), B: stat('B') },
    sum(ordered.map((shard) => shard.durationMs)),
  );
}

const now: () => number =
  typeof performance !== 'undefined' ? () => performance.now() : () => Date.now();

export interface TournamentRun {
  readonly config: Required<TournamentConfig>;
  readonly total: number;
  readonly completed: number;
  readonly done: boolean;
  /** Juga la partida següent; null si el torneig ja és complet. */
  runNext(): GameSummary | null;
  progress(): TournamentProgress;
  /** Resultat amb agregats; només quan el torneig és complet. */
  result(): TournamentResult | null;
  /** Dades fusionables d'aquest rang de partides; només quan és complet. */
  shard(): TournamentShard | null;
}

/** Prepara un torneig; el driver (CLI, worker o test) va cridant `runNext`. */
export function createTournament(configInput: TournamentConfig): TournamentRun {
  const { range: rangeInput, ...rest } = configInput;
  if (!Number.isInteger(configInput.games) || configInput.games < 1) {
    throw new Error(`Un torneig necessita com a mínim 1 partida (se n'han demanat ${configInput.games})`);
  }
  const range = rangeInput ?? { start: 0, end: configInput.games };
  if (
    !Number.isInteger(range.start) ||
    !Number.isInteger(range.end) ||
    range.start < 0 ||
    range.end > configInput.games ||
    range.start >= range.end
  ) {
    throw new Error(
      `El rang de partides [${range.start}, ${range.end}) no és vàlid per a un torneig de ${configInput.games}`,
    );
  }
  const config: Required<TournamentConfig> = {
    paired: true,
    maxTurns: 1000,
    ...rest,
    range,
  };
  const total = range.end - range.start;
  // Valida els ids abans de començar (i llança un error clar si no hi són).
  const specA = engineSpecById(config.engineA);
  const specB = engineSpecById(config.engineB);

  const summaries: GameSummary[] = [];
  // Mostres per decisió (no per partida): d'aquí surten el p95 i els màxims
  // de temps i de nodes. Números pelats: 1.000 partides hi caben de sobres; per
  // a tornejos enormes, el shard en desa un esbós compacte (`SampleSummary`).
  const timeSamples: Record<Seat, number[]> = { A: [], B: [] };
  const nodeSamples: Record<Seat, number[]> = { A: [], B: [] };
  const startedAt = now();

  const runner: TournamentRun = {
    config,
    total,
    get completed() {
      return summaries.length;
    },
    get done() {
      return summaries.length >= total;
    },

    runNext() {
      if (this.done) return null;
      const index = range.start + summaries.length;
      const setup = tournamentGameSetup(config, index);
      const match = createMatch(setup);
      while (!match.done) match.step();
      const result = match.result()!;

      // Les mostres per decisió es cullen abans de deixar anar la partida;
      // el registre torn a torn no es guarda (memòria continguda).
      for (const turn of match.turns) {
        timeSamples[turn.seat].push(turn.thinkingTimeMs);
        if (turn.nodes > 0) nodeSamples[turn.seat].push(turn.nodes);
      }

      const summary: GameSummary = {
        index,
        seed: setup.seed,
        firstSeat: setup.firstSeat!,
        winner: result.winner,
        blocked: result.blocked,
        points: result.points,
        turns: result.turns,
        totals: result.totals,
        ...(result.error ? { error: result.error } : {}),
      };
      summaries.push(summary);
      return summary;
    },

    progress() {
      return {
        completed: summaries.length,
        total,
        winsA: summaries.filter((s) => s.winner === 'A').length,
        winsB: summaries.filter((s) => s.winner === 'B').length,
        errors: summaries.filter((s) => s.error).length,
        elapsedMs: now() - startedAt,
      };
    },

    result() {
      if (!this.done) return null;
      const exact = (seat: Seat): SeatSampleStats => ({
        timeP95: p95(timeSamples[seat]),
        timeMax: max([...timeSamples[seat]]),
        nodesMean: mean([...nodeSamples[seat]]),
        nodesMax: max([...nodeSamples[seat]]),
      });
      return assembleResult(config, specA, specB, summaries, { A: exact('A'), B: exact('B') }, now() - startedAt);
    },

    shard() {
      if (!this.done) return null;
      const sketch = (seat: Seat) => ({
        time: summarizeSamples(timeSamples[seat]),
        nodes: summarizeSamples(nodeSamples[seat]),
      });
      return {
        schema: SHARD_SCHEMA,
        config,
        engineVersion: ENGINE_VERSION,
        engineA: engineSpecSummary(specA),
        engineB: engineSpecSummary(specB),
        summaries,
        samples: { A: sketch('A'), B: sketch('B') },
        durationMs: now() - startedAt,
      };
    },
  };

  return runner;
}

/** p95 i màxim de temps, i mitjana i màxim de nodes d'un motor (un seient). */
interface SeatSampleStats {
  timeP95: number;
  timeMax: number;
  nodesMean: number;
  nodesMax: number;
}

/** Del que ha jugat un torneig (o la fusió de diversos shards) al resultat. */
function assembleResult(
  config: Required<TournamentConfig>,
  specA: EngineSpec,
  specB: EngineSpec,
  summaries: GameSummary[],
  stats: Record<Seat, SeatSampleStats>,
  durationMs: number,
): TournamentResult {
  const valid = summaries.filter((s) => !s.error);
  const winsA = summaries.filter((s) => s.winner === 'A').length;
  const winsB = summaries.filter((s) => s.winner === 'B').length;
  return {
    config,
    engineVersion: ENGINE_VERSION,
    engineA: engineSpecSummary(specA),
    engineB: engineSpecSummary(specB),
    summaries,
    winsA,
    winsB,
    errors: summaries
      .filter((s) => s.error)
      .map((s) => ({
        gameIndex: s.index,
        seed: s.seed,
        firstSeat: s.firstSeat,
        turn: s.error!.turn,
        message: s.error!.message,
      })),
    turnsMean: mean(valid.map((s) => s.turns)),
    aggregates: {
      A: aggregateSeat('A', valid, winsA, stats.A),
      B: aggregateSeat('B', valid, winsB, stats.B),
    },
    interesting: interestingGames(config, summaries),
    durationMs,
  };
}

function aggregateSeat(
  seat: Seat,
  valid: GameSummary[],
  wins: number,
  sampled: SeatSampleStats,
): EngineAggregate {
  const totals = valid.map((s) => s.totals[seat]);
  const moves = sum(totals.map((t) => t.moves));
  const playMoves = sum(totals.map((t) => t.playMoves));
  const games = valid.length;

  let maxHiero: EngineAggregate['maxHieroglyph'] = {
    score: 0,
    turn: 0,
    gameIndex: -1,
    seed: 0,
    firstSeat: 'A',
  };
  for (const summary of valid) {
    const candidate = summary.totals[seat].maxHieroglyph;
    if (candidate.score > maxHiero.score) {
      maxHiero = {
        score: candidate.score,
        turn: candidate.turn,
        gameIndex: summary.index,
        seed: summary.seed,
        firstSeat: summary.firstSeat,
      };
    }
  }

  const searchLimited = sum(totals.map((t) => t.searchLimited));
  const rearranges = sum(totals.map((t) => t.rearranges));
  const hieroglyphs = sum(totals.map((t) => t.hieroglyphs));
  return {
    wins,
    winRate: games === 0 ? 0 : wins / games,
    pointsMean: mean(valid.map((s) => s.points[seat])),
    moves,
    playMoves,
    drawMoves: sum(totals.map((t) => t.drawMoves)),
    mistakes: sum(totals.map((t) => t.mistakes)),
    tilesPerTurn: moves === 0 ? 0 : sum(totals.map((t) => t.tilesPlayed)) / moves,
    timeMsMean: moves === 0 ? 0 : sum(totals.map((t) => t.thinkingTimeMs)) / moves,
    timeMsP95: sampled.timeP95,
    timeMsMax: sampled.timeMax,
    nodesTotal: sum(totals.map((t) => t.nodes)),
    nodesMeanPerSearch: sampled.nodesMean,
    nodesMax: sampled.nodesMax,
    searchLimited,
    searchLimitedRate: moves === 0 ? 0 : searchLimited / moves,
    rearranges,
    rearrangesPerGame: games === 0 ? 0 : rearranges / games,
    hieroglyphs,
    hieroglyphsPerGame: games === 0 ? 0 : hieroglyphs / games,
    complexityMean:
      playMoves === 0 ? 0 : sum(totals.map((t) => t.hieroglyphScoreTotal)) / playMoves,
    maxHieroglyph: maxHiero,
    maxRelocatedTiles: max(totals.map((t) => t.maxRelocatedTiles)),
    maxAlteredMelds: max(totals.map((t) => t.maxAlteredMelds)),
  };
}

/** La partida amb el valor màxim, o null si cap no puntua per sobre de zero. */
function pickBest(
  summaries: GameSummary[],
  value: (summary: GameSummary) => number,
): { summary: GameSummary; value: number } | null {
  let best: { summary: GameSummary; value: number } | null = null;
  for (const summary of summaries) {
    if (summary.error) continue;
    const candidate = value(summary);
    if (candidate > 0 && (!best || candidate > best.value)) {
      best = { summary, value: candidate };
    }
  }
  return best;
}

function interestingGames(
  config: Required<TournamentConfig>,
  summaries: GameSummary[],
): InterestingGame[] {
  const games: InterestingGame[] = [];
  const setupOf = (summary: GameSummary): MatchSetup => ({
    engineA: config.engineA,
    engineB: config.engineB,
    seed: summary.seed,
    firstSeat: summary.firstSeat,
    maxTurns: config.maxTurns,
  });
  const push = (
    kind: InterestingKind,
    label: string,
    found: { summary: GameSummary; value: number } | null,
    description: (value: number, summary: GameSummary) => string,
  ) => {
    if (!found) return;
    games.push({
      kind,
      label,
      description: description(found.value, found.summary),
      gameIndex: found.summary.index,
      value: found.value,
      setup: setupOf(found.summary),
    });
  };

  push(
    'victoria-a',
    'Victòria més contundent d’A',
    pickBest(summaries, (s) => (s.winner === 'A' ? s.points.A : 0)),
    (value) => `El motor A guanya per ${value} punts.`,
  );
  push(
    'victoria-b',
    'Victòria més contundent de B',
    pickBest(summaries, (s) => (s.winner === 'B' ? s.points.B : 0)),
    (value) => `El motor B guanya per ${value} punts.`,
  );
  push(
    'mes-llarga',
    'Partida més llarga',
    pickBest(summaries, (s) => s.turns),
    (value) => `${value} torns.`,
  );
  push(
    'mes-nodes',
    'Partida amb més nodes de cerca',
    pickBest(summaries, (s) => s.totals.A.nodes + s.totals.B.nodes),
    (value) => `${value} nodes explorats entre tots dos motors.`,
  );
  push(
    'mes-jeroglifics',
    'Partida amb més jeroglífics',
    pickBest(summaries, (s) => s.totals.A.hieroglyphs + s.totals.B.hieroglyphs),
    (value) => `${value} jugades amb complexitat ≥ 10.`,
  );
  push(
    'jugada-mes-complexa',
    'Jugada individual més complexa',
    pickBest(summaries, (s) =>
      Math.max(s.totals.A.maxHieroglyph.score, s.totals.B.maxHieroglyph.score),
    ),
    (value, summary) => {
      const seat =
        summary.totals.A.maxHieroglyph.score >= summary.totals.B.maxHieroglyph.score ? 'A' : 'B';
      const turn = summary.totals[seat].maxHieroglyph.turn;
      return `Complexitat ${value} (motor ${seat}, torn ${turn}).`;
    },
  );

  const firstError = summaries.find((s) => s.error);
  if (firstError) {
    games.push({
      kind: 'error',
      label: 'Partida amb error',
      description: `Al torn ${firstError.error!.turn}: ${firstError.error!.message}`,
      gameIndex: firstError.index,
      value: 1,
      setup: setupOf(firstError),
    });
  }
  return games;
}

/**
 * Juga el torneig sencer, d'una tirada. `onProgress` es crida després de cada
 * partida (per pintar barres de progrés des del CLI o un worker).
 */
export function runTournament(
  config: TournamentConfig,
  onProgress?: (progress: TournamentProgress) => void,
): TournamentResult {
  const run = createTournament(config);
  while (!run.done) {
    run.runNext();
    onProgress?.(run.progress());
  }
  return run.result()!;
}
