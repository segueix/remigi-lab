import { describe, expect, it } from 'vitest';
import { applyMove, createGame, RulesError } from '../src/core/game';
import { finalScores } from '../src/core/scoring';
import { joker, makeState, t } from './helpers';

function expectRulesError(fn: () => unknown, code: string): void {
  try {
    fn();
    expect.fail(`s'esperava un RulesError amb codi ${code}`);
  } catch (error) {
    expect(error).toBeInstanceOf(RulesError);
    expect((error as RulesError).code).toBe(code);
  }
}

describe('creació de partida', () => {
  it('reparteix 14 fitxes per jugador i deixa la resta al sac', () => {
    const state = createGame({
      seed: 42,
      players: [
        { name: 'Tu', kind: 'human' },
        { name: 'Bot 1', kind: 'ai', aiLevel: 'medium' },
        { name: 'Bot 2', kind: 'ai', aiLevel: 'easy' },
      ],
    });
    expect(state.players).toHaveLength(3);
    for (const player of state.players) {
      expect(player.rack).toHaveLength(14);
      expect(player.hasOpened).toBe(false);
    }
    expect(state.bag).toHaveLength(106 - 3 * 14);
    expect(state.board).toEqual([]);
    expect(state.status).toBe('playing');
  });

  it('comença el jugador indicat, o el primer si no se n’indica cap', () => {
    const players = [
      { name: 'Tu', kind: 'human' as const },
      { name: 'Bot 1', kind: 'ai' as const, aiLevel: 'medium' as const },
      { name: 'Bot 2', kind: 'ai' as const, aiLevel: 'easy' as const },
    ];
    expect(createGame({ seed: 1, players }).currentPlayer).toBe(0);
    expect(createGame({ seed: 1, players, firstPlayer: 2 }).currentPlayer).toBe(2);
    expectRulesError(() => createGame({ seed: 1, players, firstPlayer: 3 }), 'BAD_FIRST_PLAYER');
  });

  it('rebutja menys de 2 o més de 4 jugadors', () => {
    expectRulesError(() => createGame({ players: [{ name: 'Sol', kind: 'human' }] }), 'BAD_PLAYER_COUNT');
  });
});

describe('robar fitxa', () => {
  it('passa la fitxa del sac a la mà i el torn al següent jugador', () => {
    const state = makeState({ racks: [[t('red', 1)], [t('blue', 1)]], bag: [t('black', 9)] });
    const next = applyMove(state, { type: 'draw' });
    expect(next.players[0].rack.map((x) => x.id)).toContain('black-9-a');
    expect(next.bag).toHaveLength(0);
    expect(next.currentPlayer).toBe(1);
    expect(next.turn).toBe(2);
  });

  it('amb el sac buit robar és passar, i si tothom passa la partida es bloqueja', () => {
    const state = makeState({ racks: [[t('red', 10)], [t('blue', 2)]] });
    const afterFirstPass = applyMove(state, { type: 'draw' });
    expect(afterFirstPass.status).toBe('playing');
    const blocked = applyMove(afterFirstPass, { type: 'draw' });
    expect(blocked.status).toBe('finished');
    // Guanya qui té menys punts pendents a la mà.
    expect(blocked.winnerId).toBe('p2');
  });
});

describe('sortida inicial', () => {
  it('rebutja una sortida de menys de 30 punts', () => {
    const state = makeState({ racks: [[t('red', 5), t('blue', 5), t('black', 5)], []] });
    expectRulesError(
      () => applyMove(state, { type: 'play', board: [[t('red', 5), t('blue', 5), t('black', 5)]] }),
      'OPENING_TOO_LOW',
    );
  });

  it('accepta sumar 30 punts amb més d’una jugada', () => {
    const rack = [t('red', 5), t('blue', 5), t('black', 5), t('red', 6), t('blue', 6), t('black', 6), t('orange', 1)];
    const state = makeState({ racks: [rack, []] });
    const next = applyMove(state, {
      type: 'play',
      board: [
        [t('red', 5), t('blue', 5), t('black', 5)],
        [t('red', 6), t('blue', 6), t('black', 6)],
      ],
    });
    expect(next.players[0].hasOpened).toBe(true);
    expect(next.players[0].rack.map((x) => x.id)).toEqual(['orange-1-a']);
    expect(next.board).toHaveLength(2);
  });

  it('no deixa tocar la taula abans d’haver obert', () => {
    const board = [[t('red', 1), t('blue', 1), t('black', 1)]];
    const state = makeState({ racks: [[t('orange', 1)], []], board });
    expectRulesError(
      () =>
        applyMove(state, {
          type: 'play',
          board: [[t('red', 1), t('blue', 1), t('black', 1), t('orange', 1)]],
        }),
      'REARRANGE_BEFORE_OPENING',
    );
  });
});

describe('jugar amb la taula oberta', () => {
  it('permet allargar una jugada existent', () => {
    const board = [[t('red', 1), t('blue', 1), t('black', 1)]];
    const state = makeState({ racks: [[t('orange', 1), t('red', 9)], []], board, hasOpened: [true, true] });
    const next = applyMove(state, {
      type: 'play',
      board: [[t('red', 1), t('blue', 1), t('black', 1), t('orange', 1)]],
    });
    expect(next.players[0].rack.map((x) => x.id)).toEqual(['red-9-a']);
  });

  it('permet reordenar la taula si tot queda vàlid', () => {
    // Es parteix una escala 1-5 per fer-ne dues de vàlides amb una fitxa de la mà.
    const board = [[t('red', 1), t('red', 2), t('red', 3), t('red', 4), t('red', 5)]];
    const state = makeState({ racks: [[t('red', 6), t('red', 9)], []], board, hasOpened: [true, true] });
    const next = applyMove(state, {
      type: 'play',
      board: [
        [t('red', 1), t('red', 2), t('red', 3)],
        [t('red', 4), t('red', 5), t('red', 6)],
      ],
    });
    expect(next.board).toHaveLength(2);
    expect(next.players[0].rack.map((x) => x.id)).toEqual(['red-9-a']);
  });

  it('no deixa retirar fitxes de la taula ni jugar sense afegir-ne cap', () => {
    const board = [[t('red', 1), t('blue', 1), t('black', 1)]];
    const state = makeState({ racks: [[t('orange', 5)], []], board, hasOpened: [true, true] });
    expectRulesError(() => applyMove(state, { type: 'play', board: [] }), 'TILE_REMOVED');
    expectRulesError(() => applyMove(state, { type: 'play', board }), 'NO_TILES_PLAYED');
  });

  it('rebutja fitxes que no són ni a la taula ni a la mà, i taules no vàlides', () => {
    const state = makeState({ racks: [[t('red', 1), t('blue', 1)], []], hasOpened: [true, true] });
    expectRulesError(
      () => applyMove(state, { type: 'play', board: [[t('red', 1), t('blue', 1), t('black', 1)]] }),
      'FOREIGN_TILE',
    );
    expectRulesError(
      () => applyMove(state, { type: 'play', board: [[t('red', 1), t('blue', 1)]] }),
      'INVALID_MELD',
    );
  });
});

describe('final de partida', () => {
  it('qui es queda sense fitxes guanya, i la puntuació quadra', () => {
    const state = makeState({
      racks: [
        [t('red', 10), t('blue', 10), t('black', 10)],
        [t('orange', 5), joker('a')],
      ],
    });
    const finished = applyMove(state, {
      type: 'play',
      board: [[t('red', 10), t('blue', 10), t('black', 10)]],
    });
    expect(finished.status).toBe('finished');
    expect(finished.winnerId).toBe('p1');
    // El perdedor té 5 + 30 (joker) = 35 punts pendents.
    expect(finalScores(finished)).toEqual([
      { playerId: 'p1', name: 'Jugador 1', points: 35 },
      { playerId: 'p2', name: 'Jugador 2', points: -35 },
    ]);
    expectRulesError(() => applyMove(finished, { type: 'draw' }), 'GAME_FINISHED');
  });
});

describe('la taula no admet mai jugades incompletes', () => {
  // Regressió d'un informe de jugador: «fitxes soles al tauler sense error».
  // El motor no pot acceptar mai una taula amb jugades de menys de 3 fitxes;
  // el que es veu a mig torn és la còpia de treball, que la interfície marca.
  it('rebutja una fitxa sola i una parella, encara que la resta sigui vàlida', () => {
    const state = makeState({
      racks: [[t('red', 10), t('blue', 10), t('black', 10), t('orange', 5)], [t('blue', 2)]],
    });

    expect(() =>
      applyMove(state, { type: 'play', board: [[t('red', 10)]] }),
    ).toThrowError(/com a mínim 3/);

    expect(() =>
      applyMove(state, {
        type: 'play',
        board: [
          [t('red', 10), t('blue', 10), t('black', 10)],
          [t('orange', 5)],
        ],
      }),
    ).toThrowError(/com a mínim 3/);
  });
});
