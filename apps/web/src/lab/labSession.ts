import { round, type LabTurn, type Seat } from '@remigi/core';

/**
 * Estadística en viu d'una partida visual: es calcula dels registres de torn
 * del runner (funcions pures, provades a `labSession.test.ts`). Per als
 * torneigs, els agregats venen fets del core (`TournamentResult`).
 */

export interface LiveSeatStats {
  moves: number;
  playMoves: number;
  drawMoves: number;
  mistakes: number;
  tilesPlayed: number;
  tilesPerTurn: number;
  timeMsTotal: number;
  timeMsMean: number;
  nodesTotal: number;
  searchLimited: number;
  rearranges: number;
  hieroglyphs: number;
  complexityMean: number;
  maxHieroglyph: { score: number; turn: number };
}

export function liveSeatStats(turns: readonly LabTurn[], seat: Seat): LiveSeatStats {
  const own = turns.filter((turn) => turn.seat === seat);
  const playMoves = own.filter((turn) => turn.moveType === 'play');
  const tilesPlayed = own.reduce((total, turn) => total + turn.tilesPlayed, 0);
  const timeMsTotal = own.reduce((total, turn) => total + turn.thinkingTimeMs, 0);
  const scoreTotal = own.reduce((total, turn) => total + turn.hieroglyph.score, 0);
  let maxHieroglyph = { score: 0, turn: 0 };
  for (const turn of own) {
    if (turn.hieroglyph.score > maxHieroglyph.score) {
      maxHieroglyph = { score: turn.hieroglyph.score, turn: turn.turn };
    }
  }
  return {
    moves: own.length,
    playMoves: playMoves.length,
    drawMoves: own.length - playMoves.length,
    mistakes: own.filter((turn) => turn.mistake).length,
    tilesPlayed,
    tilesPerTurn: own.length === 0 ? 0 : tilesPlayed / own.length,
    timeMsTotal,
    timeMsMean: own.length === 0 ? 0 : timeMsTotal / own.length,
    nodesTotal: own.reduce((total, turn) => total + turn.nodes, 0),
    searchLimited: own.filter((turn) => turn.searchLimited).length,
    rearranges: own.filter((turn) => turn.rearrangeUsed).length,
    hieroglyphs: own.filter((turn) => turn.hieroglyph.isHieroglyph).length,
    complexityMean: playMoves.length === 0 ? 0 : scoreTotal / playMoves.length,
    maxHieroglyph,
  };
}

/** Files de la taula en viu (mateix format que les del torneig). */
export function liveRows(
  a: LiveSeatStats,
  b: LiveSeatStats,
): { label: string; a: string; b: string }[] {
  const num = (value: number, digits = 1) => String(round(value, digits));
  return [
    { label: 'Moviments', a: String(a.moves), b: String(b.moves) },
    { label: 'Fitxes jugades', a: String(a.tilesPlayed), b: String(b.tilesPlayed) },
    { label: 'Fitxes jugades/torn', a: num(a.tilesPerTurn, 2), b: num(b.tilesPerTurn, 2) },
    { label: 'Temps mitjà/jugada', a: `${num(a.timeMsMean)} ms`, b: `${num(b.timeMsMean)} ms` },
    { label: 'Temps total', a: `${num(a.timeMsTotal, 0)} ms`, b: `${num(b.timeMsTotal, 0)} ms` },
    { label: 'Nodes totals', a: String(a.nodesTotal), b: String(b.nodesTotal) },
    { label: 'Cerques limitades', a: String(a.searchLimited), b: String(b.searchLimited) },
    { label: 'Reordenacions', a: String(a.rearranges), b: String(b.rearranges) },
    { label: 'Errades simulades', a: String(a.mistakes), b: String(b.mistakes) },
    { label: 'Jeroglífics', a: String(a.hieroglyphs), b: String(b.hieroglyphs) },
    { label: 'Complexitat mitjana', a: num(a.complexityMean, 2), b: num(b.complexityMean, 2) },
    {
      label: 'Jugada més complexa',
      a: a.maxHieroglyph.score > 0 ? `${a.maxHieroglyph.score} (torn ${a.maxHieroglyph.turn})` : '—',
      b: b.maxHieroglyph.score > 0 ? `${b.maxHieroglyph.score} (torn ${b.maxHieroglyph.turn})` : '—',
    },
  ];
}

/**
 * Marques del tauler per a un torn: les fitxes baixades porten el número del
 * seient (1 = A, 2 = B; el color de debò el posa el CSS del laboratori amb el
 * color del motor) i les recol·locades la marca daurada de «moved».
 */
export function boardMarks(turn: LabTurn | null): {
  bots: Map<string, number>;
  marks: Map<string, 'moved'>;
} {
  const bots = new Map<string, number>();
  const marks = new Map<string, 'moved'>();
  if (turn) {
    const seatNumber = turn.seat === 'A' ? 1 : 2;
    for (const id of turn.hieroglyph.playedTileIds) bots.set(id, seatNumber);
    for (const id of turn.hieroglyph.relocatedTileIds) marks.set(id, 'moved');
  }
  return { bots, marks };
}

/** El moviment d'un torn, en una frase curta per a la timeline i les fitxes. */
export function describeMove(turn: LabTurn): string {
  if (turn.moveType === 'play') {
    return `baixa ${turn.tilesPlayed} ${turn.tilesPlayed === 1 ? 'fitxa' : 'fitxes'}`;
  }
  if (turn.wasPass) return 'passa';
  return turn.mistake ? 'roba (errada simulada)' : 'roba';
}
