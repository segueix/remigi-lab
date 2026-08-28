import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { applyMove, createGame } from '../src/core/game';
import { finalScores } from '../src/core/scoring';
import { createEngine } from '../src/engine/engine';
import baseline from './fixtures/engine-baseline.json';
import {
  BASELINE_LEVELS,
  BASELINE_SEEDS,
  baselinePlayers,
  createTrajectoryAccumulator,
  type GameFingerprint,
} from './trajectory';

/**
 * Regressió comportamental del motor: les partides de referència es van
 * capturar amb el codi ANTERIOR a la refactorització (cridant `decideAiMove`
 * directament) i aquí es tornen a jugar per l'API pública del motor. Cada
 * moviment de cada torn ha de ser exactament el mateix: la refactorització no
 * pot canviar ni una jugada de cap nivell.
 *
 * Si mai es canvia la IA a consciència (un motor que jugui diferent), el
 * baseline es regenera amb `UPDATE_ENGINE_BASELINE=1 npx vitest run
 * test/engineRegression.test.ts` — i llavors el canvi de comportament queda
 * assumit i escrit al diff del fixture.
 */

const MAX_TURNS = 1000;

function playFingerprint(level: string, seed: number): GameFingerprint {
  let state = createGame({ seed, players: baselinePlayers(level) });
  const engine = createEngine({ seed: seed + 1 });
  const acc = createTrajectoryAccumulator();

  while (state.status === 'playing' && state.turn <= MAX_TURNS) {
    const player = state.currentPlayer;
    const { move } = engine.play(state, { playerIndex: player });
    acc.record(state, player, move);
    state = applyMove(state, move);
  }
  expect(state.status).toBe('finished');

  return {
    level,
    seed,
    turns: state.turn,
    winner: state.players.findIndex((p) => p.id === state.winnerId),
    finalScores: finalScores(state).map((s) => s.points),
    moveTypes: acc.moveTypes(),
    trajectoryHash: acc.hash(),
  };
}

describe('regressió comportamental: el motor juga exactament com abans', () => {
  const games = baseline.games as GameFingerprint[];

  it('el baseline cobreix tots els nivells i totes les llavors previstes', () => {
    expect(games).toHaveLength(BASELINE_LEVELS.length * BASELINE_SEEDS.length);
    for (const level of BASELINE_LEVELS) {
      expect(games.filter((g) => g.level === level)).toHaveLength(BASELINE_SEEDS.length);
    }
  });

  for (const level of BASELINE_LEVELS) {
    // L'expert juga amb 500.000 nodes des de la v1.1.0: les seves 5 partides
    // de referència demanen més temps que el límit per defecte de vitest.
    it(`nivell ${level}: mateixes jugades a totes les partides de referència`, { timeout: 60_000 }, () => {
      for (const seed of BASELINE_SEEDS) {
        const expected = games.find((g) => g.level === level && g.seed === seed)!;
        const replayed = playFingerprint(level, seed);
        expect(replayed, `nivell ${level}, llavor ${seed}`).toEqual(expected);
      }
    });
  }

  if (process.env.UPDATE_ENGINE_BASELINE) {
    it('regenera el baseline (UPDATE_ENGINE_BASELINE)', { timeout: 300_000 }, () => {
      const regenerated: GameFingerprint[] = [];
      for (const level of BASELINE_LEVELS) {
        for (const seed of BASELINE_SEEDS) regenerated.push(playFingerprint(level, seed));
      }
      const dir = fileURLToPath(new URL('./fixtures', import.meta.url));
      mkdirSync(dir, { recursive: true });
      writeFileSync(
        `${dir}/engine-baseline.json`,
        JSON.stringify(
          { generatedWith: `engine API (regenerat a consciència)`, games: regenerated },
          null,
          2,
        ) + '\n',
      );
    });
  }
});
