import type { EngineSpec, LabTurn, Meld, Seat, Tile } from '@remigi/core';
import { MeldView } from '../components/MeldView';
import { TileView } from '../components/TileView';
import { boardMarks } from './labSession';

interface Props {
  board: Meld[];
  racks: Record<Seat, Tile[]>;
  specs: Record<Seat, EngineSpec>;
  /** A qui toca (per ressaltar la seva mà). */
  currentSeat: Seat | null;
  /** El torn les marques del qual es pinten (l'últim, o l'inspeccionat). */
  markedTurn: LabTurn | null;
}

/**
 * La taula del laboratori: el feltre amb les jugades al mig i les **dues mans
 * a la vista** (això és una eina de desenvolupament: no s'amaga res). Les
 * fitxes del darrer moviment porten el marc del color del motor que les ha
 * baixades, i les recol·locades de la taula, el marc daurat: la zona
 * reorganitzada es veu d'un cop d'ull.
 */
export function LabBoard({ board, racks, specs, currentSeat, markedTurn }: Props) {
  const { bots, marks } = boardMarks(markedTurn);

  const rack = (seat: Seat) => (
    <aside
      className={`lab-ma lab-ma-${seat.toLowerCase()}${currentSeat === seat ? ' lab-ma-torn' : ''}`}
      aria-label={`Mà del motor ${seat} (${specs[seat].name})`}
    >
      <header className="lab-ma-cap">
        <span className="motor-color" style={{ background: specs[seat].color }} aria-hidden="true" />
        <strong>{seat}</strong> · {specs[seat].name}
        <span className="lab-ma-compte">{racks[seat].length}</span>
      </header>
      <div className="lab-ma-fitxes">
        {racks[seat].map((tile) => (
          <TileView key={tile.id} tile={tile} />
        ))}
      </div>
    </aside>
  );

  return (
    <div className="lab-tauler" data-mover={markedTurn?.seat ?? ''}>
      {rack('A')}
      <div className="board lab-board" aria-label="Taula de joc">
        {board.length === 0 && <p className="muted board-empty">La taula és buida.</p>}
        {board.map((meld, index) => (
          <MeldView
            key={index}
            meld={meld}
            index={index}
            marks={marks}
            bots={bots}
          />
        ))}
      </div>
      {rack('B')}
    </div>
  );
}
