/**
 * El laboratori: la capa que fa jugar motors l'un contra l'altre i els mesura.
 *
 * Depèn només de l'API pública del motor (`src/engine/`) i de les regles del
 * nucli; mai de les tripes d'`ai/`. La fan servir la interfície del
 * laboratori (apps/web), el CLI (`npm run lab`) i els tests — tots amb el
 * mateix runner, perquè el que es mesura sigui sempre el mateix.
 */

export * from './hieroglyph';
export * from './catalog';
export * from './match';
export * from './stats';
export * from './tournament';
export * from './report';
