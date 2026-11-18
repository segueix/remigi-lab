import { DIFFICULTIES, type DifficultyKey } from '../ai/difficulty';
import { updateTableRating } from './rating';
import { nextAdaptiveProgress, ratingForAdaptiveStep } from './adaptiveDifficulty';

/** Valoració amb què comença tot jugador nou (entre 'easy' i 'medium'). */
export const STARTING_RATING = 1100;

/** Quantes partides es guarden a l'historial del perfil. */
const HISTORY_LIMIT = 50;

export interface GameRecord {
  /** Data ISO de la partida. */
  date: string;
  /** Nivells dels oponents IA. */
  opponents: DifficultyKey[];
  won: boolean;
  /** Com de contundent va ser el resultat, de 0 a 1 (absent als perfils antics). */
  margin?: number;
  /** Valoració del jugador després de la partida. */
  ratingAfter: number;
  /** Si la partida formava part de la progressió adaptativa. */
  adaptive?: boolean;
  /** Força numèrica real dels rivals, congelada en començar. */
  opponentRatings?: number[];
}

/** Resultat d'una partida, amb el marge si es coneix. */
export interface GameOutcome {
  won: boolean;
  /** 0 = molt ajustat, 1 = pallissa. Si no es diu, es fa servir 0,5. */
  margin?: number;
  /** Si s'ha de moure també el nivell adaptatiu. Per defecte, sí. */
  adaptive?: boolean;
  /** Força numèrica real dels rivals, congelada en començar. */
  opponentRatings?: number[];
}

/** Marge neutre: mou la valoració igual que abans de tenir-lo en compte. */
const NEUTRAL_MARGIN = 0.5;

/**
 * Els punts que separen un resultat ajustat d'un de contundent. Amb dos
 * oponents, guanyar per 100 punts ja compta com a pallissa.
 */
const POINTS_FOR_FULL_MARGIN_PER_OPPONENT = 50;

/**
 * Converteix els punts finals del jugador en un marge de 0 a 1. Guanyar (o
 * perdre) per molt compta més que fer-ho per poc.
 */
export function marginFromPoints(points: number, opponentCount: number): number {
  const scale = POINTS_FOR_FULL_MARGIN_PER_OPPONENT * Math.max(1, opponentCount);
  return Math.min(1, Math.abs(points) / scale);
}

export interface PlayerProfile {
  id: string;
  name: string;
  rating: number;
  gamesPlayed: number;
  wins: number;
  history: GameRecord[];
  /** Mig graó adaptatiu: 0 = Novell, 2 = Fàcil, 4 = Mitjà, 6 = Avançat, 8 = Expert. */
  adaptiveStep?: number;
  /** Partides valorades des del darrer calibratge (absent en perfils antics). */
  ratedGames?: number;
  /** Cert fins a la primera derrota o fins a guanyar a Expert. */
  adaptiveCalibrating?: boolean;
}

export function createProfile(id: string, name: string): PlayerProfile {
  return {
    id,
    name,
    rating: STARTING_RATING,
    gamesPlayed: 0,
    wins: 0,
    history: [],
    ratedGames: 0,
    adaptiveStep: 0,
    adaptiveCalibrating: true,
  };
}

/**
 * Quant pesa el marge: un resultat ajustat mou la valoració un 25% menys del
 * normal, i una pallissa un 25% més. Prou per notar-se sense que una sola
 * partida ho decideixi tot.
 */
function marginWeight(margin: number): number {
  return 0.75 + 0.5 * Math.min(1, Math.max(0, margin));
}

/**
 * Factor K de l'Elo: els primers cops es mou de pressa perquè el sistema trobi
 * aviat el nivell del jugador; amb l'experiència es va estabilitzant.
 */
export function kFactor(gamesPlayed: number): number {
  if (gamesPlayed < 10) return 40;
  return Math.max(20, 40 - (gamesPlayed - 9));
}

/**
 * Registra el resultat d'una partida al perfil i retorna el perfil actualitzat
 * (el d'entrada no es modifica). La valoració s'actualitza contra el conjunt
 * dels oponents de la partida i, si es coneix, segons el marge del resultat:
 * una victòria per molt val més que una d'apurada.
 *
 * `outcome` accepta un booleà (com abans) o `{ won, margin }`.
 */
export function recordGame(
  profile: PlayerProfile,
  opponents: DifficultyKey[],
  outcome: boolean | GameOutcome,
  date: Date = new Date(),
): PlayerProfile {
  const { won, margin = NEUTRAL_MARGIN, adaptive = true, opponentRatings: actualRatings } =
    typeof outcome === 'boolean'
      ? { won: outcome, margin: NEUTRAL_MARGIN, adaptive: true }
      : outcome;

  const opponentRatings = opponents.map((key, index) => {
    const actual = actualRatings?.[index];
    return typeof actual === 'number' && Number.isFinite(actual) && actual >= 800 && actual <= 1600
      ? actual : DIFFICULTIES[key].rating;
  });
  const ratedGames = profile.ratedGames ?? profile.gamesPlayed;
  const eloRating = updateTableRating(
    profile.rating, opponentRatings, won,
    kFactor(ratedGames) * marginWeight(margin),
  );
  const adaptiveProgress: Partial<
    Pick<PlayerProfile, 'adaptiveStep' | 'adaptiveCalibrating'>
  > = adaptive ? nextAdaptiveProgress(profile, won, margin) : {};
  /*
   * Durant la calibració l'Elo es mou internament però no s'ensenya. Quan la
   * primera derrota (o victòria a Expert) tanca el calibratge, el número queda alineat amb el nivell
   * acabat d'assignar (Novell 800, Novell–Fàcil 900, Fàcil 1000, etc.).
   */
  const calibratedStep =
    adaptive &&
    profile.adaptiveCalibrating === true &&
    adaptiveProgress.adaptiveCalibrating === false &&
    typeof adaptiveProgress.adaptiveStep === 'number'
      ? adaptiveProgress.adaptiveStep
      : null;
  const rating = calibratedStep !== null
    ? ratingForAdaptiveStep(calibratedStep)
    : Math.min(Math.max(1600, profile.rating), Math.max(Math.min(800, profile.rating), eloRating));
  if (adaptive && calibratedStep === null && !profile.adaptiveCalibrating) {
    adaptiveProgress.adaptiveStep = Math.min(8, Math.max(0, Math.round((rating - 800) / 100)));
  }
  const record: GameRecord = {
    date: date.toISOString(),
    opponents,
    won,
    margin,
    ratingAfter: rating,
    opponentRatings,
    adaptive,
  };
  return {
    ...profile,
    ...adaptiveProgress,
    rating,
    ratedGames: calibratedStep !== null ? 0
      : profile.adaptiveCalibrating ? ratedGames : ratedGames + 1,
    gamesPlayed: profile.gamesPlayed + 1,
    wins: profile.wins + (won ? 1 : 0),
    history: [...profile.history, record].slice(-HISTORY_LIMIT),
  };
}
