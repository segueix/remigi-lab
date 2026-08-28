import {
  createTournament,
  type TournamentConfig,
  type TournamentProgress,
  type TournamentResult,
} from '@remigi/core';

/**
 * El torneig corre en un Web Worker perquè 1.000 partides no congelin la
 * interfície: el fil principal només rep el progrés i el resultat final. El
 * runner és exactament el mateix que fa servir el CLI (`createTournament`).
 */

export type WorkerRequest = { type: 'run'; config: TournamentConfig };

export type WorkerResponse =
  | { type: 'progress'; progress: TournamentProgress }
  | { type: 'done'; result: TournamentResult }
  | { type: 'error'; message: string };

/** Mil·lisegons entre missatges de progrés (per no inundar el fil principal). */
const PROGRESS_EVERY_MS = 120;

self.onmessage = (event: MessageEvent<WorkerRequest>) => {
  if (event.data.type !== 'run') return;
  const post = (response: WorkerResponse) => self.postMessage(response);
  try {
    const run = createTournament(event.data.config);
    let lastProgress = 0;
    while (!run.done) {
      run.runNext();
      const nowMs = Date.now();
      if (run.done || nowMs - lastProgress >= PROGRESS_EVERY_MS) {
        lastProgress = nowMs;
        post({ type: 'progress', progress: run.progress() });
      }
    }
    post({ type: 'done', result: run.result()! });
  } catch (caught) {
    post({ type: 'error', message: caught instanceof Error ? caught.message : String(caught) });
  }
};
