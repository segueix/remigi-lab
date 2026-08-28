/** Estadística mínima i determinista per als agregats del laboratori. */

export function sum(values: readonly number[]): number {
  let total = 0;
  for (const value of values) total += value;
  return total;
}

export function mean(values: readonly number[]): number {
  return values.length === 0 ? 0 : sum(values) / values.length;
}

export function max(values: readonly number[]): number {
  return values.length === 0 ? 0 : Math.max(...values);
}

/**
 * Percentil 95 pel mètode del rang (el mateix que fa servir el simulador):
 * s'ordena i es pren la posició ⌊n·0,95⌋.
 */
export function p95(values: readonly number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))];
}

/** Arrodoniment per ensenyar: fins a `digits` decimals, sense cua de zeros. */
export function round(value: number, digits = 1): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}
