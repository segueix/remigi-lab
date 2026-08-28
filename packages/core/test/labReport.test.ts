import { describe, expect, it } from 'vitest';
import { buildReport, comparisonRows, reportToMarkdown } from '../src/lab/report';
import { runTournament } from '../src/lab/tournament';

const result = runTournament({
  engineA: 'medium-v1',
  engineB: 'rookie-v1',
  games: 4,
  baseSeed: 15,
});

describe('informe del laboratori', () => {
  it('el JSON porta l’esquema, els motors i les mètriques del torneig', () => {
    const report = buildReport(result, { generatedAt: '2026-08-28T00:00:00.000Z' });
    expect(report.schema).toBe('remigi-ai-lab-report/1');
    expect(report.generatedAt).toBe('2026-08-28T00:00:00.000Z');
    expect(report.engineA.id).toBe('medium-v1');
    expect(report.engineB.id).toBe('rookie-v1');
    expect(report.games).toBe(4);
    expect(report.baseSeed).toBe(15);
    expect(report.winsA).toBe(result.winsA);
    expect(report.winsB).toBe(result.winsB);
    expect(report.metricsA).toEqual(result.aggregates.A);
    expect(report.interestingGames).toEqual(result.interesting);
    // Ha de poder anar a un fitxer i tornar sense perdre res.
    expect(JSON.parse(JSON.stringify(report))).toEqual(report);
  });

  it('la taula comparativa té les files del dashboard', () => {
    const rows = comparisonRows(result.aggregates.A, result.aggregates.B);
    const labels = rows.map((row) => row.label);
    for (const expected of [
      'Victòries',
      '% victòries',
      'Punts mitjans',
      'Temps mitjà/jugada',
      'p95 temps/jugada',
      'Nodes mitjans/cerca',
      'Cerques limitades',
      'Fitxes jugades/torn',
      'Reordenacions',
      'Jeroglífics',
      'Jeroglífics/partida',
      'Complexitat mitjana',
    ]) {
      expect(labels).toContain(expected);
    }
    expect(rows.find((row) => row.label === 'Victòries')!.a).toBe(String(result.winsA));
  });

  it('el Markdown porta motors, resultat, partides interessants i conclusió', () => {
    const report = buildReport(result, { generatedAt: '2026-08-28T00:00:00.000Z' });
    const markdown = reportToMarkdown(report);
    expect(markdown).toContain('# Informe del laboratori Remigi AI Lab');
    expect(markdown).toContain('`medium-v1`');
    expect(markdown).toContain('`rookie-v1`');
    expect(markdown).toContain('| Victòries |');
    expect(markdown).toContain('## Conclusió');
    // Les diferències de configuració entre nivells diferents hi han de ser.
    expect(markdown).toContain('mistakeRate');
    // Cada partida interessant porta l'ordre exacta per reproduir-la.
    for (const game of report.interestingGames) {
      expect(markdown).toContain(`--seed ${game.setup.seed} --first ${game.setup.firstSeat}`);
    }
  });

  it('la conclusió és descriptiva i cita el guanyador quan n’hi ha', () => {
    const report = buildReport(result, { generatedAt: '2026-08-28T00:00:00.000Z' });
    const markdown = reportToMarkdown(report);
    if (report.winsA !== report.winsB) {
      const winner = report.winsA > report.winsB ? report.engineA.name : report.engineB.name;
      expect(markdown).toContain(`**${winner}** guanya la comparació`);
    } else {
      expect(markdown).toContain('Empat');
    }
  });
});
