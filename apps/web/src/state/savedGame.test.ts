import { MemoryStore, applyMove, createGame, decideAiMove } from '@remigi/core';
import { describe, expect, it } from 'vitest';
import { SAVED_GAME_KEY, clearGame, loadGame, saveGame, type SavedGame } from './savedGame';

const setup = { playerName: 'Anna', opponents: ['easy', 'medium'] as const };

function playing(): SavedGame {
  return {
    setup: { playerName: setup.playerName, opponents: [...setup.opponents] },
    game: createGame({
      seed: 3,
      players: [
        { name: 'Anna', kind: 'human' },
        { name: 'Bot 1', kind: 'ai', aiLevel: 'easy' },
        { name: 'Bot 2', kind: 'ai', aiLevel: 'medium' },
      ],
    }),
  };
}

describe('desar i continuar la partida', () => {
  it('no hi ha res a continuar en un navegador net', async () => {
    expect(await loadGame(new MemoryStore())).toBeNull();
  });

  it('recupera la partida exactament com estava', async () => {
    const store = new MemoryStore();
    const saved = playing();
    await saveGame(store, saved);

    const loaded = await loadGame(store);
    expect(loaded).toEqual(saved);
    // Les fitxes es conserven una per una, no només el compte.
    expect(loaded!.game.players[0].rack.map((t) => t.id)).toEqual(
      saved.game.players[0].rack.map((t) => t.id),
    );
  });

  it('continua una partida ja començada i la deixa jugable', async () => {
    const store = new MemoryStore();
    let game = playing().game;
    for (let i = 0; i < 12; i++) game = applyMove(game, decideAiMove(game, game.currentPlayer));
    await saveGame(store, { setup: playing().setup, game });

    const loaded = await loadGame(store);
    expect(loaded!.game.turn).toBe(game.turn);
    // El motor accepta el que s'ha recuperat i la partida tira endavant.
    const next = applyMove(loaded!.game, decideAiMove(loaded!.game, loaded!.game.currentPlayer));
    expect(next.turn).toBe(game.turn + 1);
  });

  it('conserva qui ha jugat cada jugada, perquè no perdi els colors', async () => {
    const store = new MemoryStore();
    const owners: [string, number][] = [['red-7-a blue-7-a black-7-a', 2]];
    await saveGame(store, { ...playing(), owners });

    expect((await loadGame(store))!.owners).toEqual(owners);
  });

  it('esborrar-la deixa de oferir-la', async () => {
    const store = new MemoryStore();
    await saveGame(store, playing());
    await clearGame(store);
    expect(await loadGame(store)).toBeNull();
  });
});

describe('el que hi ha desat no és de fiar', () => {
  async function stored(value: string) {
    const store = new MemoryStore();
    // La clau surt del mòdul: així no pot desviar-se de la de debò (i una
    // prova que esperi `null` no passarà mai per haver escrit on no toca).
    await store.set(SAVED_GAME_KEY, value);
    return loadGame(store);
  }

  it('descarta el que no és ni JSON', async () => {
    expect(await stored('{ això no és json')).toBeNull();
  });

  it('descarta una partida ja acabada: no té continuació', async () => {
    const saved = playing();
    expect(
      await stored(JSON.stringify({ ...saved, game: { ...saved.game, status: 'finished' } })),
    ).toBeNull();
  });

  it('els autors malmesos es descarten, però la partida es continua igual', async () => {
    // Són informació només visual: no val la pena perdre-hi una partida.
    const saved = playing();
    const loaded = await stored(
      JSON.stringify({ ...saved, owners: ['això no', ['bona', 1], ['sense jugador']] }),
    );
    expect(loaded).not.toBeNull();
    expect(loaded!.owners).toEqual([['bona', 1]]);
    expect(await stored(JSON.stringify({ ...saved, owners: 'ni tan sols una llista' }))).not.toBeNull();
  });

  it('descarta estats incomplets o incoherents', async () => {
    const saved = playing();
    expect(await stored(JSON.stringify({ game: saved.game }))).toBeNull();
    expect(await stored(JSON.stringify({ setup: saved.setup }))).toBeNull();
    expect(
      await stored(JSON.stringify({ ...saved, game: { ...saved.game, players: [] } })),
    ).toBeNull();
    expect(
      await stored(JSON.stringify({ ...saved, game: { ...saved.game, board: null } })),
    ).toBeNull();
    // Un torn que assenyala un jugador que no existeix.
    expect(
      await stored(JSON.stringify({ ...saved, game: { ...saved.game, currentPlayer: 9 } })),
    ).toBeNull();
  });
});
