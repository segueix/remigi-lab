import {
  ENGINE_CATALOG,
  resolveEngineParams,
  type EngineSpec,
  type Seat,
} from '@remigi/core';

interface Props {
  seat: Seat;
  spec: EngineSpec;
  /** Victòries acumulades a la sessió (partides visuals + torneigs). */
  wins: number;
  /** El motor està jugant ara mateix (té el torn). */
  active: boolean;
  /** Fitxes que li queden a la mà (null si no hi ha partida en marxa). */
  rackCount: number | null;
  onSelect(engineId: string): void;
  disabled?: boolean;
}

/**
 * La targeta d'un costat del duel: quin motor hi seu, amb quina configuració
 * juga i quantes victòries porta. El selector és la porta per posar-hi
 * qualsevol versió del catàleg (vegeu docs/AI-LAB.md per afegir-n'hi).
 */
export function EngineCard({ seat, spec, wins, active, rackCount, onSelect, disabled }: Props) {
  const params = resolveEngineParams(spec);
  return (
    <section
      className={`motor-card motor-${seat.toLowerCase()}${active ? ' motor-actiu' : ''}`}
      aria-label={`Motor ${seat}`}
    >
      <header className="motor-cap">
        <span className="motor-color" style={{ background: spec.color }} aria-hidden="true" />
        <span className="motor-seient">Motor {seat}</span>
        {spec.role === 'champion' && <span className="motor-rol">Campió</span>}
        {spec.role === 'challenger' && <span className="motor-rol">Challenger</span>}
        {active && <span className="motor-torn">està jugant…</span>}
      </header>

      <label className="motor-selector">
        <span className="visualment-ocult">Motor del costat {seat}</span>
        <select
          value={spec.id}
          onChange={(event) => onSelect(event.target.value)}
          disabled={disabled}
          aria-label={`Motor del costat ${seat}`}
        >
          {ENGINE_CATALOG.map((candidate) => (
            <option key={candidate.id} value={candidate.id}>
              {candidate.name}
            </option>
          ))}
        </select>
      </label>

      <p className="motor-info" title={spec.description}>
        <strong>v{spec.version}</strong> · {spec.strategy}
      </p>

      <ul className="motor-config">
        <li>nivell {params.key}</li>
        <li>maxNodes {params.maxNodes ?? '—'}</li>
        <li>errades {Math.round(params.mistakeRate * 100)}%</li>
        <li>{params.rearrangesTable ? 'reordena la taula' : 'sense reordenació'}</li>
      </ul>

      <p className="motor-peu">
        <span className="motor-victories">
          Victòries: <strong>{wins}</strong>
        </span>
        {rackCount !== null && (
          <span className="motor-fitxes">
            {rackCount} {rackCount === 1 ? 'fitxa' : 'fitxes'} a la mà
          </span>
        )}
      </p>
    </section>
  );
}
