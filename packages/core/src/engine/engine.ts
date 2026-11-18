import { decideAiMove, type AiDecisionStats } from '../ai/aiPlayer';
import { difficultyByKey, difficultyByRating, withOverrides, type AiParams, type DifficultyKey } from '../ai/difficulty';
import { chooseBestPlay, type PlayCandidate } from '../ai/solver';
import { createRng, type Rng } from '../core/random';
import type { GameState, Move } from '../core/types';
import { ENGINE_VERSION } from './version';

/**
 * El motor Remigi: la IA del joc encapsulada rere una API petita i estable,
 * a l'estil d'un motor d'escacs. Rep un estat de partida (JSON pur) i retorna
 * la jugada triada amb el seu diagnòstic; no sap res de React, del DOM ni de
 * cap emmagatzematge, així que funciona igual a la web, en un Web Worker o en
 * un procés de Node.
 *
 * Les implementacions de debò continuen a `ai/` (solver, reordenació,
 * dificultat): aquesta capa només hi posa la porta. Una correcció al solver
 * afecta alhora l'app i l'artefacte `dist/remigi-engine.js`, perquè tots dos
 * surten d'aquí.
 */

export interface EngineOptions {
  /**
   * Llavor del RNG dels errors humans simulats: amb la mateixa llavor, el
   * mateix estat i la mateixa configuració, el motor decideix el mateix.
   * El RNG és seqüencial: decisions successives del mateix motor consumeixen
   * la mateixa seqüència (per reproduir una partida sencera, un motor nou amb
   * la mateixa llavor).
   */
  seed?: number;
  /** RNG propi, amb preferència sobre `seed`. Per defecte, Math.random. */
  rng?: Rng;
}

export interface EnginePlayOptions {
  /** Jugador per qui es decideix; per defecte, el que té el torn. */
  playerIndex?: number;
  /**
   * Nivell amb què jugar; per defecte, l'`aiLevel` del jugador dins de l'estat
   * (o el nivell per defecte si no en té).
   */
  level?: DifficultyKey;
  /** Força contínua, amb preferència sobre level. */
  rating?: number;
  /**
   * Ajusta el nivell segons com va el jugador humà (rubber banding): la
   * probabilitat d'error i la proporció de torns amb reordenació.
   */
  rubberBanding?: boolean;
  /** Substitueix paràmetres concrets del nivell (proves i comparatives). */
  overrides?: Partial<AiParams>;
  /** Sostre de nodes de la cerca de reordenació (per defecte, el del cercador). */
  maxNodes?: number;
}

export interface EngineAnalyzeOptions {
  /** Jugador per qui s'analitza; per defecte, el que té el torn. */
  playerIndex?: number;
  /**
   * Nivell les capacitats del qual limiten l'anàlisi; per defecte, sense cap
   * limitació (jokers, allargaments i reordenació: la força màxima).
   */
  level?: DifficultyKey;
  /** Sostre de nodes de la cerca de reordenació. */
  maxNodes?: number;
}

/** Mètriques d'una decisió o anàlisi. No canvien mai la jugada. */
export interface EngineDiagnostics {
  /** Nodes explorats per la cerca de reordenació (0 si no s'ha engegat). */
  nodes: number;
  /** La cerca de reordenació ha tocat el sostre de nodes i s'ha abandonat. */
  searchLimited: boolean;
  /** La proposta ve de la reordenació completa de la taula, no de l'heurística voraç. */
  rearrangeUsed: boolean;
  /**
   * El cercador havia trobat jugada. Si tot i això el moviment és robar, és
   * l'error humà simulat del nivell.
   */
  foundPlay: boolean;
  /** Temps de càlcul, en mil·lisegons. */
  thinkingTimeMs: number;
  /** Versió del motor que ha produït el resultat. */
  engineVersion: string;
  /** Nivell efectivament aplicat. */
  level: DifficultyKey;
}

export interface EngineDecision extends EngineDiagnostics {
  /** El moviment triat, llest per passar a `applyMove`. */
  move: Move;
  /** Fitxes de la mà que el moviment baixa a la taula (0 si roba). */
  tilesPlayed: number;
}

export interface EngineAnalysis extends EngineDiagnostics {
  /** La millor jugada trobada, o null si l'únic possible és robar. */
  bestPlay: PlayCandidate | null;
}

export interface RemigiEngine {
  /** Versió del motor (la mateixa que `ENGINE_VERSION`). */
  readonly version: string;
  /** Decideix el moviment d'un jugador: la crida de cada torn d'un bot. */
  play(state: GameState, options?: EnginePlayOptions): EngineDecision;
  /**
   * Millor jugada possible d'una posició, sense errors humans ni RNG: sempre
   * determinista. És la crida de les anàlisis (jeroglífics, comparatives).
   */
  analyze(state: GameState, options?: EngineAnalyzeOptions): EngineAnalysis;
}

/** Rellotge monòton si n'hi ha (Node i navegadors el tenen); si no, Date. */
const now: () => number =
  typeof performance !== 'undefined' ? () => performance.now() : () => Date.now();

function emptyStats(): AiDecisionStats {
  return { nodes: 0, searchLimited: false, rearrangeUsed: false, foundPlay: false };
}

/** Crea un motor. Sense opcions no és determinista (Math.random); amb `seed`, sí. */
export function createEngine(options: EngineOptions = {}): RemigiEngine {
  const rng: Rng =
    options.rng ?? (options.seed !== undefined ? createRng(options.seed) : Math.random);

  return {
    version: ENGINE_VERSION,

    play(state, playOptions = {}) {
      const playerIndex = playOptions.playerIndex ?? state.currentPlayer;
      // El nivell demanat es converteix en substitucions completes de
      // paràmetres: així la decisió passa pel mateix `decideAiMove` de sempre.
      const overrides = playOptions.rating !== undefined
        ? withOverrides(difficultyByRating(playOptions.rating), playOptions.overrides)
        : playOptions.level
        ? withOverrides(difficultyByKey(playOptions.level), playOptions.overrides)
        : playOptions.overrides;
      const stats = emptyStats();

      const started = now();
      const move = decideAiMove(state, playerIndex, rng, {
        rubberBanding: playOptions.rubberBanding,
        overrides,
        maxNodes: playOptions.maxNodes,
        stats,
      });
      const thinkingTimeMs = now() - started;

      return {
        move,
        tilesPlayed: tilesPlayed(state, move),
        level: effectiveLevel(state, playerIndex, playOptions.level, overrides),
        thinkingTimeMs,
        engineVersion: ENGINE_VERSION,
        ...stats,
      };
    },

    analyze(state, analyzeOptions = {}) {
      const playerIndex = analyzeOptions.playerIndex ?? state.currentPlayer;
      const params = analyzeOptions.level ? difficultyByKey(analyzeOptions.level) : null;
      const stats = emptyStats();

      const started = now();
      const bestPlay = chooseBestPlay(state, playerIndex, {
        allowJokers: params?.usesJokers ?? true,
        allowExtensions: params?.extendsBoard ?? true,
        allowRearrange: params?.rearrangesTable ?? true,
        maxNodes: analyzeOptions.maxNodes,
        stats,
      });
      const thinkingTimeMs = now() - started;
      stats.foundPlay = bestPlay !== null;

      return {
        bestPlay,
        level: analyzeOptions.level ?? 'expert',
        thinkingTimeMs,
        engineVersion: ENGINE_VERSION,
        ...stats,
      };
    },
  };
}

/** Fitxes del moviment que no eren a la taula: les que baixen de la mà. */
function tilesPlayed(state: GameState, move: Move): number {
  if (move.type !== 'play') return 0;
  const before = new Set(state.board.flat().map((tile) => tile.id));
  let played = 0;
  for (const meld of move.board) {
    for (const tile of meld) if (!before.has(tile.id)) played++;
  }
  return played;
}

function effectiveLevel(
  state: GameState,
  playerIndex: number,
  requested: DifficultyKey | undefined,
  overrides: Partial<AiParams> | undefined,
): DifficultyKey {
  return (
    overrides?.key ?? requested ?? difficultyByKey(state.players[playerIndex]?.aiLevel).key
  );
}
