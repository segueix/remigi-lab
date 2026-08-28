# Remigi AI Lab

Aquest repositori és el **clon-laboratori** del [Remigi](https://github.com/segueix/remigi):
la seva finalitat no és jugar-hi, és **desenvolupar, comparar, observar i
millorar versions del motor de la IA**. La pantalla principal és el
**REMIGI AI LAB** — Motor A contra Motor B, amb la partida visible, torneigs,
estadístiques i la mètrica de «jeroglífics» — i la partida humana de sempre es
conserva sencera a `#joc`.

> ⚠️ El Remigi de producció (`segueix/remigi`) **no es modifica des d'aquí**.
> El laboratori serveix per decidir amb mesures quin motor és millor; portar el
> guanyador a producció és sempre un pas manual (vegeu
> [`docs/AI-LAB.md`](docs/AI-LAB.md)).
>
> Publicats, tots dos viuen al mateix origen (`segueix.github.io`) i
> `localStorage` és **per origen, no per ruta**: per això el laboratori desa
> dins del seu propi espai de noms (`remigi-lab:`, vegeu
> `apps/web/src/storage/namespace.ts`) i té la seva memòria cau
> (`remigi-lab-v1`). Jugar-hi la partida humana no toca ni el perfil ni la
> partida desada del joc de debò.

## Publicar-lo a GitHub Pages

El desplegament és automàtic a cada canvi a `main`, però la **primera vegada
cal activar Pages a mà** (el flux no té permís per crear el lloc):

1. **Settings → Pages** del repositori `remigi-lab` → *Source*: **GitHub Actions**.
2. **Actions → «Desplega a GitHub Pages» → Run workflow** (o torna a executar
   l'última execució fallida).
3. Queda publicat a `https://segueix.github.io/remigi-lab/`.

Si el pas 1 no s'ha fet, el desplegament falla amb
*«Create Pages site failed: Resource not accessible by integration»*.

## El laboratori en dues línies

- **El motor és independent i substituïble**: la IA viu rere una API petita i
  versionada (`createEngine` → `engine.play`, vegeu
  [`docs/ENGINE.md`](docs/ENGINE.md)) i `npm run build:engine` l'empaqueta
  sencera en un únic fitxer, `packages/core/dist/remigi-engine.js`, executable
  amb Node pelat, sense React ni DOM.
- **La interfície compara motors**: dues targetes (Motor A vs Motor B) amb el
  catàleg de versions, la taula al mig amb **les dues mans a la vista**,
  controls de velocitat (pas a pas → màxima), diagnòstic de cada jugada,
  timeline inspeccionable, dashboard comparatiu, torneigs de 10/100/1.000
  partides amb llavors aparellades, partides interessants reproduïbles per
  llavor i exportació d'informes (JSON i `AI_REPORT.md`).

```
REMIGI AI LAB → Motor A vs Motor B → partides visibles → torneigs
→ estadístiques → jeroglífics → llavors reproduïbles → motor millor
→ remigi-engine.js
```

## Posar-s'hi

```bash
npm install
npm run ai:lab       # el laboratori al navegador (http://localhost:5173)
npm run lab -- --list                       # catàleg de motors, al terminal
npm run lab -- --games 100 --seed 42        # torneig per CLI
npm run lab -- --games 1000 --json informe.json --report AI_REPORT.md
npm run lab -- --match --seed 43 --first A  # una partida, torn a torn
```

I la resta d'ordres del projecte:

```bash
npm run dev          # el mateix que ai:lab (l'app entra al laboratori)
npm test             # tests del motor, del laboratori i de la web
npm run test:engine  # només els tests del motor (API, artefacte i regressió)
npm run test:lab     # només els tests del laboratori
npm run test:e2e     # proves de navegador sobre el build de producció
npm run typecheck    # comprovació de tipus
npm run build        # build de producció de la web
npm run build:engine # genera dist/remigi-engine.js (el motor, sol)
npm run simulate     # el simulador clàssic (Expert vs Mitjà vs Novell)
```

Per a les proves de navegador la primera vegada cal el navegador:
`npx playwright install chromium` dins d'`apps/web`.

Hi ha un informe de mostra d'una comparació real a
[`AI_REPORT.md`](AI_REPORT.md).

## Estructura del repositori

```
remigi-lab/
├── packages/
│   └── core/                  # Motor del joc + laboratori (TypeScript pur)
│       ├── src/
│       │   ├── core/          # Regles: fitxes, jugades, taula, torns, puntuació
│       │   ├── ai/            # La IA per dins (solver, reordenació, nivells)
│       │   ├── engine/        # API pública i versionada del motor (la porta)
│       │   ├── lab/           # EL LABORATORI: catàleg, partides A/B, torneigs,
│       │   │                  #   jeroglífics, estadístiques i informes
│       │   ├── adaptive/      # Dificultat adaptativa (per al joc humà)
│       │   ├── persistence/   # Desat del perfil
│       │   └── cli/
│       │       ├── simulate.ts    # Simulador clàssic
│       │       └── lab.ts         # El laboratori des del terminal
│       ├── scripts/           # Build de remigi-engine.js i prova de fum
│       └── test/              # Tests (regressió del motor i laboratori inclosos)
├── apps/
│   └── web/                   # Aplicació web (Vite + React)
│       ├── src/
│       │   ├── lab/           # LA INTERFÍCIE DEL LABORATORI (pantalla principal)
│       │   ├── screens/       # La partida humana (#joc) i l'historial
│       │   ├── components/    # Fitxa, jugada, taula, faristol, menú
│       │   ├── game/ state/ storage/
│       │   └── …
│       └── e2e/               # Proves de navegador (laboratori i joc)
├── AI_REPORT.md               # Informe de mostra d'una comparació real
├── AGENT.md                   # Pla de fases i registre de problemes
└── docs/
    ├── AI-LAB.md              # EL LABORATORI: com funciona tot, com afegir motors
    ├── ENGINE.md              # El motor: API, artefacte, versionat, regressió
    ├── ARQUITECTURA.md        # Decisions de disseny i mapa de mòduls
    ├── REGLES.md              # Regles del joc
    └── IA-ADAPTATIVA.md       # La dificultat adaptativa del joc humà
```

## Fer servir el motor des de codi

```ts
import { createEngine, createGame, applyMove } from '@remigi/core';

const engine = createEngine({ seed: 7 }); // amb llavor: reproduïble

let state = createGame({
  seed: 42,
  players: [
    { name: 'A', kind: 'ai', aiLevel: 'expert' },
    { name: 'B', kind: 'ai', aiLevel: 'expert' },
  ],
});
const decision = engine.play(state);
state = applyMove(state, decision.move);
// decision → { move, engineVersion, level, thinkingTimeMs, nodes,
//              searchLimited, rearrangeUsed, foundPlay, tilesPlayed }
```

I el laboratori sencer també és programable:

```ts
import { playMatch, runTournament, buildReport } from '@remigi/core';

const partida = playMatch({ engineA: 'expert-v1', engineB: 'challenger-30k', seed: 43 });
const torneig = runTournament({ engineA: 'expert-v1', engineB: 'challenger-30k', games: 100, baseSeed: 42 });
const informe = buildReport(torneig);
```

## El joc humà, que continua aquí

El clon conserva el Remigi jugable complet (a `#joc`): partida contra 1–3 bots
amb dificultat adaptativa, arrossegar amb ratolí i dit, partida desada,
jeroglífics-quiz de les oportunitats perdudes, PWA instal·lable i joc sense
connexió. El joc públic de debò viu a
<https://segueix.github.io/remigi/> (repositori `segueix/remigi`).

## Publicació

Cada canvi a `main` construeix l'app i la publica a GitHub Pages
(`.github/workflows/desplega.yml`); la CI (`.github/workflows/ci.yml`) passa
tipus, tests, build i proves de navegador a cada push i pull request. La font
de Pages ha de ser «GitHub Actions» (vegeu els comentaris del workflow); la
ruta base surt del nom del repositori i es pot forçar amb `BASE_PATH`.
