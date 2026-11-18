import type { GameSummary } from './tournament';

/**
 * Significació estadística d'una comparació A/B: a partir d'1.000 partides un
 * 55,7% sembla una victòria, però un 50,8% (el que va donar el Challenger 1M)
 * és soroll, i el marcador sol no ho distingeix. Aquest mòdul ho diu amb un
 * interval de confiança i un contrast, sense decidir res per ningú: només
 * quantifica quant se'n pot fiar de la diferència observada.
 *
 * Funció pura sobre els resums de les partides.
 */

/** Nivell de significació dels contrastos (bilateral). */
export const SIGNIFICANCE_ALPHA = 0.05;

export interface PairedAnalysis {
  /** Llavors amb les dues partides vàlides i decisives (una per seient). */
  pairs: number;
  /** A guanya les dues partides de la llavor. */
  aBoth: number;
  /** Cadascú guanya la seva (la llavor, o el repartiment, decideix). */
  split: number;
  /** B guanya les dues. */
  bBoth: number;
  /** Contrast bilateral de la diferència mitjana per parell (normal). */
  pValue: number;
}

export interface Significance {
  /** Partides vàlides amb guanyador. */
  decisiveGames: number;
  winsA: number;
  winsB: number;
  /** Quota de victòries d'A sobre les partides decisives. */
  winRateA: number;
  /** Interval de confiança del 95% (Wilson) de la quota d'A. */
  ci95: [number, number];
  /** Contrast de signes sobre partides, bilateral (normal). */
  pValue: number;
  /** Semiamplada de l'IC al 50%: la mida de diferència que aquest torneig pot distingir. */
  marginOfError: number;
  /** Anàlisi per llavors aparellades; null si no n'hi ha prou parells. */
  paired: PairedAnalysis | null;
  /** Quin contrast fa servir el veredicte: el de parells si n'hi ha, el de partides si no. */
  basis: 'parells' | 'partides';
  verdict: 'a-millor' | 'b-millor' | 'sense-diferencia';
}

/** Mínim de parells per fiar-se de l'aproximació normal de l'anàlisi per parells. */
const MIN_PAIRS = 30;
const Z95 = 1.959963984540054;

/** erfc amb error absolut < 1,5e-7 (Abramowitz–Stegun 7.1.26). */
function erfc(x: number): number {
  const t = 1 / (1 + 0.3275911 * Math.abs(x));
  const poly =
    t *
    (0.254829592 +
      t * (-0.284496736 + t * (1.421413741 + t * (-1.453152027 + t * 1.061405429))));
  const value = poly * Math.exp(-x * x);
  return x >= 0 ? value : 2 - value;
}

/** p-valor bilateral d'un estadístic z normal estàndard. */
export function twoSidedP(z: number): number {
  if (!Number.isFinite(z)) return z === 0 || Number.isNaN(z) ? 1 : 0;
  return Math.min(1, erfc(Math.abs(z) / Math.SQRT2));
}

/** Interval de Wilson al 95% per a `successes` sobre `n`. */
export function wilsonInterval(successes: number, n: number): [number, number] {
  if (n === 0) return [0, 1];
  const p = successes / n;
  const z2 = Z95 * Z95;
  const denominator = 1 + z2 / n;
  const centre = (p + z2 / (2 * n)) / denominator;
  const half = (Z95 * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n))) / denominator;
  return [Math.max(0, centre - half), Math.min(1, centre + half)];
}

function pairedAnalysis(summaries: readonly GameSummary[]): PairedAnalysis | null {
  const bySeed = new Map<number, GameSummary[]>();
  for (const summary of summaries) {
    if (summary.error || summary.winner === null) continue;
    const list = bySeed.get(summary.seed);
    if (list) list.push(summary);
    else bySeed.set(summary.seed, [summary]);
  }
  let pairs = 0;
  let aBoth = 0;
  let split = 0;
  let bBoth = 0;
  for (const list of bySeed.values()) {
    if (list.length !== 2 || list[0].firstSeat === list[1].firstSeat) continue;
    pairs++;
    const aWins = list.filter((summary) => summary.winner === 'A').length;
    if (aWins === 2) aBoth++;
    else if (aWins === 0) bBoth++;
    else split++;
  }
  if (pairs < MIN_PAIRS) return null;
  // Puntuació per parell: +1 (A guanya les dues), 0, −1 (B les dues).
  const mean = (aBoth - bBoth) / pairs;
  const variance = (aBoth + bBoth) / pairs - mean * mean;
  const standardError = Math.sqrt(variance / pairs);
  const z = standardError === 0 ? (mean === 0 ? 0 : Infinity) : mean / standardError;
  return { pairs, aBoth, split, bBoth, pValue: twoSidedP(z) };
}

export function significance(summaries: readonly GameSummary[]): Significance {
  const decisive = summaries.filter((summary) => !summary.error && summary.winner !== null);
  const winsA = decisive.filter((summary) => summary.winner === 'A').length;
  const winsB = decisive.length - winsA;
  const n = decisive.length;
  const pValue = n === 0 ? 1 : twoSidedP((winsA - winsB) / Math.sqrt(n));
  const paired = pairedAnalysis(summaries);

  const basis = paired ? 'parells' : 'partides';
  const p = paired ? paired.pValue : pValue;
  const verdict =
    p < SIGNIFICANCE_ALPHA && winsA !== winsB
      ? winsA > winsB
        ? 'a-millor'
        : 'b-millor'
      : 'sense-diferencia';

  return {
    decisiveGames: n,
    winsA,
    winsB,
    winRateA: n === 0 ? 0 : winsA / n,
    ci95: wilsonInterval(winsA, n),
    pValue,
    marginOfError: n === 0 ? 1 : (Z95 * 0.5) / Math.sqrt(n),
    paired,
    basis,
    verdict,
  };
}
