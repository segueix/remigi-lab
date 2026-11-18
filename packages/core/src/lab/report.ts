import { engineSpecDiff, engineSpecById } from './catalog';
import { HIEROGLYPH_THRESHOLD } from './hieroglyph';
import { round } from './stats';
import { SIGNIFICANCE_ALPHA, significance, type Significance } from './significance';
import type {
  EngineAggregate,
  EngineSpecSummary,
  InterestingGame,
  TournamentResult,
} from './tournament';

/**
 * Informe d'una comparació: el mateix contingut en dos formats.
 *
 * - `buildReport` → JSON serialitzable (per desar, versionar o processar);
 * - `reportToMarkdown` → `AI_REPORT.md`, llegible per persones.
 *
 * L'informe és **descriptiu**: diu què s'ha mesurat i on trobar les partides
 * interessants (llavor + seient: tot el que cal per reproduir-les). No decideix
 * quin motor passa a producció.
 */

export interface LabReport {
  schema: 'remigi-ai-lab-report/1';
  generatedAt: string;
  engineVersion: string;
  engineA: EngineSpecSummary;
  engineB: EngineSpecSummary;
  games: number;
  baseSeed: number;
  paired: boolean;
  winsA: number;
  winsB: number;
  turnsMean: number;
  durationMs: number;
  metricsA: EngineAggregate;
  metricsB: EngineAggregate;
  /** Quant es pot fiar de la diferència: IC, contrast i anàlisi per parells. */
  significance: Significance;
  interestingGames: InterestingGame[];
  errors: TournamentResult['errors'];
  /** Si el torneig s'ha repartit entre processos: quants shards s'han fusionat. */
  shards?: number;
}

export interface ReportOptions {
  /** Data de l'informe (per defecte, ara); es pot fixar per a tests. */
  generatedAt?: string;
  /** Nombre de shards fusionats (només si n'hi ha més d'un). */
  shards?: number;
}

export function buildReport(result: TournamentResult, options: ReportOptions = {}): LabReport {
  return {
    schema: 'remigi-ai-lab-report/1',
    generatedAt: options.generatedAt ?? new Date().toISOString(),
    engineVersion: result.engineVersion,
    engineA: result.engineA,
    engineB: result.engineB,
    games: result.config.games,
    baseSeed: result.config.baseSeed,
    paired: result.config.paired,
    winsA: result.winsA,
    winsB: result.winsB,
    turnsMean: result.turnsMean,
    durationMs: result.durationMs,
    metricsA: result.aggregates.A,
    metricsB: result.aggregates.B,
    significance: significance(result.summaries),
    interestingGames: result.interesting,
    errors: result.errors,
    ...(options.shards && options.shards > 1 ? { shards: options.shards } : {}),
  };
}

const percent = (value: number) => `${round(100 * value, 1)}%`;
const ms = (value: number) => `${round(value, 1)} ms`;
const num = (value: number, digits = 1) => String(round(value, digits));
const pValueText = (p: number) => (p < 0.0001 ? 'p < 0,0001' : `p = ${String(round(p, 4)).replace('.', ',')}`);

/** La secció de significació: el que el marcador sol no diu. */
function significanceSection(report: LabReport): string {
  const sig = report.significance;
  const { engineA, engineB } = report;
  const lines = [
    `Sobre ${sig.decisiveGames} partides decisives, ${engineA.name} en guanya el **${percent(sig.winRateA)}** (interval de confiança del 95%: ${percent(sig.ci95[0])}–${percent(sig.ci95[1])}). Amb aquest nombre de partides la diferència més petita que es pot distingir del soroll és d'uns **±${round(100 * sig.marginOfError, 2)} punts** de quota.`,
    `Contrast de signes sobre partides: ${pValueText(sig.pValue)}.`,
  ];
  if (sig.paired) {
    lines.push(
      `Anàlisi per llavors aparellades (${sig.paired.pairs} parells; cada repartiment jugat des dels dos seients, que anul·la la sort de la mà): ${engineA.name} guanya les dues partides de ${sig.paired.aBoth} llavors, ${engineB.name} de ${sig.paired.bBoth}, i es reparteixen ${sig.paired.split}. ${pValueText(sig.paired.pValue)}.`,
    );
  }
  const basis = sig.basis === 'parells' ? 'l’anàlisi per parells' : 'el contrast de partides';
  const who = sig.verdict === 'a-millor' ? engineA.name : engineB.name;
  lines.push(
    sig.verdict === 'sense-diferencia'
      ? `**Sense diferència estadísticament significativa** (${basis}, α = ${SIGNIFICANCE_ALPHA}): el resultat és compatible amb el soroll; un empat aparent no demostra que els dos motors siguin iguals, només que aquest torneig no els distingeix.`
      : `**Diferència estadísticament significativa a favor de ${who}** (${basis}, α = ${SIGNIFICANCE_ALPHA}). Significativa no vol dir gran: cal mirar també la mida de la diferència.`,
  );
  return lines.join('\n\n');
}

/** Ordre de reproducció d'una partida interessant, per enganxar al terminal. */
function replayCommand(report: LabReport, game: InterestingGame): string {
  return `npm run lab -- --match --engine-a ${report.engineA.id} --engine-b ${report.engineB.id} --seed ${game.setup.seed} --first ${game.setup.firstSeat}`;
}

/** Files de la taula comparativa (les mateixes del dashboard del laboratori). */
export function comparisonRows(
  a: EngineAggregate,
  b: EngineAggregate,
): { label: string; a: string; b: string }[] {
  return [
    { label: 'Victòries', a: String(a.wins), b: String(b.wins) },
    { label: '% victòries', a: percent(a.winRate), b: percent(b.winRate) },
    { label: 'Punts mitjans', a: num(a.pointsMean), b: num(b.pointsMean) },
    { label: 'Fitxes jugades/torn', a: num(a.tilesPerTurn, 2), b: num(b.tilesPerTurn, 2) },
    { label: 'Temps mitjà/jugada', a: ms(a.timeMsMean), b: ms(b.timeMsMean) },
    { label: 'p95 temps/jugada', a: ms(a.timeMsP95), b: ms(b.timeMsP95) },
    { label: 'Nodes mitjans/cerca', a: num(a.nodesMeanPerSearch, 0), b: num(b.nodesMeanPerSearch, 0) },
    { label: 'Cerques limitades', a: String(a.searchLimited), b: String(b.searchLimited) },
    { label: 'Reordenacions', a: String(a.rearranges), b: String(b.rearranges) },
    { label: 'Errades simulades', a: String(a.mistakes), b: String(b.mistakes) },
    { label: 'Jeroglífics', a: String(a.hieroglyphs), b: String(b.hieroglyphs) },
    { label: 'Jeroglífics/partida', a: num(a.hieroglyphsPerGame, 2), b: num(b.hieroglyphsPerGame, 2) },
    { label: 'Complexitat mitjana', a: num(a.complexityMean, 2), b: num(b.complexityMean, 2) },
    { label: 'Jugada més complexa', a: String(a.maxHieroglyph.score), b: String(b.maxHieroglyph.score) },
    { label: 'Màx. fitxes recol·locades', a: String(a.maxRelocatedTiles), b: String(b.maxRelocatedTiles) },
    { label: 'Màx. jugades alterades', a: String(a.maxAlteredMelds), b: String(b.maxAlteredMelds) },
  ];
}

/** Conclusió descriptiva: què diuen els números, sense prendre cap decisió. */
function conclusion(report: LabReport): string {
  const { engineA, engineB, winsA, winsB, metricsA, metricsB } = report;
  const lines: string[] = [];

  if (winsA === winsB) {
    lines.push(
      `**Empat a ${winsA}**: amb aquestes ${report.games} partides no hi ha un guanyador clar.`,
    );
  } else {
    const [strong, weak, strongWins, weakWins] =
      winsA > winsB ? [engineA, engineB, winsA, winsB] : [engineB, engineA, winsB, winsA];
    lines.push(
      `**${strong.name}** guanya la comparació: ${strongWins} victòries contra ${weakWins} de ${weak.name} (${percent(strongWins / report.games)} de les partides vàlides).`,
    );
  }

  const [complex, plain] =
    metricsA.complexityMean >= metricsB.complexityMean
      ? [
          { name: engineA.name, metrics: metricsA },
          { name: engineB.name, metrics: metricsB },
        ]
      : [
          { name: engineB.name, metrics: metricsB },
          { name: engineA.name, metrics: metricsA },
        ];
  if (complex.metrics.complexityMean > plain.metrics.complexityMean) {
    lines.push(
      `${complex.name} fa les jugades més complexes (complexitat mitjana ${num(complex.metrics.complexityMean, 2)} vs ${num(plain.metrics.complexityMean, 2)}; ${complex.metrics.hieroglyphs} jeroglífics vs ${plain.metrics.hieroglyphs}).`,
    );
  } else {
    lines.push(
      `Tots dos motors mostren la mateixa complexitat mitjana (${num(complex.metrics.complexityMean, 2)}).`,
    );
  }

  if (report.errors.length > 0) {
    lines.push(
      `⚠️ ${report.errors.length} partides han acabat en error: no compten com a victòria de ningú i queden llistades per reproduir-les.`,
    );
  }
  return lines.join('\n\n');
}

/** L'informe en Markdown: el contingut d'`AI_REPORT.md`. */
export function reportToMarkdown(report: LabReport): string {
  const { engineA, engineB } = report;
  const differences = engineSpecDiff(engineSpecById(engineA.id), engineSpecById(engineB.id));

  const engineRow = (spec: EngineSpecSummary) =>
    `| ${spec.name} | \`${spec.id}\` | ${spec.version} | ${spec.strategy} | ${spec.params.key} | ${spec.config.maxNodes ?? '—'} | ${spec.params.mistakeRate} |`;

  const sections: string[] = [];
  sections.push(`# Informe del laboratori Remigi AI Lab

Generat: ${report.generatedAt} · motor remigi-engine v${report.engineVersion} · ${report.games} partides (llavor base ${report.baseSeed}${report.paired ? ', llavors aparellades amb seients bescanviats' : ''}) · ${round(report.durationMs / 1000, 1)} s de càlcul${report.shards ? ` (repartit en ${report.shards} shards)` : ''}.

## Motors comparats

| Motor | id | versió | estratègia | nivell | maxNodes | mistakeRate |
|---|---|---|---|---|---:|---:|
${engineRow(engineA)}
${engineRow(engineB)}`);

  if (differences.length > 0) {
    sections.push(`### Diferències de configuració

\`\`\`text
${differences.map((d) => `${d.key}\n  A: ${d.a}\n  B: ${d.b}`).join('\n')}
\`\`\``);
  } else {
    sections.push(
      `### Diferències de configuració\n\nCap: tots dos costats juguen amb paràmetres idèntics (només canvia la llavor del seu RNG).`,
    );
  }

  sections.push(`## Resultat

| Mètrica | ${engineA.name} (A) | ${engineB.name} (B) |
|---|---:|---:|
${comparisonRows(report.metricsA, report.metricsB)
  .map((row) => `| ${row.label} | ${row.a} | ${row.b} |`)
  .join('\n')}

Mitjana de torns per partida: ${num(report.turnsMean)}.

Un **jeroglífic** és una jugada amb complexitat de reconstrucció ≥ ${HIEROGLYPH_THRESHOLD}
segons la mètrica del laboratori (vegeu \`docs/AI-LAB.md\`): telemetria
determinista que no influeix en cap decisió del motor.`);

  if (report.interestingGames.length > 0) {
    sections.push(`## Partides interessants

Cada partida es reprodueix exactament amb la seva llavor i el seient inicial:

${report.interestingGames
  .map(
    (game) =>
      `- **${game.label}** — ${game.description} (partida ${game.gameIndex + 1}, llavor ${game.setup.seed}, comença ${game.setup.firstSeat})\n  \`${replayCommand(report, game)}\``,
  )
  .join('\n')}`);
  }

  if (report.errors.length > 0) {
    sections.push(`## Errors

${report.errors
  .map(
    (error) =>
      `- Partida ${error.gameIndex + 1} (llavor ${error.seed}, comença ${error.firstSeat}), torn ${error.turn}: ${error.message}`,
  )
  .join('\n')}`);
  }

  sections.push(`## Significació estadística

${significanceSection(report)}`);

  sections.push(`## Conclusió

${conclusion(report)}`);

  return sections.join('\n\n') + '\n';
}
