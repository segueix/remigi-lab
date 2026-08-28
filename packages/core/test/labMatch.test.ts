import { describe, expect, it } from 'vitest';
import {
  applyMove,
  createEngine,
  createGame,
  type GameState,
} from '../src/engine';
import { engineSpecById } from '../src/lab/catalog';
import {
  createMatch,
  playMatch,
  seatEngineSeed,
  type LabTurn,
  type MatchResult,
} from '../src/lab/match';

/** Còpia d'un resultat sense els temps, que no són deterministes. */
function withoutTimes(result: MatchResult) {
  const clean = structuredClone(result) as MatchResult & Record<string, unknown>;
  clean.totals.A.thinkingTimeMs = 0;
  clean.totals.B.thinkingTimeMs = 0;
  return clean;
}

function turnsWithoutTimes(turns: readonly LabTurn[]) {
  return turns.map(({ thinkingTimeMs: _dropped, ...rest }) => rest);
}

describe('partida Motor A vs Motor B', () => {
  it('una partida sencera acaba, amb guanyador i punts que sumen zero', () => {
    const result = playMatch({ engineA: 'medium-v1', engineB: 'easy-v1', seed: 11 });
    expect(result.error).toBeUndefined();
    expect(result.winner === 'A' || result.winner === 'B').toBe(true);
    expect(result.points.A + result.points.B).toBe(0);
    expect(result.turns).toBeGreaterThan(2);
    expect(result.totals.A.moves + result.totals.B.moves).toBeGreaterThan(2);
  });

  it('mateixa configuració → mateix resultat, torn a torn (reproducció per llavor)', () => {
    const setup = { engineA: 'expert-v1', engineB: 'challenger-30k', seed: 7 } as const;
    const first = createMatch(setup);
    while (!first.done) first.step();
    const second = createMatch(setup);
    while (!second.done) second.step();

    expect(turnsWithoutTimes(second.turns)).toEqual(turnsWithoutTimes(first.turns));
    expect(withoutTimes(second.result()!)).toEqual(withoutTimes(first.result()!));
  });

  it('el pas a pas i la partida de cop són la mateixa partida', () => {
    const setup = { engineA: 'medium-v1', engineB: 'rookie-v1', seed: 21 } as const;
    const stepped = createMatch(setup);
    let steps = 0;
    while (stepped.step() !== null) steps++;
    const whole = playMatch(setup);
    expect(steps).toBe(stepped.turns.length);
    expect(withoutTimes(stepped.result()!)).toEqual(withoutTimes(whole));
  });

  it('bescanviar els seients amb la mateixa llavor fa jugar la mà de l’altre', () => {
    const aFirst = createMatch({ engineA: 'medium-v1', engineB: 'easy-v1', seed: 5, firstSeat: 'A' });
    const bFirst = createMatch({ engineA: 'medium-v1', engineB: 'easy-v1', seed: 5, firstSeat: 'B' });
    // El repartiment només depèn de la llavor: el primer seient rep les
    // mateixes fitxes sigui quin sigui el motor que hi seu.
    expect(bFirst.state.players[0].rack).toEqual(aFirst.state.players[0].rack);
    expect(aFirst.seatOf).toEqual(['A', 'B']);
    expect(bFirst.seatOf).toEqual(['B', 'A']);
    expect(aFirst.seats[0].id).toBe('medium-v1');
    expect(bFirst.seats[0].id).toBe('easy-v1');
  });

  it('cada seient té el seu motor: les mètriques d’A no contaminen B', () => {
    // El novell s'equivoca un 35% dels cops (consumeix RNG a cada decisió) i
    // no reordena mai: si compartís motor, RNG o comptadors amb l'expert, les
    // errades i les mètriques es barrejarien entre costats.
    const run = createMatch({ engineA: 'expert-v1', engineB: 'rookie-v1', seed: 9 });
    while (!run.done) run.step();
    const result = run.result()!;
    // L'expert no falla mai (mistakeRate 0): cap errada del novell no se li
    // pot apuntar, i les reordenacions només poden ser del costat A.
    expect(result.totals.A.mistakes).toBe(0);
    expect(result.totals.B.rearranges).toBe(0);
    expect(result.totals.B.searchLimited).toBe(0);
    for (const turn of run.turns) {
      expect(turn.engineId).toBe(turn.seat === 'A' ? 'expert-v1' : 'rookie-v1');
      if (turn.seat === 'B') expect(turn.nodes).toBe(0);
    }
  });

  it('la telemetria del laboratori no altera cap decisió del motor', () => {
    // La mateixa partida, refeta a mà amb l'API pelada del motor (sense
    // laboratori, sense jeroglífics, sense registres): estat final idèntic.
    const setup = { engineA: 'expert-v1', engineB: 'medium-v1', seed: 13 } as const;
    const lab = createMatch(setup);
    while (!lab.done) lab.step();

    const specs = [engineSpecById('expert-v1'), engineSpecById('medium-v1')];
    let state: GameState = createGame({
      seed: setup.seed,
      players: specs.map((spec) => ({ name: spec.name, kind: 'ai', aiLevel: spec.config.level })),
    });
    const engines = specs.map((spec, seat) =>
      createEngine({ seed: seatEngineSeed(setup.seed, seat as 0 | 1) }),
    );
    while (state.status === 'playing') {
      const seat = state.currentPlayer as 0 | 1;
      const decision = engines[seat].play(state, {
        playerIndex: seat,
        level: specs[seat].config.level,
        overrides: specs[seat].config.overrides,
        maxNodes: specs[seat].config.maxNodes,
      });
      state = applyMove(state, decision.move);
    }
    expect(lab.state).toEqual(state);
  });

  it('el recompte de jeroglífics d’una partida és determinista', () => {
    const setup = { engineA: 'expert-v1', engineB: 'expert-v1', seed: 3 } as const;
    const first = playMatch(setup);
    const second = playMatch(setup);
    expect(second.totals.A.hieroglyphs).toBe(first.totals.A.hieroglyphs);
    expect(second.totals.B.hieroglyphs).toBe(first.totals.B.hieroglyphs);
    expect(second.totals.A.hieroglyphScoreTotal).toBe(first.totals.A.hieroglyphScoreTotal);
    expect(second.totals.A.maxHieroglyph).toEqual(first.totals.A.maxHieroglyph);
  });

  it('amb keepBoards, cada torn conserva la taula per inspeccionar-lo', () => {
    const run = createMatch({ engineA: 'medium-v1', engineB: 'easy-v1', seed: 2, keepBoards: true });
    while (!run.done) run.step();
    expect(run.turns.length).toBeGreaterThan(0);
    for (const turn of run.turns) {
      expect(turn.boardAfter).toBeDefined();
    }
    // L'últim tauler desat és exactament la taula final.
    expect(run.turns.at(-1)!.boardAfter).toEqual(run.state.board);
    // I sense keepBoards no se'n desa cap (memòria continguda als torneigs).
    const lleuger = createMatch({ engineA: 'medium-v1', engineB: 'easy-v1', seed: 2 });
    while (!lleuger.done) lleuger.step();
    expect(lleuger.turns.every((turn) => turn.boardAfter === undefined)).toBe(true);
  });

  it('el marcador provisional són els punts pendents de cada mà', () => {
    const run = createMatch({ engineA: 'medium-v1', engineB: 'easy-v1', seed: 4 });
    const pending = run.pendingPoints();
    expect(pending.A).toBeGreaterThan(0);
    expect(pending.B).toBeGreaterThan(0);
    run.step();
    expect(run.pendingPoints().A).not.toBeNaN();
  });

  it('l’expert de debò produeix reordenacions i jeroglífics mesurables', () => {
    // Partida llarga expert contra expert: en alguna de les llavors petites hi
    // ha d'haver com a mínim una reordenació completa amb complexitat > 0.
    let rearranges = 0;
    let scored = 0;
    for (const seed of [1, 2, 3, 4, 5]) {
      const result = playMatch({ engineA: 'expert-v1', engineB: 'expert-v1', seed });
      rearranges += result.totals.A.rearranges + result.totals.B.rearranges;
      scored += result.totals.A.hieroglyphScoreTotal + result.totals.B.hieroglyphScoreTotal;
    }
    expect(rearranges).toBeGreaterThan(0);
    expect(scored).toBeGreaterThan(0);
  });
});
