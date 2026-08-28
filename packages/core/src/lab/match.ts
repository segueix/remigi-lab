import {
  TOTAL_TILES,
  applyMove,
  createGame,
  finalScores,
  type GameState,
  type Meld,
  type Tile,
} from '../engine';
import { rackPoints } from '../core/scoring';
import { engineSpecById, instantiateEngine, type EngineSpec } from './catalog';
import { emptyHieroglyph, hieroglyphForMove, type HieroglyphBreakdown } from './hieroglyph';

/**
 * Una partida del laboratori: Motor A contra Motor B, jugada pas a pas o de
 * cop, amb el diagnòstic i el jeroglífic de cada torn registrats.
 *
 * Tot el que cal per reproduir-la exactament és el `MatchSetup`: els ids dels
 * dos motors, la llavor i qui seu primer. Les llavors dels RNG dels motors es
 * deriven de la llavor de la partida (una per seient), així que no s'han de
 * desar a part. La interfície, el simulador i els tests fan anar **aquest
 * mateix runner**: no hi ha dues maneres de jugar una partida.
 */

export type Seat = 'A' | 'B';

export interface MatchSetup {
  /** Id del motor del costat A (vegeu el catàleg). */
  engineA: string;
  /** Id del motor del costat B. */
  engineB: string;
  /** Llavor del repartiment: mateixa llavor, mateixes fitxes per a tothom. */
  seed: number;
  /** Qui seu al primer seient (i per tant comença). */
  firstSeat?: Seat;
  /** Tall de seguretat de torns (una partida normal en fa ~40–120). */
  maxTurns?: number;
  /**
   * Desa la taula resultant de cada torn (per inspeccionar-los a la
   * interfície). En torneigs es deixa apagat per no acumular memòria.
   */
  keepBoards?: boolean;
}

const DEFAULT_MAX_TURNS = 1000;

/**
 * Llavor del RNG del motor d'un seient, derivada de la de la partida: així el
 * `MatchSetup` és tot el que cal per reproduir-la, i cada seient té la seva
 * seqüència pròpia (les mètriques i els errors simulats d'un costat no toquen
 * mai el RNG de l'altre).
 */
export function seatEngineSeed(seed: number, seatIndex: 0 | 1): number {
  return seed * 2 + seatIndex + 1;
}

/** Registre d'un torn del laboratori. */
export interface LabTurn {
  /** Número de torn (el de l'estat quan s'ha decidit el moviment). */
  turn: number;
  seat: Seat;
  engineId: string;
  moveType: 'play' | 'draw';
  /** El «robar» ha estat passar (sac buit). */
  wasPass: boolean;
  /** El cercador tenia jugada i tot i això ha robat: errada simulada del nivell. */
  mistake: boolean;
  tilesPlayed: number;
  thinkingTimeMs: number;
  nodes: number;
  searchLimited: boolean;
  rearrangeUsed: boolean;
  /** Desglossament de complexitat del moviment (vegeu lab/hieroglyph.ts). */
  hieroglyph: HieroglyphBreakdown;
  /** Fitxes que queden a cada mà i al sac després del moviment. */
  rackA: number;
  rackB: number;
  bag: number;
  /** La taula després del moviment; només si `keepBoards`. */
  boardAfter?: Meld[];
  /** Les mans després del moviment; només si `keepBoards` (inspecció visual). */
  racksAfter?: Record<Seat, Tile[]>;
}

/** Totals d'un costat en una partida. */
export interface SeatTotals {
  moves: number;
  playMoves: number;
  drawMoves: number;
  mistakes: number;
  tilesPlayed: number;
  thinkingTimeMs: number;
  nodes: number;
  searchLimited: number;
  rearranges: number;
  hieroglyphs: number;
  hieroglyphScoreTotal: number;
  /** La jugada més complexa del costat (0 si no ha jugat cap). */
  maxHieroglyph: { score: number; turn: number };
  maxRelocatedTiles: number;
  maxAlteredMelds: number;
}

export interface MatchResult {
  setup: Required<MatchSetup>;
  engineA: string;
  engineB: string;
  /**
   * Guanyador (les partides bloquejades també en tenen: menys punts pendents).
   * Només és null si la partida ha petat (`error`).
   */
  winner: Seat | null;
  /** La partida ha acabat bloquejada (ningú no s'ha quedat sense fitxes). */
  blocked: boolean;
  /** Punts finals de cada costat (sumen zero). */
  points: Record<Seat, number>;
  turns: number;
  totals: Record<Seat, SeatTotals>;
  /** Si la partida ha petat, què i quan (i el resultat queda invalidat). */
  error?: { turn: number; message: string };
}

function emptyTotals(): SeatTotals {
  return {
    moves: 0,
    playMoves: 0,
    drawMoves: 0,
    mistakes: 0,
    tilesPlayed: 0,
    thinkingTimeMs: 0,
    nodes: 0,
    searchLimited: 0,
    rearranges: 0,
    hieroglyphs: 0,
    hieroglyphScoreTotal: 0,
    maxHieroglyph: { score: 0, turn: 0 },
    maxRelocatedTiles: 0,
    maxAlteredMelds: 0,
  };
}

function countTiles(state: GameState): number {
  return (
    state.bag.length +
    state.board.reduce((sum, meld) => sum + meld.length, 0) +
    state.players.reduce((sum, player) => sum + player.rack.length, 0)
  );
}

/** Una partida en marxa: estat viu, registres i el pas següent. */
export interface MatchRun {
  readonly setup: Required<MatchSetup>;
  /** Espec de cada seient (posició 0 comença). */
  readonly seats: [EngineSpec, EngineSpec];
  /** Seient (A/B) de cada posició. */
  readonly seatOf: [Seat, Seat];
  readonly state: GameState;
  readonly turns: readonly LabTurn[];
  readonly done: boolean;
  /** Juga el moviment següent; null si la partida ja ha acabat. */
  step(): LabTurn | null;
  /** Resultat final; null mentre la partida duri. */
  result(): MatchResult | null;
  /** Punts pendents a la mà de cada costat (marcador provisional). */
  pendingPoints(): Record<Seat, number>;
}

/** Prepara una partida A vs B, a punt de jugar el primer moviment. */
export function createMatch(setupInput: MatchSetup): MatchRun {
  const setup: Required<MatchSetup> = {
    firstSeat: 'A',
    maxTurns: DEFAULT_MAX_TURNS,
    keepBoards: false,
    ...setupInput,
  };
  const specA = engineSpecById(setup.engineA);
  const specB = engineSpecById(setup.engineB);

  // Qui seu primer comença i roba els primers 14 del sac: bescanviar el
  // seient amb la mateixa llavor fa jugar cada motor amb la mà de l'altre.
  const seats: [EngineSpec, EngineSpec] = setup.firstSeat === 'A' ? [specA, specB] : [specB, specA];
  const seatOf: [Seat, Seat] = setup.firstSeat === 'A' ? ['A', 'B'] : ['B', 'A'];

  let state = createGame({
    seed: setup.seed,
    players: seats.map((spec) => ({ name: spec.name, kind: 'ai' as const, aiLevel: spec.config.level })),
  });
  // Un motor per seient, cadascun amb la seva llavor derivada: seqüències de
  // RNG independents, mètriques independents.
  const engines = seats.map((spec, seatIndex) =>
    instantiateEngine(spec, { seed: seatEngineSeed(setup.seed, seatIndex as 0 | 1) }),
  );

  const turns: LabTurn[] = [];
  const totals: Record<Seat, SeatTotals> = { A: emptyTotals(), B: emptyTotals() };
  let error: MatchResult['error'];
  let finished = false;

  const rackOf = (seat: Seat) => state.players[seatOf.indexOf(seat)].rack;

  const run: MatchRun = {
    setup,
    seats,
    seatOf,
    get state() {
      return state;
    },
    get turns() {
      return turns;
    },
    get done() {
      return finished;
    },

    step() {
      if (finished) return null;
      const seatIndex = state.currentPlayer as 0 | 1;
      const seat = seatOf[seatIndex];
      const spec = seats[seatIndex];
      const turnNumber = state.turn;

      try {
        const decision = engines[seatIndex].play(state, {
          playerIndex: seatIndex,
          level: spec.config.level,
          overrides: spec.config.overrides,
          maxNodes: spec.config.maxNodes,
        });
        // El jeroglífic es calcula fora del motor, un cop la decisió ja està
        // presa: la telemetria no pot influir en cap jugada.
        const hieroglyph =
          decision.move.type === 'play' ? hieroglyphForMove(state, decision.move) : emptyHieroglyph();
        const wasPass = decision.move.type === 'draw' && state.bag.length === 0;
        state = applyMove(state, decision.move);

        if (countTiles(state) !== TOTAL_TILES) {
          throw new Error(`s'ha trencat la conservació de les ${TOTAL_TILES} fitxes`);
        }

        const record: LabTurn = {
          turn: turnNumber,
          seat,
          engineId: spec.id,
          moveType: decision.move.type,
          wasPass,
          mistake: decision.move.type === 'draw' && decision.foundPlay,
          tilesPlayed: decision.tilesPlayed,
          thinkingTimeMs: decision.thinkingTimeMs,
          nodes: decision.nodes,
          searchLimited: decision.searchLimited,
          rearrangeUsed: decision.rearrangeUsed,
          hieroglyph,
          rackA: rackOf('A').length,
          rackB: rackOf('B').length,
          bag: state.bag.length,
          ...(setup.keepBoards
            ? { boardAfter: state.board, racksAfter: { A: rackOf('A'), B: rackOf('B') } }
            : {}),
        };
        turns.push(record);

        const seatTotals = totals[seat];
        seatTotals.moves++;
        if (record.moveType === 'play') seatTotals.playMoves++;
        else seatTotals.drawMoves++;
        if (record.mistake) seatTotals.mistakes++;
        seatTotals.tilesPlayed += record.tilesPlayed;
        seatTotals.thinkingTimeMs += record.thinkingTimeMs;
        seatTotals.nodes += record.nodes;
        if (record.searchLimited) seatTotals.searchLimited++;
        if (record.rearrangeUsed) seatTotals.rearranges++;
        if (record.hieroglyph.isHieroglyph) seatTotals.hieroglyphs++;
        seatTotals.hieroglyphScoreTotal += record.hieroglyph.score;
        if (record.hieroglyph.score > seatTotals.maxHieroglyph.score) {
          seatTotals.maxHieroglyph = { score: record.hieroglyph.score, turn: turnNumber };
        }
        seatTotals.maxRelocatedTiles = Math.max(
          seatTotals.maxRelocatedTiles,
          record.hieroglyph.relocatedTiles,
        );
        seatTotals.maxAlteredMelds = Math.max(
          seatTotals.maxAlteredMelds,
          record.hieroglyph.alteredMelds,
        );

        if (state.status === 'finished') finished = true;
        if (!finished && state.turn > setup.maxTurns) {
          throw new Error(`la partida no ha acabat en ${setup.maxTurns} torns`);
        }
        return record;
      } catch (caught) {
        error = { turn: turnNumber, message: caught instanceof Error ? caught.message : String(caught) };
        finished = true;
        return null;
      }
    },

    result() {
      if (!finished) return null;
      if (error) {
        return {
          setup,
          engineA: setup.engineA,
          engineB: setup.engineB,
          winner: null,
          blocked: false,
          points: { A: 0, B: 0 },
          turns: state.turn,
          totals,
          error,
        };
      }
      const scores = finalScores(state);
      const winnerIndex = state.players.findIndex((player) => player.id === state.winnerId);
      const blocked = state.players.every((player) => player.rack.length > 0);
      return {
        setup,
        engineA: setup.engineA,
        engineB: setup.engineB,
        winner: seatOf[winnerIndex],
        blocked,
        points: {
          [seatOf[0]]: scores[0].points,
          [seatOf[1]]: scores[1].points,
        } as Record<Seat, number>,
        turns: state.turn,
        totals,
      };
    },

    pendingPoints() {
      return { A: rackPoints(rackOf('A')), B: rackPoints(rackOf('B')) };
    },
  };

  return run;
}

/** Juga una partida sencera i en retorna el resultat. */
export function playMatch(setup: MatchSetup): MatchResult {
  const run = createMatch(setup);
  while (!run.done) run.step();
  return run.result()!;
}
