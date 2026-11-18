import { tilePoints } from '../core/scoring';
import { createEngine, type GameState, type Meld, type Move } from '../engine';
import { engineSpecById, resolveEngineParams } from './catalog';
import { createMatch } from './match';
import { round } from './stats';

/**
 * La sonda del desempat: **quantes vegades una variant canvia de debò la
 * jugada?**
 *
 * Un torneig diu si una variant guanya més; no diu si arriba a fer res. Una
 * regla excel·lent que s'activa en el 2% dels moviments no pot moure el
 * marcador, i el torneig sol no distingeix «hipòtesi falsa» de «hipòtesi
 * massa estreta». Això és el que mesura aquesta sonda.
 *
 * Com: es juga la partida amb la variant i, a cada moviment seu, es demana **a
 * banda** al motor de referència què hauria jugat en aquella mateixa posició.
 * Si les dues taules resultants difereixen, la variant ha canviat la jugada.
 *
 * La comparació es fa **després** que la decisió estigui presa i amb un motor
 * a part, així que no altera la partida (com la resta de telemetria del
 * laboratori). Costa el doble de càlcul, i per això viu aquí i no dins del
 * motor: mesurar-ho a cada decisió de cada torneig distorsionaria justament
 * els temps que el torneig mesura.
 */

export interface TieBreakProbeResult {
  /** Motor amb la variant (el que s'examina). */
  variant: string;
  /** Motor de referència amb què es compara cada decisió. */
  reference: string;
  games: number;
  /** Moviments de la variant examinats. */
  moves: number;
  /** D'aquests, els que baixen fitxes (robar no depèn mai del desempat). */
  playMoves: number;
  /** Moviments on la jugada de la variant difereix de la de la referència. */
  changed: number;
  /** Percentatge de moviments canviats sobre el total de moviments. */
  changedRate: number;
  /** Percentatge de canvis sobre les jugades de baixar fitxes. */
  changedPlayRate: number;
  /** Punts pendents que la variant ha tret de més, sumant tots els canvis. */
  extraPointsShed: number;
  /** Punts de més per jugada canviada (0 si no n'hi ha cap). */
  extraPointsPerChange: number;
  /**
   * Diferència total de fitxes baixades. Invariant del desempat per punts:
   * ha de ser **0** — mai no fa jugar ni una fitxa més ni una menys.
   */
  tilesDelta: number;
}

/** Identitat d'una taula, independent de l'ordre de les jugades. */
function boardKey(board: Meld[]): string {
  return board
    .map((meld) => meld.map((tile) => tile.id).sort().join(','))
    .sort()
    .join('|');
}

/** Punts pendents que una proposta es treu de la mà. */
function shedPoints(before: Meld[], proposal: Meld[]): number {
  const old = new Set(before.flat().map((tile) => tile.id));
  let points = 0;
  for (const meld of proposal) {
    for (const tile of meld) if (!old.has(tile.id)) points += tilePoints(tile);
  }
  return points;
}

function playedTiles(before: GameState, move: Move): number {
  if (move.type !== 'play') return 0;
  const old = new Set(before.board.flat().map((tile) => tile.id));
  return move.board.flat().filter((tile) => !old.has(tile.id)).length;
}

export interface TieBreakProbeConfig {
  /** Motor amb la variant a examinar (seu al costat A). */
  variant: string;
  /** Motor de referència (seu al costat B i fa d'ombra). */
  reference: string;
  games: number;
  baseSeed: number;
}

/**
 * Juga `games` partides variant contra referència (amb el mateix calendari de
 * llavors aparellades del torneig) i mesura, moviment a moviment del costat
 * de la variant, si la jugada triada difereix de la de la referència.
 */
export function probeTieBreak(config: TieBreakProbeConfig): TieBreakProbeResult {
  const variantSpec = engineSpecById(config.variant);
  const referenceSpec = engineSpecById(config.reference);
  const referenceNodes = resolveEngineParams(referenceSpec).maxNodes ?? undefined;

  /*
   * El motor ombra és a part expressament: `play` consumeix RNG per a l'error
   * humà simulat, i cridar-lo sobre el motor de la partida en desincronitzaria
   * la seqüència. Als nivells sense errades (l'expert) el RNG no toca cap
   * decisió, així que l'ombra amb llavor pròpia dona exactament la jugada que
   * hauria fet la referència.
   */
  const shadow = createEngine({ seed: 1 });

  const result: TieBreakProbeResult = {
    variant: config.variant,
    reference: config.reference,
    games: config.games,
    moves: 0,
    playMoves: 0,
    changed: 0,
    changedRate: 0,
    changedPlayRate: 0,
    extraPointsShed: 0,
    extraPointsPerChange: 0,
    tilesDelta: 0,
  };

  for (let index = 0; index < config.games; index++) {
    const run = createMatch({
      engineA: config.variant,
      engineB: config.reference,
      seed: config.baseSeed + Math.floor(index / 2),
      firstSeat: index % 2 === 0 ? 'A' : 'B',
      keepBoards: true,
    });

    while (!run.done) {
      // L'estat d'abans del moviment: és el que veurà també l'ombra.
      const before = run.state;
      const playerIndex = before.currentPlayer;
      const seat = run.seatOf[playerIndex];
      const turn = run.step();
      if (!turn || seat !== 'A') continue;

      const shadowMove = shadow.play(before, {
        playerIndex,
        level: referenceSpec.config.level,
        overrides: referenceSpec.config.overrides,
        maxNodes: referenceNodes,
      }).move;

      result.moves++;
      if (turn.moveType === 'play') result.playMoves++;

      const variantKey = turn.moveType === 'play' ? boardKey(turn.boardAfter!) : 'draw';
      const shadowKey = shadowMove.type === 'play' ? boardKey(shadowMove.board) : 'draw';
      if (variantKey === shadowKey) continue;

      result.changed++;
      if (turn.moveType === 'play' && shadowMove.type === 'play') {
        result.extraPointsShed +=
          shedPoints(before.board, turn.boardAfter!) - shedPoints(before.board, shadowMove.board);
      }
      result.tilesDelta += turn.tilesPlayed - playedTiles(before, shadowMove);
    }
  }

  result.changedRate = result.moves === 0 ? 0 : result.changed / result.moves;
  result.changedPlayRate = result.playMoves === 0 ? 0 : result.changed / result.playMoves;
  result.extraPointsPerChange =
    result.changed === 0 ? 0 : result.extraPointsShed / result.changed;
  return result;
}

/** La sonda en text, per al CLI. */
export function describeProbe(probe: TieBreakProbeResult): string {
  const percent = (value: number) => `${round(100 * value, 1)}%`;
  const lines = [
    `Sonda del desempat: ${probe.variant} contra ${probe.reference} · ${probe.games} partides`,
    '',
    `  moviments de la variant:      ${probe.moves}`,
    `  dels quals, jugades:          ${probe.playMoves}`,
    `  jugades CANVIADES:            ${probe.changed} (${percent(probe.changedRate)} dels moviments · ${percent(probe.changedPlayRate)} de les jugades)`,
    `  punts pendents trets de més:  ${probe.extraPointsShed} (${round(probe.extraPointsPerChange, 1)} per canvi)`,
    `  diferència de fitxes jugades: ${probe.tilesDelta} (ha de ser 0)`,
  ];
  if (probe.tilesDelta !== 0) {
    lines.push('', '  ⚠️ La variant canvia el NOMBRE de fitxes jugades: ja no és un desempat.');
  }
  return lines.join('\n');
}
