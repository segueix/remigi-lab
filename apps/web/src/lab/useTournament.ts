import {
  createTournament,
  type TournamentConfig,
  type TournamentProgress,
  type TournamentResult,
} from '@remigi/core';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { WorkerResponse } from './tournamentWorker';

export interface TournamentHandle {
  running: boolean;
  progress: TournamentProgress | null;
  result: TournamentResult | null;
  error: string | null;
  start(config: TournamentConfig): void;
  cancel(): void;
  /** Buida el resultat (en canviar de motors, la comparativa vella no val). */
  clear(): void;
}

/**
 * Condueix un torneig des de la interfície. El treball va a un Web Worker
 * (vegeu `tournamentWorker.ts`); si el navegador no en té, es fa al fil
 * principal a talls curts perquè la pàgina continuï responent.
 */
export function useTournament(): TournamentHandle {
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<TournamentProgress | null>(null);
  const [result, setResult] = useState<TournamentResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const workerRef = useRef<Worker | null>(null);
  const cancelledRef = useRef(false);

  const stopWorker = useCallback(() => {
    workerRef.current?.terminate();
    workerRef.current = null;
    cancelledRef.current = true;
  }, []);

  useEffect(() => stopWorker, [stopWorker]);

  const start = useCallback(
    (config: TournamentConfig) => {
      stopWorker();
      cancelledRef.current = false;
      setRunning(true);
      setResult(null);
      setError(null);
      setProgress({ completed: 0, total: config.games, winsA: 0, winsB: 0, errors: 0, elapsedMs: 0 });

      if (typeof Worker !== 'undefined') {
        const worker = new Worker(new URL('./tournamentWorker.ts', import.meta.url), {
          type: 'module',
        });
        workerRef.current = worker;
        worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
          const message = event.data;
          if (message.type === 'progress') setProgress(message.progress);
          if (message.type === 'done') {
            setResult(message.result);
            setProgress(message.result ? { ...messageProgress(message.result) } : null);
            setRunning(false);
            stopWorker();
          }
          if (message.type === 'error') {
            setError(message.message);
            setRunning(false);
            stopWorker();
          }
        };
        worker.onerror = (event) => {
          setError(event.message || 'El worker del torneig ha fallat');
          setRunning(false);
          stopWorker();
        };
        worker.postMessage({ type: 'run', config });
        return;
      }

      // Sense workers: el mateix torneig, a talls curts al fil principal.
      try {
        const run = createTournament(config);
        const chunk = () => {
          if (cancelledRef.current) return;
          const started = performance.now();
          while (!run.done && performance.now() - started < 30) run.runNext();
          setProgress(run.progress());
          if (!run.done) {
            setTimeout(chunk, 0);
            return;
          }
          setResult(run.result());
          setRunning(false);
        };
        setTimeout(chunk, 0);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : String(caught));
        setRunning(false);
      }
    },
    [stopWorker],
  );

  const cancel = useCallback(() => {
    stopWorker();
    setRunning(false);
  }, [stopWorker]);

  const clear = useCallback(() => {
    stopWorker();
    setRunning(false);
    setProgress(null);
    setResult(null);
    setError(null);
  }, [stopWorker]);

  return { running, progress, result, error, start, cancel, clear };
}

/** Progrés final coherent amb el resultat (per si l'últim missatge es perd). */
function messageProgress(result: TournamentResult): TournamentProgress {
  return {
    completed: result.summaries.length,
    total: result.config.games,
    winsA: result.winsA,
    winsB: result.winsB,
    errors: result.errors.length,
    elapsedMs: result.durationMs,
  };
}
