import {
  ENGINE_VERSION,
  createEngine,
  difficultyByKey,
  type AiParams,
  type DifficultyKey,
  type EngineOptions,
  type RemigiEngine,
} from '../engine';

/**
 * El catàleg de motors del laboratori: les versions de la IA que es poden
 * seure a cada costat del Motor A vs Motor B.
 *
 * Cada entrada és un `EngineSpec`: identitat (id, nom, versió, estratègia,
 * color) + configuració (nivell, sostre de nodes, substitucions de
 * paràmetres). El laboratori només parla amb l'API pública del motor
 * (`createEngine` + `play`), mai amb les tripes d'`ai/`; per això **afegir una
 * versió nova és afegir una entrada aquí** — o, si la versió ve empaquetada en
 * un artefacte propi (`engine-v2.js`), donar-li una `factory` que
 * l'instanciï amb la mateixa interfície `RemigiEngine`.
 *
 * Fins que no hi hagi millores estratègiques deliberades, el catàleg conté la
 * referència (`expert-v1`, l'Expert de sempre, el Campió) i variants de
 * configuració i de nivell de la mateixa implementació: prou per validar tot
 * el circuit de comparació sense canviar ni una jugada.
 */

export interface EngineConfigSpec {
  /** Nivell del motor (fixa els paràmetres base de la cerca). */
  level: DifficultyKey;
  /** Sostre de nodes de la cerca de reordenació (absent: el del cercador). */
  maxNodes?: number;
  /** Substitucions de paràmetres del nivell (variants de configuració). */
  overrides?: Partial<AiParams>;
}

export interface EngineSpec {
  /** Identificador estable (és el que es desa a informes i reproduccions). */
  id: string;
  /** Nom per ensenyar. */
  name: string;
  /** Versió de la variant (estratègia + configuració). */
  version: string;
  /** Nom de l'estratègia que la implementa. */
  strategy: string;
  /** Versió de la implementació del motor que l'executa. */
  engineVersion: string;
  /** Una frase: què és i per què és al catàleg. */
  description: string;
  /** Color identificatiu a la interfície (llegible sobre el feltre). */
  color: string;
  /** Paper al laboratori: el Campió de referència o un Challenger. */
  role?: 'champion' | 'challenger';
  config: EngineConfigSpec;
  /**
   * Fàbrica pròpia per a motors externs (p. ex. un `engine-v2.js` importat):
   * ha de retornar la mateixa interfície `RemigiEngine`. Si no n'hi ha, es fa
   * servir el `createEngine` d'aquest workspace.
   */
  factory?: (options: EngineOptions) => RemigiEngine;
}

/**
 * El catàleg. `expert-v1` és la línia de base: l'Expert d'abans de la
 * refactorització, capturat pel test de regressió comportamental — la
 * referència contra la qual s'han de mesurar les versions futures.
 */
export const ENGINE_CATALOG: EngineSpec[] = [
  {
    id: 'expert-v1',
    name: 'Expert v1',
    version: '1.0.0',
    strategy: 'voraç + reordenació completa',
    engineVersion: ENGINE_VERSION,
    description:
      'L’Expert de referència (el Campió): cerca voraç, extensions i reordenació completa de la taula amb sostre de 120.000 nodes. Juga exactament igual que abans d’encapsular el motor.',
    color: '#2dd4bf',
    role: 'champion',
    config: { level: 'expert' },
  },
  {
    id: 'challenger-30k',
    name: 'Challenger 30k',
    version: '1.0.0+n30k',
    strategy: 'voraç + reordenació completa',
    engineVersion: ENGINE_VERSION,
    description:
      'Challenger de mostra: la mateixa estratègia que l’Expert v1 amb el sostre de cerca retallat a 30.000 nodes. Serveix per validar el circuit de comparació amb una diferència real de configuració.',
    color: '#e879f9',
    role: 'challenger',
    config: { level: 'expert', maxNodes: 30_000 },
  },
  {
    id: 'advanced-v1',
    name: 'Avançat v1',
    version: '1.0.0',
    strategy: 'voraç + extensions',
    engineVersion: ENGINE_VERSION,
    description:
      'El nivell Avançat: cerca voraç amb extensions i jokers, sense reordenació de taula, amb un 4% d’errades simulades.',
    color: '#a3e635',
    config: { level: 'advanced' },
  },
  {
    id: 'medium-v1',
    name: 'Mitjà v1',
    version: '1.0.0',
    strategy: 'voraç + extensions',
    engineVersion: ENGINE_VERSION,
    description: 'El nivell Mitjà: extensions i jokers, amb un 10% d’errades simulades.',
    color: '#60a5fa',
    config: { level: 'medium' },
  },
  {
    id: 'easy-v1',
    name: 'Fàcil v1',
    version: '1.0.0',
    strategy: 'voraç',
    engineVersion: ENGINE_VERSION,
    description:
      'El nivell Fàcil: només jugades de la mà (sense extensions), amb un 20% d’errades simulades.',
    color: '#fbbf24',
    config: { level: 'easy' },
  },
  {
    id: 'rookie-v1',
    name: 'Novell v1',
    version: '1.0.0',
    strategy: 'voraç',
    engineVersion: ENGINE_VERSION,
    description:
      'El nivell Novell: sense extensions ni jokers i amb un 35% d’errades simulades. Útil com a fons de rendiment.',
    color: '#f87171',
    config: { level: 'rookie' },
  },
];

/** Espec del catàleg per id; llança un error clar si no hi és. */
export function engineSpecById(id: string): EngineSpec {
  const spec = ENGINE_CATALOG.find((candidate) => candidate.id === id);
  if (!spec) {
    const ids = ENGINE_CATALOG.map((candidate) => candidate.id).join(', ');
    throw new Error(`No hi ha cap motor «${id}» al catàleg (n'hi ha: ${ids})`);
  }
  return spec;
}

/** Instancia el motor d'un espec (amb la seva `factory` si en té). */
export function instantiateEngine(spec: EngineSpec, options: EngineOptions = {}): RemigiEngine {
  return (spec.factory ?? createEngine)(options);
}

/**
 * Paràmetres efectius amb què jugarà un espec: els del seu nivell amb les
 * substitucions aplicades, més el sostre de nodes. És el que la interfície
 * ensenya com a «configuració» i el que compara `engineSpecDiff`.
 */
export function resolveEngineParams(spec: EngineSpec): AiParams & { maxNodes: number | null } {
  return {
    ...difficultyByKey(spec.config.level),
    ...spec.config.overrides,
    maxNodes: spec.config.maxNodes ?? null,
  };
}

export interface EngineSpecDifference {
  /** Nom del paràmetre que difereix. */
  key: string;
  a: string;
  b: string;
}

/** Un valor de configuració, en text curt per ensenyar. */
function shown(value: unknown): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'boolean') return value ? 'sí' : 'no';
  return String(value);
}

/**
 * Diferències entre les configuracions efectives de dos especs, en ordre
 * estable. Si la llista és buida, els dos costats juguen amb paràmetres
 * idèntics (i llavors només canvia la llavor del seu RNG).
 */
export function engineSpecDiff(a: EngineSpec, b: EngineSpec): EngineSpecDifference[] {
  const paramsA = resolveEngineParams(a);
  const paramsB = resolveEngineParams(b);
  const differences: EngineSpecDifference[] = [];

  if (a.strategy !== b.strategy) {
    differences.push({ key: 'estratègia', a: a.strategy, b: b.strategy });
  }
  if (a.version !== b.version) {
    differences.push({ key: 'versió', a: a.version, b: b.version });
  }

  const keys: (keyof ReturnType<typeof resolveEngineParams>)[] = [
    'key',
    'mistakeRate',
    'extendsBoard',
    'usesJokers',
    'rearrangesTable',
    'maxNodes',
  ];
  const labels: Record<string, string> = {
    key: 'nivell',
    mistakeRate: 'mistakeRate',
    extendsBoard: 'extendsBoard',
    usesJokers: 'usesJokers',
    rearrangesTable: 'rearrangesTable',
    maxNodes: 'maxNodes',
  };
  for (const key of keys) {
    if (paramsA[key] !== paramsB[key]) {
      differences.push({ key: labels[key], a: shown(paramsA[key]), b: shown(paramsB[key]) });
    }
  }
  return differences;
}
