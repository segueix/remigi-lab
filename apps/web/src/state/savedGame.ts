import type { GameState } from '@remigi/core';
import { validMisses, type MissedChance } from '../game/missedChances';
import type { GameSetup } from '../game/useGame';
import type { KeyValueStore } from '@remigi/core';

/**
 * Clau **lògica** de la partida desada. L'espai de noms del laboratori
 * (`remigi-lab:`) l'hi posa el `KeyValueStore` de la web, un sol cop i en un
 * sol lloc (vegeu `storage/namespace.ts`): aquí no s'hi ha d'afegir, o
 * quedaria dues vegades.
 */
export const SAVED_GAME_KEY = 'remigi:game';

export interface SavedGame {
  setup: GameSetup;
  game: GameState;
  /**
   * Fitxes de la taula posades pel bot de l'últim moviment, en parelles
   * `[fitxa, jugador]` perquè un `Map` no es pot desar tal qual en JSON
   * (vegeu `meldOwners.ts`).
   *
   * És informació només visual, i per això no forma part de l'estat del motor.
   * Es desa perquè continuar una partida no faci desaparèixer els marcs; si
   * falta o ve malmesa (o ve d'una versió antiga amb claus de jugada), la
   * partida es continua igual i les fitxes es queden sense marc.
   */
  owners?: [string, number][];
  /**
   * Oportunitats perdudes de la partida, per al repàs del final (vegeu
   * `missedChances.ts`). Mateix criteri que els autors: si falten o venen
   * malmeses, la partida es continua igual i el repàs començarà de zero.
   */
  misses?: MissedChance[];
}

export async function saveGame(store: KeyValueStore, saved: SavedGame): Promise<void> {
  await store.set(SAVED_GAME_KEY, JSON.stringify(saved));
}

export async function clearGame(store: KeyValueStore): Promise<void> {
  await store.remove(SAVED_GAME_KEY);
}

/**
 * Recupera la partida desada, o `null` si no n'hi ha cap d'aprofitable.
 *
 * El que hi ha al navegador no és de fiar: pot ser d'una versió anterior del
 * joc, haver-se quedat a mitges o haver-lo tocat algú. Per això es comprova la
 * forma abans de retornar-la; davant del dubte val més començar de nou que
 * carregar un estat que faria petar la partida.
 */
export async function loadGame(store: KeyValueStore): Promise<SavedGame | null> {
  const raw = await store.get(SAVED_GAME_KEY);
  if (!raw) return null;
  try {
    let saved = JSON.parse(raw) as SavedGame;
    if (!isResumable(saved)) return null;
    if ('owners' in saved) saved = { ...saved, owners: validOwners(saved.owners) };
    if ('misses' in saved) saved = { ...saved, misses: validMisses(saved.misses) };
    return saved;
  } catch {
    return null;
  }
}

/** Els autors que tenen forma d'autor; la resta es descarten sense fer soroll. */
function validOwners(owners: unknown): [string, number][] {
  if (!Array.isArray(owners)) return [];
  return owners.filter(
    (pair): pair is [string, number] =>
      Array.isArray(pair) &&
      pair.length === 2 &&
      typeof pair[0] === 'string' &&
      typeof pair[1] === 'number',
  );
}

function isResumable(value: unknown): boolean {
  if (typeof value !== 'object' || value === null) return false;
  const { setup, game } = value as Partial<SavedGame>;

  if (!setup || !Array.isArray(setup.opponents) || typeof setup.playerName !== 'string') {
    return false;
  }
  if (!game || typeof game !== 'object') return false;
  // Només es reprenen partides a mig jugar: una d'acabada ja no té continuació.
  if (game.status !== 'playing') return false;
  if (!Array.isArray(game.bag) || !Array.isArray(game.board)) return false;
  if (!Array.isArray(game.players) || game.players.length < 2) return false;
  if (!game.players.every((player) => player && Array.isArray(player.rack))) return false;
  if (typeof game.currentPlayer !== 'number') return false;
  return game.currentPlayer >= 0 && game.currentPlayer < game.players.length;
}
