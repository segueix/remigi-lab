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
}

/** Llavor i seient de la partida i-èsima del torneig. */
export function tournamentGameSetup(
  config: Required<TournamentConfig>,
  index: number,
): MatchSetup {
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
}

/** Prepara un torneig; el driver (CLI, worker o test) va cridant `runNext`. */
export function createTournament(configInput: TournamentConfig): TournamentRun {
  const config: Required<TournamentConfig> = {
    paired: true,
    maxTurns: 1000,
    ...configInput,
  };
  if (!Number.isInteger(config.games) || config.games < 1) {
    throw new Error(`Un torneig necessita com a mínim 1 partida (se n'han demanat ${config.games})`);
  }
  // Valida els ids abans de començar (i llança un error clar si no hi són).
  const specA = engineSpecById(config.engineA);
  const specB = engineSpecById(config.engineB);

  const summaries: GameSummary[] = [];
  // Mostres per decisió (no per partida): d'aquí surten el p95 i els màxims
  // de temps i de nodes. Números pelats: 1.000 partides hi caben de sobres.
  const timeSamples: Record<Seat, number[]> = { A: [], B: [] };
  const nodeSamples: Record<Seat, number[]> = { A: [], B: [] };
  const startedAt = now();

  const runner: TournamentRun = {
    config,
    total: config.games,
    get completed() {
      return summaries.length;
    },
    get done() {
      return summaries.length >= config.games;
    },

    runNext() {
      if (this.done) return null;
      const index = summaries.length;
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
        total: config.games,
        winsA: summaries.filter((s) => s.winner === 'A').length,
        winsB: summaries.filter((s) => s.winner === 'B').length,
        errors: summaries.filter((s) => s.error).length,
        elapsedMs: now() - startedAt,
      };
    },

    result() {
      if (!this.done) return null;
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
          A: aggregateSeat('A', valid, winsA, timeSamples.A, nodeSamples.A),
          B: aggregateSeat('B', valid, winsB, timeSamples.B, nodeSamples.B),
        },
        interesting: interestingGames(config, summaries),
        durationMs: now() - startedAt,
      };
    },
  };

  return runner;
}

function aggregateSeat(
  seat: Seat,
  valid: GameSummary[],
  wins: number,
  timeSamples: readonly number[],
  nodeSamples: readonly number[],
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
    timeMsP95: p95(timeSamples),
    timeMsMax: max([...timeSamples]),
    nodesTotal: sum(totals.map((t) => t.nodes)),
    nodesMeanPerSearch: mean([...nodeSamples]),
    nodesMax: max([...nodeSamples]),
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
