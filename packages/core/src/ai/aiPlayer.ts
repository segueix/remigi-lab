import type { Rng } from '../core/random';
import type { GameState, Move } from '../core/types';
import { difficultyByKey, type AiParams } from './difficulty';
import { chooseBestPlay, type SearchStats } from './solver';

/** Paràmetres d'IA del jugador (segons el seu `aiLevel`, o el nivell per defecte). */
export function aiParamsForPlayer(state: GameState, playerIndex: number): AiParams {
  return difficultyByKey(state.players[playerIndex].aiLevel);
}

export interface AiMoveOptions {
  /**
   * Ajusta la dificultat **dins** de la partida segons com va el jugador humà.
   * Desactivat per defecte: canvia el nivell del rival a mitja partida, i això
   * ha de ser una decisió explícita.
   */
  rubberBanding?: boolean;
  /** Substitueix paràmetres del nivell (proves i comparatives). */
  overrides?: Partial<AiParams>;
  /** Sostre de nodes de la cerca (per defecte, el del nivell o el del cercador). */
  maxNodes?: number;
  /** Sortida de diagnòstic per al motor: no canvia cap decisió. */
  stats?: AiDecisionStats;
}

/** Diagnòstic d'una decisió, per a les mètriques del motor. */
export interface AiDecisionStats extends SearchStats {
  /**
   * El cercador havia trobat jugada. Si tot i això el moviment és robar, és
   * l'error humà simulat del nivell («no veure» la jugada).
   */
  foundPlay: boolean;
}

/** Com de lluny pot arribar l'ajust dins de la partida. */
const RUBBER_BAND_PER_TILE = 0.03;
const RUBBER_BAND_MAX_MISTAKE = 0.5;

/**
 * Probabilitat d'error ajustada a com va la partida: si el jugador humà va
 * endarrerit (li queden més fitxes), el bot s'equivoca una mica més; si va
 * avançat, afina. Serveix per suavitzar les ratxes sense canviar de nivell.
 *
 * Sense cap jugador humà a la taula no hi ha res a suavitzar.
 */
export function rubberBandedMistakeRate(
  state: GameState,
  playerIndex: number,
  baseMistakeRate: number,
): number {
  const humanRacks = state.players.filter((p) => p.kind === 'human').map((p) => p.rack.length);
  if (humanRacks.length === 0) return baseMistakeRate;

  const behind = Math.min(...humanRacks) - state.players[playerIndex].rack.length;
  const adjusted = baseMistakeRate + behind * RUBBER_BAND_PER_TILE;
  return Math.min(RUBBER_BAND_MAX_MISTAKE, Math.max(0, adjusted));
}

/**
 * Decideix el moviment d'un jugador IA. El nivell de dificultat limita el
 * cercador (jokers, extensions, reordenació de la taula) i hi afegeix una
 * probabilitat d'error humà: "no veure" la jugada i robar fitxa.
 *
 * `rng` permet passar un generador amb llavor perquè les partides siguin
 * reproduïbles; per defecte fa servir Math.random.
 */
export function decideAiMove(
  state: GameState,
  playerIndex: number,
  rng: Rng = Math.random,
  options: AiMoveOptions = {},
): Move {
  const params = { ...aiParamsForPlayer(state, playerIndex), ...options.overrides };
  const best = chooseBestPlay(state, playerIndex, {
    allowJokers: params.usesJokers,
    allowExtensions: params.extendsBoard,
    allowRearrange: params.rearrangesTable,
    maxNodes: options.maxNodes ?? params.maxNodes,
    preferPointsTieBreak: params.preferPointsTieBreak,
    stats: options.stats,
  });
  if (options.stats) options.stats.foundPlay = best !== null;
  if (!best) return { type: 'draw' };

  const mistakeRate = options.rubberBanding
    ? rubberBandedMistakeRate(state, playerIndex, params.mistakeRate)
    : params.mistakeRate;
  if (rng() < mistakeRate) return { type: 'draw' };
  return { type: 'play', board: best.board };
}
