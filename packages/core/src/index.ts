// API pública de @remigi/core. L'app web (Fase 2) importarà d'aquí.
// (jsonFileStore.ts s'importa a banda, expressament, perquè depèn de Node.)

export * from './core/types';
export * from './core/constants';
export * from './core/random';
export * from './core/tiles';
export * from './core/melds';
export * from './core/board';
export * from './core/game';
export * from './core/scoring';

/*
 * El motor: la porta per demanar jugades a la IA (vegeu docs/ENGINE.md).
 * Les peces d'ai/ de sota queden exportades per compatibilitat i per als
 * tests, però el codi nou ha de parlar amb el motor.
 */
export * from './engine/version';
export * from './engine/engine';

export * from './ai/difficulty';
export * from './ai/solver';
export * from './ai/rearrange';
export * from './ai/aiPlayer';

export * from './adaptive/rating';
export * from './adaptive/experience';
export * from './adaptive/adaptiveDifficulty';

/*
 * El laboratori (Remigi AI Lab): Motor A vs Motor B, torneigs, jeroglífics i
 * informes (vegeu docs/AI-LAB.md). Parla amb la IA només a través del motor.
 */
export * from './lab';

export * from './persistence/storage';
export * from './persistence/profiles';
