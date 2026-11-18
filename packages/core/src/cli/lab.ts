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
 *   npm run lab -- --probe --engine-a challenger-punts --engine-b expert-v2 --games 100
 *                                                # quantes jugades canvia de debò
 *                                                #  la variant respecte del Campió
 *
 * Tornejos grans, repartits entre processos o màquines (vegeu docs/AI-LAB.md):
 *   npm run lab -- --games 100000 --workers 4 --json informe.json
 *                                                # 4 processos locals i fusió
 *   npm run lab -- --games 100000 --shard 3/20 --shard-out shard-3.json
 *                                                # només el tros 3 de 20
 *   npm run lab -- --merge shards/ --json informe.json --report AI_REPORT.md
 *                                                # fusiona els trossos (fitxers o carpetes)
 *
 * Les partides interessants del torneig s'imprimeixen amb l'ordre exacta per
 * reproduir-les. Sortida amb codi 1 si alguna partida acaba en error.
 */
import { spawn } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { isAbsolute, join } from 'node:path';
import { ENGINE_VERSION } from '../engine';
import {
  ENGINE_CATALOG,
  HIEROGLYPH_TIER_LABELS,
  buildReport,
  comparisonRows,
  createMatch,
  createTournament,
  describeProbe,
  engineSpecById,
  engineSpecDiff,
  probeTieBreak,
  mergeTournamentShards,
  reportToMarkdown,
  round,
  runTournament,
  shardRange,
  SHARD_SCHEMA,
  type LabTurn,
  type Seat,
  type TournamentResult,
  type TournamentShard,
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

/**
 * La sonda del desempat: no diu qui guanya, diu **si la variant arriba a fer
 * res**. Un torneig igualat pot voler dir que la hipòtesi és falsa o que
 * s'activa massa poc; això ho distingeix.
 */
function runProbe(variant: string, reference: string): void {
  const games = argNumber('games', 100);
  const baseSeed = argNumber('seed', 42);
  console.log(
    `Sondejant ${games} partides (llavor base ${baseSeed}). Cada decisió de la variant es compara amb la que hauria pres ${reference} en la mateixa posició: costa el doble de càlcul.\n`,
  );
  const probe = probeTieBreak({ variant, reference, games, baseSeed });
  console.log(describeProbe(probe));

  console.log('');
  if (probe.changed === 0) {
    console.log('La variant NO canvia mai la jugada: davant d’aquest rival és el mateix motor.');
  } else if (probe.changedRate < 0.05) {
    console.log(
      'La variant s’activa molt poc: un torneig igualat no vol dir que la idea sigui dolenta, sinó que gairebé mai no arriba a aplicar-se. Per moure el marcador caldria eixamplar-la.',
    );
  } else {
    console.log(
      'La variant s’activa sovint: si tot i això el torneig queda igualat, la idea sí que és neutra o dolenta i es pot descartar.',
    );
  }
}

function parseShardSpec(spec: string): { index: number; count: number } {
  const match = /^(\d+)\/(\d+)$/.exec(spec);
  const index = match ? Number(match[1]) : NaN;
  const count = match ? Number(match[2]) : NaN;
  if (!match || index < 1 || index > count) {
    throw new Error(`--shard espera «i/n» amb 1 ≤ i ≤ n (per exemple 3/20), i s'ha donat «${spec}»`);
  }
  return { index: index - 1, count };
}

/** Escriu el progrés d'un torneig, ~10 línies en tot el torneig. */
function progressPrinter(total: number, quiet: boolean) {
  const step = Math.max(1, Math.floor(total / 10));
  return (progress: { completed: number; total: number; winsA: number; winsB: number; errors: number; elapsedMs: number }) => {
    if (quiet || (progress.completed % step !== 0 && progress.completed !== total)) return;
    const eta =
      progress.completed === 0
        ? '?'
        : round(((progress.total - progress.completed) * progress.elapsedMs) / progress.completed / 1000, 1);
    console.log(
      `  ${String(progress.completed).padStart(String(total).length)}/${total} · A ${progress.winsA} – ${progress.winsB} B${progress.errors ? ` · ${progress.errors} errors` : ''} · ${round(progress.elapsedMs / 1000, 1)} s (falten ~${eta} s)`,
    );
  };
}

function printHeader(engineA: string, engineB: string, games: number, baseSeed: number, paired: boolean): void {
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
}

/** Taula, partides interessants, errors i informes d'un torneig acabat (o fusionat). */
function printResult(result: TournamentResult, shards?: number): void {
  const { engineA, engineB } = result.config;
  const specA = engineSpecById(engineA);
  const specB = engineSpecById(engineB);
  console.log(`\n| Mètrica | ${specA.name} (A) | ${specB.name} (B) |`);
  console.log('|---|---:|---:|');
  for (const row of comparisonRows(result.aggregates.A, result.aggregates.B)) {
    console.log(`| ${row.label} | ${row.a} | ${row.b} |`);
  }
  console.log(`\nMitjana de torns: ${round(result.turnsMean, 1)} · durada ${round(result.durationMs / 1000, 1)} s${shards ? ' de càlcul acumulat' : ''}`);

  const report = buildReport(result, { shards });
  const sig = report.significance;
  console.log(
    `\nA guanya el ${round(100 * sig.winRateA, 2)}% de ${sig.decisiveGames} partides decisives (IC 95%: ${round(100 * sig.ci95[0], 2)}–${round(100 * sig.ci95[1], 2)}%; ±${round(100 * sig.marginOfError, 2)} punts) · ${
      sig.verdict === 'sense-diferencia'
        ? 'SENSE diferència significativa'
        : `diferència significativa a favor de ${sig.verdict === 'a-millor' ? 'A' : 'B'}`
    } (${sig.basis}${sig.paired ? `: ${sig.paired.aBoth} llavors per A, ${sig.paired.bBoth} per B, ${sig.paired.split} repartides` : ''})`,
  );

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

function playTournament(engineA: string, engineB: string): void {
  const games = argNumber('games', 20);
  const baseSeed = argNumber('seed', 42);
  const paired = !hasFlag('no-pair');
  printHeader(engineA, engineB, games, baseSeed, paired);
  const result = runTournament(
    { engineA, engineB, games, baseSeed, paired },
    progressPrinter(games, hasFlag('quiet')),
  );
  printResult(result);
}

/** Juga només un tros del torneig i el desa en un fitxer fusionable. */
function playShard(engineA: string, engineB: string): void {
  const games = argNumber('games', 20);
  const baseSeed = argNumber('seed', 42);
  const paired = !hasFlag('no-pair');
  const { index, count } = parseShardSpec(argValue('shard')!);
  const out = argValue('shard-out');
  if (!out) throw new Error('--shard necessita --shard-out <fitxer.json> per desar el tros');

  const range = shardRange(games, paired, index, count);
  console.log(
    `Shard ${index + 1}/${count} del torneig A=${engineA} vs B=${engineB}: partides ${range.start + 1}–${range.end} de ${games} · llavor base ${baseSeed}${paired ? ' · aparellades' : ''}\n`,
  );
  const run = createTournament({ engineA, engineB, games, baseSeed, paired, range });
  const print = progressPrinter(run.total, hasFlag('quiet'));
  while (!run.done) {
    run.runNext();
    print(run.progress());
  }
  const shard = run.shard()!;
  writeFileSync(outputPath(out), JSON.stringify(shard));
  const errors = shard.summaries.filter((summary) => summary.error).length;
  console.log(
    `\nShard desat a ${outputPath(out)} (${shard.summaries.length} partides${errors ? `, ${errors} amb error` : ''}, ${round(shard.durationMs / 1000, 1)} s)`,
  );
}

/** Els fitxers de shard d'una llista de camins (cada un, un fitxer o una carpeta). */
function readShards(paths: string[]): TournamentShard[] {
  const files = paths.flatMap((path) => {
    const resolved = outputPath(path);
    return statSync(resolved).isDirectory()
      ? readdirSync(resolved)
          .filter((name) => name.endsWith('.json'))
          .sort()
          .map((name) => join(resolved, name))
      : [resolved];
  });
  const shards: TournamentShard[] = [];
  for (const file of files) {
    const data = JSON.parse(readFileSync(file, 'utf8')) as { schema?: string };
    if (data.schema !== SHARD_SCHEMA) {
      console.log(`  (s'ignora ${file}: no és un shard del laboratori)`);
      continue;
    }
    shards.push(data as TournamentShard);
  }
  return shards;
}

function mergeShards(paths: string[]): void {
  if (paths.length === 0) throw new Error('--merge necessita fitxers o carpetes de shards');
  const shards = readShards(paths);
  console.log(`Fusionant ${shards.length} shards…`);
  const result = mergeTournamentShards(shards);
  const { engineA, engineB, games, baseSeed, paired } = result.config;
  console.log('');
  printHeader(engineA, engineB, games, baseSeed, paired);
  printResult(result, shards.length);
}

/**
 * Reparteix el torneig entre N processos fills d'aquest mateix CLI (un shard
 * cadascun), espera que acabin i en fusiona els fitxers. Mateix resultat que
 * sense `--workers`, en una fracció del temps.
 */
async function playWithWorkers(engineA: string, engineB: string, workers: number): Promise<void> {
  const games = argNumber('games', 20);
  const baseSeed = argNumber('seed', 42);
  const paired = !hasFlag('no-pair');
  const units = Math.ceil(games / (paired ? 2 : 1));
  const count = Math.min(workers, units);
  printHeader(engineA, engineB, games, baseSeed, paired);
  console.log(`Repartit en ${count} processos (un shard cadascun)…\n`);

  const dir = mkdtempSync(join(tmpdir(), 'remigi-lab-shards-'));
  const baseArgs = [
    '--engine-a', engineA,
    '--engine-b', engineB,
    '--games', String(games),
    '--seed', String(baseSeed),
    ...(paired ? [] : ['--no-pair']),
    '--quiet',
  ];
  try {
    await Promise.all(
      Array.from({ length: count }, (_, i) => {
        const out = join(dir, `shard-${String(i + 1).padStart(4, '0')}.json`);
        return new Promise<void>((resolve, reject) => {
          const child = spawn(
            process.execPath,
            [...process.execArgv, process.argv[1], ...baseArgs, '--shard', `${i + 1}/${count}`, '--shard-out', out],
            { stdio: ['ignore', 'ignore', 'inherit'] },
          );
          child.on('error', reject);
          child.on('exit', (code) => {
            if (code === 0) {
              console.log(`  shard ${i + 1}/${count} acabat`);
              resolve();
            } else {
              reject(new Error(`El shard ${i + 1}/${count} ha acabat amb codi ${code}`));
            }
          });
        });
      }),
    );
    const result = mergeTournamentShards(readShards([dir]));
    printResult(result, count);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/** Els valors que segueixen un flag fins al proper `--` (per a `--merge a b c`). */
function argValues(name: string): string[] {
  const index = process.argv.indexOf(`--${name}`);
  if (index < 0) return [];
  const values: string[] = [];
  for (const value of process.argv.slice(index + 1)) {
    if (value.startsWith('--')) break;
    values.push(value);
  }
  return values;
}

async function main(): Promise<void> {
  console.log(`Remigi AI Lab (CLI) · motor v${ENGINE_VERSION}\n`);
  if (hasFlag('list')) return listEngines();
  if (hasFlag('merge')) return mergeShards(argValues('merge'));

  const engineA = argValue('engine-a') ?? 'expert-v1';
  const engineB = argValue('engine-b') ?? 'challenger-30k';
  // Valida els dos ids d'entrada, amb el missatge del catàleg si no hi són.
  engineSpecById(engineA);
  engineSpecById(engineB);

  if (hasFlag('match')) return playOneMatch(engineA, engineB);
  if (hasFlag('probe')) return runProbe(engineA, engineB);
  if (hasFlag('shard')) return playShard(engineA, engineB);
  const workers = argNumber('workers', 1);
  if (workers > 1) return playWithWorkers(engineA, engineB, workers);
  return playTournament(engineA, engineB);
}

main().catch((error: unknown) => {
  console.error(`\n✖ ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
