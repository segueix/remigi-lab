import { INITIAL_MELD_POINTS, INITIAL_RACK_SIZE } from './constants';
import { analyzeMeld } from './melds';
import { randomSeed } from './random';
import { rackPoints } from './scoring';
import { shuffledBag } from './tiles';
import type { GameConfig, GameState, Meld, Move, PlayerState } from './types';

/**
 * Error de regles: el moviment no és legal. `code` és estable (per als tests i la
 * lògica de la UI) i `message` és el text en català per ensenyar al jugador.
 */
export class RulesError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'RulesError';
  }
}

/** Crea una partida nova amb les fitxes barrejades i 14 fitxes per jugador. */
export function createGame(config: GameConfig): GameState {
  if (config.players.length < 2 || config.players.length > 4) {
    throw new RulesError('BAD_PLAYER_COUNT', 'calen entre 2 i 4 jugadors');
  }
  const firstPlayer = config.firstPlayer ?? 0;
  if (!Number.isInteger(firstPlayer) || firstPlayer < 0 || firstPlayer >= config.players.length) {
    throw new RulesError('BAD_FIRST_PLAYER', 'el jugador que comença no existeix');
  }
  const seed = config.seed ?? randomSeed();
  const bag = shuffledBag(seed);
  const players: PlayerState[] = config.players.map((setup, i) => ({
    id: `p${i + 1}`,
    name: setup.name,
    kind: setup.kind,
    aiLevel: setup.aiLevel,
    rack: bag.slice(i * INITIAL_RACK_SIZE, (i + 1) * INITIAL_RACK_SIZE),
    hasOpened: false,
  }));
  return {
    seed,
    bag: bag.slice(players.length * INITIAL_RACK_SIZE),
    board: [],
    players,
    currentPlayer: firstPlayer,
    turn: 1,
    consecutivePasses: 0,
    status: 'playing',
  };
}

export function currentPlayer(state: GameState): PlayerState {
  return state.players[state.currentPlayer];
}

/**
 * Aplica un moviment del jugador actual i retorna l'estat nou (l'anterior no es
 * modifica). Si el moviment no és legal, llança un RulesError explicant per què.
 */
export function applyMove(state: GameState, move: Move): GameState {
  if (state.status !== 'playing') {
    throw new RulesError('GAME_FINISHED', 'la partida ja ha acabat');
  }
  return move.type === 'draw' ? applyDraw(state) : applyPlay(state, move.board);
}

function applyDraw(state: GameState): GameState {
  if (state.bag.length === 0) {
    // Sense fitxes al sac, robar és passar. Si tothom passa seguit, la partida
    // queda bloquejada i guanya qui té menys punts pendents a la mà.
    const consecutivePasses = state.consecutivePasses + 1;
    if (consecutivePasses >= state.players.length) {
      return finishBlocked({ ...state, consecutivePasses });
    }
    return advanceTurn({ ...state, consecutivePasses });
  }
  const drawn = state.bag[0];
  const players = state.players.map((p, i) =>
    i === state.currentPlayer ? { ...p, rack: [...p.rack, drawn] } : p,
  );
  return advanceTurn({ ...state, bag: state.bag.slice(1), players, consecutivePasses: 0 });
}

function applyPlay(state: GameState, newBoard: Meld[]): GameState {
  const player = currentPlayer(state);

  // 1) Totes les jugades de la taula proposada han de ser vàlides.
  newBoard.forEach((meld, i) => {
    const info = analyzeMeld(meld);
    if (!info.valid) {
      throw new RulesError('INVALID_MELD', `la jugada ${i + 1} no és vàlida: ${info.reason}`);
    }
  });

  // 2) Conservació de fitxes: la taula nova ha de ser exactament la taula antiga
  //    més una o més fitxes de la mà del jugador, sense repetits ni desaparicions.
  const newIds = newBoard.flat().map((t) => t.id);
  const newIdSet = new Set(newIds);
  if (newIdSet.size !== newIds.length) {
    throw new RulesError('DUPLICATED_TILE', 'hi ha fitxes repetides a la taula proposada');
  }
  const oldIds = new Set(state.board.flat().map((t) => t.id));
  const rackIds = new Set(player.rack.map((t) => t.id));
  for (const id of newIds) {
    if (!oldIds.has(id) && !rackIds.has(id)) {
      throw new RulesError('FOREIGN_TILE', `la fitxa ${id} no és ni a la taula ni a la teva mà`);
    }
  }
  for (const id of oldIds) {
    if (!newIdSet.has(id)) {
      throw new RulesError('TILE_REMOVED', `no es poden retirar fitxes de la taula (hi falta ${id})`);
    }
  }
  const playedIds = new Set(newIds.filter((id) => !oldIds.has(id)));
  if (playedIds.size === 0) {
    throw new RulesError('NO_TILES_PLAYED', "has d'afegir com a mínim una fitxa de la teva mà");
  }

  // 3) Sortida inicial: fins que no ha obert, el jugador no pot tocar la taula i
  //    ha de baixar jugades noves, només amb fitxes seves, que sumin 30 punts.
  if (!player.hasOpened) {
    const oldKeys = new Set(state.board.map(meldKey));
    const keptCount = newBoard.filter((m) => oldKeys.has(meldKey(m))).length;
    if (keptCount !== state.board.length) {
      throw new RulesError(
        'REARRANGE_BEFORE_OPENING',
        'no pots modificar la taula abans de fer la sortida inicial',
      );
    }
    const newMelds = newBoard.filter((m) => !oldKeys.has(meldKey(m)));
    const points = newMelds.reduce((sum, m) => sum + analyzeMeld(m).points, 0);
    if (points < INITIAL_MELD_POINTS) {
      throw new RulesError(
        'OPENING_TOO_LOW',
        `la sortida inicial demana ${INITIAL_MELD_POINTS} punts i n'has jugat ${points}`,
      );
    }
  }

  const newRack = player.rack.filter((t) => !playedIds.has(t.id));
  const players = state.players.map((p, i) =>
    i === state.currentPlayer ? { ...p, rack: newRack, hasOpened: true } : p,
  );
  const next: GameState = { ...state, board: newBoard, players, consecutivePasses: 0 };
  if (newRack.length === 0) {
    return { ...next, status: 'finished', winnerId: player.id };
  }
  return advanceTurn(next);
}

/** Clau d'una jugada independent de l'ordre intern (els ids són únics). */
function meldKey(meld: Meld): string {
  return meld
    .map((t) => t.id)
    .sort()
    .join('|');
}

function advanceTurn(state: GameState): GameState {
  return {
    ...state,
    currentPlayer: (state.currentPlayer + 1) % state.players.length,
    turn: state.turn + 1,
  };
}

function finishBlocked(state: GameState): GameState {
  let best = 0;
  for (let i = 1; i < state.players.length; i++) {
    if (rackPoints(state.players[i].rack) < rackPoints(state.players[best].rack)) best = i;
  }
  return { ...state, status: 'finished', winnerId: state.players[best].id };
}
