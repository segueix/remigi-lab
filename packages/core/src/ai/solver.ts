import { COLORS, INITIAL_MELD_POINTS, MAX_GROUP_SIZE, MAX_VALUE, MIN_MELD_SIZE, MIN_VALUE } from '../core/constants';
import { analyzeMeld } from '../core/melds';
import { tilePoints } from '../core/scoring';
import { bestRearrangement } from './rearrange';
import { isJoker, isNumberTile } from '../core/tiles';
import type { GameState, Meld, NumberTile, Tile, TileColor } from '../core/types';

/**
 * Cercador de jugades.
 *
 * Té dues marxes. La de sempre és una heurística voraç: baixa les jugades que
 * pot fer amb la mà i allarga les que ja hi ha a la taula. La segona, només per
 * al nivell expert, crida `bestRearrangement`, que reparteix de nou la taula
 * sencera per encabir-hi tantes fitxes com pugui.
 */

export interface SolverOptions {
  /** Si pot fer servir els jokers de la mà. */
  allowJokers: boolean;
  /** Si pot allargar jugades que ja són a la taula. */
  allowExtensions: boolean;
  /** Si pot repartir de nou la taula sencera (cerca completa). */
  allowRearrange?: boolean;
  /** Sostre de nodes de la cerca de reordenació. */
  maxNodes?: number;
  /**
   * Desempat per punts (vegeu ai/difficulty.ts): a igualtat de fitxes
   * jugades, prefereix la proposta que es desfà de més punts. No fa jugar mai
   * ni una fitxa més ni una menys: només tria entre empats.
   */
  preferPointsTieBreak?: boolean;
  /** Sortida de diagnòstic per al motor: no canvia cap decisió. */
  stats?: SearchStats;
}

/** Diagnòstic de la cerca, per a les mètriques del motor. */
export interface SearchStats {
  /** Nodes explorats per la cerca de reordenació (0 si no s'ha engegat). */
  nodes: number;
  /** La cerca de reordenació ha tocat el sostre de nodes i s'ha abandonat. */
  searchLimited: boolean;
  /** La proposta final ve de la reordenació completa, no de l'heurística voraç. */
  rearrangeUsed: boolean;
}

export interface PlayCandidate {
  /** Proposta completa de taula nova (el format del moviment 'play'). */
  board: Meld[];
  /** Quantes fitxes de la mà fa servir. */
  tilesUsed: number;
  /** Punts de les jugades noves baixades de la mà (criteri de la sortida inicial). */
  points: number;
}

interface MeldCandidate {
  meld: Meld;
  points: number;
}

/** Enumera jugades completes (grups i escales) que es poden fer només amb la mà. */
export function findRackMelds(rack: Tile[], allowJokers: boolean): MeldCandidate[] {
  const jokers = allowJokers ? rack.filter(isJoker) : [];
  const numbers = rack.filter(isNumberTile);
  const candidates: MeldCandidate[] = [];

  // Grups: per a cada número, una fitxa de cada color disponible + jokers.
  for (let value = MIN_VALUE; value <= MAX_VALUE; value++) {
    const byColor = new Map<TileColor, NumberTile>();
    for (const tile of numbers) {
      if (tile.value === value && !byColor.has(tile.color)) byColor.set(tile.color, tile);
    }
    for (const colorSubset of subsets([...byColor.values()])) {
      if (colorSubset.length === 0) continue;
      for (let jokerCount = 0; jokerCount <= jokers.length; jokerCount++) {
        const size = colorSubset.length + jokerCount;
        if (size < MIN_MELD_SIZE || size > MAX_GROUP_SIZE) continue;
        pushCandidate(candidates, [...colorSubset, ...jokers.slice(0, jokerCount)]);
      }
    }
  }

  // Escales: per a cada color, totes les finestres de valors consecutius que es
  // puguin completar amb els jokers disponibles. Els jokers poden anar tant a
  // dins com als extrems: [J,6,7] és tan vàlida com [5,J,7].
  for (const color of COLORS) {
    const byValue = new Map<number, NumberTile>();
    for (const tile of numbers) {
      if (tile.color === color && !byValue.has(tile.value)) byValue.set(tile.value, tile);
    }
    for (let start = MIN_VALUE; start <= MAX_VALUE - MIN_MELD_SIZE + 1; start++) {
      for (let end = start + MIN_MELD_SIZE - 1; end <= MAX_VALUE; end++) {
        const meld: Meld = [];
        let jokersUsed = 0;
        let realTiles = 0;
        for (let value = start; value <= end; value++) {
          const tile = byValue.get(value);
          if (tile) {
            meld.push(tile);
            realTiles++;
          } else if (jokersUsed < jokers.length) {
            meld.push(jokers[jokersUsed++]);
          } else {
            break;
          }
        }
        // Ha de quedar completa i no pot ser només de jokers.
        if (meld.length === end - start + 1 && realTiles > 0) pushCandidate(candidates, meld);
      }
    }
  }

  return candidates;
}

function pushCandidate(candidates: MeldCandidate[], meld: Meld): void {
  const info = analyzeMeld(meld);
  if (info.valid) candidates.push({ meld, points: info.points });
}

/** Tots els subconjunts d'una llista curta (aquí, com a màxim 4 fitxes). */
function subsets<T>(items: T[]): T[][] {
  const result: T[][] = [[]];
  for (const item of items) {
    const len = result.length;
    for (let i = 0; i < len; i++) result.push([...result[i], item]);
  }
  return result;
}

/**
 * Selecció voraç de jugades que no comparteixen fitxes, prioritzant desfer-se de
 * més fitxes ('tiles') o sumar més punts ('points', per a la sortida inicial).
 */
export function pickDisjointMelds(
  candidates: MeldCandidate[],
  prefer: 'tiles' | 'points',
): { melds: Meld[]; points: number } {
  const sorted = [...candidates].sort((a, b) =>
    prefer === 'tiles'
      ? b.meld.length - a.meld.length || b.points - a.points
      : b.points - a.points || b.meld.length - a.meld.length,
  );
  const used = new Set<string>();
  const melds: Meld[] = [];
  let points = 0;
  for (const candidate of sorted) {
    if (candidate.meld.some((t) => used.has(t.id))) continue;
    candidate.meld.forEach((t) => used.add(t.id));
    melds.push(candidate.meld);
    points += candidate.points;
  }
  return { melds, points };
}

/**
 * Prova d'allargar les jugades de la taula amb fitxes soltes de la mà (afegir el
 * quart color a un grup, o punxar un extrem d'una escala), repetidament fins que
 * no hi hagi cap més extensió possible.
 */
function extendBoardMelds(
  board: Meld[],
  rack: Tile[],
  allowJokers: boolean,
): { board: Meld[]; rack: Tile[]; used: number } {
  const melds = board.map((m) => [...m]);
  let rest = [...rack];
  let used = 0;
  let changed = true;
  while (changed) {
    changed = false;
    for (let i = 0; i < melds.length && !changed; i++) {
      for (const tile of rest) {
        if (isJoker(tile) && !allowJokers) continue;
        const extended = [
          [...melds[i], tile],
          [tile, ...melds[i]],
        ].find((m) => analyzeMeld(m).valid);
        if (extended) {
          melds[i] = extended;
          rest = rest.filter((t) => t.id !== tile.id);
          used++;
          changed = true;
          break;
        }
      }
    }
  }
  return { board: melds, rack: rest, used };
}

/**
 * Millor jugada trobada per al jugador, o null si no en té cap (i per tant ha de
 * robar). Té en compte si encara ha de fer la sortida inicial de 30 punts.
 */
export function chooseBestPlay(
  state: GameState,
  playerIndex: number,
  options: SolverOptions,
): PlayCandidate | null {
  const { stats } = options;
  if (stats) {
    stats.nodes = 0;
    stats.searchLimited = false;
    stats.rearrangeUsed = false;
  }
  const player = state.players[playerIndex];
  const candidates = findRackMelds(player.rack, options.allowJokers);

  if (!player.hasOpened) {
    const { melds, points } = pickDisjointMelds(candidates, 'points');
    if (points < INITIAL_MELD_POINTS) return null;
    return {
      board: [...state.board, ...melds],
      tilesUsed: melds.reduce((sum, m) => sum + m.length, 0),
      points,
    };
  }

  const { melds, points } = pickDisjointMelds(candidates, 'tiles');
  let board = [...state.board, ...melds];
  const usedIds = new Set(melds.flat().map((t) => t.id));
  let rack = player.rack.filter((t) => !usedIds.has(t.id));
  let tilesUsed = usedIds.size;

  if (options.allowExtensions) {
    const extended = extendBoardMelds(board, rack, options.allowJokers);
    board = extended.board;
    rack = extended.rack;
    tilesUsed += extended.used;
  }

  const greedy = tilesUsed > 0 ? { board, tilesUsed, points } : null;
  if (!options.allowRearrange) return greedy;

  /*
   * La cerca completa pot no arribar a temps (sostre de nodes) o, si mai
   * tingués un error, proposar una taula que el motor rebutjaria i tombaria la
   * partida. Per això es comprova abans de fer-la servir i, si no convenç, es
   * juga la de l'heurística voraç.
   */
  const rearrangeStats = stats ? { nodes: 0, limited: false } : undefined;
  const rearranged = bestRearrangement(state.board, player.rack, {
    maxNodes: options.maxNodes,
    preferPoints: options.preferPointsTieBreak,
    stats: rearrangeStats,
  });
  if (stats && rearrangeStats) {
    stats.nodes = rearrangeStats.nodes;
    stats.searchLimited = rearrangeStats.limited;
  }
  if (!rearranged || rearranged.tilesUsed < (greedy?.tilesUsed ?? 0)) return greedy;
  if (rearranged.tilesUsed === (greedy?.tilesUsed ?? 0)) {
    /*
     * Empat en fitxes entre la voraç i la reordenació: sense el desempat per
     * punts es juga la voraç, com sempre; amb el desempat, la reordenació
     * només guanya l'empat si es desfà d'estrictament més punts.
     */
    const rearrangeWinsTie =
      options.preferPointsTieBreak &&
      greedy !== null &&
      shedPoints(state.board, rearranged.board) > shedPoints(state.board, greedy.board);
    if (!rearrangeWinsTie) return greedy;
  }
  if (!isSoundProposal(state.board, player.rack, rearranged.board)) return greedy;
  if (stats) stats.rearrangeUsed = true;
  return { board: rearranged.board, tilesUsed: rearranged.tilesUsed, points };
}

/** Punts pendents que una proposta es treu de la mà (fitxes noves a la taula). */
function shedPoints(before: Meld[], proposal: Meld[]): number {
  const old = new Set(before.flat().map((tile) => tile.id));
  let points = 0;
  for (const meld of proposal) {
    for (const tile of meld) if (!old.has(tile.id)) points += tilePoints(tile);
  }
  return points;
}

/**
 * Xarxa de seguretat abans de confiar en una taula proposada: totes les jugades
 * vàlides, cap fitxa repetida ni inventada, i cap de la taula que hagi
 * desaparegut. És el mateix que comprovarà el motor, però aquí encara som a
 * temps de fer marxa enrere.
 */
function isSoundProposal(board: Meld[], rack: Tile[], proposal: Meld[]): boolean {
  if (!proposal.every((meld) => analyzeMeld(meld).valid)) return false;

  const ids = proposal.flat().map((tile) => tile.id);
  const unique = new Set(ids);
  if (unique.size !== ids.length) return false;

  const available = new Set([...board.flat(), ...rack].map((tile) => tile.id));
  if (!ids.every((id) => available.has(id))) return false;
  return board.flat().every((tile) => unique.has(tile.id));
}
