import { isJoker } from '../core/tiles';
import type { GameState, Meld, Move } from '../core/types';

/**
 * «Jeroglífics»: la mètrica de complexitat del laboratori.
 *
 * Mesura quanta reconstrucció de taula fa una jugada: no si és bona, sinó com
 * de fonda és la reorganització. No és cap regla del joc, és **telemetria del
 * laboratori**: es calcula DESPRÉS que el motor hagi decidit, a partir de la
 * taula d'abans i la de després, i per tant no pot influir en cap decisió.
 *
 * El criteri, determinista i documentat (vegeu docs/AI-LAB.md):
 *
 * 1. Cada jugada de la taula d'abans té una **successora**: la jugada de la
 *    taula de després que conserva més fitxes seves (en cas d'empat, la de
 *    l'índex més baix — les fitxes no poden desaparèixer de la taula, així que
 *    sempre n'hi ha una).
 * 2. Una jugada d'abans és **estesa** si sobreviu sencera dins d'una successora
 *    més gran (+1), i **alterada** si no es conserva sencera — partida,
 *    escurçada o barrejada (+2).
 * 3. Una fitxa de la taula és **recol·locada** si acaba en una jugada diferent
 *    de la successora de la seva jugada d'origen (+1; si és un joker, +1 més:
 *    moure un joker ja col·locat és el moviment més delicat del joc).
 *
 *    puntuació = esteses + 2·alterades + recol·locades + jokersRecol·locats
 *
 * Trams (l'escala del laboratori):
 *
 *    0     trivial      (robar, o baixar jugades noves sense tocar la taula)
 *    1–2   simple       (allargar una o dues jugades existents)
 *    3–5   interessant  (alguna fitxa de la taula canvia de lloc)
 *    6–9   complexa     (reconstrucció que desfà i refà diverses jugades)
 *    10+   jeroglífic   (reorganització profunda de la taula)
 *
 * Les fitxes baixades de la mà i les jugades noves fetes només amb fitxes de
 * la mà NO puntuen: la mètrica és de reconstrucció de la taula, no de volum
 * (per al volum ja hi ha `tilesPlayed`).
 */

export type HieroglyphTier = 'trivial' | 'simple' | 'interessant' | 'complexa' | 'jeroglific';

/** Una jugada amb puntuació ≥ HIEROGLYPH_THRESHOLD compta com a jeroglífic. */
export const HIEROGLYPH_THRESHOLD = 10;

export interface HieroglyphBreakdown {
  /** Puntuació de complexitat (0 = trivial). */
  score: number;
  /** Tram de l'escala del laboratori on cau la puntuació. */
  tier: HieroglyphTier;
  /** La jugada compta com a jeroglífic (score ≥ 10). */
  isHieroglyph: boolean;
  /** Jugades d'abans conservades senceres dins d'una jugada més gran. */
  extendedMelds: number;
  /** Jugades d'abans que NO es conserven senceres (partides o barrejades). */
  alteredMelds: number;
  /** Fitxes de la taula que canvien de jugada respecte de la successora. */
  relocatedTiles: number;
  /** De les recol·locades, quantes són jokers. */
  relocatedJokers: number;
  /** Jugades de després sense predecessora (noves de trinca). */
  createdMelds: number;
  /** De les creades, quantes són només amb fitxes de la mà. */
  newMeldsFromRack: number;
  /** Fitxes baixades de la mà en aquest moviment. */
  tilesFromRack: number;
  /** Ids de les fitxes de taula recol·locades (per pintar la zona refeta). */
  relocatedTileIds: string[];
  /** Ids de les fitxes baixades de la mà (per pintar el que s'acaba de jugar). */
  playedTileIds: string[];
}

/** Desglossament de complexitat zero: el d'un moviment de robar. */
export function emptyHieroglyph(): HieroglyphBreakdown {
  return {
    score: 0,
    tier: 'trivial',
    isHieroglyph: false,
    extendedMelds: 0,
    alteredMelds: 0,
    relocatedTiles: 0,
    relocatedJokers: 0,
    createdMelds: 0,
    newMeldsFromRack: 0,
    tilesFromRack: 0,
    relocatedTileIds: [],
    playedTileIds: [],
  };
}

/** Tram de l'escala per a una puntuació. */
export function hieroglyphTier(score: number): HieroglyphTier {
  if (score <= 0) return 'trivial';
  if (score <= 2) return 'simple';
  if (score <= 5) return 'interessant';
  if (score <= 9) return 'complexa';
  return 'jeroglific';
}

/** Etiquetes en català dels trams, per a interfícies i informes. */
export const HIEROGLYPH_TIER_LABELS: Record<HieroglyphTier, string> = {
  trivial: 'trivial',
  simple: 'simple',
  interessant: 'interessant',
  complexa: 'complexa',
  jeroglific: 'jeroglífic',
};

/**
 * Desglossament de complexitat entre dues taules. Funció pura i determinista:
 * mateixes taules (en el mateix ordre), mateix resultat, sempre. Els empats de
 * successora es resolen per índex, així que el recompte no depèn de cap RNG.
 */
export function hieroglyphBreakdown(before: Meld[], after: Meld[]): HieroglyphBreakdown {
  const result = emptyHieroglyph();

  // On és cada fitxa a la taula de després, i quines fitxes hi havia abans.
  const afterIndexByTile = new Map<string, number>();
  after.forEach((meld, index) => {
    for (const tile of meld) afterIndexByTile.set(tile.id, index);
  });
  const beforeIds = new Set<string>();
  for (const meld of before) for (const tile of meld) beforeIds.add(tile.id);

  // Successora de cada jugada d'abans: la de després amb més fitxes seves.
  const successorOf: number[] = before.map((meld) => {
    const votes = new Map<number, number>();
    for (const tile of meld) {
      const index = afterIndexByTile.get(tile.id);
      if (index !== undefined) votes.set(index, (votes.get(index) ?? 0) + 1);
    }
    let bestIndex = -1;
    let bestCount = -1;
    for (const [index, count] of votes) {
      if (count > bestCount || (count === bestCount && index < bestIndex)) {
        bestIndex = index;
        bestCount = count;
      }
    }
    return bestIndex;
  });

  // Esteses i alterades.
  const successors = new Set<number>();
  before.forEach((meld, beforeIndex) => {
    const successorIndex = successorOf[beforeIndex];
    successors.add(successorIndex);
    const successor = after[successorIndex];
    const preserved = meld.every((tile) => afterIndexByTile.get(tile.id) === successorIndex);
    if (!preserved) result.alteredMelds++;
    else if (successor.length > meld.length) result.extendedMelds++;
  });

  // Fitxes de taula recol·locades: acaben fora de la successora del seu origen.
  before.forEach((meld, beforeIndex) => {
    for (const tile of meld) {
      if (afterIndexByTile.get(tile.id) === successorOf[beforeIndex]) continue;
      result.relocatedTiles++;
      result.relocatedTileIds.push(tile.id);
      if (isJoker(tile)) result.relocatedJokers++;
    }
  });

  // Jugades creades i fitxes baixades de la mà.
  after.forEach((meld, afterIndex) => {
    if (!successors.has(afterIndex)) {
      result.createdMelds++;
      if (meld.every((tile) => !beforeIds.has(tile.id))) result.newMeldsFromRack++;
    }
    for (const tile of meld) {
      if (!beforeIds.has(tile.id)) {
        result.tilesFromRack++;
        result.playedTileIds.push(tile.id);
      }
    }
  });

  result.score =
    result.extendedMelds +
    2 * result.alteredMelds +
    result.relocatedTiles +
    result.relocatedJokers;
  result.tier = hieroglyphTier(result.score);
  result.isHieroglyph = result.score >= HIEROGLYPH_THRESHOLD;
  return result;
}

/**
 * Desglossament de complexitat d'un moviment sobre un estat: la crida còmoda
 * per al laboratori. Robar (o passar) és sempre trivial.
 */
export function hieroglyphForMove(state: GameState, move: Move): HieroglyphBreakdown {
  if (move.type !== 'play') return emptyHieroglyph();
  return hieroglyphBreakdown(state.board, move.board);
}
