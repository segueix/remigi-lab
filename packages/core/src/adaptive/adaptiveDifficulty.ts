import { DIFFICULTIES, DIFFICULTY_ORDER, type DifficultyKey } from '../ai/difficulty';
import type { PlayerProfile } from './experience';

/** Graons reservats a la calibració; després només mana la valoració. */
export const MAX_ADAPTIVE_STEP = (DIFFICULTY_ORDER.length - 1) * 2;

function clampStep(step: number): number {
  return Math.min(MAX_ADAPTIVE_STEP, Math.max(0, Math.round(step)));
}

export function isCalibrating(profile: PlayerProfile): boolean {
  return profile.adaptiveCalibrating === true;
}

export function adaptiveStepFor(profile: PlayerProfile): number {
  if (isCalibrating(profile) && typeof profile.adaptiveStep === 'number') {
    return clampStep(profile.adaptiveStep);
  }
  return clampStep((profile.rating - 800) / 100);
}

/** Escalada inicial; guanyar a Expert també acaba el calibratge. */
export function nextAdaptiveProgress(
  profile: PlayerProfile,
  won: boolean,
  margin = 0.5,
): { adaptiveStep: number; adaptiveCalibrating: boolean } {
  const current = adaptiveStepFor(profile);
  if (!isCalibrating(profile)) {
    return { adaptiveStep: current, adaptiveCalibrating: false };
  }
  if (won) {
    return {
      adaptiveStep: clampStep(current + 2),
      adaptiveCalibrating: current < MAX_ADAPTIVE_STEP,
    };
  }
  const lossDrop = margin <= 0.25 ? 0 : margin <= 0.65 ? 1 : 2;
  return { adaptiveStep: clampStep(current - lossDrop), adaptiveCalibrating: false };
}

/** Valoració congelada en començar la partida, compartida per tots els rivals. */
export function suggestOpponentRatings(profile: PlayerProfile, count: 1 | 2 | 3): number[] {
  const rating = isCalibrating(profile)
    ? ratingForAdaptiveStep(adaptiveStepFor(profile))
    : Math.min(1600, Math.max(800, profile.rating));
  return Array.from({ length: count }, () => rating);
}

function difficultyAt(index: number): DifficultyKey {
  const clamped = Math.min(DIFFICULTY_ORDER.length - 1, Math.max(0, index));
  return DIFFICULTY_ORDER[clamped];
}

/** Claus descriptives; la força exacta viatja a suggestOpponentRatings. */
export function suggestOpponents(profile: PlayerProfile, count: 1 | 2 | 3): DifficultyKey[] {
  return suggestOpponentRatings(profile, count).map((rating) =>
    difficultyAt(Math.floor((rating - 800) / 200)),
  );
}

/** Etiqueta del punt adaptatiu actual: «Mitjà» o «Fàcil–Mitjà». */
export function adaptiveLevelLabel(profile: PlayerProfile): string {
  const rating = suggestOpponentRatings(profile, 1)[0];
  const position = (rating - 800) / 200;
  const lower = DIFFICULTIES[difficultyAt(Math.floor(position))].label;
  if (Number.isInteger(position)) return lower;
  return `${lower}–${DIFFICULTIES[difficultyAt(Math.ceil(position))].label}`;
}

/** Valoració numèrica coherent amb un mig graó adaptatiu. */
export function ratingForAdaptiveStep(step: number): number {
  const first = DIFFICULTIES[DIFFICULTY_ORDER[0]].rating;
  const second = DIFFICULTIES[DIFFICULTY_ORDER[1]].rating;
  const halfLevel = Math.max(1, (second - first) / 2);
  return first + clampStep(step) * halfLevel;
}

/** Text curt per explicar la tria a la interfície. */
export function describeSuggestion(keys: DifficultyKey[]): string {
  const labels = keys.map((key) => DIFFICULTIES[key].label);
  return `Nivell adaptatiu: ${labels.join(', ')}`;
}
