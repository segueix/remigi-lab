/**
 * Nivells de dificultat de la IA. Tots els nivells fan servir el mateix cercador
 * de jugades (solver.ts); el que canvia són els paràmetres que el limiten o hi
 * introdueixen errors "humans". Això fa fàcil afegir nivells intermedis o ajustar
 * la corba de dificultat sense tocar la lògica.
 */
export type DifficultyKey = 'rookie' | 'easy' | 'medium' | 'advanced' | 'expert';

export interface AiParams {
  key: DifficultyKey;
  /** Nom per ensenyar a la interfície. */
  label: string;
  /** Valoració Elo del nivell, per encaixar-lo amb l'habilitat del jugador. */
  rating: number;
  /** Probabilitat de "no veure" la millor jugada del torn i robar fitxa. */
  mistakeRate: number;
  /** Si sap allargar les jugades que ja hi ha a la taula. */
  extendsBoard: boolean;
  /** Proporció de torns amb extensions; absent equival al booleà. */
  extensionRate?: number;
  /** Si està disposat a jugar els jokers de la mà (els nivells baixos se'ls guarden). */
  usesJokers: boolean;
  /** Proporció de torns amb jokers; absent equival al booleà. */
  jokerRate?: number;
  /** Si sap reordenar completament la taula per encabir-hi més fitxes. */
  rearrangesTable: boolean;
  /**
   * Proporció de torns en què fa servir la reordenació (0–1), si en sap. És el
   * que més pesa en la força d'un bot: un rival que no reordena mai perd totes
   * les partides contra un que sempre ho fa, així que aquest valor gradua el
   * salt entre nivells en comptes de fer-lo de cop.
   */
  rearrangeRate: number;
  /*
   * ── Extensions del laboratori (Remigi AI Lab) ───────────────────────────
   * Camps opcionals i **apagats per defecte a tots els nivells**: sense ells el
   * joc és exactament el de producció (el que fixa el baseline de regressió).
   * Només s'activen amb `overrides`, des del catàleg del laboratori.
   */
  /**
   * Sostre de nodes de la cerca de reordenació. Absent: el sostre per defecte
   * del cercador (120.000, vegeu ai/rearrange.ts). Una crida al motor amb
   * `maxNodes` explícit sempre hi mana per sobre.
   */
  maxNodes?: number;
  /**
   * Desempat per punts: a igualtat de fitxes jugades, desfer-se de més punts
   * i quedar-se a la mà les fitxes barates (els 13 i els jokers costen car si
   * la partida es perd). Hipòtesi del laboratori (challenger-punts), tancada
   * com a «massa estreta» però conservada perquè es pugui tornar a provar.
   */
  preferPointsTieBreak?: boolean;
}

export const DIFFICULTIES: Record<DifficultyKey, AiParams> = {
  /*
   * Els nivells baixos també allarguen les jugades de la taula, una part dels
   * torns: sense, a 800–1000 gairebé ningú no podia posar res, la bossa es
   * buidava en poques rondes i la partida s'acabava bloquejada (vegeu
   * AGENT.md, «Els rivals de nivell baix posen més fitxes»).
   */
  rookie: {
    key: 'rookie',
    label: 'Novell',
    rating: 800,
    mistakeRate: 0.28,
    extendsBoard: true,
    extensionRate: 0.45,
    usesJokers: false,
    rearrangesTable: false,
    rearrangeRate: 0,
  },
  easy: {
    key: 'easy',
    label: 'Fàcil',
    rating: 1000,
    mistakeRate: 0.18,
    extendsBoard: true,
    extensionRate: 0.6,
    usesJokers: true,
    rearrangesTable: false,
    rearrangeRate: 0,
  },
  medium: {
    key: 'medium',
    label: 'Mitjà',
    rating: 1200,
    mistakeRate: 0.1,
    extendsBoard: true,
    usesJokers: true,
    rearrangesTable: false,
    rearrangeRate: 0,
  },
  advanced: {
    key: 'advanced',
    label: 'Avançat',
    rating: 1400,
    mistakeRate: 0.04,
    extendsBoard: true,
    usesJokers: true,
    rearrangesTable: true,
    rearrangeRate: 0.2,
  },
  expert: {
    key: 'expert',
    label: 'Expert',
    rating: 1600,
    mistakeRate: 0,
    extendsBoard: true,
    usesJokers: true,
    rearrangesTable: true,
    rearrangeRate: 1,
  },
};

/** Nivells ordenats de més fluix a més fort. */
export const DIFFICULTY_ORDER: DifficultyKey[] = ['rookie', 'easy', 'medium', 'advanced', 'expert'];

export const DEFAULT_DIFFICULTY: DifficultyKey = 'medium';

export function difficultyByKey(key: string | undefined): AiParams {
  return DIFFICULTIES[(key ?? DEFAULT_DIFFICULTY) as DifficultyKey] ?? DIFFICULTIES[DEFAULT_DIFFICULTY];
}

/**
 * Aplica substitucions de paràmetres a un nivell. Una substitució que només
 * diu `rearrangesTable` (sense `rearrangeRate`) es llegeix com abans que
 * existís la proporció: `true` vol dir reordenar sempre i `false`, mai.
 */
export function withOverrides(base: AiParams, overrides: Partial<AiParams> = {}): AiParams {
  const params = { ...base, ...overrides };
  if (overrides.rearrangesTable !== undefined && overrides.rearrangeRate === undefined) {
    params.rearrangeRate = overrides.rearrangesTable ? 1 : 0;
  }
  return params;
}

/** Interpolació contínua de capacitats entre dos nivells consecutius. */
export function difficultyByRating(value: number): AiParams {
  const rating = Number.isFinite(value) ? Math.min(1600, Math.max(800, value)) : 1200;
  const position = (rating - 800) / 200;
  const lower = DIFFICULTIES[DIFFICULTY_ORDER[Math.floor(position)]];
  const upper = DIFFICULTIES[DIFFICULTY_ORDER[Math.ceil(position)]];
  if (lower === upper) return { ...lower };
  const fraction = position - Math.floor(position);
  const mix = (a: number, b: number) => a + (b - a) * fraction;
  return {
    ...lower, rating, label: `${lower.label}–${upper.label}`,
    mistakeRate: mix(lower.mistakeRate, upper.mistakeRate),
    rearrangesTable: upper.rearrangesTable,
    rearrangeRate: mix(lower.rearrangeRate, upper.rearrangeRate),
    usesJokers: upper.usesJokers,
    // Els jokers tenen molt impacte als nivells baixos: una corba cúbica
    // evita que el punt mig ja jugui pràcticament com Fàcil.
    jokerRate: Number(lower.usesJokers) + (Number(upper.usesJokers) - Number(lower.usesJokers)) * fraction ** 3,
    extendsBoard: lower.extendsBoard || upper.extendsBoard,
    extensionRate: mix(lower.extensionRate ?? Number(lower.extendsBoard), upper.extensionRate ?? Number(upper.extendsBoard)),
  };
}
