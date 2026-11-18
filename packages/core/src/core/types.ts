// Tipus bàsics del joc. Tot l'estat és serialitzable (JSON pur) perquè es pugui
// desar, enviar per la xarxa o fer servir com a estat de React sense adaptadors.

export type TileColor = 'red' | 'blue' | 'black' | 'orange';

export interface NumberTile {
  /** Identificador únic, p. ex. "red-7-a". Permet seguir cada fitxa física. */
  id: string;
  kind: 'number';
  color: TileColor;
  value: number; // 1..13
}

export interface JokerTile {
  id: string; // "joker-a" | "joker-b"
  kind: 'joker';
}

export type Tile = NumberTile | JokerTile;

/** Una jugada sobre la taula: grup (mateix número) o escala (mateix color). */
export type Meld = Tile[];

export type PlayerKind = 'human' | 'ai';

export interface PlayerState {
  id: string;
  name: string;
  kind: PlayerKind;
  /** Clau del nivell de dificultat (vegeu ai/difficulty.ts); només per a IA. */
  aiLevel?: string;
  rack: Tile[];
  /** Si ja ha fet la sortida inicial de 30 punts. */
  hasOpened: boolean;
}

export type GameStatus = 'playing' | 'finished';

export interface GameState {
  /** Llavor del barreig; amb la mateixa llavor la partida és reproduïble. */
  seed: number;
  /** Sac de fitxes pendents de robar (cap amunt: es roba la posició 0). */
  bag: Tile[];
  board: Meld[];
  players: PlayerState[];
  /** Índex dins de `players` del jugador a qui toca. */
  currentPlayer: number;
  turn: number;
  /** Passades seguides amb el sac buit; si tothom passa, la partida queda bloquejada. */
  consecutivePasses: number;
  status: GameStatus;
  winnerId?: string;
}

export type Move =
  /** Robar una fitxa del sac (o passar, si el sac és buit). */
  | { type: 'draw' }
  /**
   * Jugar fitxes: es proposa la taula sencera resultant. Això permet, en un sol
   * moviment, baixar jugades noves, allargar-ne d'existents i reordenar la taula.
   * El motor valida que tot quadri (vegeu game.ts).
   */
  | { type: 'play'; board: Meld[] };

export interface PlayerSetup {
  name: string;
  kind: PlayerKind;
  aiLevel?: string;
}

export interface GameConfig {
  /** Entre 2 i 4 jugadors (1 humà + 1..3 IA en l'ús normal). */
  players: PlayerSetup[];
  seed?: number;
  /** Índex del jugador que fa el primer torn (per defecte, el 0). */
  firstPlayer?: number;
}
