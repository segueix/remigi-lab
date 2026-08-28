import { round, type EngineSpec, type LabTurn, type Seat } from '@remigi/core';
import { describeMove } from './labSession';

interface Props {
  turns: readonly LabTurn[];
  specs: Record<Seat, EngineSpec>;
  /** Índex del torn inspeccionat (dins de `turns`), o null. */
  viewIndex: number | null;
  onInspect(index: number | null): void;
}

/**
 * La cronologia de la partida: un torn per fila, el més nou a dalt. Clicar-ne
 * un l'inspecciona (la taula i la fitxa de diagnòstic tornen a aquell moment).
 */
export function Timeline({ turns, specs, viewIndex, onInspect }: Props) {
  if (turns.length === 0) {
    return <p className="muted small">Encara no s'ha jugat cap torn.</p>;
  }
  return (
    <ol className="lab-timeline" aria-label="Historial de jugades">
      {turns
        .map((turn, index) => ({ turn, index }))
        .reverse()
        .map(({ turn, index }) => (
          <li key={index}>
            <button
              type="button"
              className={`lab-torn${viewIndex === index ? ' lab-torn-triat' : ''}`}
              onClick={() => onInspect(viewIndex === index ? null : index)}
              aria-pressed={viewIndex === index}
            >
              <span className="lab-torn-num">{turn.turn}</span>
              <span
                className="motor-color"
                style={{ background: specs[turn.seat].color }}
                aria-hidden="true"
              />
              <span className="lab-torn-motor">{turn.seat}</span>
              <span className="lab-torn-mov">
                {describeMove(turn)}
                {turn.rearrangeUsed ? ' · reordena' : ''}
              </span>
              <span className="lab-torn-dades">
                {round(turn.thinkingTimeMs, 1)} ms
                {turn.nodes > 0 ? ` · ${turn.nodes.toLocaleString('ca')} n` : ''}
              </span>
              {turn.hieroglyph.score > 0 && (
                <span className={`hiero-punt hiero-${turn.hieroglyph.tier}`}>
                  {turn.hieroglyph.score}
                </span>
              )}
            </button>
          </li>
        ))}
    </ol>
  );
}
