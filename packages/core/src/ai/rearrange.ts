import { COLORS, JOKER_PENALTY_POINTS, MAX_GROUP_SIZE, MAX_VALUE, MIN_MELD_SIZE } from '../core/constants';
import { isJoker } from '../core/tiles';
import type { Meld, Tile } from '../core/types';

/**
 * Cerca de la millor reordenació de la taula.
 *
 * El problema: repartir en jugades vàlides **totes** les fitxes que ja hi ha a
 * la taula més les que el jugador vulgui de la seva mà, quedant-se'n a la mà
 * les mínimes possibles. És el que fa un bon jugador quan desfà i refà mitja
 * taula per encabir-hi una fitxa.
 *
 * Com que dues còpies de la mateixa fitxa són intercanviables, no es treballa
 * amb fitxes concretes sinó amb **recomptes** per color i número. Això redueix
 * moltíssim l'espai de cerca i permet memoritzar els estats repetits.
 *
 * Les caselles es recorren en un ordre fix (primer el número, després el
 * color) i a cada casella només s'enumeren les jugades on aquella fitxa és la
 * de l'índex més baix. Així cada repartiment possible es genera **una sola
 * vegada**, que és el que fa la cerca abastable.
 */

const COLOR_COUNT = COLORS.length;
const SLOTS = COLOR_COUNT * MAX_VALUE;

const slotOf = (color: number, value: number) => (value - 1) * COLOR_COUNT + color;
const colorOf = (slot: number) => slot % COLOR_COUNT;
const valueOf = (slot: number) => Math.floor(slot / COLOR_COUNT) + 1;

/** Jugada trobada per la cerca, encara sense fitxes concretes assignades. */
type PlannedMeld =
  | { kind: 'run'; color: number; start: number; length: number; jokerAt: boolean[] }
  | { kind: 'group'; value: number; colors: number[]; jokers: number };

export interface RearrangeResult {
  board: Meld[];
  /** Fitxes de la mà que es col·loquen a la taula. */
  tilesUsed: number;
}

export interface RearrangeOptions {
  /**
   * Sostre de nodes de la cerca. Si s'esgota no es retorna res, i qui crida es
   * queda amb la jugada de l'heurística voraç: val més jugar de pressa i una
   * mica pitjor que fer esperar el jugador.
   */
  maxNodes?: number;
  /**
   * Desempat per punts: entre repartiments que es queden el MATEIX nombre de
   * fitxes a la mà, prefereix quedar-se les de menys valor pendent. No canvia
   * mai quantes fitxes es col·loquen, només quines es queden.
   */
  preferPoints?: boolean;
  /**
   * Sortida de diagnòstic: si es passa, s'hi escriuen els nodes explorats i si
   * la cerca ha tocat el sostre. No canvia cap decisió.
   */
  stats?: RearrangeStats;
}

export interface RearrangeStats {
  /** Nodes explorats per la cerca. */
  nodes: number;
  /** La cerca ha tocat el sostre de nodes i s'ha abandonat. */
  limited: boolean;
}

const DEFAULT_MAX_NODES = 120_000;

/*
 * Amb el desempat per punts, el cost passa a ser compost:
 * fitxes_quedades · KEEP_UNIT + punts_quedats. Com que els punts d'una mà mai
 * no s'acosten a KEEP_UNIT, minimitzar el cost compost minimitza primer les
 * fitxes (exactament com abans) i, només en cas d'empat, els punts.
 */
const KEEP_UNIT = 10_000;

export function bestRearrangement(
  board: Meld[],
  rack: Tile[],
  options: RearrangeOptions = {},
): RearrangeResult | null {
  const maxNodes = options.maxNodes ?? DEFAULT_MAX_NODES;
  // Cost de quedar-se una fitxa a la mà: 1 (comptar fitxes) o compost.
  const keepCost = (slot: number) => (options.preferPoints ? KEEP_UNIT + valueOf(slot) : 1);
  const jokerKeepCost = options.preferPoints ? KEEP_UNIT + JOKER_PENALTY_POINTS : 1;

  // Reserves de fitxes de debò per casella, amb les de la taula al davant: com
  // que totes les de la taula s'han de tornar a col·locar, gastar-les primer
  // garanteix que no en quedi cap fora.
  const pool: Tile[][] = Array.from({ length: SLOTS }, () => []);
  const jokerPool: Tile[] = [];
  const tableCount = new Int8Array(SLOTS);
  let tableJokers = 0;

  for (const tile of board.flat()) {
    if (isJoker(tile)) {
      jokerPool.unshift(tile);
      tableJokers++;
    } else {
      const slot = slotOf(COLORS.indexOf(tile.color), tile.value);
      pool[slot].unshift(tile);
      tableCount[slot]++;
    }
  }
  for (const tile of rack) {
    if (isJoker(tile)) jokerPool.push(tile);
    else pool[slotOf(COLORS.indexOf(tile.color), tile.value)].push(tile);
  }

  const remaining = new Int8Array(SLOTS);
  for (let slot = 0; slot < SLOTS; slot++) remaining[slot] = pool[slot].length;
  const totalJokers = jokerPool.length;
  const rackJokers = totalJokers - tableJokers;

  let nodes = 0;
  let exhausted = false;
  const memo = new Map<string, { cost: number; melds: PlannedMeld[] } | null>();

  /**
   * Mínim de fitxes que queden sense col·locar a partir d'aquesta casella, o
   * `null` si des d'aquí no hi ha cap repartiment possible.
   */
  function solve(slot: number, jokersLeft: number): { cost: number; melds: PlannedMeld[] } | null {
    if (exhausted) return null;
    if (++nodes > maxNodes) {
      exhausted = true;
      return null;
    }

    if (slot >= SLOTS) {
      // Els jokers de la taula també s'han de tornar a col·locar tots.
      return jokersLeft > rackJokers ? null : { cost: jokersLeft * jokerKeepCost, melds: [] };
    }
    if (remaining[slot] === 0) return solve(slot + 1, jokersLeft);

    const key = memoKey(slot, jokersLeft);
    const cached = memo.get(key);
    if (cached !== undefined) return cached;

    let best: { cost: number; melds: PlannedMeld[] } | null = null;

    // Quedar-se la fitxa a la mà: només si la que queda no és de la taula.
    if (remaining[slot] > tableCount[slot]) {
      remaining[slot]--;
      const rest = solve(slot, jokersLeft);
      remaining[slot]++;
      if (rest) best = { cost: rest.cost + keepCost(slot), melds: rest.melds };
    }

    for (const meld of meldsStartingAt(slot, remaining, jokersLeft)) {
      const usedJokers = apply(meld, remaining, 1);
      const rest = solve(slot, jokersLeft - usedJokers);
      apply(meld, remaining, -1);
      if (rest && (!best || rest.cost < best.cost)) {
        best = { cost: rest.cost, melds: [meld, ...rest.melds] };
      }
      if (best && best.cost === 0) break; // no es pot fer millor
    }

    if (!exhausted) memo.set(key, best);
    return best;
  }

  function memoKey(slot: number, jokersLeft: number): string {
    let key = String.fromCharCode(slot, jokersLeft);
    for (let i = slot; i < SLOTS; i++) key += String.fromCharCode(remaining[i]);
    return key;
  }

  const solution = solve(0, totalJokers);
  if (options.stats) {
    options.stats.nodes = nodes;
    options.stats.limited = exhausted;
  }
  if (!solution || exhausted) return null;

  const keptTiles = options.preferPoints ? Math.floor(solution.cost / KEEP_UNIT) : solution.cost;
  const tilesUsed = rack.length - keptTiles;
  if (tilesUsed <= 0) return null;

  return { board: buildBoard(solution.melds, pool, jokerPool), tilesUsed };
}

/**
 * Jugades vàlides on la fitxa d'aquesta casella és la de l'índex més baix: les
 * escales del seu color que hi comencen i els grups del seu número amb colors
 * posteriors. Les que la contenen però comencen abans ja s'han enumerat en
 * arribar a la seva casella.
 */
function meldsStartingAt(slot: number, remaining: Int8Array, jokersLeft: number): PlannedMeld[] {
  const color = colorOf(slot);
  const value = valueOf(slot);
  const melds: PlannedMeld[] = [];

  for (let length = MIN_MELD_SIZE; value + length - 1 <= MAX_VALUE; length++) {
    const jokerAt: boolean[] = [];
    let jokersNeeded = 0;
    for (let step = 0; step < length; step++) {
      const has = remaining[slotOf(color, value + step)] > 0;
      jokerAt.push(!has);
      if (!has) jokersNeeded++;
    }
    // Una escala més llarga només pot necessitar més jokers, no menys.
    if (jokersNeeded > jokersLeft) break;
    melds.push({ kind: 'run', color, start: value, length, jokerAt });
  }

  const others: number[] = [];
  for (let other = color + 1; other < COLOR_COUNT; other++) {
    if (remaining[slotOf(other, value)] > 0) others.push(other);
  }
  for (let mask = 0; mask < 1 << others.length; mask++) {
    const colors = [color];
    for (let bit = 0; bit < others.length; bit++) {
      if (mask & (1 << bit)) colors.push(others[bit]);
    }
    for (let jokers = 0; jokers <= jokersLeft; jokers++) {
      const size = colors.length + jokers;
      if (size < MIN_MELD_SIZE) continue;
      if (size > MAX_GROUP_SIZE) break;
      melds.push({ kind: 'group', value, colors, jokers });
    }
  }

  return melds;
}

/** Aplica (sign 1) o desfà (sign -1) una jugada sobre els recomptes. */
function apply(meld: PlannedMeld, remaining: Int8Array, sign: number): number {
  if (meld.kind === 'run') {
    let jokers = 0;
    for (let step = 0; step < meld.length; step++) {
      if (meld.jokerAt[step]) jokers++;
      else remaining[slotOf(meld.color, meld.start + step)] -= sign;
    }
    return jokers;
  }
  for (const color of meld.colors) remaining[slotOf(color, meld.value)] -= sign;
  return meld.jokers;
}

/** Assigna fitxes de debò al pla, gastant primer les de la taula. */
function buildBoard(melds: PlannedMeld[], pool: Tile[][], jokerPool: Tile[]): Meld[] {
  const take = (slot: number) => pool[slot].shift()!;
  const takeJoker = () => jokerPool.shift()!;

  return melds.map((meld) => {
    if (meld.kind === 'run') {
      const tiles: Tile[] = [];
      for (let step = 0; step < meld.length; step++) {
        tiles.push(meld.jokerAt[step] ? takeJoker() : take(slotOf(meld.color, meld.start + step)));
      }
      return tiles;
    }
    const tiles: Tile[] = meld.colors.map((color) => take(slotOf(color, meld.value)));
    for (let i = 0; i < meld.jokers; i++) tiles.push(takeJoker());
    return tiles;
  });
}
