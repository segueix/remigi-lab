# REMIGI AI LAB — el laboratori de motors

Aquest repositori és el **clon-laboratori** del Remigi: la seva pantalla
principal no és el joc, és una consola per **desenvolupar, comparar, observar i
millorar versions del motor de la IA**. El Remigi de producció
(`segueix/remigi`) no es toca des d'aquí: el laboratori serveix per decidir amb
mesures què val la pena portar-hi, i el trasllat és sempre manual.

La filosofia: **veure → comparar → entendre → mesurar → millorar.**

```
      REMIGI AI LAB
            │
     Motor A vs Motor B          ← selector de versions del catàleg
            │
     partides visibles           ← taula, les dues mans, diagnòstic per torn
            │
        torneigs                 ← 10 / 100 / 1.000 partides, sense dibuixar
            │
      estadístiques              ← dashboard comparatiu, mètrica a mètrica
            │
       jeroglífics               ← complexitat de reconstrucció de taula
            │
   llavors reproduïbles          ← qualsevol partida es torna a veure exacta
            │
       motor millor  ──build──►  dist/remigi-engine.js (el candidat a producció)
```

## On és cada cosa

| Peça | Fitxer |
|---|---|
| Catàleg de motors (afegir-n'hi un és aquí) | `packages/core/src/lab/catalog.ts` |
| Partida A vs B (runner pas a pas) | `packages/core/src/lab/match.ts` |
| Torneigs i agregats | `packages/core/src/lab/tournament.ts` |
| Mètrica de jeroglífics | `packages/core/src/lab/hieroglyph.ts` |
| Informes JSON i Markdown | `packages/core/src/lab/report.ts` |
| CLI (`npm run lab`) | `packages/core/src/cli/lab.ts` |
| Interfície del laboratori | `apps/web/src/lab/` (`LabScreen.tsx` i companyia) |
| Torneig en Web Worker | `apps/web/src/lab/tournamentWorker.ts` |
| API pública del motor | `packages/core/src/engine/` (vegeu `docs/ENGINE.md`) |

La capa `lab/` parla amb la IA **només a través de l'API pública del motor**
(`createEngine` + `play`): no importa mai `ai/`. I no hi ha dues maneres de
jugar una partida: la interfície, el CLI i els tests fan servir exactament el
mateix runner (`createMatch`/`playMatch`) i el mateix torneig
(`createTournament`), així que el que es mesura és sempre el mateix.

## Engegar el laboratori

```bash
npm run ai:lab        # la interfície (Vite; la pantalla principal és el lab)
npm run lab -- --list # el catàleg de motors, des del terminal
npm run lab -- --games 100 --seed 42          # torneig per CLI
npm run lab -- --match --seed 43 --first A    # una partida, torn a torn
```

La partida humana de sempre continua sencera a **`#joc`** (botó «Partida
humana» al laboratori; «Laboratori de motors» al menú del jugador per tornar).

### Publicat: el laboratori no toca les dades del joc de debò

Un cop a GitHub Pages, el laboratori (`/remigi-lab/`) i el Remigi de producció
(`/remigi/`) pengen del **mateix origen**, i tant `localStorage` com la
memòria cau són per origen, no per ruta. Per això el clon té el seu propi
espai de noms:

| | producció | laboratori |
|---|---|---|
| perfil | `remigi:profile:local` | `remigi-lab:profile:local` |
| partida desada | `remigi:game` | `remigi-lab:game` |
| jeroglífics, preferències | `remigi:…` | `remigi-lab:…` |
| memòria cau | `remigi-v1` | `remigi-lab-v1` |

El prefix el posa **el `KeyValueStore` de la web** (`NamespacedStore`), en un
sol lloc: el codi que desa per store fa servir la clau lògica (`remigi:game`)
i no ha d'afegir res; només el que escriu a `localStorage` directament crida
`labKey`. Posar-lo dues vegades és l'error a evitar. Ho fixen dues proves
d'unitat (`storage/webStore.test.ts`): el perfil del clon va a la seva clau, i
un perfil de producció ja desat no es llegeix ni es sobreescriu.

## Motor A vs Motor B

A dalt de la pantalla hi ha les dues targetes amb el **VS** al mig. Cada
targeta ensenya la identitat completa del que s'està comparant:

- nom, versió i estratègia del motor;
- la configuració efectiva (nivell, `maxNodes`, % d'errades, si reordena);
- el color identificatiu (el mateix que marca les seves fitxes al tauler);
- les **victòries acumulades** a la sessió (partides visuals + torneigs);
- el paper: **Campió** (el vigent) o **Challenger**; la referència històrica
  (`expert-v1`) no porta insígnia.

El selector de cada costat tria qualsevol motor del catàleg. Canviar un motor
posa el marcador a zero i descarta el torneig anterior: la comparació vella ja
no valdria. Sota els «Detalls» hi ha la secció **Diferències**, amb els
paràmetres que no coincideixen entre A i B (si és buida, només canvia la llavor
del RNG de cadascú).

## La partida visual

- La **taula** és al mig i les **dues mans són a la vista** (és una eina de
  desenvolupament: no s'amaga res). Cada mà porta el color i el compte de
  fitxes del seu motor, i la del torn queda ressaltada.
- Després de cada moviment, les fitxes **baixades** porten el marc del color
  del motor, i les fitxes de la taula **recol·locades** per la jugada, el marc
  daurat: la zona reorganitzada es veu d'un cop d'ull.
- La **fitxa de diagnòstic** de sota ensenya el detall del moviment: fitxes
  jugades, temps, nodes, si la cerca ha tocat el sostre, si la jugada ve de la
  reordenació completa, si s'ha fet servir un comodí, combinacions modificades,
  fitxes recol·locades i la complexitat amb el seu tram.
- La línia d'**estat** diu la llavor (editable: posa-n'hi una i «Aplica»), el
  torn, qui juga, el sac, els punts pendents de cada mà i els acumulats de
  nodes, temps i jeroglífics.

### Velocitat

`Pas a pas · 0,5× · 1× · 2× · 5× · 10× · Màx`, més **Pausa / Reprodueix**,
**Següent jugada**, **Reinicia** (mateixa llavor), **Nova llavor** i el
selector de **qui comença** (A o B). A 1× cau un moviment per segon; a «Màx» es
juguen tants moviments com caben en talls de ~24 ms i es pinta un sol cop per
tall — una partida sencera d'experts triga menys d'un segon.

### Historial de jugades (timeline)

A «Detalls» hi ha la cronologia: un torn per fila (motor, moviment, temps,
nodes, reordenació i la insígnia de complexitat). **Clicar un torn
l'inspecciona**: la taula i les dues mans tornen exactament a aquell moment i
la fitxa de diagnòstic ensenya aquella jugada; «Torna al directe» segueix.

## «Jeroglífics»: la mètrica de complexitat

No és cap regla del joc: és una **mètrica interna del laboratori** que mesura
com de fonda és la reconstrucció de taula d'una jugada. (El nom ve dels
trencaclosques del joc humà, que són justament jugades d'aquesta mena que se
t'havien escapat; aquí és telemetria dels motors, no un quiz.)

El criteri, implementat a `lab/hieroglyph.ts` (funció pura sobre la taula
d'abans i la de després):

1. Cada jugada de la taula d'abans té una **successora**: la jugada de després
   que conserva més fitxes seves (empat → l'índex més baix; com que cap fitxa
   no pot sortir de la taula, sempre n'hi ha una).
2. Una jugada d'abans **estesa** (sobreviu sencera dins d'una successora més
   gran) suma **+1**; una d'**alterada** (partida, escurçada o barrejada) suma
   **+2**.
3. Una fitxa de taula **recol·locada** (acaba fora de la successora de la seva
   jugada d'origen) suma **+1**, i **+1 més si és un joker** (moure un joker ja
   col·locat és el moviment més delicat del joc).

Les fitxes baixades de la mà i les jugades noves fetes només amb fitxes de la
mà **no puntuen**: el volum ja el mesura `tilesPlayed`; això mesura la
reconstrucció.

L'escala:

| puntuació | tram |
|---:|---|
| 0 | trivial (robar, o baixar jugades noves sense tocar la taula) |
| 1–2 | simple (allargar una o dues jugades) |
| 3–5 | interessant (alguna fitxa de la taula canvia de lloc) |
| 6–9 | complexa (es desfan i refan diverses jugades) |
| **10+** | **jeroglífic** |

Propietats que fixen els tests (`test/hieroglyph.test.ts`,
`test/labMatch.test.ts`):

- **Determinista**: mateixes taules, mateix desglossament, sempre.
- **No influeix en cap decisió**: es calcula *després* que el motor hagi
  decidit, fora del motor; hi ha un test que refà una partida sencera amb
  l'API pelada del motor i comprova que l'estat final és idèntic al del
  laboratori.
- **Comparable entre motors**: cada torn porta el seu desglossament complet
  (`HieroglyphBreakdown`), i els agregats en surten per simple suma.

Per motor es mostren: jeroglífics totals, jeroglífics/partida, complexitat
mitjana (sobre les jugades de baixar), la jugada més complexa (amb partida i
torn per anar-hi), i els màxims de fitxes recol·locades i jugades alterades.

## Torneigs

Al panell **Torneig**: 10, 100, 1.000 o un nombre a mida de partides, sense
dibuixar-les. El càlcul corre en un **Web Worker** (la interfície no es
congela) i es veu el progrés: partides completades, victòries provisionals,
temps, partides/segon i estimació del que falta. Es pot cancel·lar.

### Justícia

- Qui comença **s'alterna** a cada partida.
- Amb **llavors aparellades** (opció per defecte), cada llavor es juga **dues
  vegades amb els seients bescanviats**: els dos motors juguen exactament els
  mateixos repartiments des dels dos costats, i cap posició no pot decidir la
  comparativa.
- Les llavors surten de la llavor base en seqüència fixa
  (`base, base, base+1, base+1…`), i la llavor del RNG de cada motor es deriva
  de la de la partida i del seient: **tot el torneig és reproduïble** amb
  motors A i B, nombre de partides, llavor base i l'opció d'aparellament.

Cada partida d'un torneig la juga el mateix runner que la partida visual, amb
l'invariant de conservació comprovat a cada moviment: si mai es trenqués res,
la partida queda registrada com a **error** (no compta com a victòria de
ningú) i llistada amb la seva llavor per reproduir-la.

### Partides interessants

En acabar, el torneig assenyala, cadascuna amb el botó **Reprodueix** (que la
carrega a la taula del laboratori amb la seva llavor i el seu seient exactes):

- victòria més contundent d'A i de B;
- partida més llarga;
- partida amb més nodes de cerca;
- partida amb més jeroglífics;
- jugada individual més complexa;
- la primera partida amb error, si n'hi ha hagut.

## Reproduir una partida

Tot el que identifica una partida és el seu `MatchSetup`:

```ts
{ engineA: 'expert-v1', engineB: 'challenger-30k', seed: 43, firstSeat: 'A' }
```

- A la interfície: escriu la llavor a la línia d'estat («Aplica»), tria qui
  comença i reprodueix; o directament «Reprodueix» en una partida interessant.
- Al CLI: `npm run lab -- --match --engine-a expert-v1 --engine-b
  challenger-30k --seed 43 --first A` (els informes ja porten aquesta ordre
  feta per a cada partida interessant).

Mateix setup → mateixos moviments, mateix guanyador, mateixos jeroglífics
(l'únic que varia són els temps de rellotge). Ho fixa el test
«mateixa configuració → mateix resultat, torn a torn».

## El dashboard

| Mètrica | què és |
|---|---|
| Victòries · % victòries | sobre les partides vàlides (les d'error no compten) |
| Punts mitjans | puntuació final per partida (en duel, A i B sumen zero) |
| Fitxes jugades/torn | fitxes baixades per moviment propi |
| Temps mitjà/jugada · p95 | mil·lisegons per decisió (p95 sobre totes les decisions) |
| Nodes mitjans/cerca | nodes per decisió, comptant només les cerques engegades |
| Cerques limitades | decisions que han tocat el sostre de `maxNodes` |
| Reordenacions | jugades sortides de la reordenació completa |
| Errades simulades | robar tenint jugada (el `mistakeRate` del nivell) |
| Jeroglífics · /partida · complexitat mitjana · màxims | vegeu la mètrica |

La mateixa taula surt a la interfície (pestanyes «Partida actual» / «Últim
torneig»), al CLI i a l'informe: totes tres surten de `comparisonRows`.

## Informes

- **JSON** (`buildReport`): esquema `remigi-ai-lab-report/1` amb els dos
  motors (config efectiva inclosa), victòries, mètriques agregades, partides
  interessants (amb el setup de reproducció) i errors. Botó «Exporta JSON» o
  `npm run lab -- --games 1000 --json informe.json`.
- **Markdown** (`reportToMarkdown` → `AI_REPORT.md`): el mateix contingut
  llegible — motors, diferències, taula comparativa, partides interessants amb
  l'ordre de reproducció, errors i una **conclusió descriptiva** (mai una
  decisió de promoció). Botó «Exporta AI_REPORT.md» o `--report AI_REPORT.md`.

N'hi ha un de mostra al repositori: [`AI_REPORT.md`](../AI_REPORT.md).

## Afegir una versió nova del motor

El cas normal (una variant de configuració o una estratègia ja existent):

1. Afegeix una entrada a `ENGINE_CATALOG` (`packages/core/src/lab/catalog.ts`):
   id estable, nom, versió, estratègia, color, descripció i `config`
   (`level` + `overrides`/`maxNodes`). **Res més**: el selector, el CLI, els
   torneigs i els informes la veuen tots sols.
2. `npm run test:lab` (el catàleg té tests de sanitat) i ja es pot comparar.

Si la versió nova canvia la cerca de debò (fitxers d'`ai/`):

3. Puja `ENGINE_VERSION` (`src/engine/version.ts`): MINOR si juga diferent.
4. Si el canvi és **opcional** (un paràmetre nou d'`AiParams` apagat per
   defecte), els nivells de sempre no es mouen i el baseline de regressió
   continua en verd: el Challenger l'activa amb `overrides`.
5. Si canvia el joc dels nivells existents, regenera el baseline
   (`UPDATE_ENGINE_BASELINE=1`, vegeu `docs/ENGINE.md`) i assumeix-ho al diff.

Un motor **empaquetat a part** (`engine-v2.js` d'un altre commit o build) també
hi cap: l'espec admet una `factory` pròpia que retorni la interfície
`RemigiEngine`. L'única condició és el contracte de `docs/ENGINE.md`.

## Campió, Challenger i exportar el guanyador

- El camp `role` del catàleg marca el **Campió** i els **Challengers**; la
  interfície els compara com qualsevol A/B. El Campió vigent és **`expert-v2`**
  (500.000 nodes), promocionat del Challenger 500k el 2026-08-28 després de
  guanyar **557–443** en 1.000 partides aparellades amb llavor independent
  (vegeu `AI_REPORT.md`). `expert-v1` (120.000 nodes) queda **congelat per
  sempre com a referència**: és l'Expert d'abans d'encapsular el motor, fixat
  pel test de regressió, contra qui es mesura tota la història.
- Quan un Challenger demostri ser millor (torneigs grans, llavors aparellades,
  diferència clara), el camí a producció és:
  1. `npm run build:engine` → `packages/core/dist/remigi-engine.js` (el motor
     validat, en un únic fitxer, amb la seva versió al banner);
  2. portar **manualment** al Remigi original els canvis de codi font que el
     produeixen (`packages/core/src/ai/` + `src/engine/version.ts`, i les
     entrades noves de tests). **Cap pas automàtic no toca `segueix/remigi`.**
- La promoció automàtica de Challenger a Campió queda expressament fora
  d'aquesta fase: aquí es mesura; la decisió és de les persones.

## Els tests del laboratori

`npm run test:lab` (dins de `npm test`) cobreix, entre altres:

| què | on |
|---|---|
| El motor funciona sense UI i amb Node | `test/engine.test.ts`, `test/engineArtifact.test.ts`, `npm run smoke:engine` |
| Mateixa llavor → mateix resultat | `test/engine.test.ts`, `test/labMatch.test.ts` |
| `remigi-engine.js` es genera i juga | `test/engineArtifact.test.ts` |
| L'Expert encapsulat juga com abans | `test/engineRegression.test.ts` (25 partides de referència) |
| A i B coexisteixen i no es contaminen | `test/labMatch.test.ts` |
| La telemetria no altera decisions | `test/labMatch.test.ts` (partida refeta amb l'API pelada) |
| Jeroglífics deterministes i segons l'escala | `test/hieroglyph.test.ts` |
| Reproducció per llavor | `test/labMatch.test.ts`, e2e `laboratori.spec.ts` |
| El torneig compta bé i els agregats quadren | `test/labTournament.test.ts` |
| Les 106 fitxes ni es perden ni es dupliquen | invariant del runner + `test/invariants.test.ts` |
| Informes JSON i Markdown | `test/labReport.test.ts` |
| La interfície sencera (partida, torneig, reproducció, exportació) | `apps/web/e2e/laboratori.spec.ts` |

## Limitacions conegudes

- El catàleg d'avui són variants de configuració de la mateixa implementació:
  encara no hi ha cap estratègia alternativa (és expressament la fase «primer
  separar i mesurar»).
- Els motors externs per `factory` s'han d'afegir amb un import al codi (no hi
  ha càrrega dinàmica d'artefactes des de la interfície).
- El torneig corre en un sol worker; per a desenes de milers de partides, el
  CLI amb Node és més còmode (i el pas a GitHub Actions queda per més
  endavant).
- La partida visual guarda les taules de cada torn per inspeccionar-les;
  partides anòmalament llargues (centenars de torns) gasten memòria en
  proporció.
- El p95 de temps és sensible al soroll de la màquina (els nodes, no: són
  deterministes).
