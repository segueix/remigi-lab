import type { TileColor } from './types';

export const COLORS: TileColor[] = ['red', 'blue', 'black', 'orange'];

export const MIN_VALUE = 1;
export const MAX_VALUE = 13;

/** Còpies de cada fitxa numerada (color + valor). */
export const COPIES_PER_TILE = 2;
export const JOKER_COUNT = 2;

/** 4 colors × 13 valors × 2 còpies + 2 jokers = 106 fitxes. */
export const TOTAL_TILES =
  COLORS.length * (MAX_VALUE - MIN_VALUE + 1) * COPIES_PER_TILE + JOKER_COUNT;

export const INITIAL_RACK_SIZE = 14;

/** Punts mínims de la sortida inicial. */
export const INITIAL_MELD_POINTS = 30;

/** Punts que penalitza un joker que es queda a la mà en acabar la partida. */
export const JOKER_PENALTY_POINTS = 30;

export const MIN_MELD_SIZE = 3;
/** Un grup no pot repetir color, per tant com a màxim té 4 fitxes. */
export const MAX_GROUP_SIZE = 4;

/**
 * Noms dels colors per a la interfície en català.
 *
 * El quart color es diu **groc**: la clau interna continua sent `orange`
 * perquè és la que hi ha desada a les partides i als perfils de tothom, i
 * canviar-la no faria el joc ni un pèl més groc; el que es veu i el que es
 * llegeix, sí.
 */
export const COLOR_LABELS: Record<TileColor, string> = {
  red: 'vermell',
  blue: 'blau',
  black: 'negre',
  orange: 'groc',
};
