/**
 * Valoració d'habilitat estil Elo. El jugador i cada nivell d'IA tenen una
 * puntuació; després de cada partida la del jugador s'actualitza segons el
 * resultat i la diferència amb els oponents. Guanyar contra rivals més forts
 * puja molt; perdre contra rivals més fluixos baixa molt.
 */

/** Probabilitat esperada que `a` guanyi `b`. */
export function expectedScore(a: number, b: number): number {
  return 1 / (1 + 10 ** ((b - a) / 400));
}

/**
 * Nova valoració després d'un resultat (`score`: 1 victòria, 0 derrota,
 * 0.5 empat). `k` regula com de ràpid es mou la puntuació.
 */
export function updateRating(rating: number, opponentRating: number, score: number, k: number): number {
  return Math.round(rating + k * (score - expectedScore(rating, opponentRating)));
}

/** Probabilitat de guanyar la taula: 1/(n+1) amb n rivals equivalents. */
export function expectedTableScore(rating: number, opponents: readonly number[]): number {
  return 1 / (1 + opponents.reduce((sum, rival) => sum + 10 ** ((rival - rating) / 400), 0));
}

export function updateTableRating(
  rating: number, opponents: readonly number[], won: boolean, k: number,
): number {
  return Math.round(rating + k * ((won ? 1 : 0) - expectedTableScore(rating, opponents)));
}
