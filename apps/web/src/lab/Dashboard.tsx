import {
  comparisonRows,
  round,
  type EngineSpec,
  type LabTurn,
  type Seat,
  type TournamentResult,
} from '@remigi/core';
import { liveRows, liveSeatStats } from './labSession';

interface Props {
  specs: Record<Seat, EngineSpec>;
  /** Torns de la partida visual en marxa (per a la vista «partida»). */
  turns: readonly LabTurn[];
  /** Resultat de l'últim torneig, si n'hi ha (per a la vista «torneig»). */
  tournament: TournamentResult | null;
  view: 'partida' | 'torneig';
  onView(view: 'partida' | 'torneig'): void;
}

/**
 * El dashboard comparatiu (§ mètrica a mètrica, Motor A contra Motor B): la
 * partida en marxa es calcula en viu dels torns; el torneig porta els
 * agregats fets del core. Les files poden créixer amb mètriques noves sense
 * tocar res més que `comparisonRows` (torneig) o `liveRows` (partida).
 */
export function Dashboard({ specs, turns, tournament, view, onView }: Props) {
  const effective = view === 'torneig' && tournament ? 'torneig' : 'partida';
  const rows =
    effective === 'torneig' && tournament
      ? comparisonRows(tournament.aggregates.A, tournament.aggregates.B)
      : liveRows(liveSeatStats(turns, 'A'), liveSeatStats(turns, 'B'));

  return (
    <section className="lab-panell lab-dashboard" aria-label="Dashboard comparatiu">
      <header className="lab-dashboard-cap">
        <h3>Estadístiques</h3>
        <div className="lab-pestanyes" role="tablist" aria-label="Origen de les estadístiques">
          <button
            type="button"
            role="tab"
            aria-selected={effective === 'partida'}
            className={effective === 'partida' ? 'actiu' : ''}
            onClick={() => onView('partida')}
          >
            Partida actual
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={effective === 'torneig'}
            className={effective === 'torneig' ? 'actiu' : ''}
            onClick={() => onView('torneig')}
            disabled={!tournament}
          >
            Últim torneig
          </button>
        </div>
      </header>

      {effective === 'torneig' && tournament && (
        <p className="muted small">
          {tournament.config.games} partides · llavor base {tournament.config.baseSeed} ·{' '}
          {round(tournament.durationMs / 1000, 1)} s · mitjana {round(tournament.turnsMean, 1)}{' '}
          torns/partida
        </p>
      )}

      <table className="lab-taula">
        <thead>
          <tr>
            <th scope="col">Mètrica</th>
            <th scope="col">
              <span className="motor-color" style={{ background: specs.A.color }} aria-hidden="true" />{' '}
              {specs.A.name}
            </th>
            <th scope="col">
              <span className="motor-color" style={{ background: specs.B.color }} aria-hidden="true" />{' '}
              {specs.B.name}
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.label}>
              <th scope="row">{row.label}</th>
              <td>{row.a}</td>
              <td>{row.b}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
