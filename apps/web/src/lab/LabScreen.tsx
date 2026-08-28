import {
  ENGINE_VERSION,
  engineSpecById,
  round,
  type MatchSetup,
  type Seat,
} from '@remigi/core';
import { useEffect, useRef, useState } from 'react';
import { Dashboard } from './Dashboard';
import { EngineCard } from './EngineCard';
import { EngineDiff } from './EngineDiff';
import { LabBoard } from './LabBoard';
import { MoveCard } from './MoveCard';
import { Timeline } from './Timeline';
import { TournamentPanel } from './TournamentPanel';
import { liveSeatStats } from './labSession';
import { LAB_SPEEDS, useLabMatch } from './useLabMatch';
import { useTournament } from './useTournament';
import './lab.css';

interface Props {
  /** Obre la partida humana de sempre (es conserva sencera a #joc). */
  onPlayHuman(): void;
}

/** La comparació amb què s'obre el laboratori: el Campió contra la referència. */
const INITIAL_SETUP: MatchSetup = {
  engineA: 'expert-v2',
  engineB: 'expert-v1',
  seed: 42,
  firstSeat: 'A',
};

/**
 * REMIGI AI LAB: la pantalla principal d'aquest clon. Motor A contra Motor B,
 * amb la partida visible al mig, el diagnòstic de cada jugada, la cronologia,
 * el dashboard comparatiu i el mode torneig. Tot el càlcul és del core
 * (`@remigi/core`, capa lab): aquí només s'hi posa la vista.
 */
export function LabScreen({ onPlayHuman }: Props) {
  const match = useLabMatch(INITIAL_SETUP);
  const tournament = useTournament();
  const [details, setDetails] = useState(false);
  const [dashboardView, setDashboardView] = useState<'partida' | 'torneig'>('partida');
  const [seedDraft, setSeedDraft] = useState(String(INITIAL_SETUP.seed));
  const [sessionWins, setSessionWins] = useState<Record<Seat, number>>({ A: 0, B: 0 });

  const specs = {
    A: engineSpecById(match.setup.engineA),
    B: engineSpecById(match.setup.engineB),
  };

  /** Prepara una partida nova i deixa la llavor del quadre al dia. */
  function prepare(setup: MatchSetup) {
    match.prepare(setup);
    setSeedDraft(String(setup.seed));
  }

  /** Canviar un motor invalida la comparació: marcador i torneig de zero. */
  function selectEngine(seat: Seat, engineId: string) {
    const next: MatchSetup = {
      ...match.setup,
      engineA: seat === 'A' ? engineId : match.setup.engineA,
      engineB: seat === 'B' ? engineId : match.setup.engineB,
    };
    setSessionWins({ A: 0, B: 0 });
    tournament.clear();
    setDashboardView('partida');
    prepare(next);
  }

  // Cada partida visual acabada suma la victòria al seu motor (un sol cop).
  const winCountedRef = useRef(0);
  const { result, matchId } = match;
  useEffect(() => {
    if (!result || result.error || !result.winner) return;
    if (winCountedRef.current === matchId) return;
    winCountedRef.current = matchId;
    const winner = result.winner;
    setSessionWins((wins) => ({ ...wins, [winner]: wins[winner] + 1 }));
  }, [result, matchId]);

  // El torneig acabat també: les seves victòries s'acumulen a les targetes.
  const tournamentCountedRef = useRef<object | null>(null);
  const tournamentResult = tournament.result;
  useEffect(() => {
    if (!tournamentResult || tournamentCountedRef.current === tournamentResult) return;
    tournamentCountedRef.current = tournamentResult;
    setSessionWins((wins) => ({
      A: wins.A + tournamentResult.winsA,
      B: wins.B + tournamentResult.winsB,
    }));
    setDashboardView('torneig');
  }, [tournamentResult]);

  const inspectedTurn = match.viewIndex !== null ? match.turns[match.viewIndex] : null;
  const lastTurn = match.turns.at(-1) ?? null;
  const shownTurn = inspectedTurn ?? lastTurn;
  const board = inspectedTurn?.boardAfter ?? match.board;
  const racks = inspectedTurn?.racksAfter ?? match.racks;

  const statsA = liveSeatStats(match.turns, 'A');
  const statsB = liveSeatStats(match.turns, 'B');

  function applySeedDraft() {
    const seed = Number(seedDraft);
    if (!Number.isInteger(seed) || seed < 0) return;
    prepare({ ...match.setup, seed });
  }

  return (
    <main className="lab">
      <header className="lab-cap">
        <h1 className="lab-titol">
          <span aria-hidden="true">⚗</span> REMIGI AI LAB
        </h1>
        <p className="lab-subtitol">
          consola de desenvolupament de motors · remigi-engine v{ENGINE_VERSION}
        </p>
        <button type="button" className="secondary lab-huma" onClick={onPlayHuman}>
          Partida humana
        </button>
      </header>

      {/* Motor A — VS — Motor B */}
      <div className="lab-motors" style={{ ['--motor-a' as string]: specs.A.color, ['--motor-b' as string]: specs.B.color }}>
        <EngineCard
          seat="A"
          spec={specs.A}
          wins={sessionWins.A}
          active={!match.done && match.currentSeat === 'A' && match.running}
          rackCount={match.racks.A.length}
          onSelect={(id) => selectEngine('A', id)}
          disabled={tournament.running}
        />
        <div className="lab-vs" aria-hidden="true">
          VS
        </div>
        <EngineCard
          seat="B"
          spec={specs.B}
          wins={sessionWins.B}
          active={!match.done && match.currentSeat === 'B' && match.running}
          rackCount={match.racks.B.length}
          onSelect={(id) => selectEngine('B', id)}
          disabled={tournament.running}
        />
      </div>

      {/* Controls de la simulació */}
      <div className="lab-controls">
        {!match.done &&
          (match.running ? (
            <button type="button" onClick={match.pause} aria-label="Pausa">
              ⏸ Pausa
            </button>
          ) : (
            <button
              type="button"
              onClick={match.play}
              disabled={match.speed === 'pas'}
              aria-label="Reprodueix la partida"
            >
              ▶ Reprodueix
            </button>
          ))}
        <button type="button" className="secondary" onClick={match.stepOnce} disabled={match.done}>
          Següent jugada
        </button>
        <label className="lab-velocitat">
          Velocitat:{' '}
          <select
            value={String(match.speed)}
            onChange={(event) => {
              const raw = event.target.value;
              match.setSpeed(raw === 'pas' || raw === 'max' ? raw : (Number(raw) as 0.5 | 1 | 2 | 5 | 10));
            }}
            aria-label="Velocitat de reproducció"
          >
            {LAB_SPEEDS.map((option) => (
              <option key={String(option.value)} value={String(option.value)}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <button type="button" className="secondary" onClick={match.restart}>
          Reinicia
        </button>
        <button type="button" className="secondary" onClick={match.newSeed}>
          Nova llavor
        </button>
        <label className="check lab-comenca" title="Qui seu al primer seient (i comença) amb aquesta llavor">
          Comença:{' '}
          <select
            value={match.setup.firstSeat}
            onChange={(event) => prepare({ ...match.setup, firstSeat: event.target.value as Seat })}
            aria-label="Qui comença"
          >
            <option value="A">A</option>
            <option value="B">B</option>
          </select>
        </label>
      </div>

      {/* Estat de la partida (llavor, torn, comptes en viu) */}
      <div className="lab-estat" data-prova="estat">
        <span className="lab-estat-item">
          llavor{' '}
          <input
            className="lab-llavor"
            inputMode="numeric"
            value={seedDraft}
            onChange={(event) => setSeedDraft(event.target.value.replace(/[^\d]/g, ''))}
            onKeyDown={(event) => {
              if (event.key === 'Enter') applySeedDraft();
            }}
            aria-label="Llavor de la partida"
          />
          {Number(seedDraft) !== match.setup.seed && (
            <button type="button" className="secondary lab-llavor-aplica" onClick={applySeedDraft}>
              Aplica
            </button>
          )}
        </span>
        <span className="lab-estat-item">torn {match.turn}</span>
        <span className="lab-estat-item">
          {match.done
            ? 'partida acabada'
            : match.currentSeat
              ? `juga ${match.currentSeat} (${specs[match.currentSeat].name})`
              : 'a punt'}
        </span>
        <span className="lab-estat-item">sac {match.bag}</span>
        <span className="lab-estat-item">
          pendents A {match.pending.A} · B {match.pending.B}
        </span>
        <span className="lab-estat-item">
          nodes {(statsA.nodesTotal + statsB.nodesTotal).toLocaleString('ca')}
        </span>
        <span className="lab-estat-item">
          temps {round(statsA.timeMsTotal + statsB.timeMsTotal, 0)} ms
        </span>
        <span className="lab-estat-item">jeroglífics {statsA.hieroglyphs + statsB.hieroglyphs}</span>
      </div>

      {/* El resultat, quan la partida visual acaba */}
      {match.done && match.result && (
        <p className="lab-resultat" role="status" data-prova="resultat">
          {match.result.error ? (
            <>
              ✖ La partida ha petat al torn {match.result.error.turn}:{' '}
              {match.result.error.message}
            </>
          ) : (
            <>
              🏁 Guanya <strong>{match.result.winner}</strong> (
              {specs[match.result.winner!].name})
              {match.result.blocked ? ' per bloqueig' : ''} en {match.result.turns} torns · punts A{' '}
              {match.result.points.A} / B {match.result.points.B}
            </>
          )}{' '}
          <button type="button" className="secondary" onClick={match.newSeed}>
            Una altra (llavor nova)
          </button>
        </p>
      )}

      {/* Inspecció des de la timeline */}
      {inspectedTurn && (
        <p className="lab-inspeccio" role="status">
          Estàs inspeccionant el torn {inspectedTurn.turn} ({inspectedTurn.seat}).{' '}
          <button type="button" className="secondary" onClick={() => match.inspect(null)}>
            Torna al directe
          </button>
        </p>
      )}

      {/* La taula amb les dues mans a la vista */}
      <LabBoard
        board={board}
        racks={racks}
        specs={specs}
        currentSeat={inspectedTurn ? null : match.currentSeat}
        markedTurn={shownTurn}
      />
      <p className="lab-llegenda muted small">
        marc de color: fitxes baixades pel motor · marc daurat: fitxes de la taula
        recol·locades en la jugada
      </p>

      {/* Diagnòstic de la jugada ensenyada */}
      {shownTurn && (
        <MoveCard turn={shownTurn} spec={specs[shownTurn.seat]} inspected={Boolean(inspectedTurn)} />
      )}

      {/* Dashboard comparatiu */}
      <Dashboard
        specs={specs}
        turns={match.turns}
        tournament={tournament.result}
        view={dashboardView}
        onView={setDashboardView}
      />

      {/* Torneig */}
      <TournamentPanel
        tournament={tournament}
        engineA={match.setup.engineA}
        engineB={match.setup.engineB}
        baseSeed={match.setup.seed}
        onRun={(games, paired) => {
          tournament.start({
            engineA: match.setup.engineA,
            engineB: match.setup.engineB,
            games,
            baseSeed: match.setup.seed,
            paired,
          });
        }}
        onReplay={(setup) => {
          // El setup de la partida interessant porta motors, llavor i seient:
          // exactament la partida del torneig, ara amb visualització completa.
          setDashboardView('partida');
          prepare(setup);
          window.scrollTo({ top: 0 });
        }}
      />

      {/* Detalls: diferències, timeline */}
      <div className="lab-detalls-cap">
        <button
          type="button"
          className="secondary"
          aria-expanded={details}
          onClick={() => setDetails((current) => !current)}
        >
          {details ? 'Amaga els detalls' : 'Detalls'}
        </button>
      </div>
      {details && (
        <div className="lab-detalls">
          <EngineDiff specA={specs.A} specB={specs.B} />
          <section className="lab-panell" aria-label="Historial de jugades">
            <h3>Historial de jugades</h3>
            <Timeline
              turns={match.turns}
              specs={specs}
              viewIndex={match.viewIndex}
              onInspect={match.inspect}
            />
          </section>
        </div>
      )}

      <footer className="lab-peu muted small">
        Remigi AI Lab · el motor és independent i substituïble (
        <code>npm run build:engine</code> → <code>dist/remigi-engine.js</code>) · vegeu{' '}
        <code>docs/AI-LAB.md</code>
      </footer>
    </main>
  );
}
