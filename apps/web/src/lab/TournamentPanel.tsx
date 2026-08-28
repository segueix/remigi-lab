import { buildReport, reportToMarkdown, round, type MatchSetup } from '@remigi/core';
import { useState } from 'react';
import { downloadText } from './download';
import type { TournamentHandle } from './useTournament';

interface Props {
  tournament: TournamentHandle;
  engineA: string;
  engineB: string;
  baseSeed: number;
  onRun(games: number, paired: boolean): void;
  /** Torna a veure una partida interessant a la taula del laboratori. */
  onReplay(setup: MatchSetup): void;
}

const PRESETS = [10, 100, 1000];

/**
 * El mode torneig: N partides sense dibuixar-les, amb progrés, resultat,
 * partides interessants reproduïbles i exportació de l'informe (JSON i
 * AI_REPORT.md). El càlcul va en un Web Worker: la interfície no es congela.
 */
export function TournamentPanel({ tournament, engineA, engineB, baseSeed, onRun, onReplay }: Props) {
  const [games, setGames] = useState(100);
  const [custom, setCustom] = useState('');
  const [paired, setPaired] = useState(true);
  const { running, progress, result, error } = tournament;

  const effectiveGames = custom.trim() !== '' ? Number(custom) : games;
  const canRun = Number.isInteger(effectiveGames) && effectiveGames >= 1 && effectiveGames <= 100_000;

  const percent = (value: number, total: number) =>
    total === 0 ? 0 : Math.round((100 * value) / total);
  const gamesPerSecond =
    progress && progress.elapsedMs > 0 ? (1000 * progress.completed) / progress.elapsedMs : 0;
  const etaSeconds =
    progress && gamesPerSecond > 0 ? (progress.total - progress.completed) / gamesPerSecond : null;

  function exportJson() {
    if (!result) return;
    const report = buildReport(result);
    downloadText(
      `remigi-lab-${engineA}-vs-${engineB}.json`,
      JSON.stringify(report, null, 2) + '\n',
      'application/json',
    );
  }

  function exportMarkdown() {
    if (!result) return;
    downloadText('AI_REPORT.md', reportToMarkdown(buildReport(result)), 'text/markdown');
  }

  return (
    <section className="lab-panell lab-torneig" aria-label="Mode torneig">
      <h3>Torneig</h3>

      <div className="lab-torneig-config">
        <span className="muted">Partides:</span>
        {PRESETS.map((preset) => (
          <button
            key={preset}
            type="button"
            className={custom.trim() === '' && games === preset ? '' : 'secondary'}
            aria-pressed={custom.trim() === '' && games === preset}
            onClick={() => {
              setGames(preset);
              setCustom('');
            }}
            disabled={running}
          >
            {preset.toLocaleString('ca')}
          </button>
        ))}
        <input
          className="lab-torneig-custom"
          inputMode="numeric"
          placeholder="a mida"
          value={custom}
          onChange={(event) => setCustom(event.target.value.replace(/[^\d]/g, ''))}
          disabled={running}
          aria-label="Nombre de partides a mida"
        />
        <label className="check lab-torneig-parelles" title="Cada llavor es juga dues vegades amb els seients bescanviats: els dos motors juguen els mateixos repartiments des dels dos costats.">
          <input
            type="checkbox"
            checked={paired}
            onChange={(event) => setPaired(event.target.checked)}
            disabled={running}
          />
          llavors aparellades
        </label>
        {!running ? (
          <button type="button" disabled={!canRun} onClick={() => onRun(effectiveGames, paired)}>
            Executa el torneig
          </button>
        ) : (
          <button type="button" className="secondary" onClick={tournament.cancel}>
            Cancel·la
          </button>
        )}
      </div>

      {error && <p className="lab-error" role="alert">El torneig ha fallat: {error}</p>}

      {progress && (running || result) && (
        <div className="lab-progres" aria-live="polite">
          <div
            className="lab-progres-barra"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={progress.total}
            aria-valuenow={progress.completed}
          >
            <div
              className="lab-progres-fet"
              style={{ width: `${percent(progress.completed, progress.total)}%` }}
            />
          </div>
          <p className="lab-progres-text">
            {progress.completed.toLocaleString('ca')} / {progress.total.toLocaleString('ca')}{' '}
            partides · <strong>A {progress.winsA}</strong> – <strong>{progress.winsB} B</strong>
            {progress.errors > 0 && ` · ${progress.errors} errors`} ·{' '}
            {round(progress.elapsedMs / 1000, 1)} s
            {running && etaSeconds !== null && ` · falten ~${round(etaSeconds, 0)} s`}
            {gamesPerSecond > 0 && ` · ${round(gamesPerSecond, 1)} partides/s`}
          </p>
        </div>
      )}

      {result && (
        <div className="lab-torneig-resultat">
          <p
            className="lab-marcador"
            data-prova="marcador-torneig"
            data-wins-a={result.winsA}
            data-wins-b={result.winsB}
          >
            <strong>{result.engineA.name}</strong> {result.winsA} –{' '}
            {result.winsB} <strong>{result.engineB.name}</strong>
            <span className="muted">
              {' '}
              ({percent(result.winsA, result.winsA + result.winsB)}% –{' '}
              {percent(result.winsB, result.winsA + result.winsB)}% de les vàlides)
            </span>
          </p>

          {result.interesting.length > 0 && (
            <>
              <h4>Partides interessants</h4>
              <ul className="lab-interessants">
                {result.interesting.map((game) => (
                  <li key={game.kind}>
                    <div>
                      <strong>{game.label}</strong> — {game.description}{' '}
                      <span className="muted small">
                        (llavor {game.setup.seed}, comença {game.setup.firstSeat})
                      </span>
                    </div>
                    <button type="button" className="secondary" onClick={() => onReplay(game.setup)}>
                      Reprodueix
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}

          {result.errors.length > 0 && (
            <details className="lab-errors">
              <summary>{result.errors.length} partides amb error</summary>
              <ul>
                {result.errors.map((gameError) => (
                  <li key={gameError.gameIndex}>
                    Partida {gameError.gameIndex + 1} (llavor {gameError.seed}, comença{' '}
                    {gameError.firstSeat}), torn {gameError.turn}: {gameError.message}
                  </li>
                ))}
              </ul>
            </details>
          )}

          <div className="lab-exporta">
            <button type="button" className="secondary" onClick={exportJson}>
              Exporta JSON
            </button>
            <button type="button" className="secondary" onClick={exportMarkdown}>
              Exporta AI_REPORT.md
            </button>
          </div>
        </div>
      )}

      {!running && !result && (
        <p className="muted small">
          Executa 10, 100 o 1.000 partides amb la llavor base {baseSeed}: sense dibuixar-les,
          només comptant. Les llavors de cada partida en surten de manera reproduïble.
        </p>
      )}
    </section>
  );
}
