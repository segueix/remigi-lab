import {
  createMatch,
  randomSeed,
  type LabTurn,
  type MatchResult,
  type MatchRun,
  type MatchSetup,
  type Meld,
  type Seat,
  type Tile,
} from '@remigi/core';
import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * La partida visual del laboratori: un `MatchRun` del core (el mateix runner
 * que el CLI i els torneigs) conduït des de React, amb velocitat regulable,
 * pausa, pas a pas i inspecció de torns passats.
 */

export type LabSpeed = 'pas' | 0.5 | 1 | 2 | 5 | 10 | 'max';

export const LAB_SPEEDS: { value: LabSpeed; label: string }[] = [
  { value: 'pas', label: 'Pas a pas' },
  { value: 0.5, label: '0,5×' },
  { value: 1, label: '1×' },
  { value: 2, label: '2×' },
  { value: 5, label: '5×' },
  { value: 10, label: '10×' },
  { value: 'max', label: 'Màx' },
];

/** Mil·lisegons entre moviments a velocitat 1×. */
const BASE_DELAY_MS = 1000;
/** A velocitat màxima: temps de càlcul seguit abans de tornar el fil a la UI. */
const MAX_CHUNK_MS = 24;

export interface LabMatchView {
  setup: Required<MatchSetup>;
  /** Número de partida preparada (puja a cada `prepare`): identitat del run. */
  matchId: number;
  turns: readonly LabTurn[];
  board: Meld[];
  racks: Record<Seat, Tile[]>;
  bag: number;
  /** Punts pendents a cada mà (marcador provisional). */
  pending: Record<Seat, number>;
  /** A qui toca (null quan la partida ha acabat). */
  currentSeat: Seat | null;
  turn: number;
  done: boolean;
  result: MatchResult | null;
  /** Torn inspeccionat de la timeline (null = seguint el directe). */
  viewIndex: number | null;
  running: boolean;
  speed: LabSpeed;
}

export interface LabMatchHandle extends LabMatchView {
  /** Prepara una partida nova (i atura la que hi hagi). */
  prepare(setup: MatchSetup): void;
  /** Torna a començar la mateixa partida (mateixa llavor i seient). */
  restart(): void;
  /** Prepara la mateixa comparació amb una llavor nova a l'atzar. */
  newSeed(): void;
  play(): void;
  pause(): void;
  /** Juga un sol moviment (el botó «Següent jugada» i el mode pas a pas). */
  stepOnce(): void;
  setSpeed(speed: LabSpeed): void;
  /** Inspecciona un torn de la timeline; null torna al directe. */
  inspect(index: number | null): void;
}

function seatView(run: MatchRun): Pick<LabMatchView, 'board' | 'racks' | 'bag' | 'pending' | 'currentSeat' | 'turn'> {
  const state = run.state;
  const seatIndex = (seat: Seat) => run.seatOf.indexOf(seat);
  return {
    board: state.board,
    racks: {
      A: state.players[seatIndex('A')].rack,
      B: state.players[seatIndex('B')].rack,
    },
    bag: state.bag.length,
    pending: run.pendingPoints(),
    currentSeat: state.status === 'playing' ? run.seatOf[state.currentPlayer] : null,
    turn: state.turn,
  };
}

export function useLabMatch(initialSetup: MatchSetup): LabMatchHandle {
  const runRef = useRef<MatchRun | null>(null);
  const matchIdRef = useRef(0);
  const [view, setView] = useState<LabMatchView | null>(null);

  /** Reconstrueix la vista de React a partir del run (que és mutable). */
  const refresh = useCallback((changes: Partial<LabMatchView> = {}) => {
    setView((current) => {
      const run = runRef.current;
      if (!run || !current) return current;
      return {
        ...current,
        ...seatView(run),
        turns: [...run.turns],
        done: run.done,
        result: run.done ? run.result() : null,
        ...changes,
      };
    });
  }, []);

  const prepare = useCallback((setup: MatchSetup) => {
    // Les partides visuals guarden la taula de cada torn per poder-los
    // inspeccionar des de la timeline.
    const run = createMatch({ ...setup, keepBoards: true });
    runRef.current = run;
    matchIdRef.current++;
    setView({
      setup: run.setup,
      matchId: matchIdRef.current,
      turns: [],
      ...seatView(run),
      done: false,
      result: null,
      viewIndex: null,
      running: false,
      speed: 1,
    });
  }, []);

  // La primera partida es prepara en muntar (i només una vegada).
  const preparedRef = useRef(false);
  useEffect(() => {
    if (preparedRef.current) return;
    preparedRef.current = true;
    prepare(initialSetup);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stepOnce = useCallback(() => {
    const run = runRef.current;
    if (!run || run.done) return;
    run.step();
    refresh({ viewIndex: null });
  }, [refresh]);

  /*
   * El bucle de reproducció automàtica. A velocitats amb nom (0,5×–10×) es
   * juga un moviment per temporitzador; a màxima velocitat es juguen tants
   * moviments seguits com hi capiguen en un tall curt i es pinta un sol cop,
   * per no ofegar la interfície amb renders.
   */
  const running = view?.running ?? false;
  const speed = view?.speed ?? 1;
  const done = view?.done ?? true;
  const viewIndex = view?.viewIndex ?? null;
  const turnCount = view?.turns.length ?? 0;
  useEffect(() => {
    if (!running || done || speed === 'pas' || viewIndex !== null) return;

    if (speed === 'max') {
      const timer = setTimeout(() => {
        const run = runRef.current;
        if (!run) return;
        const started = performance.now();
        while (!run.done && performance.now() - started < MAX_CHUNK_MS) run.step();
        refresh();
      }, 0);
      return () => clearTimeout(timer);
    }

    const timer = setTimeout(() => stepOnce(), BASE_DELAY_MS / speed);
    return () => clearTimeout(timer);
  }, [running, speed, done, viewIndex, turnCount, refresh, stepOnce]);

  const setup = view?.setup ?? { ...initialSetup };

  return {
    // Mentre la primera partida no està preparada (primer render), una vista
    // buida coherent: el primer efecte la substitueix de seguida.
    setup: view?.setup ?? {
      firstSeat: 'A',
      maxTurns: 1000,
      keepBoards: true,
      ...initialSetup,
    },
    matchId: view?.matchId ?? 0,
    turns: view?.turns ?? [],
    board: view?.board ?? [],
    racks: view?.racks ?? { A: [], B: [] },
    bag: view?.bag ?? 0,
    pending: view?.pending ?? { A: 0, B: 0 },
    currentSeat: view?.currentSeat ?? null,
    turn: view?.turn ?? 1,
    done,
    result: view?.result ?? null,
    viewIndex,
    running,
    speed,

    prepare,
    restart: useCallback(() => prepare(setup), [prepare, setup]),
    newSeed: useCallback(() => prepare({ ...setup, seed: randomSeed() }), [prepare, setup]),
    play: useCallback(() => refresh({ running: true, viewIndex: null }), [refresh]),
    pause: useCallback(() => refresh({ running: false }), [refresh]),
    stepOnce,
    setSpeed: useCallback((next: LabSpeed) => refresh({ speed: next }), [refresh]),
    inspect: useCallback(
      (index: number | null) => refresh(index === null ? { viewIndex: null } : { viewIndex: index, running: false }),
      [refresh],
    ),
  };
}
