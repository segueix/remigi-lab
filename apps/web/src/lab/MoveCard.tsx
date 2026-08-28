import { HIEROGLYPH_TIER_LABELS, round, type EngineSpec, type LabTurn } from '@remigi/core';
import { describeMove } from './labSession';

interface Props {
  turn: LabTurn;
  spec: EngineSpec;
  /** S'està mirant des de la timeline (no és l'últim moviment del directe). */
  inspected?: boolean;
}

/** La fitxa de diagnòstic d'una jugada: què ha fet el motor i què ha costat. */
export function MoveCard({ turn, spec, inspected }: Props) {
  const { hieroglyph } = turn;
  const jokerUsed =
    hieroglyph.relocatedJokers > 0 ||
    hieroglyph.playedTileIds.some((id) => id.startsWith('joker'));
  const meldsChanged = hieroglyph.alteredMelds + hieroglyph.extendedMelds;

  return (
    <section
      className={`lab-panell move-card${inspected ? ' move-card-inspeccio' : ''}`}
      aria-label={`Diagnòstic del torn ${turn.turn}`}
    >
      <header className="move-card-cap">
        <span className="motor-color" style={{ background: spec.color }} aria-hidden="true" />
        <strong>
          Motor {turn.seat} — torn {turn.turn}
        </strong>
        <span className={`hiero-tram hiero-${hieroglyph.tier}`}>
          {hieroglyph.score > 0
            ? `complexitat ${hieroglyph.score} · ${HIEROGLYPH_TIER_LABELS[hieroglyph.tier]}`
            : describeMove(turn)}
        </span>
      </header>
      <dl className="move-card-dades">
        <div>
          <dt>moviment</dt>
          <dd>{describeMove(turn)}</dd>
        </div>
        <div>
          <dt>temps</dt>
          <dd>{round(turn.thinkingTimeMs, 1)} ms</dd>
        </div>
        <div>
          <dt>nodes</dt>
          <dd>{turn.nodes.toLocaleString('ca')}</dd>
        </div>
        <div>
          <dt>límit de cerca</dt>
          <dd>{turn.searchLimited ? 'sí' : 'no'}</dd>
        </div>
        <div>
          <dt>reordenació completa</dt>
          <dd>{turn.rearrangeUsed ? 'sí' : 'no'}</dd>
        </div>
        <div>
          <dt>comodí utilitzat</dt>
          <dd>{jokerUsed ? 'sí' : 'no'}</dd>
        </div>
        <div>
          <dt>combinacions modificades</dt>
          <dd>{meldsChanged}</dd>
        </div>
        <div>
          <dt>fitxes de taula recol·locades</dt>
          <dd>{hieroglyph.relocatedTiles}</dd>
        </div>
        <div>
          <dt>combinacions noves</dt>
          <dd>{hieroglyph.createdMelds}</dd>
        </div>
        <div>
          <dt>mà · sac després</dt>
          <dd>
            A {turn.rackA} · B {turn.rackB} · sac {turn.bag}
          </dd>
        </div>
      </dl>
    </section>
  );
}
