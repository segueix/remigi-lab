# El motor Remigi (`remigi-engine`)

La IA del Remigi està encapsulada com un **motor independent** rere una API
petita, estable i versionada, a l'estil d'un motor d'escacs: l'app gestiona la
interfície, la partida i el perfil; el motor rep l'estat de la partida i
retorna la millor jugada. Cap de les dues bandes no sap res de les tripes de
l'altra.

```
┌──────────────────────────┐         ┌──────────────────────────────┐
│  Remigi app (apps/web)   │  estat  │  Remigi Engine               │
│  interfície · partida ·  │ ──────► │  (packages/core/src/engine)  │
│  usuari · perfil         │ ◄────── │  decideix la jugada          │
└──────────────────────────┘ jugada  └──────────────────────────────┘
```

- **API pública**: `packages/core/src/engine/` (s'importa via `@remigi/core`).
- **Implementació interna**: `packages/core/src/ai/` (solver, reordenació,
  nivells) i les regles de `packages/core/src/core/`. Cap altre codi no ha
  d'importar `ai/` directament: la porta és el motor.
- **Artefacte**: `packages/core/dist/remigi-engine.js`, un únic fitxer ESM
  autocontingut que funciona amb Node, en un Web Worker o en qualsevol entorn
  ES2022, sense React, sense DOM i sense dependències.

No hi ha dues IA: l'app, el simulador i l'artefacte surten **del mateix codi
font**. Una correcció al solver afecta automàticament tots tres.

## L'API pública

Tot això s'exporta des de `@remigi/core` (i és exactament el que conté
`dist/remigi-engine.js`):

| Element | Què és |
|---|---|
| `ENGINE_VERSION` | Versió del motor, `"1.1.0"` |
| `createEngine(options?)` | Crea un motor (`seed` o `rng` opcionals) |
| `engine.play(state, options?)` | Decideix el moviment d'un jugador |
| `engine.analyze(state, options?)` | Millor jugada d'una posició, sense errors humans (determinista) |
| `DIFFICULTIES`, `DIFFICULTY_ORDER`, `difficultyByKey` | Els 5 nivells i els seus paràmetres |
| `createGame`, `applyMove`, `finalScores`, `RulesError`, `currentPlayer`, `TOTAL_TILES` | Regles mínimes perquè l'artefacte pugui fer anar partides tot sol |
| `createRng`, `randomSeed` | RNG amb llavor, per a simulacions reproduïbles |
| Tipus | `GameState`, `Move`, `Meld`, `Tile`, `DifficultyKey`, `AiParams`, `RemigiEngine`, `EngineDecision`, `EngineAnalysis`… |

El **contracte del motor** pròpiament dit són tres coses: `ENGINE_VERSION`,
`createEngine` i els tipus que l'acompanyen. La resta (regles, RNG, nivells)
és el joc de suport perquè l'artefacte sigui autosuficient en simulacions.

### Fer una jugada

```ts
import { createEngine, createGame, applyMove } from '@remigi/core';

const engine = createEngine({ seed: 7 }); // amb llavor: reproduïble

let state = createGame({
  seed: 42,
  players: [
    { name: 'Tu', kind: 'human' },
    { name: 'Bot', kind: 'ai', aiLevel: 'expert' },
  ],
});

// Torn del bot: el motor decideix pel jugador que té el torn.
const decision = engine.play(state);
state = applyMove(state, decision.move);
```

La resposta (`EngineDecision`) porta la jugada i el seu diagnòstic:

```ts
{
  move: { type: 'play', board: [...] },  // o { type: 'draw' }
  engineVersion: '1.1.0',
  level: 'expert',        // nivell efectivament aplicat
  thinkingTimeMs: 34,     // temps de càlcul
  nodes: 84321,           // nodes de la cerca de reordenació (0 si no s'engega)
  searchLimited: false,   // la cerca ha tocat el sostre de nodes?
  rearrangeUsed: true,    // la jugada ve de la reordenació completa?
  foundPlay: true,        // hi havia jugada (si tot i això roba, és l'error humà simulat)
  tilesPlayed: 5,         // fitxes de la mà que baixen a la taula
}
```

El diagnòstic **no canvia mai la jugada**: és per mesurar i comparar motors.

### Opcions de `play`

```ts
engine.play(state, {
  playerIndex: 2,          // per defecte, state.currentPlayer
  level: 'medium',         // per defecte, l'aiLevel del jugador dins de l'estat
  rubberBanding: true,     // ajust d'error segons com va l'humà (per defecte, no)
  overrides: { mistakeRate: 0 },  // substitueix paràmetres del nivell (proves)
  maxNodes: 50_000,        // sostre de la cerca (per defecte, el del nivell:
                           //  l'expert juga a 500.000 des de la v1.1.0)
});
```

### Analitzar una posició

`analyze` busca la millor jugada **sense** errors humans ni RNG (l'usa l'app
per detectar els jeroglífics). Per defecte a força màxima; amb `level`, amb
les capacitats d'aquell nivell:

```ts
const { bestPlay, nodes } = engine.analyze(state, { playerIndex: 0 });
if (bestPlay) console.log(`Podies baixar ${bestPlay.tilesUsed} fitxes`);
```

### Llavor i determinisme

El motor consumeix RNG només per a l'error humà simulat dels nivells.
Amb **mateix estat + mateixa configuració + mateixa llavor**, la decisió és
sempre la mateixa:

```ts
createEngine({ seed: 7 }).play(state);  // sempre idèntic a
createEngine({ seed: 7 }).play(state);  // aquest altre
```

El RNG és seqüencial: un mateix motor consumeix la seva seqüència decisió
rere decisió, així que per reproduir una **partida sencera** es crea un motor
nou amb la mateixa llavor i es repeteixen les mateixes crides (és el que fan
el simulador i el test de regressió). També es pot passar un `rng` propi:
`createEngine({ rng: () => 0.5 })`. Sense `seed` ni `rng` es fa servir
`Math.random` i el motor no és determinista.

### Triar la dificultat

El camí normal és posar `aiLevel` al jugador dins de l'estat
(`'rookie' | 'easy' | 'medium' | 'advanced' | 'expert'`); el motor el llegeix
d'allà. Alternativament es pot forçar per crida amb `level`, o afinar
paràmetres concrets amb `overrides` (que és com el simulador compara l'expert
amb reordenació i sense).

## Generar `remigi-engine.js`

```bash
npm run build:engine
```

produeix, de manera reproduïble:

```
packages/core/dist/remigi-engine.js     # el motor, un únic fitxer ESM
packages/core/dist/remigi-engine.d.ts   # els tipus públics
packages/core/dist/types/               # declaracions (les reexporta el .d.ts)
```

El build empaqueta amb esbuild l'entrada `src/engine/index.ts` amb totes les
dependències internes, en plataforma «neutral»: si mai el motor importés res
de Node o del navegador, **el build fallaria**. El fitxer no es versiona al
repositori (`dist/` és a `.gitignore`): es genera del codi font quan cal.

## Fer-lo servir amb Node

L'artefacte no necessita TypeScript, ni Vite, ni React, ni `node_modules`:

```js
// partida.mjs — node partida.mjs
import { createEngine, createGame, applyMove, finalScores } from './remigi-engine.js';

let state = createGame({
  seed: 1,
  players: [
    { name: 'Expert', kind: 'ai', aiLevel: 'expert' },
    { name: 'Mitjà', kind: 'ai', aiLevel: 'medium' },
  ],
});
const engine = createEngine({ seed: 2 });

while (state.status === 'playing') {
  state = applyMove(state, engine.play(state).move);
}
console.log(finalScores(state));
```

La prova de fum del repositori fa exactament això (i comprova el determinisme):

```bash
npm run build:engine && npm run smoke:engine -w @remigi/core
```

## Fer-lo servir des d'un Web Worker

L'API és síncrona i pura sobre estat JSON, així que passar-la a un worker és
només embolcallar-la amb missatges (l'app encara no ho necessita: amb
l'expert a 500.000 nodes, el p95 mesurat és de ~69 ms per decisió i el pitjor
cas queda per sota del mig segon):

```js
// engine-worker.js
import { createEngine } from './remigi-engine.js';
const engine = createEngine();
onmessage = ({ data }) => postMessage(engine.play(data.state, data.options));
```

```js
// des de l'app
const worker = new Worker(new URL('./engine-worker.js', import.meta.url), { type: 'module' });
worker.postMessage({ state });
worker.onmessage = ({ data: decision }) => applyMove(state, decision.move);
```

Cap part de l'API no toca el DOM ni res del fil principal: no hi ha res a
«desconnectar» per fer aquest pas quan calgui.

## Què és públic i què és intern

**Públic** (estable; canviar-ho vol dir pujar `ENGINE_VERSION`):

- `packages/core/src/engine/` — `createEngine`, `ENGINE_VERSION` i els tipus.
- Les regles i tipus de partida que reexporta (`GameState`, `applyMove`…).

**Intern** (pot canviar sense avisar; no s'hi ha de dependre des de fora):

- `packages/core/src/ai/solver.ts` — cerca voraç de jugades.
- `packages/core/src/ai/rearrange.ts` — reordenació completa de la taula.
- `packages/core/src/ai/difficulty.ts` — paràmetres interns dels nivells (la
  taula `DIFFICULTIES` és pública; l'estructura interna del cercador, no).
- `packages/core/src/ai/aiPlayer.ts` — `decideAiMove` i companyia.

`decideAiMove` i `chooseBestPlay` continuen exportats de `@remigi/core` per
compatibilitat i per als tests del paquet, però el codi nou (app, eines,
simulacions) ha de parlar **només** amb el motor.

## Versionat

- `ENGINE_VERSION` viu a `packages/core/src/engine/version.ts` i es puja a mà:
  **MAJOR** si canvia l'API pública, **MINOR** si la IA juga diferent (més
  fort o més fluix), **PATCH** per a correccions sense canvi de joc.
- Cada decisió porta `engineVersion`, el simulador l'imprimeix a la capçalera,
  i l'artefacte la porta a la primera línia (banner) i exportada: sempre es
  pot dir quina versió ha jugat una partida o produït una simulació.

## La xarxa de seguretat: regressió comportamental

`test/engineRegression.test.ts` torna a jugar 25 partides de referència (5
nivells × 5 llavors, capturades **abans** de la refactorització cridant la IA
directament) a través de l'API del motor, i comprova que **cada moviment de
cada torn** és exactament el mateix (hash de trajectòria a
`test/fixtures/engine-baseline.json`). Si mai es canvia la força de la IA a
consciència, el baseline es regenera amb:

```bash
cd packages/core && UPDATE_ENGINE_BASELINE=1 npx vitest run test/engineRegression.test.ts
```

i el canvi de comportament queda assumit i visible al diff del fixture.

## El laboratori que hi ha a sobre

Aquesta frontera és la que fa possible el **Remigi AI Lab**
([`docs/AI-LAB.md`](AI-LAB.md)): la capa `src/lab/` fa jugar dos motors l'un
contra l'altre (partides visibles, torneigs, jeroglífics, informes) parlant
**només** amb aquesta API — cap peça del laboratori no importa `ai/`. El
catàleg de versions comparables és `src/lab/catalog.ts`, i un motor empaquetat
a part (`engine-v2.js`) s'hi connecta amb una `factory` que retorni aquesta
mateixa interfície `RemigiEngine`.
