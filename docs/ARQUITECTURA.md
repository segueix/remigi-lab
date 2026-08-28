# Arquitectura

## Visió general

El projecte és un monorepo amb workspaces d'npm:

- **`packages/core`** — el motor del joc. TypeScript pur, **sense cap dependència
  d'interfície ni de navegador**, perquè la mateixa lògica serveixi per a la web
  (Fase 2), per al simulador de terminal i per als tests.
- **`apps/web`** — l'aplicació web (Vite + React). Hi viu tot el que és
  interfície: l'edició del torn, l'arrossegament, el perfil desat al navegador i
  el que es veu de la partida.

Dependències entre capes (sempre en aquesta direcció, mai al revés):

```
core  ◄──  ai  ◄──  engine  ◄──  lab      core ◄── adaptive
  ▲          ▲        ▲           ▲          ▲        ▲
  └──────────│────────┴───────────┴──────────┴────────┴──  persistence · cli · app web
             └─ (només el motor importa ai/)
```

La capa **`engine/`** és la porta pública de la IA (vegeu
[`docs/ENGINE.md`](ENGINE.md)): la resta del projecte demana jugades a
`createEngine(...).play(...)` i no importa mai `ai/` directament. És també
l'entrada del build que genera l'artefacte independent
`dist/remigi-engine.js`.

La capa **`lab/`** és el laboratori d'aquest clon (vegeu
[`docs/AI-LAB.md`](AI-LAB.md)): el catàleg de motors comparables, el runner de
partides Motor A vs Motor B, els torneigs, la mètrica de jeroglífics i els
informes. Consumeix el motor per la seva API pública, exactament igual que
l'app.

## Decisions principals

### Estat immutable i funcions pures

`GameState` és JSON pur i `applyMove(state, move)` retorna un estat **nou** sense
tocar l'anterior. Això dona de franc:

- integració directa amb React (`setState(applyMove(state, move))`),
- desar i restaurar partides serialitzant l'estat,
- desfer jugades guardant estats anteriors,
- tests senzills (es forgen estats artificials, vegeu `test/helpers.ts`).

### Cada fitxa té identitat

Les 106 fitxes tenen un `id` únic (`red-7-a`, `joker-b`...). Validar un moviment
es redueix a comparar conjunts d'ids: la taula nova ha de ser exactament la taula
antiga més fitxes de la mà del jugador, sense duplicats ni desaparicions.

### El moviment «jugar» proposa la taula sencera

Un `Move` de tipus `play` porta la disposició completa de la taula resultant.
Així un sol format de moviment cobreix baixar jugades noves, allargar-ne
d'existents i reordenar la taula, i el motor només ha de validar el resultat.
Els errors es llancen com a `RulesError` amb un `code` estable (per a la lògica)
i un missatge en català (per ensenyar directament a la interfície).

### Partides reproduïbles

El barreig i les decisions de la IA fan servir un RNG amb llavor (`random.ts`).
Amb la mateixa llavor, la mateixa partida: imprescindible per depurar i testejar.

### Una sola IA, molts nivells

No hi ha un algorisme per nivell: hi ha **un únic cercador de jugades**
(`ai/solver.ts`) i **paràmetres que el limiten** (`ai/difficulty.ts`): probabilitat
d'error humà (`mistakeRate`), si pot allargar la taula (`extendsBoard`), si juga
els jokers (`usesJokers`), si reparteix de nou la taula (`rearrangesTable`)...
Ajustar la corba de dificultat és tocar números, no
reescriure lògica. La capa adaptativa (`adaptive/`) tria aquests paràmetres
segons el perfil del jugador; vegeu `docs/IA-ADAPTATIVA.md`.

### El motor de la IA, encapsulat i substituïble

Tota aquesta IA queda darrere d'una API petita i versionada, `engine/`
(`createEngine`, `ENGINE_VERSION`), pensada com un motor d'escacs: rep l'estat
i retorna la jugada amb el seu diagnòstic (temps, nodes, si la cerca s'ha
limitat). L'app, el simulador i l'artefacte `dist/remigi-engine.js` (un únic
fitxer ESM, executable amb Node o en un Web Worker, sense React ni DOM) surten
del mateix codi font, i un test de regressió amb partides de referència
garanteix que la frontera no canvia cap jugada. Tot el detall, a
[`docs/ENGINE.md`](ENGINE.md).

### Reordenar la taula: recomptes, no fitxes

`ai/rearrange.ts` resol el problema de debò del rummy de fitxes: repartir en jugades
vàlides **totes** les fitxes de la taula més les que es vulguin de la mà,
quedant-se'n a la mà les mínimes possibles.

Dues decisions el fan abastable:

1. **Es treballa amb recomptes per color i número, no amb fitxes concretes.**
   Dues còpies de la mateixa fitxa són intercanviables, així que distingir-les
   només multiplicaria l'espai de cerca. Les fitxes de debò s'assignen al final,
   gastant primer les de la taula, que és el que garanteix que no en quedi cap
   fora.
2. **Ordre de recorregut fix.** Les caselles es recorren per número i després
   per color, i a cada casella només s'enumeren les jugades on aquella fitxa és
   la de l'índex més baix. Així cada repartiment possible es genera una sola
   vegada; amb memorització dels estats repetits, la cerca es tanca de pressa.

Té un **sostre de nodes**: si s'esgota no retorna res i el cercador es queda amb
l'heurística voraç, perquè val més jugar de pressa i una mica pitjor que fer
esperar el jugador. I abans de fer servir cap proposta seva es comprova que la
taula resultant és legal (`isSoundProposal`): un error aquí tombaria la partida,
i la comprovació és barata.

### Persistència per interfície

El motor només coneix `KeyValueStore` (get/set/remove). Implementacions:
`MemoryStore` (tests), `JsonFileStore` (Node; no s'exporta des de l'índex per no
arrossegar dependències de Node a la web) i `LocalStorageStore` a l'app web, que
comprova de debò si es pot escriure i degrada a memòria si no.

## Limitacions conegudes

- La cerca de reordenació no posa mai un joker on ja hi ha la fitxa de debò
  disponible. Alliberar-la per a una altra jugada podria ser millor en algun cas
  rebuscat; a canvi, l'enumeració es manté petita.
- Els nivells que no reordenen segueixen amb una tria voraç: no busquen la
  millor combinació entre les jugades possibles.
- La IA no té estratègia a llarg termini: maximitza les fitxes del torn actual,
  sense guardar-se'n per a jugades futures ni comptar les del rival.

## Com hi encaixa l'app web

- L'estat de React és directament el `GameState`; cada acció de l'usuari
  construeix un `Move` i crida `applyMove` dins d'un `try/catch` que mostra el
  missatge del `RulesError` si el moviment no és legal.
- Els torns dels bots demanen la jugada al motor (`engine.play`, síncron i
  prou ràpid: el pitjor torn d'un expert mesurat va ser de 176 ms) amb un
  petit retard perquè es puguin seguir visualment; la detecció de jeroglífics
  fa servir `engine.analyze`.
- En acabar, `finalScores` + `recordGame` actualitzen el perfil, i
  `suggestOpponents` proposa els rivals de la partida següent.
- **El que és només visual es queda a la web.** Qui ha posat cada jugada, per
  exemple, no és estat de joc: el motor no en sap res i no n'ha de saber. La web
  ho dedueix comparant la taula d'abans i la de després de cada moviment
  (`game/meldOwners.ts`) i ho desa a part amb la partida.
