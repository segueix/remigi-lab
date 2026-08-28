/**
 * El laboratori des del terminal: les mateixes comparacions que la interfície
 * (mateix runner, mateixes mètriques), per a scripts i CI.
 *
 *   npm run lab -- --list                        # motors del catàleg
 *   npm run lab -- --games 100                   # torneig (per defecte
 *                                                #  expert-v1 vs challenger-30k)
 *   npm run lab -- --engine-a expert-v1 --engine-b advanced-v1 --games 50
 *   npm run lab -- --games 100 --seed 42 --json informe.json --report AI_REPORT.md
 *   npm run lab -- --match --seed 7 --first B    # una partida, torn a torn
 *   npm run lab -- --no-pair                     # sense llavors aparellades
 *
 * Les partides interessants del torneig s'imprimeixen amb l'ordre exacta per
 * reproduir-les. Sortida amb codi 1 si alguna partida acaba en error.
 */
import { writeFileSync } from 'node:fs';
import { isAbsolute, join } from 'node:path';
import { ENGINE_VERSION } from '../engine';
import {
  ENGINE_CATALOG,
  HIEROGLYPH_TIER_LABELS,
  buildReport,
  comparisonRows,
  createMatch,
  engineSpecById,
  engineSpecDiff,
  reportToMarkdown,
  round,
  runTournament,
  type LabTurn,
  type Seat,
} from '../lab';

function argValue(name: string): string | null {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? (process.argv[index + 1] ?? null) : null;
}

function argNumber(name: string, fallback: number): number {
  const value = Number(argValue(name));
  return Number.isFinite(value) ? value : fallback;
}

const hasFlag = (name: string) => process.argv.includes(`--${name}`);

/**
 * Els camins de sortida relatius es resolen des d'on s'ha executat l'ordre
 * (npm posa el directori original a INIT_CWD), no des del workspace del
 * paquet: `--report AI_REPORT.md` ha de caure allà on ets.
 */
function outputPath(path: string): string {
  return isAbsolute(path) ? path : join(process.env.INIT_CWD ?? process.cwd(), path);
}

function listEngines(): void {
  console.log(`Motors al catàleg (implementació remigi-engine v${ENGINE_VERSION}):\n`);
  for (const spec of ENGINE_CATALOG) {
    const role = spec.role === 'champion' ? ' · CAMPIÓ' : spec.role === 'challenger' ? ' · challenger' : '';
    console.log(`  ${spec.id.padEnd(16)} ${spec.name} (v${spec.version})${role}`);
    console.log(`  ${' '.repeat(16)} ${spec.strategy} · nivell ${spec.config.level}${spec.config.maxNodes ? ` · maxNodes ${spec.config.maxNodes}` : ''}`);
  }
  console.log('\nUna partida:  npm run lab -- --match --engine-a <id> --engine-b <id> --seed <n>');
  console.log('Un torneig:   npm run lab -- --engine-a <id> --engine-b <id> --games <n> --seed <n>');
}

function describeTurn(turn: LabTurn): string {
  const move =
    turn.moveType === 'play'
      ? `baixa ${turn.tilesPlayed} fitxes`
      : turn.wasPass
        ? 'passa'
        : turn.mistake
          ? 'roba (errada simulada)'
          : 'roba';
  const parts = [
    `torn ${String(turn.turn).padStart(3)}`,
    `${turn.seat} (${turn.engineId})`,
    move.padEnd(24),
    `${round(turn.thinkingTimeMs, 1)} ms`,
  ];
  if (turn.nodes > 0) parts.push(`${turn.nodes} nodes${turn.searchLimited ? ' (limitada)' : ''}`);
  if (turn.rearrangeUsed) parts.push('reordena');
  if (turn.hieroglyph.score > 0) {
    parts.push(
      `complexitat ${turn.hieroglyph.score} (${HIEROGLYPH_TIER_LABELS[turn.hieroglyph.tier]})`,
    );
  }
  return '  ' + parts.join(' · ');
}

function playOneMatch(engineA: string, engineB: string): void {
  const seed = argNumber('seed', 1);
  const firstSeat = (argValue('first') === 'B' ? 'B' : 'A') as Seat;
  const run = createMatch({ engineA, engineB, seed, firstSeat });

  console.log(
    `Partida única: A=${engineA} vs B=${engineB} · llavor ${seed} · comença ${firstSeat}\n`,
  );
  while (!run.done) {
    const turn = run.step();
    if (turn) console.log(describeTurn(turn));
  }
  const result = run.result()!;
  if (result.error) {
    console.error(`\n✖ Error al torn ${result.error.turn}: ${result.error.message}`);
    process.exitCode = 1;
    return;
  }
  console.log(
    `\nGuanya ${result.winner} (${result.winner === 'A' ? engineA : engineB})${result.blocked ? ' per bloqueig' : ''} en ${result.turns} torns · punts A ${result.points.A} / B ${result.points.B}`,
  );
  for (const seat of ['A', 'B'] as const) {
    const totals = result.totals[seat];
    console.log(
      `  ${seat}: ${totals.playMoves} jugades i ${totals.drawMoves} robades · ${totals.tilesPlayed} fitxes · ${totals.rearranges} reordenacions · ${totals.hieroglyphs} jeroglífics (màx. ${totals.maxHieroglyph.score}) · ${round(totals.thinkingTimeMs, 0)} ms`,
    );
  }
  console.log(`\nPer reproduir-la: npm run lab -- --match --engine-a ${engineA} --engine-b ${engineB} --seed ${seed} --first ${firstSeat}`);
}

function playTournament(engineA: string, engineB: string): void {
  const games = argNumber('games', 20);
  const baseSeed = argNumber('seed', 42);
  const paired = !hasFlag('no-pair');
  const quiet = hasFlag('quiet');

  const specA = engineSpecById(engineA);
  const specB = engineSpecById(engineB);
  console.log(`Torneig: A=${specA.name} (${engineA}) vs B=${specB.name} (${engineB})`);
  console.log(
    `${games} partides · llavor base ${baseSeed}${paired ? ' · llavors aparellades (cada llavor es juga des dels dos seients)' : ''}\n`,
  );
  const differences = engineSpecDiff(specA, specB);
  if (differences.length > 0) {
    console.log('Diferències de configuració:');
    for (const diff of differences) console.log(`  ${diff.key}:  A ${diff.a} · B ${diff.b}`);
    console.log('');
  }

  const step = Math.max(1, Math.floor(games / 10));
  const result = runTournament({ engineA, engineB, games, baseSeed, paired }, (progress) => {
    if (quiet || (progress.completed % step !== 0 && progress.completed !== games)) return;
    const eta =
      progress.completed === 0
        ? '?'
        : round(((progress.total - progress.completed) * progress.elapsedMs) / progress.completed / 1000, 1);
    console.log(
      `  ${String(progress.completed).padStart(String(games).length)}/${games} · A ${progress.winsA} – ${progress.winsB} B${progress.errors ? ` · ${progress.errors} errors` : ''} · ${round(progress.elapsedMs / 1000, 1)} s (falten ~${eta} s)`,
    );
  });

  console.log(`\n| Mètrica | ${specA.name} (A) | ${specB.name} (B) |`);
  console.log('|---|---:|---:|');
  for (const row of comparisonRows(result.aggregates.A, result.aggregates.B)) {
    console.log(`| ${row.label} | ${row.a} | ${row.b} |`);
  }
  console.log(`\nMitjana de torns: ${round(result.turnsMean, 1)} · durada ${round(result.durationMs / 1000, 1)} s`);

  if (result.interesting.length > 0) {
    console.log('\nPartides interessants (reproduïbles per llavor):');
    for (const game of result.interesting) {
      console.log(`  ${game.label}: ${game.description}`);
      console.log(
        `    npm run lab -- --match --engine-a ${engineA} --engine-b ${engineB} --seed ${game.setup.seed} --first ${game.setup.firstSeat}`,
      );
    }
  }
  if (result.errors.length > 0) {
    console.error(`\n✖ ${result.errors.length} partides amb error:`);
    for (const error of result.errors) {
      console.error(`  llavor ${error.seed}, comença ${error.firstSeat}, torn ${error.turn}: ${error.message}`);
    }
    process.exitCode = 1;
  }

  const report = buildReport(result);
  const jsonPath = argValue('json');
  if (jsonPath) {
    writeFileSync(outputPath(jsonPath), JSON.stringify(report, null, 2) + '\n');
    console.log(`\nInforme JSON desat a ${outputPath(jsonPath)}`);
  }
  const markdownPath = argValue('report');
  if (markdownPath) {
    writeFileSync(outputPath(markdownPath), reportToMarkdown(report));
    console.log(`Informe Markdown desat a ${outputPath(markdownPath)}`);
  }
}

function main(): void {
  console.log(`Remigi AI Lab (CLI) · motor v${ENGINE_VERSION}\n`);
  if (hasFlag('list')) return listEngines();

  const engineA = argValue('engine-a') ?? 'expert-v1';
  const engineB = argValue('engine-b') ?? 'challenger-30k';
  // Valida els dos ids d'entrada, amb el missatge del catàleg si no hi són.
  engineSpecById(engineA);
  engineSpecById(engineB);

  if (hasFlag('match')) return playOneMatch(engineA, engineB);
  return playTournament(engineA, engineB);
}

main();
