/**
 * Simulador de partides IA contra IA per validar el motor i mesurar els canvis:
 *
 *   npm run simulate                     # 20 partides Expert vs Mitjà vs Novell
 *   npm run simulate -- --games 200      # més partides
 *   npm run simulate -- --seed 7         # una altra llavor inicial
 *   npm run simulate -- --no-rearrange   # expert sense reordenació de taula
 *   npm run simulate -- --duel 200       # expert nou contra expert antic
 *   npm run simulate -- --ladder 200     # duels entre cada nivell i el següent
 *   npm run simulate -- --rubber 200     # «humà» d'Avançat contra dos experts, amb ajust i sense
 *
 * Les jugades es demanen a l'API pública del motor (engine/), la mateixa que fa
 * servir l'app: el que es mesura aquí és exactament el que jugarà la web.
 * A cada torn es comprova l'invariant de conservació: sac + taula + mans = 106,
 * i es recull el temps i els nodes de cada decisió del jugador mesurat.
 */
import {
  DIFFICULTIES,
  DIFFICULTY_ORDER,
  ENGINE_VERSION,
  TOTAL_TILES,
  applyMove,
  createEngine,
  createGame,
  finalScores,
} from '../engine';
import type { DifficultyKey, GameState } from '../engine';

const MAX_TURNS = 1000;

function argValue(name: string, fallback: number): number {
  const index = process.argv.indexOf(`--${name}`);
  const value = index >= 0 ? Number(process.argv[index + 1]) : NaN;
  return Number.isFinite(value) ? value : fallback;
}

const hasFlag = (name: string) => process.argv.includes(`--${name}`);

function countTiles(state: GameState): number {
  return (
    state.bag.length +
    state.board.reduce((sum, meld) => sum + meld.length, 0) +
    state.players.reduce((sum, player) => sum + player.rack.length, 0)
  );
}

interface Timing {
  /** Mil·lisegons de cada decisió del jugador que ens interessa mesurar. */
  samples: number[];
  /** Nodes de cerca de cada decisió del mateix jugador. */
  nodes: number[];
}

/** Juga una partida sencera i retorna l'estat final. */
function playGame(
  seed: number,
  names: string[],
  levels: string[],
  rearrangeFor: boolean[],
  timing: Timing,
  measuredPlayer: number,
): GameState {
  let state = createGame({
    seed,
    players: names.map((name, i) => ({ name, kind: 'ai' as const, aiLevel: levels[i] })),
  });
  // Mateixa llavor, mateixa partida: el motor arrossega el RNG dels errors
  // humans, així que un motor nou per partida la fa reproduïble de cap a cap.
  const engine = createEngine({ seed: seed + 1 });

  while (state.status === 'playing' && state.turn <= MAX_TURNS) {
    const player = state.currentPlayer;
    const overrides = rearrangeFor[player] ? undefined : { rearrangesTable: false };
    const decision = engine.play(state, { playerIndex: player, overrides });
    if (player === measuredPlayer) {
      timing.samples.push(decision.thinkingTimeMs);
      timing.nodes.push(decision.nodes);
    }

    state = applyMove(state, decision.move);
    if (countTiles(state) !== TOTAL_TILES) {
      throw new Error(`S'ha trencat la conservació de fitxes al torn ${state.turn}`);
    }
  }
  if (state.status !== 'finished') {
    throw new Error(`La partida amb llavor ${seed} no ha acabat en ${MAX_TURNS} torns`);
  }
  return state;
}

function summariseTiming(timing: Timing): string {
  if (timing.samples.length === 0) return 'sense mesures';
  const sorted = [...timing.samples].sort((a, b) => a - b);
  const mean = sorted.reduce((a, b) => a + b, 0) / sorted.length;
  const p95 = sorted[Math.floor(sorted.length * 0.95)];
  return `mitjana ${mean.toFixed(1)} ms · p95 ${p95.toFixed(1)} ms · pitjor ${sorted.at(-1)!.toFixed(1)} ms`;
}

function summariseNodes(timing: Timing): string {
  const explored = timing.nodes.filter((n) => n > 0);
  if (explored.length === 0) return 'cap cerca de reordenació';
  const mean = explored.reduce((a, b) => a + b, 0) / explored.length;
  return `mitjana ${Math.round(mean)} · màxim ${Math.max(...explored)} (en ${explored.length} cerques)`;
}

/** Expert amb reordenació contra expert sense, a igualtat de repartiment. */
function duel(games: number, baseSeed: number): void {
  const timing: Timing = { samples: [], nodes: [] };
  const timingOld: Timing = { samples: [], nodes: [] };
  const wins = { nou: 0, antic: 0 };

  for (let i = 0; i < games; i++) {
    // Es juguen les dues meitats bescanviant la posició, perquè començar
    // primer no decideixi la comparativa.
    const seed = baseSeed + i * 1000;
    const newFirst = i % 2 === 0;
    const state = playGame(
      seed,
      newFirst ? ['Expert nou', 'Expert antic'] : ['Expert antic', 'Expert nou'],
      ['expert', 'expert'],
      newFirst ? [true, false] : [false, true],
      newFirst ? timing : timingOld,
      0,
    );
    const winner = state.players.find((p) => p.id === state.winnerId)!.name;
    if (winner === 'Expert nou') wins.nou++;
    else wins.antic++;
  }

  console.log(`Duel a ${games} partides (mateix repartiment, alternant qui comença):`);
  const percent = (n: number) => ((100 * n) / games).toFixed(0);
  console.log(`  Expert amb reordenació:  ${String(wins.nou).padStart(3)} victòries (${percent(wins.nou)}%)`);
  console.log(`  Expert sense reordenació:${String(wins.antic).padStart(3)} victòries (${percent(wins.antic)}%)`);
  console.log(`  Temps de decisió amb reordenació: ${summariseTiming(timing)}`);
  console.log(`  Temps de decisió sense:           ${summariseTiming(timingOld)}`);
}

/**
 * Partida amb nivells i tipus de jugador a mida (sense mesures de temps). Un
 * jugador `human` el juga igualment el motor al seu nivell: serveix per veure
 * què fa l'ajust dins de la partida, que només mira els humans.
 */
function playCustom(
  seed: number,
  players: { name: string; level: DifficultyKey; human?: boolean }[],
  rubberBanding = false,
): GameState {
  let state = createGame({
    seed,
    players: players.map((p) => ({ name: p.name, kind: 'ai' as const, aiLevel: p.level })),
  });
  state = {
    ...state,
    players: state.players.map((p, i) => (players[i].human ? { ...p, kind: 'human' as const } : p)),
  };
  const engine = createEngine({ seed: seed + 1 });
  while (state.status === 'playing' && state.turn <= MAX_TURNS) {
    const player = state.currentPlayer;
    const bot = state.players[player].kind !== 'human';
    state = applyMove(state, engine.play(state, { playerIndex: player, rubberBanding: bot && rubberBanding }).move);
  }
  if (state.status !== 'finished') {
    throw new Error(`La partida amb llavor ${seed} no ha acabat en ${MAX_TURNS} torns`);
  }
  return state;
}

const winnerName = (state: GameState) => state.players.find((p) => p.id === state.winnerId)?.name;

/** Duels a dos entre cada nivell i el següent, alternant qui comença. */
function ladder(games: number, baseSeed: number): void {
  console.log(`Escala de nivells (${games} duels per parella, alternant qui comença):`);
  for (let i = 1; i < DIFFICULTY_ORDER.length; i++) {
    const weak = DIFFICULTIES[DIFFICULTY_ORDER[i - 1]];
    const strong = DIFFICULTIES[DIFFICULTY_ORDER[i]];
    let strongWins = 0;
    for (let g = 0; g < games; g++) {
      const pair = [
        { name: strong.label, level: strong.key },
        { name: weak.label, level: weak.key },
      ];
      if (g % 2 === 1) pair.reverse();
      if (winnerName(playCustom(baseSeed + g * 1000, pair)) === strong.label) strongWins++;
    }
    const expected = 100 / (1 + 10 ** ((weak.rating - strong.rating) / 400));
    console.log(
      `  ${strong.label.padEnd(8)} contra ${weak.label.padEnd(8)} ${String(Math.round((100 * strongWins) / games)).padStart(3)}%` +
        `  (l'Elo n'espera ${Math.round(expected)}%)`,
    );
  }
}

/**
 * El cas que va motivar l'ajust de la reordenació: un jugador que juga com
 * l'Avançat, marcat com a humà, contra dos experts, amb l'ajust i sense.
 */
function rubber(games: number, baseSeed: number): void {
  console.log(`«Humà» d'Avançat contra dos experts (${games} partides, rotant qui comença):`);
  for (const rubberBanding of [false, true]) {
    let wins = 0;
    for (let g = 0; g < games; g++) {
      const table = [
        { name: 'Humà', level: 'advanced' as const, human: true },
        { name: 'Expert A', level: 'expert' as const },
        { name: 'Expert B', level: 'expert' as const },
      ];
      const rotated = [...table.slice(g % 3), ...table.slice(0, g % 3)];
      if (winnerName(playCustom(baseSeed + g * 1000, rotated, rubberBanding)) === 'Humà') wins++;
    }
    console.log(
      `  ${rubberBanding ? 'Amb ajust ' : 'Sense ajust'}: l'humà guanya el ${Math.round((100 * wins) / games)}%` +
        ' (a parts iguals seria el 33%)',
    );
  }
}

function main(): void {
  console.log(`Motor remigi-engine v${ENGINE_VERSION}\n`);
  const baseSeed = argValue('seed', 42);
  const duelGames = argValue('duel', 0);
  if (duelGames > 0) return duel(duelGames, baseSeed);
  const ladderGames = argValue('ladder', 0);
  if (ladderGames > 0) return ladder(ladderGames, baseSeed);
  const rubberGames = argValue('rubber', 0);
  if (rubberGames > 0) return rubber(rubberGames, baseSeed);

  const games = argValue('games', 20);
  const rearrange = !hasFlag('no-rearrange');
  const wins = new Map<string, number>();
  const timing: Timing = { samples: [], nodes: [] };
  let totalTurns = 0;

  for (let i = 0; i < games; i++) {
    const state = playGame(
      baseSeed + i * 1000,
      ['Expert', 'Mitjà', 'Novell'],
      ['expert', 'medium', 'rookie'],
      [rearrange, true, true],
      timing,
      0,
    );
    const winner = state.players.find((p) => p.id === state.winnerId);
    if (winner) wins.set(winner.name, (wins.get(winner.name) ?? 0) + 1);
    totalTurns += state.turn;

    if (i === 0) {
      console.log(`Exemple (llavor ${state.seed}), puntuació final:`);
      for (const score of finalScores(state)) {
        console.log(`  ${score.name.padEnd(8)} ${score.points >= 0 ? '+' : ''}${score.points}`);
      }
      console.log('');
    }
  }

  console.log(
    `Resultats de ${games} partides (Expert${rearrange ? '' : ' SENSE reordenació'} vs Mitjà vs Novell):`,
  );
  for (const name of ['Expert', 'Mitjà', 'Novell']) {
    const count = wins.get(name) ?? 0;
    console.log(
      `  ${name.padEnd(8)} ${String(count).padStart(3)} victòries (${((100 * count) / games).toFixed(0)}%)`,
    );
  }
  console.log(`Mitjana de torns per partida: ${(totalTurns / games).toFixed(1)}`);
  console.log(`Temps de decisió de l'expert: ${summariseTiming(timing)}`);
  console.log(`Nodes de reordenació de l'expert: ${summariseNodes(timing)}`);
}

main();
