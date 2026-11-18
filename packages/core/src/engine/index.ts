/**
 * API pública del motor Remigi: la frontera entre el joc i la seva IA.
 *
 * La resta del projecte (app web, simulador, eines) ha d'importar el motor
 * d'aquí (via `@remigi/core`), mai de les peces internes d'`ai/`. Aquesta és
 * també l'entrada del build que genera `dist/remigi-engine.js`: tot el que
 * s'exporta aquí és el contracte estable que una versió futura del motor ha
 * de continuar oferint per ser intercanviable amb aquesta.
 *
 * El contracte del motor pròpiament dit són tres coses: `ENGINE_VERSION`,
 * `createEngine` i els tipus que l'acompanyen. La resta són els tipus de
 * l'estat que el motor rep, els nivells de dificultat que accepta i un joc
 * mínim de regles i RNG perquè l'artefacte empaquetat pugui fer anar partides
 * senceres tot sol (simulacions amb Node, sense l'app).
 */

// El motor: versió, creació i càlcul de jugada.
export { ENGINE_VERSION } from './version';
export { createEngine } from './engine';
export type {
  RemigiEngine,
  EngineOptions,
  EnginePlayOptions,
  EngineAnalyzeOptions,
  EngineDiagnostics,
  EngineDecision,
  EngineAnalysis,
} from './engine';

// Tipus de l'estat que el motor rep i del moviment que retorna.
export type {
  GameState,
  GameStatus,
  GameConfig,
  Move,
  Meld,
  Tile,
  NumberTile,
  JokerTile,
  TileColor,
  PlayerState,
  PlayerSetup,
  PlayerKind,
} from '../core/types';
export type { PlayCandidate } from '../ai/solver';

// Nivells de dificultat: la configuració pública del motor.
export {
  DIFFICULTIES,
  DIFFICULTY_ORDER,
  DEFAULT_DIFFICULTY,
  difficultyByKey,
  difficultyByRating,
} from '../ai/difficulty';
export type { DifficultyKey, AiParams } from '../ai/difficulty';

// Regles i RNG mínims perquè l'artefacte del motor pugui jugar partides tot
// sol: crear-la, aplicar-hi moviments, puntuar-la i reproduir-la amb llavor.
export { createGame, applyMove, currentPlayer, RulesError } from '../core/game';
export { finalScores } from '../core/scoring';
export { createRng, randomSeed } from '../core/random';
export type { Rng } from '../core/random';
export { TOTAL_TILES } from '../core/constants';
