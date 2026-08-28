import { createMatch, type LabTurn } from '@remigi/core';
import { describe, expect, it } from 'vitest';
import { boardMarks, describeMove, liveRows, liveSeatStats } from './labSession';

/** Una partida curta de debò, per no inventar-se registres a mà. */
function playedTurns(): readonly LabTurn[] {
  const run = createMatch({
    engineA: 'medium-v1',
    engineB: 'easy-v1',
    seed: 11,
    keepBoards: true,
  });
  while (!run.done) run.step();
  return run.turns;
}

describe('estadística en viu de la partida visual', () => {
  const turns = playedTurns();

  it('separa net els dos costats i quadra amb els registres', () => {
    const a = liveSeatStats(turns, 'A');
    const b = liveSeatStats(turns, 'B');
    expect(a.moves + b.moves).toBe(turns.length);
    expect(a.moves).toBe(turns.filter((turn) => turn.seat === 'A').length);
    expect(a.tilesPlayed).toBe(
      turns.filter((t) => t.seat === 'A').reduce((total, t) => total + t.tilesPlayed, 0),
    );
    expect(a.playMoves + a.drawMoves).toBe(a.moves);
    expect(a.hieroglyphs).toBe(
      turns.filter((t) => t.seat === 'A' && t.hieroglyph.isHieroglyph).length,
    );
  });

  it('amb cap torn, tot és zero (la taula en viu no peta al principi)', () => {
    const empty = liveSeatStats([], 'A');
    expect(empty.moves).toBe(0);
    expect(empty.tilesPerTurn).toBe(0);
    expect(empty.complexityMean).toBe(0);
    expect(liveRows(empty, empty).every((row) => row.a === row.b)).toBe(true);
  });

  it('les files en viu porten les mètriques principals', () => {
    const rows = liveRows(liveSeatStats(turns, 'A'), liveSeatStats(turns, 'B'));
    const labels = rows.map((row) => row.label);
    for (const expected of [
      'Moviments',
      'Fitxes jugades/torn',
      'Temps mitjà/jugada',
      'Nodes totals',
      'Reordenacions',
      'Jeroglífics',
      'Complexitat mitjana',
    ]) {
      expect(labels).toContain(expected);
    }
  });

  it('les marques del tauler surten del jeroglífic del torn', () => {
    const played = turns.find((turn) => turn.moveType === 'play')!;
    const { bots, marks } = boardMarks(played);
    expect(bots.size).toBe(played.hieroglyph.playedTileIds.length);
    for (const id of played.hieroglyph.playedTileIds) {
      expect(bots.get(id)).toBe(played.seat === 'A' ? 1 : 2);
    }
    for (const id of played.hieroglyph.relocatedTileIds) {
      expect(marks.get(id)).toBe('moved');
    }
    expect(boardMarks(null).bots.size).toBe(0);
  });

  it('descriu els moviments en paraules', () => {
    const played = turns.find((turn) => turn.moveType === 'play')!;
    expect(describeMove(played)).toMatch(/^baixa \d+ fitx/);
    const drawn = turns.find((turn) => turn.moveType === 'draw');
    if (drawn) expect(['roba', 'roba (errada simulada)', 'passa']).toContain(describeMove(drawn));
  });
});
