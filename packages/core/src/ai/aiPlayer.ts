import type { Rng } from '../core/random';
import type { GameState, Move } from '../core/types';
import { difficultyByKey, withOverrides, type AiParams } from './difficulty';
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
const RUBBER_BAND_REARRANGE_PER_TILE = 0.25;

/**
 * Quantes fitxes més que el bot li queden al jugador humà que va millor
 * (negatiu si l'humà va per davant), o null si a la taula no hi ha cap humà.
 */
function humanDeficit(state: GameState, playerIndex: number): number | null {
  const humanRacks = state.players.filter((p) => p.kind === 'human').map((p) => p.rack.length);
  if (humanRacks.length === 0) return null;
  return Math.min(...humanRacks) - state.players[playerIndex].rack.length;
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/**
 * Probabilitat d'error ajustada a com va la partida: si el jugador humà va
 * endarrerit (li queden més fitxes), el bot s'equivoca una mica més; si va
 * avançat, afina. És el que suavitza els nivells baixos, que no reordenen.
 *
 * Sense cap jugador humà a la taula no hi ha res a suavitzar.
 */
export function rubberBandedMistakeRate(
  state: GameState,
  playerIndex: number,
  baseMistakeRate: number,
): number {
  const behind = humanDeficit(state, playerIndex);
  if (behind === null) return baseMistakeRate;
  return clamp(baseMistakeRate + behind * RUBBER_BAND_PER_TILE, 0, RUBBER_BAND_MAX_MISTAKE);
}

/**
 * Proporció de torns amb reordenació ajustada a com va la partida: és el que
 * de debò iguala els nivells alts, perquè «no veure» una jugada gairebé no
 * afebleix un bot que reordena (la recupera el torn següent). Si l'humà va
 * endarrerit, el bot reordena menys sovint; si va avançat, més. Només afecta
 * els nivells que saben reordenar.
 *
 * Sense cap jugador humà a la taula no hi ha res a suavitzar.
 */
export function rubberBandedRearrangeRate(
  state: GameState,
  playerIndex: number,
  baseRearrangeRate: number,
): number {
  const behind = humanDeficit(state, playerIndex);
  if (behind === null) return baseRearrangeRate;
  return clamp(baseRearrangeRate - behind * RUBBER_BAND_REARRANGE_PER_TILE, 0, 1);
}

/**
 * Decideix el moviment d'un jugador IA. El nivell de dificultat limita el
 * cercador (jokers, extensions i, en una part dels torns, reordenació de la
 * taula) i hi afegeix una probabilitat d'error humà: "no veure" la jugada i
 * robar fitxa.
 *
 * `rng` permet passar un generador amb llavor perquè les partides siguin
 * reproduïbles; per defecte fa servir Math.random. Amb una proporció de
 * reordenació de 0 o d'1 no se'n tira cap dau, així que el nivell expert
 * consumeix el RNG exactament com abans que existís.
 */
export function decideAiMove(
  state: GameState,
  playerIndex: number,
  rng: Rng = Math.random,
  options: AiMoveOptions = {},
): Move {
  const params = withOverrides(aiParamsForPlayer(state, playerIndex), options.overrides);
  const best = chooseBestPlay(state, playerIndex, {
    limitJokers: true,
    allowJokers: params.usesJokers && rollRate(params.jokerRate ?? 1, rng),
    allowExtensions: params.extendsBoard && rollRate(params.extensionRate ?? 1, rng),
    allowRearrange: params.rearrangesTable && rollRearrange(state, playerIndex, rng, params, options),
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

/** Decideix si aquest torn el bot fa servir la reordenació de la taula. */
function rollRearrange(
  state: GameState,
  playerIndex: number,
  rng: Rng,
  params: AiParams,
  options: AiMoveOptions,
): boolean {
  const base = params.rearrangeRate;
  const rate = options.rubberBanding ? rubberBandedRearrangeRate(state, playerIndex, base) : base;
  if (rate >= 1) return true;
  if (rate <= 0) return false;
  return rng() < rate;
}

/** Els extrems no consumeixen RNG: els nivells fixos conserven les decisions. */
function rollRate(rate: number, rng: Rng): boolean {
  return rate >= 1 || (rate > 0 && rng() < rate);
}
