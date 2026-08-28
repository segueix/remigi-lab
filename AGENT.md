# AGENT — Pla de fases del Remigi

Document de treball per a l'agent. Defineix **totes les fases** del projecte, en
l'ordre en què s'han de fer, amb les tasques, els criteris per donar cada fase
per acabada i un registre de problemes. **Aquest document és l'estat de la
veritat del projecte**: mira'l abans de començar cap feina i actualitza'l en
acabar-la.

> **Aquest repositori és el clon-laboratori (Remigi AI Lab).** La pantalla
> principal és el laboratori de motors (vegeu `docs/AI-LAB.md`); el joc humà
> es conserva a `#joc`. El Remigi de producció és `segueix/remigi` i **no es
> modifica des d'aquí**: cap canvi d'aquest clon no s'hi porta automàticament.

## Protocol de treball de l'agent

1. **Abans de començar**: llegeix aquest document i localitza la primera fase
   que no estigui `✅ Feta`. Treballa **una fase a la vegada**, en ordre, tret
   que l'usuari digui expressament una altra cosa.
2. **Mentre treballes**: marca les caselles de tasca (`[ ]` → `[x]`) a mesura
   que les completis i posa la fase `🔄 En curs`.
3. **Per tancar una fase**: han de complir-se **tots els criteris d'acceptació**
   (executa les ordres indicades i comprova-les de debò). Llavors posa la fase
   `✅ Feta` amb la data.
4. **Problemes**: qualsevol entrebanc (bug, decisió no prevista, limitació,
   canvi de pla) s'apunta a l'apartat *Problemes trobats* de la fase, amb el
   format: `- [data] Problema — com s'ha resolt (o per què queda pendent)`.
   Si un problema es deixa per més endavant, afegeix-lo també com a tasca a la
   fase que toqui.
5. **Cada lliurament**: `npm run typecheck` i `npm test` en verd, commit amb
   missatge descriptiu **que inclogui l'actualització d'aquest AGENT.md**, i
   push a la branca de treball indicada per la sessió.
6. **Regles del repositori** (no negociables sense parlar-ho amb l'usuari):
   - `packages/core` es manté **pur**: sense dependències de navegador ni d'UI;
     tot estat immutable i serialitzable; l'única API pública és `src/index.ts`
     (i `persistence/jsonFileStore.ts` importat a banda, perquè depèn de Node).
   - Les capes només depenen en aquesta direcció:
     `core ← ai ← engine ← lab` i `core ← adaptive`, amb
     `(persistence, cli, web)` al capdamunt. La IA es demana **sempre** a
     través del motor (`engine/`, vegeu `docs/ENGINE.md`); cap codi nou no
     importa `ai/` directament — el laboratori (`lab/`, vegeu
     `docs/AI-LAB.md`) tampoc.
   - Identificadors de codi en anglès; comentaris, docs, missatges d'error i UI
     en **català**.
   - Documentació de referència: `docs/ARQUITECTURA.md`, `docs/REGLES.md`,
     `docs/IA-ADAPTATIVA.md`. Si una fase canvia el que hi diu, actualitza-les.

## Estat general

| Fase | Nom | Estat |
|---|---|---|
| 1 | Estructura i motor del joc | ✅ Feta (2026-08-22, reverificada 2026-08-22) |
| 2 | Esquelet de l'aplicació web | ✅ Feta (2026-08-22) |
| 3 | Pantalla de partida jugable | ✅ Feta (2026-08-22) |
| 4 | Cicle adaptatiu complet a la web | ✅ Feta (2026-08-22) |
| 5 | Experiència d'usuari i polit | ✅ Feta (2026-08-22) |
| 6 | Motor avançat (solver òptim i regles pendents) | ✅ Feta (2026-08-22) |
| 7 | Desplegament | ✅ Feta (2026-08-22) |

Llegenda: `⬜ Pendent` · `🔄 En curs` · `✅ Feta (data)` · `⏸️ Aturada (motiu)`

La feina demanada un cop tancades les set fases s'apunta a **[Millores després de
les fases](#millores-després-de-les-fases)**, amb el mateix protocol.

---

## Fase 1 — Estructura i motor del joc

**Estat**: ✅ Feta (2026-08-22)

**Objectiu**: monorepo amb el motor complet del joc a `packages/core`,
independent de la interfície, amb IA per nivells i sistema adaptatiu, tot provat.

### Tasques

- [x] Monorepo npm workspaces (`packages/*`, `apps/*`), TypeScript estricte.
- [x] Regles completes a `src/core/`: 106 fitxes amb id únic, grups i escales
      amb jokers, sortida inicial de 30 punts, reordenació de taula, robar i
      passar, partida bloquejada, puntuació final. Errors com a `RulesError`
      amb codi estable i missatge en català.
- [x] Estat immutable (`applyMove` retorna estat nou) i RNG amb llavor.
- [x] IA a `src/ai/`: un sol cercador de jugades (`solver.ts`) i 5 nivells
      parametritzats (`difficulty.ts`): novell, fàcil, mitjà, avançat, expert.
- [x] Sistema adaptatiu a `src/adaptive/`: perfil amb Elo (K decreixent),
      historial, i `suggestOpponents` per triar 1–3 rivals segons l'habilitat.
- [x] Persistència a `src/persistence/`: interfície `KeyValueStore`,
      `MemoryStore`, `JsonFileStore` (Node) i `ProfileRepository`.
- [x] Simulador IA contra IA (`npm run simulate`) amb invariant de conservació.
- [x] Docs en català a `docs/`.
- [x] **Cobertura de tota l'API pública** (74 tests): a més de fitxes, jugades,
      partida, solver i sistema adaptatiu, també `core/board.ts`,
      `core/scoring.ts`, `ai/difficulty.ts`, `ai/aiPlayer.ts` (errors "humans"
      amb RNG controlat), la capa `persistence/` sencera (bateria comuna per a
      qualsevol `KeyValueStore`, `JsonFileStore` sobre disc i
      `ProfileRepository`) i el contracte de `src/index.ts`.

### Criteris d'acceptació (verificats)

- `npm run typecheck` i `npm test` en verd. ✔ (74/74, reverificat 2026-08-22)
- `npm run simulate -- --games 100` acaba sempre i ordena els nivells. ✔
  (Expert 59%, Mitjà 39%, Novell 2%; ~95 torns/partida)

### Problemes trobats

- [2026-08-22] L'script arrel `npm run simulate` no reenviava els arguments: el
  `npm` intermedi es menjava `--games` — resolt afegint `--` final a l'script
  de l'arrel (`npm run simulate -w @remigi/core --`).
- [2026-08-22] El cercador d'escales només feia servir jokers per omplir
  **forats interns** (extrems sempre reals): un test suposava que també
  allargava extrems amb joker. Es va ajustar el test a l'heurística
  documentada, i la millora es va fer a la **Fase 6**, on els jokers ja poden
  anar també als extrems.
- [2026-08-22] **Buit de cobertura**: en reverificar la fase es va detectar que
  `core/board.ts`, `ai/difficulty.ts` i tota la capa `persistence/` eren API
  pública **sense cap test**. Resolt afegint-ne (38 → 74 tests).
- [2026-08-22] **Bug de puntuació** (el va destapar un dels tests nous):
  `finalScores` feia `totalPending - 2 * pending[guanyador]`, de manera que en
  una **partida bloquejada** el guanyador es penalitzava les seves pròpies
  fitxes i el marcador **no sumava zero** (una partida d'exemple donava −36).
  En victòria neta no es notava, perquè el guanyador té 0 fitxes. Resolt:
  `totalPending - pending[guanyador]`, que deixa igual la victòria neta,
  quadra el bloqueig i alinea el codi amb el que ja deia `docs/REGLES.md`.
  S'hi ha afegit l'invariant «la puntuació sempre suma zero» com a test.

---

## Fase 2 — Esquelet de l'aplicació web

**Estat**: ✅ Feta (2026-08-22)

**Objectiu**: `apps/web` arrenca amb Vite + React + TypeScript, importa
`@remigi/core` del workspace i té la navegació i la persistència de base.
Encara sense partida jugable: només l'esquelet sòlid on penjar les fases 3 i 4.

### Tasques

- [x] Crear `apps/web` (Vite 8 + React 19 + TypeScript), paquet `@remigi/web`,
      amb `@remigi/core` com a dependència de workspace.
- [x] Comprovar que Vite resol el paquet core (el seu `main` apunta a font
      `.ts`): **funciona sense àlies ni `optimizeDeps`** — risc descartat.
- [x] `LocalStorageStore` implementant `KeyValueStore`, amb `createWebStore()`
      que comprova de debò si es pot escriure i degrada a `MemoryStore` si no.
- [x] Estructura de pantalles i navegació mínima (estat a `App.tsx`, sense
      router): **Inici**, **Partida**, **Estadístiques**.
- [x] Pàgina d'inici funcional: demana/recorda el nom i crea el perfil amb
      `ProfileRepository` sobre l'emmagatzematge del navegador.
- [x] Prova de fum del motor a la UI: `createGame` real, amb els jugadors, les
      fitxes de cadascun, el nivell dels bots i el sac.
- [x] Scripts a l'arrel (`dev`, `build`, `preview`); READMEs actualitzats.
- [x] 7 tests de l'adaptador d'emmagatzematge, inclosa la degradació i la
      persistència del perfil «entre recàrregues».

### Criteris d'acceptació (verificats)

- `npm install` net des de zero (esborrant `node_modules` i el lockfile);
  `npm run typecheck` i `npm test` en verd. ✔ (74 core + 7 web)
- `npm run build -w @remigi/web` compila sense errors. ✔ (198 kB, 63 kB gzip)
- `npm run dev` mostra la pantalla d'inici; en recarregar, el nom del jugador
  es conserva. ✔ Verificat amb Chromium (Playwright): perfil desat i recuperat,
  motor repartint 14 fitxes a 3 jugadors i 64 al sac, sense errors de consola
  ni desbordament horitzontal a 390 px.

### Problemes trobats

- [2026-08-22] `defineConfig` importat de `vite` no accepta l'apartat `test` i
  el typecheck fallava (TS2769) — resolt important-lo de `vitest/config`.
- [2026-08-22] **Conflicte de versions de vitest**: el core anava amb vitest 2,
  que porta Vite 5 a dins, i la web necessita Vite 8. Tenir-hi dues versions
  majors del mateix runner era demanar problemes, així que s'ha unificat tot el
  monorepo a **vitest 4**. Els 74 tests del core hi passen sense cap canvi.
- [2026-08-22] Risc que hi havia apuntat sobre la resolució de `@remigi/core`
  amb font TypeScript: **no s'ha materialitzat**. Vite el transpila com a codi
  del projecte a través de l'enllaç de workspace, tant en `dev` com en `build`.
  El risc queda tancat a la llista de sota.

---

## Fase 3 — Pantalla de partida jugable

**Estat**: ✅ Feta (2026-08-22)

**Objectiu**: es pot jugar una partida sencera al navegador contra 1, 2 o 3
bots, amb totes les regles aplicades pel motor.

### Tasques

- [x] Components de fitxa, jugada, taula i faristol, amb colors i valors reals
      (`COLOR_LABELS` per als textos d'accessibilitat).
- [x] Interacció per **seleccionar i col·locar** (clic): tries una fitxa i cliques
      on la deixes. `insertSmart` la posa a la posició que fa vàlida la jugada.
      L'arrossegar i deixar anar queda per a la Fase 5, com preveia el pla.
- [x] Còpia de treball del torn (`turnDraft.ts`, funcions pures); «Acabar jugada»
      envia la taula sencera a `applyMove` dins d'un `try/catch`.
- [x] Missatge del `RulesError` en català i botó «Desfer canvis».
- [x] Botó «Robar fitxa», que passa a dir «Passar torn» amb el sac buit.
- [x] Torns dels bots amb `decideAiMove` i pausa (`VITE_BOT_DELAY`, 900 ms per
      defecte), amb el jugador actiu ressaltat i animació a les fitxes que
      acaba de baixar.
- [x] Final de partida amb `finalScores`, guanyador, avís si ha estat bloqueig i
      botó de partida nova.
- [x] Selector a Inici: nombre d'oponents (1–3) i nivell de cadascun.
- [x] Ordenació del faristol (per número o per color), que el pla situava a la
      Fase 5 però surt gairebé de franc i fa la partida molt més còmoda.
- [x] 22 tests de la lògica del torn + checklist manual a `apps/web/README.md`.

### Criteris d'acceptació (verificats)

- Partida completa jugable contra 1, 2 i 3 bots sense errors de consola. ✔
  Verificat amb Chromium: les tres partides arriben al final i mostren la
  puntuació de tothom.
- És impossible fer trampes des de la UI. ✔ Verificat un per un: sortida inicial
  de 9 punts → *«la sortida inicial demana 30 punts i n'has jugat 9»*; jugada
  d'una sola fitxa → *«una jugada necessita com a mínim 3 fitxes»*; i una fitxa
  que ja era a la taula no es pot endur al faristol.
- La partida sempre pot acabar. ✔ Les tres partides de prova han acabat per
  bloqueig amb el sac buit, i el marcador suma zero (+420 −121 −299).
- `typecheck`, `test` i `build` en verd. ✔ (74 core + 22 web; 212 kB, 67 kB gzip)

### Problemes trobats

- [2026-08-22] El botó «+ Jugada nova» portava la classe `meld`, així que
  comptava com una jugada més: en col·locar-hi fitxes, cadascuna anava a una
  jugada nova en comptes d'ajuntar-se. Ho va destapar la prova de fer una
  sortida inicial vàlida al navegador. Resolt separant-lo (`new-meld` sol): no
  és una jugada, és el botó per crear-ne una.
- [2026-08-22] Els efectes de React s'executen dues vegades en mode estricte i
  el bot podia jugar dos cops el mateix torn. Resolt amb el `clearTimeout` del
  cleanup i una comprovació dins de `setGame`, que és qui té l'estat de debò.
- [2026-08-22] En treure una fitxa d'una jugada que es queda buida, la jugada
  desapareix i les següents es desplacen, així que l'índex de destinació que
  venia de la interfície ja no assenyalava el mateix lloc. Detectat escrivint
  els tests de `moveTile`; resolt amb `adjustIndex` i cobert amb un test propi.

### Limitacions conegudes (per a fases següents)

- `insertSmart` tria la primera posició que fa vàlida la jugada, que no sempre
  és la que l'usuari vol en casos ambigus. L'arrossegar i deixar anar de la
  Fase 5 donarà control exacte.
- ~~La `key` de cada jugada depèn de les seves fitxes~~ — **resolt a la Fase 5**:
  ara la clau és la posició, així afegir una fitxa a una jugada ja no en torna a
  muntar el component ni s'endú l'animació.

---

## Fase 4 — Cicle adaptatiu complet a la web

**Estat**: ✅ Feta (2026-08-22)

**Objectiu**: la dificultat s'adapta de debò a l'experiència del jugador: el
perfil viu al navegador, es proposa la partida segons l'Elo i cada resultat
l'actualitza.

### Tasques

- [x] A Inici, mode «Oponents automàtics» per defecte: `suggestOpponents`
      tria els nivells segons el perfil i `describeSuggestion` ho explica;
      «Prefereixo triar-los jo» passa a manual partint de la proposta.
- [x] En acabar cada partida, `useRecordResult` la registra **una sola vegada**
      amb els nivells realment jugats i la desa de seguida; el resultat mostra
      com ha canviat l'habilitat (p. ex. «1100 → 1070 (−30)»).
- [x] Pantalla d'Estadístiques: habilitat, partides, victòries i percentatge;
      gràfic d'evolució i historial complet (rivals, resultat, data).
- [x] Reiniciar el perfil amb confirmació en dos passos (`reset()` al hook).
- [x] Tests d'integració del cicle amb `MemoryStore`, inclosa una partida jugada
      de debò pel motor de punta a punta (7 tests nous, 29 en total a la web).

### Criteris d'acceptació (verificats)

- Dues partides seguides mouen l'habilitat i el canvi es conserva en tancar i
  reobrir. ✔ Verificat amb Chromium: 1100 → 1070 → 1041, amb les dues partides
  a l'historial i els rivals que s'havien jugat de debò.
- La proposta puja amb l'habilitat. ✔ Amb un perfil nou proposa «Novell, Fàcil»
  («Fàcil» amb un sol rival); posant l'habilitat a 1600 passa a «Avançat,
  Expert» («Expert» amb un sol rival).
- `typecheck`, `test` i `build` en verd. ✔ (74 core + 29 web; 218 kB, 69 kB gzip)
- Extra: el gràfic i l'historial aguanten 24 partides sense desbordar ni estirar
  la pàgina, i es poden recórrer amb el teclat.

### Problemes trobats

- [2026-08-22] El criteri deia que un perfil nou (1100) hauria de proposar
  «fàcil/mitjà», però amb **dos** rivals proposa **Novell i Fàcil**: 1100 queda
  just entre Fàcil (1000) i Mitjà (1200), i l'empat es resol cap avall (decisió
  ja documentada als riscos), i a sobre amb dos rivals la regla és «un per sota
  i un al nivell». No s'ha tocat: fa que les primeres partides siguin planeres i
  el jugador pugi de pressa, que és el que es vol en començar. Si es prefereix
  que estiguin igualades des del primer moment, la regla a canviar és la de dos
  rivals a `suggestOpponents` (passar de `[main-1, main]` a `[main, main+1]`).
- [2026-08-22] El perfil canvia d'identitat a cada render, així que posar-lo a
  les dependències de l'efecte que registra el resultat el feia córrer sense
  parar. Resolt llegint-lo per referència, de manera que l'efecte només depèn
  de la partida; el registre queda blindat, a més, per l'estat ja comptat.
- [2026-08-22] Els colors d'accent de la interfície no passen els controls de la
  guia de visualització com a color de dades (en tema clar la croma queda per
  sota del mínim i en fosc la lluminositat se'n va del marc). El gràfic fa
  servir `#0d9488`, que passa els sis controls sobre les dues superfícies i és
  de la mateixa família.

---

## Fase 5 — Experiència d'usuari i polit

**Estat**: ✅ Feta (2026-08-22)

**Objectiu**: que jugar-hi sigui còmode i agradable a ordinador i a mòbil.

### Tasques

- [x] Disseny responsiu i interacció tàctil: fitxes de 44 px de costat, taula i
      faristol amb desplaçament propi, botons del torn de 44 px d'alçada.
- [x] Arrossegar i deixar anar amb esdeveniments de punter (`useDragTile`), que
      funcionen igual amb ratolí i amb dit. El «tria i col·loca» a clics de la
      Fase 3 continua sent l'alternativa accessible per teclat, amb un botó
      «Torna la fitxa al faristol» per al cas que el faristol sigui buit.
- [x] Animacions curtes en robar, en guanyar i a les fitxes que acaba de baixar
      un bot, totes desactivades amb `prefers-reduced-motion`.
- [x] Partida en curs desada a cada moviment i oferta de continuar-la en tornar
      a obrir, amb validació del que hi ha desat (`state/savedGame.ts`).
- [x] ~~Ordenar el faristol (per color / per número)~~ — avançat a la Fase 3.
- [x] Ajuda opcional: marca les fitxes de la mà que poden formar jugada
      (`findRackMelds`), calculada només quan està encesa.
- [x] Accessibilitat: mides de toc, focus visible, `aria-live` per al canvi de
      torn i `role="alert"` per als errors, etiquetes a totes les fitxes.
- [x] Revisió de rendiment amb mesures reals.
- [x] Extra: tota la taula és zona per crear jugada nova, i la clau de cada
      jugada passa a ser la posició (resol la limitació apuntada a la Fase 3).

### Criteris d'acceptació (verificats)

- Partida completa jugable amb comoditat en un mòbil. ✔ Verificat en un Pixel 5
  emulat (393 px): partida sencera a base de tocs, arrossegament amb el dit,
  fitxes de 44×56 px, botons de 44 px i cap desbordament horitzontal.
- Tancar la pestanya a mitja partida i continuar-la. ✔ Es reprèn al mateix torn
  i amb les mateixes fitxes a la mà; en acabar-se, deixa d'oferir-se.
- `typecheck`, `test` i `build` en verd. ✔ (74 core + 36 web; 223 kB, 71 kB gzip)
- Rendiment: la resposta del torn **no es degrada** a mesura que creix la taula
  (90 ms el primer torn per escalfament; després 40–55 ms estables fins a 31
  fitxes a la taula). Inclou el temps d'anada i tornada de l'automatització, així
  que el treball real de la interfície és força menor.
- Tema fosc i moviment reduït comprovats: contrast de 6,3:1 al número de la
  fitxa i animacions efectivament desactivades.

### Problemes trobats

- [2026-08-22] Els botons del torn feien 42 px d'alçada i l'enllaç «Deixar la
  partida» només 24: per sota dels 44 recomanats per al tacte. Detectat
  mesurant-los en el mòbil emulat; resolt amb una alçada mínima en pantalles
  petites.
- [2026-08-22] **Compromís del tacte**: per poder arrossegar amb el dit cal
  `touch-action: none` a les fitxes, i això impedeix desplaçar la pàgina
  lliscant just damunt d'una fitxa. S'ha compensat donant desplaçament propi a
  la taula i al faristol, i mantenint el «tria i col·loca» a tocs, que no
  necessita arrossegar gens. Queda anotat perquè és una decisió, no un descuit.
- [2026-08-22] Una escala llarga no cap en una pantalla estreta i desquadrava la
  pàgina. Resolt fent que la taula es desplaci per dins, sense partir les
  jugades.
- [2026-08-22] Una primera mesura de rendiment no valia res: la partida
  s'acabava abans d'omplir-se la taula i es mesurava amb la taula buida.
  Repetida seguint la mida de la taula a cada torn, que és el que es volia
  saber.

---

## Fase 6 — Motor avançat (solver òptim i regles pendents)

**Estat**: ✅ Feta (2026-08-22)

**Objectiu**: apujar el sostre de la IA i completar les variants de regles
apuntades com a pendents a `docs/REGLES.md` i `docs/ARQUITECTURA.md`.

### Tasques

- [x] **Solver amb reordenació de taula** (`ai/rearrange.ts`): reparteix de nou
      totes les fitxes de la taula més les que calgui de la mà, quedant-se'n a
      la mà les mínimes. Treballa amb recomptes per color i número (les còpies
      són intercanviables) i recorre les caselles en ordre fix, de manera que
      cada repartiment es genera una sola vegada. Sostre de nodes i comprovació
      de la proposta abans de fer-la servir.
- [x] Escales amb joker també als **extrems**.
- [x] **Intercanvi de joker**: comprovat que ja funcionava sense cap regla nova
      (vegeu *Problemes trobats*), i fixat amb tests.
- [x] Elo amb **marge de resultat** (`marginFromPoints`), connectat a la web des
      de la puntuació final.
- [x] *Rubber banding* opcional (`rubberBandedMistakeRate`), desactivat per
      defecte i amb casella pròpia a la pantalla d'inici.
- [x] `docs/` actualitzats i simulador ampliat amb temps de decisió i mode duel.

### Criteris d'acceptació (verificats)

- Tests nous per a cada regla i per al solver. ✔ 97 tests al motor (abans 81):
  reordenació, intercanvi de joker, marge d'Elo i ajust dins de la partida.
- L'expert nou guanya clarament més que l'antic. ✔ Mesurat de dues maneres:
  - Duel directe a 200 partides amb el mateix repartiment i alternant qui
    comença: **200–0** per a l'expert amb reordenació.
  - Contra Mitjà i Novell, 100 partides amb les mateixes llavors: **92%** de
    victòries amb reordenació contra **56%** sense (el 56% és el control que
    confirma que l'expert antic segueix jugant com abans).
- El torn de l'expert no arriba a ~1 s. ✔ Mitjana 9 ms, p95 60 ms, pitjor
  **176 ms** en 100 partides.
- `typecheck` i `test` en verd. ✔ (97 core + 36 web)
- API pública: `recordGame` accepta ara `boolean | GameOutcome` (compatible amb
  el que hi havia), `decideAiMove` té un quart paràmetre d'opcions, i s'hi
  exporten `bestRearrangement`, `marginFromPoints` i `rubberBandedMistakeRate`.

### Problemes trobats

- [2026-08-22] **L'intercanvi de joker ja funcionava.** En anar a implementar-lo
  es va veure que surt sol de com està plantejat el moviment de jugar: com que
  es valida la taula sencera resultant, substituir el joker per la fitxa de debò
  i tornar-lo a col·locar és una reordenació més. I les dues restriccions de la
  regla oficial ja hi eren: no te'l pots endur a la mà (`TILE_REMOVED`) i no el
  pots tocar abans d'obrir (`REARRANGE_BEFORE_OPENING`). No s'hi ha afegit cap
  codi d'error nou: hauria estat inventar-se una restricció per tenir-la.
- [2026-08-22] Un duel 200–0 fa desconfiar. S'hi va fer un control: l'expert
  sense reordenació, contra Mitjà i Novell, guanya el 56% de les partides, molt
  a prop del 59% que donava a la Fase 1. Per tant no estava trencat, i el 200–0
  és real: en un cara a cara l'avantatge s'acumula a cada torn.
- [2026-08-22] Arreglar els jokers als extrems de les escales va abaixar
  lleugerament l'expert antic (59% → 56%) perquè també enforteix el nivell
  mitjà, que és el seu rival directe. És el comportament esperat, no una
  regressió.
- [2026-08-22] `pkill -f vite` matava el propi intèrpret d'ordres, perquè la
  seva línia també conté «vite». Anotat perquè no torni a passar: cal filtrar
  per `node.*vite`.

---

## Fase 7 — Desplegament

**Estat**: ✅ Feta (2026-08-22)

**Objectiu**: el joc és públic en una URL i s'hi pot jugar des de qualsevol
dispositiu.

### Tasques

- [x] Build estàtic de producció amb la `base` a `/rummikub/`, configurable amb
      `BASE_PATH` sense tocar codi.
- [x] Desplegament automàtic a **GitHub Pages** (triat per l'usuari) a cada
      canvi que arriba a `main`, amb el desplegament oficial de Pages.
- [x] CI a cada push i pull request: tipus, tests, build i proves de navegador.
- [x] **37 proves de navegador** (Playwright) que substitueixen la checklist
      manual de la Fase 3, executades en escriptori i mòbil contra el build de
      producció servit a `/rummikub/`.
- [x] PWA: manifest, icones i service worker per jugar sense connexió.
- [x] READMEs amb l'enllaç públic, com publicar i com provar-ho.

### Criteris d'acceptació (verificats)

- La URL pública carrega i s'hi juga una partida sencera. ✔ **Publicat i
  verificat** el 2026-08-22. Com que el navegador d'aquest entorn no pot sortir
  a internet (curl sí), es van baixar un per un els fitxers que serveix
  `https://segueix.github.io/rummikub/` i es van provar en un navegador:
  partida sencera fins al final, habilitat 1100 → 1062, perfil conservat entre
  visites, cap error de consola, bé en mòbil, manifest descarregable i joc
  obrint-se amb la xarxa tallada. La resposta de la URL (200 i els fitxers
  correctes sota `/rummikub/assets/`) es va comprovar amb curl.
- El perfil persisteix entre visites. ✔ Prova pròpia a `e2e/perfil.spec.ts`,
  inclosa la represa d'una partida a mitges.
- La CI falla si es trenca un test. ✔ Comprovat sense fer trampes: es va rompre
  una asserció a posta i `npm test` va sortir amb codi 1, que és el que fa
  fallar el pas de la CI.
- La CI funciona de debò, no només sobre el paper. ✔ La primera execució als
  servidors de GitHub va passar sencera en poc més d'un minut: tipus, tests,
  build, instal·lació de Chromium i les 39 proves de navegador.
- Extra: es pot jugar **sense connexió** un cop visitat (prova amb la xarxa
  tallada) i instal·lar com a aplicació (manifest i icones comprovats).

### Dos publicadors alhora: el problema que va costar més

Amb la font de Pages en «Deploy from a branch», **cada canvi a `main` engega dos
desplegaments**: el d'aquest projecte i el generador antic de Jekyll. Els dos
publiquen al mateix lloc i guanya el que acaba l'últim.

Es va veure comparant les hores de la fusió de la PR núm. 4: el desplegament del
joc va acabar a les 21:24:04 i el de Jekyll a les 21:24:11, set segons més tard.
Per això el joc va aparèixer un moment i després va tornar a sortir el README.

La solució és canviar la font a «GitHub Actions», que apaga el generador antic.
El flux ho demana ell mateix amb `enablement: true`, però si el permís no basta
s'ha de fer des de *Settings → Pages*.

**Símptoma per reconèixer-ho una altra vegada**: el lloc publicat és el README
convertit en pàgina i, a Actions, cada canvi a `main` té dues execucions de
desplegament en comptes d'una.

### Com va anar la primera publicació

Dues coses no es podien fer des del codi, i les va fer l'usuari: portar els
canvis a `main` i posar la font de Pages a «GitHub Actions».

Amb això encara no n'hi va haver prou: després de la fusió, el flux
`desplega.yml` constava com a registrat i actiu però **no havia produït cap
execució**, i el lloc continuava sent el README convertit amb Jekyll. Es va
llançar a mà (*Actions → Desplega a GitHub Pages → Run workflow*) i va publicar
correctament en 30 segons. Els canvis següents a `main` sí que l'engeguen.

### Problemes trobats

- [2026-08-22] `vite preview` compta com a `serve`, no com a `build`, així que
  amb la `base` posada només per al build servia el lloc des de l'arrel mentre
  els fitxers generats apuntaven a `/rummikub/`: **totes** les proves de
  navegador fallaven de cop. Resolt aplicant la base també a `preview`, cosa que
  a més fa que les proves comprovin exactament el que es publica.
- [2026-08-22] La prova de l'ajuda partia d'una premissa fràgil: una mà de 14
  fitxes a l'atzar pot no tenir cap jugada possible, i llavors no marcar-ne cap
  és el comportament correcte. Resolt robant fitxes fins que n'hi hagi alguna.
- [2026-08-22] `pkill -f vite` matava el propi intèrpret d'ordres (la seva línia
  també conté «vite»). Ja anotat a la Fase 6; aquí va tornar a passar. La manera
  segura és filtrar per port: `lsof -t -i:4173`.
- [2026-08-22] La documentació deia que calia «activar Pages» perquè el
  repositori no el tenia. En comprovar-ho va resultar que **ja hi estava
  activat**, amb la font antiga per branca, servint el README amb Jekyll. La
  passa que cal no és activar-lo sinó **canviar-ne la font**. Corregit als
  READMEs: la diferència importa, perquè amb la instrucció antiga l'usuari
  hauria buscat un interruptor que ja estava encès.
- [2026-08-22] **El primer desplegament no es va engegar sol.** Un cop fusionat
  a `main` i amb la font canviada, `desplega.yml` figurava actiu però sense cap
  execució, i el lloc seguia sent el de Jekyll. Llançant-lo a mà des d'Actions
  va publicar sense problemes. Queda documentat al README perquè, si torna a
  passar amb un flux acabat d'afegir, se sàpiga que la sortida és el botó «Run
  workflow» i no tornar a tocar la configuració.
- [2026-08-22] **El joc publicat va tornar enrere tot sol.** No era cap error
  del desplegament: amb la font de Pages en mode branca, cada canvi a `main`
  engega també el generador de Jekyll, i com que acaba uns segons més tard,
  sobreescriu el joc amb el README. Diagnosticat comparant les hores de les
  dues execucions. Afegit `enablement: true` perquè el flux demani la font
  correcta, i documentat el símptoma al README.
- [2026-08-22] El navegador d'aquest entorn no pot sortir a internet (ni amb el
  proxy configurat: `ERR_CONNECTION_RESET`), tot i que `curl` sí que hi surt.
  Per verificar la publicació de debò es van baixar amb curl els fitxers que
  serveix Pages, es van servir en local i s'hi van fer les proves. Comprova el
  que s'ha publicat, però no el camí de xarxa; això últim es va comprovar amb
  curl (codi 200 i els fitxers correctes).

---

## El projecte, acabat

Les set fases estan fetes. Si es reprèn el projecte, això és el que hi ha
apuntat com a següent pas natural, per ordre de profit:

- **Estratègia a llarg termini de la IA**: ara maximitza les fitxes del torn
  actual, sense guardar-se'n per a jugades futures ni comptar les del rival.
- **Perfils múltiples** al mateix dispositiu (`ProfileRepository` ja ho suporta,
  només cal interfície).
- **Rondes encadenades** amb marcador acumulat: la puntuació ja suma zero, que
  és el que ho fa possible.
- Límit de temps per torn.

### Problemes trobats

*(cap encara)*

---

## Millores després de les fases

Feina demanada un cop tancades les set fases. S'apunta aquí perquè aquest
document continuï sent l'estat de la veritat, amb el mateix protocol: criteris
comprovats de debò i problemes registrats.

### Explicar com s'obre ✅ Feta (2026-08-22)

Un jugador va provar d'obrir amb un 6 i dos 12 («sumen 30») i el joc li va
respondre «en portes 0» i «una jugada necessita com a mínim 3 fitxes». Les dues
coses eren certes —6+12+12 no és ni grup ni escala, i les fitxes li havien quedat
en caixes separades— però cap de les dues ho explicava.

- [x] «Com es juga (i com s'obre)» a la pantalla d'inici, amb exemples fets amb
      fitxes de debò, inclòs el cas que enganya.
- [x] Durant el torn, la pista de la sortida inicial diu **per què** les jugades
      marcades en vermell no sumen punts.

**Criteris d'acceptació (verificats)**: dues proves de navegador noves, una per a
l'explicació de l'inici i una per al cas real del jugador.

### Qui ha jugat què ✅ Feta (2026-08-22)

Demanat pel jugador: «marca amb un recuadre la peça que he robat a la jugada.
Dona un color a cada bot i posa un marc del color del bot en el moment que posi
un grup nou de peces, si aquest és modificat que perdi el color del marc o es
posi el del bot que ha fet la modificació.»

- [x] La fitxa acabada de robar es marca al faristol fins que tornes a jugar o a
      robar.
- [x] Un color per bot, a la llista de jugadors i al marc de les seves jugades.
- [x] Una jugada modificada passa al color de qui la modifica, i perd el marc si
      qui la toca ets tu (el color és dels bots).
- [x] Els colors es desen amb la partida, perquè continuar-la no els faci perdre.

**Criteris d'acceptació (verificats)**:

- `npm test` en verd (147 tests, 14 de nous) i `npm run typecheck` net.
- `npm run test:e2e` en verd: 53 proves de navegador, 10 de noves (5 × 2
  projectes), en escriptori i mòbil sobre el build de producció.
- Comprovat també mirant-ho: captures de la partida amb tema clar i fosc, amb
  fitxa robada marcada i jugades de dos bots diferents.

**Decisió**: qui ha jugat cada jugada **no entra al motor**. `packages/core` es
manté pur i sense estat que no siguin regles; la web ho dedueix comparant la
taula d'abans i la de després de cada moviment (`apps/web/src/game/meldOwners.ts`).

### Vermell i taronja que es distingeixin ✅ Feta (2026-08-22)

Demanat pel jugador: «fes que els números vermells siguin més intensos i els
taronges un pel més grocs, són difícil de diferenciar a la pantalla actualment».
Tenia raó i es pot mesurar: els dos colors estaven a ΔE 23, i a ΔE 6 amb
daltonisme simulat, que és tant com dir el mateix color.

- [x] Vermell més intens i fosc (`#cc0000`), que a sobre contrasta més amb el
      crema de la fitxa que abans: 5.5:1 en comptes de 4.5:1.
- [x] Taronja cap al groc (`#c47504`), amb el mateix contrast d'abans (3.3:1).

**Criteris d'acceptació (verificats)**: la distància entre els dos colors passa
de ΔE 23 a 46 (de 6 a 13 amb daltonisme), cap dels dos no perd contrast, i tots
dos continuen lluny del blau i del negre. Comprovat també mirant-ho, amb una mà
de vermells i taronges alternats en tema clar i fosc.

### Problemes trobats

- [2026-08-22] **Identificar una jugada per la posició no serveix.** Una jugada
  es proposa reordenant la taula sencera, així que els índexs ballen a cada
  moviment i el color hauria saltat de jugada. Resolt identificant-la per les
  seves fitxes (els ids, ordenats): una jugada que no ha canviat conserva el
  color encara que canviï de lloc, i una de modificada és una altra jugada, que
  és justament el que es vol.
- [2026-08-22] **Continuar una partida deixava la taula sense colors**, perquè
  els autors no són estat del motor i no es desaven. Semblava un error, no una
  limitació. Resolt desant-los amb la partida, validats a part: si vénen
  malmesos es descarten i la partida es continua igual.
- [2026-08-22] **La primera tria de colors no passava el test del daltonisme**:
  violeta i verd sobre fons fosc quedaven a ΔE 21 amb deuteranopia simulada, o
  sigui pràcticament iguals. Resolt mesurant contrast i separació de tots els
  candidats i quedant-se amb fúcsia/oliva/blau (mínim ΔE 36 en clar i 33 en
  fosc). El nom del bot també surt en text, que no depèn de veure el color.
- [2026-08-22] Una prova nova esperava el torn del jugador mirant si el botó
  «Acabar jugada» estava actiu, i aquest només s'activa quan hi ha canvis al
  torn. Resolt esperant la línia de torn, que és qui ho diu de debò.
- [2026-08-22] **Fer el taronja més groc li treia contrast**: com més groc, més
  clar, i menys es veu sobre el crema de la fitxa. Els candidats més grocs
  baixaven de 3:1, que és el mínim per a un número d'aquesta mida. Resolt
  abaixant-ne la lluminositat a mesura que se'n pujava el to, fins a trobar-ne
  un de prou groc que manté el contrast d'abans.

---

### Taula de joc a pantalla completa, amb rivals amb cara i ulls ✅ Feta (2026-08-23)

Demanat pel jugador: disseny en horitzontal amb el faristol a sota i la taula a
sobre ocupant el màxim sense desplaçament; bots amb nom (un planter de 20-30 que
canvien a cada partida) i avatar propi; i un aspecte de joc professional,
sobretot la taula on es posen les fitxes.

- [x] La partida ocupa tota la pantalla: la taula es queda l'espai que sobra,
      el faristol és sempre a baix i la pàgina no es desplaça mai (les úniques
      zones amb desplaçament propi són la taula i el faristol, si mai calen).
- [x] Les fitxes de la taula són un pèl més petites que les del faristol: hi
      caben més jugades a la vista; el faristol conserva els 44 px de toc.
- [x] Planter de 24 personatges amb nom i avatar (`game/bots.ts`); cada partida
      en tria de diferents a l'atzar. El nom viatja dins de l'estat del motor
      (que només hi veu una cadena), així que les partides desades conserven els
      seus rivals; l'avatar es dedueix del nom i no cal desar-lo.
- [x] Taula de feltre verd i faristol de fusta, fitxes amb relleu, jugadors en
      targetes amb avatar i anell del seu color, i botons amb una mica de cos.

**Criteris d'acceptació (verificats)**:

- Les 57 proves de navegador en verd (4 de noves: rivals amb nom i avatar
  diferents, i partida encaixada a la pantalla sense desplaçament de pàgina),
  en escriptori i mòbil sobre el build de producció. 102 tests de unitat.
- Mirat amb captures en tema clar, fosc i mòbil vertical: res no desborda i
  tots els estats es distingeixen (fitxa robada, marcs de bots, jugada
  invàlida, destinacions).

**Decisions**:

- El feltre és fosc en tots dos temes, com una taula de debò; per això tot el
  que s'hi posa a sobre fa servir sempre versions clares dels colors (variables
  amb sufix `-taula`). Els marcs dels bots sobre feltre són les versions
  clares encara que el tema sigui clar.
- La fitxa robada passa de marcar-se amb el color d'acció a marcar-se en
  **daurat**: sobre la fusta del faristol el torquesa es confonia amb la fitxa
  triada, i el daurat no el fa servir res més.
- El planter és a la web, no al motor: per al motor el nom d'un jugador és una
  cadena i prou, i així ha de continuar.

### Problemes trobats

- [2026-08-23] Una partida desada d'una versió anterior porta bots que es diuen
  «Bot 1»: no són al planter i no tindrien avatar. Resolt amb un avatar de
  recanvi (🤖) per a qualsevol nom desconegut, amb test.
- [2026-08-23] El botó «+ Jugada nova» heretava el relleu nou dels botons i
  semblava un botó d'acció flotant sobre el feltre. Resolt traient-li l'ombra:
  és una zona per deixar-hi fitxes, no una ordre.

### Botons del torn amb icona i mòbil apaïsat ✅ Feta (2026-08-23)

Demanat pel jugador: els quatre botons del torn en una sola línia amb icones
estil aplicació, i que la partida s'adapti al mòbil posat en horitzontal.

- [x] Els botons van sempre en una sola línia, amb icona de traç (SVG en línia,
      `components/icons.tsx`, sense cap llibreria) i rètol; quan el rètol no hi
      cap, s'amaga i queda la icona, com en una app. El nom accessible el porta
      `aria-label`, així no canvia mai (i les proves tampoc).
- [x] «Robar fitxa» i «Passar torn» tenen icona diferent: una fitxa amb un més,
      i l'avanç de torn.
- [x] Mòbil apaïsat (`orientation: landscape` i poca alçada): jugadors reduïts
      a avatar i compte, faristol en una sola filera amb desplaçament
      horitzontal, fitxes de taula més menudes i botons només amb icona. La
      taula es queda la resta de l'alçada i la pàgina no es desplaça.

**Criteris d'acceptació (verificats)**: 60 proves de navegador en verd (3 de
noves: botons en una sola línia a totes les mides amb el nom intacte, i partida
encaixada al mòbil apaïsat de 851×393 amb botons de 44 px). Comprovat amb
captures en escriptori, mòbil vertical i mòbil apaïsat.

**Decisió**: el nom dels botons viu a `aria-label` i el rètol visible és
decoratiu. Si el rètol s'amagués amb `display: none` sense `aria-label`, el
botó es quedaria sense nom accessible: no és una finor, és el que fa que
amagar-lo sigui possible.

### Problemes trobats

*(cap: el canvi ha sortit net a la primera passada de proves)*

### El mòbil no girava, i el gir amb un botó ✅ Feta (2026-08-23)

El jugador va veure que al mòbil el joc no es posava en horitzontal ni girant
el telèfon, i va demanar també un botó de gir al costat dels quatre del torn, i
que els noms dels bots es veiessin (en apaïsat s'havien amagat per estalviar
espai).

**El perquè no girava**: el manifest de l'aplicació portava
`"orientation": "portrait"` des que es va crear, així que l'app instal·lada
quedava clavada en vertical per molt que girés el telèfon. No era cap misteri
de CSS: era una línia de configuració.

- [x] `orientation: "any"` al manifest: l'app gira amb el telèfon.
- [x] Botó «Gira la pantalla» a la dreta dels quatre del torn, amb la seva
      icona: posa el joc a pantalla completa (el bloqueig d'orientació ho
      demana) i gira a l'orientació contrària; tornar-lo a prémer ho desfà.
      Només surt on pot funcionar (pantalla tàctil i navegador amb
      `screen.orientation.lock`); als iPhone no hi és, i girar el telèfon fa
      el mateix.
- [x] Els noms dels bots tornen a veure's en apaïsat, en lletra menuda.

**Criteris d'acceptació (verificats)**: 62 proves de navegador en verd (el botó
surt al projecte de mòbil i no al d'escriptori, prémer-lo no peta encara que
l'emulador no pugui girar, i el recompte de botons és 5 al mòbil i 4 a
l'escriptori). Captures en vertical i apaïsat amb el botó al seu lloc.

### Problemes trobats

- [2026-08-23] **El bloqueig d'orientació no és un gir de CSS**: girar la
  interfície per transformació hauria trencat l'arrossegament (coordenades del
  punter). S'ha fet amb l'API d'orientació de debò, acceptant que on no hi és
  (iPhone) el botó no surti: val més un botó que no surt que un que no fa res.
- [2026-08-23] TypeScript ja no declara `screen.orientation.lock` (massa
  navegadors sense suport): es comprova en temps d'execució i es tipa a mà.

### Directes a la taula: menú del jugador i rivals amb nom d'usuari ✅ Feta (2026-08-23)

Demanat pel jugador: fora la pantalla d'inici (l'app entra directament a la
partida), bots amb nom d'usuari i avatars més vistosos, faristol sense títol
(el compte de fitxes al costat d'«Ordena») i sense «ajuda'm», i tot el que era
a l'inici —nom, nivell, partida nova, historial— en un desplegable que s'obre
tocant el teu jugador.

- [x] L'app entra directament a la taula: si hi ha partida a mig jugar es
      continua sola, i si no se'n reparteix una amb els rivals que toquen per
      l'habilitat. El perfil es crea sol el primer cop («Jugador») i el nom es
      canvia des del menú.
- [x] Menú del jugador (`components/PlayerMenu.tsx`): nom, nombre de rivals,
      nivell (automàtic o fixat), «Partida nova», «Historial» i «Com es juga».
- [x] Planter refet amb noms d'usuari (GuineuAstuta, PolpVuitMans, MussolSavi…)
      i avatars amb degradat de colors propi de cada personatge; l'anell
      conserva el color de taula del bot, que és el que lliga amb els marcs.
- [x] Faristol: fora el títol i l'ajuda; «Ordena: … · N fitxes».
- [x] L'historial (abans «Estadístiques») porta el retorn a la partida i el
      reinici del perfil, que vivia a l'inici.
- [x] Fora el botó «Deixar la partida»: la seva destinació ja no existeix;
      «Partida nova» i «Historial» viuen al menú. Queden 3 botons de torn
      (4 al mòbil, amb el gir).

**Criteris d'acceptació (verificats)**: 60 proves de navegador en verd amb el
flux nou (entrada directa, nom pel menú, partida nova des del menú, historial
amb retorn, reinici que torna a crear el perfil de zero, regles dins del menú)
i 102 tests de unitat. Captures de taula i menú.

**Decisions**:

- **La partida no es desmunta en anar a l'historial**: es pinta a sobre i es
  torna exactament on era, sense passar pel desat.
- **El nom del teu jugador surt del perfil, no de l'estat de la partida**: així
  canviar-lo al menú es veu a l'instant; l'estat del motor conserva el nom amb
  què va començar la partida.
- La configuració viva de la partida (rivals, adaptació) es guarda a la
  pantalla de joc (`currentSetup`), perquè una partida nova des del menú quedi
  ben registrada al perfil i ben desada.

### Problemes trobats

- [2026-08-23] **Les proves que injectaven una partida desada van petar**: ara
  l'app reparteix una partida només arribar i la desa a cada moviment, així que
  esborrar o injectar `localStorage` després de carregar era una cursa contra
  els bots (que amb `VITE_BOT_DELAY=0` juguen a l'instant i sobreescrivien la
  partida injectada abans del `reload`). Resolt amb `addInitScript`: la llavor
  s'hi posa abans que l'app arrenqui, amb un senyal perquè una recàrrega dins
  de la mateixa prova no ho torni a esborrar.

### Amb el dit: lliscar desplaça, mantenir premut arrossega ✅ Feta (2026-08-23)

El jugador va topar amb un mur: amb el tacte no es podia desplaçar la taula, i
les fitxes no es podien portar a jugades que no fossin a la pantalla. La causa
era el `touch-action: none` de les fitxes: qualsevol lliscada que comencés
sobre una fitxa quedava segrestada per l'arrossegament — i amb la taula plena,
tot són fitxes.

- [x] Les fitxes ja no porten `touch-action: none`: lliscar-hi per sobre
      desplaça la taula o el faristol amb normalitat, també amb una fitxa
      triada.
- [x] Amb el dit, la fitxa s'agafa **mantenint-la premuda un instant** (180 ms
      quiet), com a les apps; una vibració curta ho confirma on n'hi ha. A
      partir d'aquí el dit se l'enduu i el desplaçament queda frenat (aturant
      el `touchmove` amb un oient no passiu, que és l'única manera un cop
      descartat el `touch-action`).
- [x] Amb el ratolí res no canvia: moure's uns píxels amb el botó premut ja és
      arrossegar, com sempre.

**Criteris d'acceptació (verificats)**: prova de navegador amb tocs de debò
(CDP) sobre una taula de 25 jugades que no cap a la pantalla — la lliscada que
comença sobre una fitxa desplaça la taula i no s'enduu res; mantenir premut
aixeca la fitxa, arrossegar-la no desplaça, i la fitxa acaba dins de la jugada.
61 proves en verd.

### Problemes trobats

- [2026-08-23] **La inèrcia del desplaçament va embrutar la prova**: després
  d'una lliscada, la taula continua rodant uns instants pel seu compte, i la
  comprovació de «no s'ha desplaçat durant l'arrossegament» veia el cua d'aquell
  impuls. Resolt esperant que la inèrcia mori abans de la segona part de la
  prova. És cosa de la prova, no del joc.
- [2026-08-23] El manteniment podia acabar en menú contextual a Android o en
  selecció de text a iOS. Resolt aturant el `contextmenu` mentre hi ha gest en
  marxa i amb `user-select: none` i `-webkit-touch-callout: none` a la fitxa.

### Color i integració: menú, final de partida i historial ✅ Feta (2026-08-24)

Demanat pel jugador: que el menú del jugador, la pantalla de final de partida i
l'historial tinguin més color i lliguin més amb el joc.

- [x] **Firma comuna**: una franja amb els quatre colors de les fitxes obre les
      tres superfícies (`.franja-fitxes`), amb versions clares al tema fosc.
- [x] **Menú**: avatar gran al costat del nom, i la configuració de la partida
      en una capsa tenyida del color d'acció.
- [x] **Final de partida**: trofeu gran si guanyes (amb la targeta enllustrada
      d'or), l'avatar del bot guanyador si perds; marcador amb l'avatar de cada
      jugador, corona al guanyador i punts com a xapes (verd qui suma, vermell
      apagat qui resta); el canvi d'habilitat en una banda destacada.
- [x] **Historial**: capçalera amb avatar i nom, rajoles d'estadístiques amb un
      color d'identitat cadascuna (habilitat, partides, victòries, percentatge),
      àrea suau sota la línia del gràfic, i resultats de l'historial com a xapes
      amb la vora de la fila del mateix color.

**Criteris d'acceptació (verificats)**: les 61 proves de navegador continuen en
verd sense tocar-ne cap (el redisseny no canvia cap selector ni cap text que es
comprovi), i captures de les tres superfícies en tema clar i fosc.

**Decisió (de la guia de visualització)**: a les rajoles i al marcador, el color
porta la identitat (vores, fons tenyits, xapes) i **els números van sempre amb
el color del text**: el que s'ha de llegir no es tenyeix.

### Problemes trobats

- [2026-08-24] **La variable d'identitat de les rajoles no s'aplicava**: el
  valor per defecte era a `.stats div` (especificitat 0,1,1) i les classes
  `.stat-*` (0,1,0) no el podien guanyar. Resolt posant el valor per defecte al
  pare `.stats`: l'herència sí que cedeix davant d'una regla pròpia de
  l'element, la especificitat no.

### El marc de colors marca només l'últim moviment ✅ Feta (2026-08-24)

Demanat pel jugador: que el marc del color del bot surti només a les peces
mogudes en el darrer moviment, i també a la jugada que baixa el jugador.

- [x] `updateOwners` deixa de conservar l'autoria antiga: després de cada
      moviment només queden marcades les jugades noves o modificades d'aquell
      moviment, atribuïdes a qui l'ha fet. Robar o passar (cap fitxa moguda) no
      esborra res: l'últim moviment amb fitxes continua sent el d'abans.
- [x] Les jugades que baixa el jugador també porten marc, amb el seu color
      d'acció (`data-bot="0"` → torquesa de taula). Tocar una jugada marcada
      durant el torn li continua traient el marc a l'instant.

**Criteris d'acceptació (verificats)**: 63 proves de navegador en verd — les
del marc reescrites al comportament nou (tots els marcs de la taula són d'un
sol moviment i d'un sol color; la jugada baixada pel jugador porta el marc 0) i
13 tests de unitat de `meldOwners` (2 de nous: les marques d'abans s'esborren,
i un moviment sense fitxes no esborra res).

### Problemes trobats

- [2026-08-24] **Un localitzador «viu» de Playwright va emmascarar el canvi**:
  la prova de tocar una jugada marcada la buscava per `[data-bot]`, i quan la
  jugada tocada perdia el marc, el localitzador saltava tot sol a una altra que
  encara el tenia. Resolt fixant l'objectiu per posició abans de tocar-lo.

### Canvi de nom: de «rummikub» a «Remigi» ✅ Feta (2026-08-24)

«RUMMIKUB» és una marca registrada, i encara que el projecte no en faci negoci,
fer servir la marca com a nom d'un joc públic pot fer creure que és l'oficial.
El jugador va triar **Remigi** — el nom tradicional de la família del rummy—,
i la descripció diu «rummy de fitxes», que és el genèric i no és de ningú.

- [x] Nom visible: títol de la pestanya, manifest de l'app (nom, nom curt i
      descripció).
- [x] Noms interns: paquets `@remigi/core` i `@remigi/web` amb tots els
      imports, ruta base `/remigi/`, memòria cau del service worker i claus
      del navegador.
- [x] **Migració de dades**: les claus velles (`rummikub:profile:local`,
      `rummikub:game`) es copien un sol cop a les noves en arrencar i
      s'esborren; ningú no perd el perfil ni la partida a mitges pel canvi de
      nom (`storage/migrate.ts`, amb tests).
- [x] Documentació i adreces actualitzades a `/remigi/`. Les mencions del nom
      antic al registre històric d'aquest document es queden: expliquen fets.

**Pendent de l'usuari**: reanomenar el repositori a GitHub (`rummikub` →
`remigi`). Quan ho faci, l'adreça de Pages passa a `/remigi/` tota sola (la
ruta base del build surt del nom del repositori) i cal tornar a desplegar.
L'app instal·lada al mòbil apunta a l'adreça antiga i s'haurà de tornar a
instal·lar.

### Problemes trobats

*(cap: el canvi ha sortit net, amb la migració coberta per tests)*

### Més taula, torn visible i gestos ben educats ✅ Feta (2026-08-24)

Cinc demandes del jugador i un informe d'error, en una passada:

- [x] **Més espai per a la taula**: la capçalera del faristol («Ordena…») més
      prima, i els botons del torn més prims on el punter és fi (on es toca amb
      el dit conserven els 44 px, amb regla pròpia a cada mode i una de
      seguretat per a `pointer: coarse`).
- [x] **Apaïsat amb barra lateral**: els jugadors passen a una columna a
      l'esquerra (targetes apilades i línia de torn a sota) i la taula es queda
      tota l'alçada. Fet amb una graella dins del bloc apaïsat.
- [x] **El canvi de torn es veu venir**: la pausa dels bots puja a 3 segons i,
      mentre duren, al mig de la pantalla hi ha l'avís amb l'avatar i el nom
      del bot i «està jugant…». No rep clics (`pointer-events: none`) i és
      decoratiu: la línia de torn ja ho anuncia als lectors de pantalla.
- [x] **El gest d'enrere d'Android no s'endú la partida**: a l'app instal·lada
      es planta una entrada d'historial i es replanta a cada intent; a la
      pestanya del navegador es respecta l'enrere, i el gest de la vora i el
      d'arrossegar per refrescar els frena `overscroll-behavior: none`.
- [x] **L'informe de «fitxes soles al tauler sense error»**: el motor és
      estanc — `applyPlay` valida cada jugada de la taula proposada abans
      d'acceptar res, i ara hi ha un test de regressió que ho fixa amb el cas
      exacte de l'informe (un 10 sol i una parella). El que es veia era la
      còpia de treball del torn del jugador, on les fitxes soles són legals
      fins a «Acabar jugada»; el que faltava era que es veiés: el marc vermell
      passa a 2 px amb lluïssor, i fora de l'obertura també surt la pista que
      explica què cal fer amb les jugades en vermell.

**Criteris d'acceptació (verificats)**: 157 tests i 63 proves de navegador en
verd; captures de la barra lateral en apaïsat, de les fitxes soles ben marcades
amb la pista nova, i de l'avís de torn sobre el build de producció (amb la
pausa real de 3 segons).

### Problemes trobats

- [2026-08-24] **La barra lateral no s'aplicava**: la regla base
  `.app-joc .game` (0,2,0) guanyava el `.game` del bloc apaïsat (0,1,0) i la
  graella no entrava mai — la línia de torn quedava esclafada. Resolt fent
  servir el selector complet dins del bloc. Mateixa lliçó que les rajoles de
  l'historial: dins d'un media query l'especificitat compta igual.

### Apaïsat: la taula s'ho queda tot ✅ Feta (2026-08-25)

Proposta demanada pel jugador (amb captura del seu mòbil): que en apaïsat la
taula es vegi molt més gran i s'hi puguin veure totes les fitxes, amagant els
usuaris de l'esquerra i reduint l'espai sobre el faristol i els botons.

- [x] La columna de jugadors desapareix: els jugadors **floten sobre el
      feltre** com a fitxetes translúcides (avatar i compte de fitxes; el nom
      ja el diu l'avís de torn de 3 segons), amb la línia de torn com a
      píndola a la dreta. La teva fitxeta continua obrint el menú.
- [x] La fila d'«Ordena» no hi és en apaïsat (queda en vertical i escriptori).
- [x] Els botons del torn passen **al costat del faristol**, no a sota: la
      fila de baix és faristol + botons, i la taula guanya tota aquella alçada.
- [x] Resultat: la taula ocupa tota l'amplada i més de mitja alçada de la
      pantalla (fixat amb asserts: ≥93% i ≥55%).

**Criteris d'acceptació (verificats)**: 63 proves de navegador en verd, amb la
d'apaïsat reforçada (mides mínimes de la taula, tira flotant sobre el feltre,
«Ordena» amagat); captures a la mida del mòbil de l'usuari (969×432) i al
Pixel 5 girat, amb 9 jugades a la taula i el faristol ple.

### Problemes trobats

- [2026-08-25] **El menú del jugador va quedar sense tacte**: la tira flotant
  porta `pointer-events: none` perquè el feltre de sota continuï rebent tocs, i
  el menú, que n'és fill, ho heretava — no es podia clicar «Desa el nom». La
  prova d'apaïsat el va caçar. Resolt retornant `pointer-events: auto` al menú
  i al seu fons.

### Ordenació en apaïsat, fitxes grans a l'ordinador i adaptació tancada ✅ Feta (2026-08-25)

Tres demandes del jugador:

- [x] **«números / colors» sobre els botons en apaïsat**: l'estat d'ordenació
      del faristol puja a `GameScreen` i es controla des de dos llocs — la
      capçalera de sempre (vertical i escriptori) i el bloc compacte
      `.sort-mini` sobre els botons (només apaïsat). Tocar l'opció activa la
      desfà (torna a «com està»).
- [x] **Fitxes de taula més grans a l'ordinador**: 2,95 × 3,85 rem — més grans
      que les del faristol i tot; en pantalles petites i apaïsat, els seus
      blocs les tornen a empetitir. Fixat amb un assert (≥45 px d'amplada).
- [x] **El sistema adaptatiu, tancat**: ja existia (Elo + proposta de rivals),
      però «Una altra partida» repetia els mateixos rivals per sempre. Ara la
      configuració porta el tret `auto` i, quan és actiu, **cada partida nova
      surt de l'habilitat d'aquell moment**, també des del final de partida —
      que a més anuncia els rivals següents («El joc s'adapta a tu: els
      pròxims rivals seran…»).

**Criteris d'acceptació (verificats)**: 64 proves de navegador en verd — les
noves: l'ordenació compacta apaïsada mana de debò sobre el faristol (es
comprova l'ordre de les fitxes), les fitxes de taula d'escriptori fan ≥45 px, i
el final de partida anuncia els pròxims rivals.

### Problemes trobats

*(cap: la migració de l'estat d'ordenació i el tret `auto` han sortit nets)*

### El nivell del jugador, a la vista ✅ Feta (2026-08-25)

Demanat pel jugador: veure a dalt a la dreta el nivell que té assignat, amb el
nom entre parèntesis (Novell, Fàcil…), perquè es vegi pujar i baixar amb els
resultats.

- [x] `state/playerLevel.ts`: el nivell «amb nom» del jugador és el nivell de
      bot amb l'habilitat més propera a la seva, amb el mateix criteri d'empat
      que el motor (en cas de dubte, el més fluix). Amb tests.
- [x] A dalt a la dreta, al costat de la línia de torn: «Nivell 1100 (Fàcil)».
      En apaïsat és una píndola com la del torn; el menú del jugador també
      afegeix el nom del nivell a la línia d'habilitat.

**Criteris d'acceptació (verificats)**: 66 proves de navegador i 160 tests en
verd (la prova nova comprova el text exacte amb l'habilitat inicial), i
captures d'escriptori i apaïsat.

### Problemes trobats

*(cap)*

### Nivell propi i nivell dels rivals, sense confusió ✅ Feta (2026-08-25)

El jugador va assenyalar que en triar una dificultat no quedava clar si
s'aplicava de debò, i que es barrejava el seu nivell amb el que triava. Dues
arrels: el menú deia «Nivell:» a seques (semblava el nivell propi) i, en
reobrir-lo, sempre tornava a mostrar «automàtic» encara que haguessis fixat
una dificultat.

- [x] El menú diu **«Nivell dels rivals»**, les opcions fixes porten
      «(fixat)», i en triar-ne una surt la confirmació: «Rivals fixats a X: no
      canviaran encara que el teu nivell es mogui. S'aplica a la partida
      nova». En automàtic, la proposta diu també que aniran canviant amb tu.
- [x] **El menú recorda la tria**: s'obre mostrant el mode de la partida en
      curs (el nivell fixat o «automàtic»), llegit de la configuració viva.
- [x] **A dalt a la dreta es diferencien els dos nivells**: sempre el teu
      («Nivell 1100 (Fàcil)») i, només si els has fixat, «· rivals fixats:
      Mitjà». En automàtic no es diu res dels rivals: s'adapten sols.
- [x] El final de partida, en mode fixat, ho recorda i diu com tornar a
      l'automàtic.

**Criteris d'acceptació (verificats)**: 68 proves de navegador en verd; la
nova recorre el cicle sencer — fixar Mitjà (confirmació al menú, píndola de
dalt, etiqueta del bot, menú que ho recorda en reobrir-se) i tornar a
l'automàtic (la píndola calla).

### Problemes trobats

*(cap: el gruix era d'etiquetes i d'estat que no es rellegia)*

### Fitxes al gust i escales que s'endrecen soles ✅ Feta (2026-08-26)

Dues demandes del jugador:

- [x] **Aspecte de les fitxes a triar**, al menú del jugador: crema amb el
      número de color (com fins ara) o **fitxa del color amb el número blanc**.
      Es tria mirant (dues mostres reals, la triada amb l'anell d'acció), és
      una preferència del dispositiu (localStorage, `state/useTileStyle.ts`) i
      s'aplica amb una classe a l'arrel: tot el que és per fitxa (`--tinta`)
      continua manant, només canvia on s'aplica el color.
- [x] **Les escales s'endrecen soles mentre es construeixen**. `insertSmart`
      ja col·locava bé la fitxa quan la jugada resultant era vàlida; el forat
      era el material d'escala a mig fer (1-2 fitxes, o desordenat), on cap
      ordre no és «vàlid» i tot s'apilava per ordre d'arribada. Ara, si el que
      hi ha és material d'escala (mateix color, valors sense repetir),
      s'ordena per valor amb els jokers omplint forats (i els que sobren
      allarguen per on es pot, 13 inclòs). Els grups no es toquen: el seu
      ordre no vol dir res.

**Criteris d'acceptació (verificats)**: 165 tests (5 de nous per a
l'endreçament, jokers inclosos) i 72 proves de navegador en verd — les noves:
baixar 7-5-6 desordenats acaba en 5-6-7 sense marca d'error, i la tria de
fitxes canvia el color del número a l'instant i sobreviu a recarregar.

### Problemes trobats

*(cap)*

### Tres retocs al menú del jugador ✅ Feta (2026-08-26)

- [x] **La mostra clàssica ja no es contagia**: amb l'estil invertit actiu, la
      classe de l'arrel arribava per herència fins a les mostres del menú i
      totes dues es veien invertides — no sabies què triaves en tornar enrere.
      La mostra clàssica porta ara una regla pròpia més específica que la
      desfà.
- [x] **«Desa el nom» sense desplaçament al mòbil**: en pantalla estreta el
      camp del nom ocupa la fila sencera i el botó queda a sota, a l'esquerra.
- [x] **«Tanca la finestra» a baix de tot** del menú, d'amplada sencera, a més
      del toc fora de sempre.

**Criteris d'acceptació (verificats)**: 72 proves de navegador en verd — la
de l'estil de fitxes comprova ara també que, amb l'invertit actiu, la mostra
clàssica continua clàssica i que el botó de baix tanca el menú. Captures del
menú al mòbil, a dalt i a baix.

### Problemes trobats

- [2026-08-26] La prova reobria el menú després de triar l'estil, però el menú
  ja quedava obert i el clic el tancava (o el fons l'interceptava). La prova
  s'ha adaptat al comportament real: triar l'estil no tanca el menú.

### Prémer una fitxa al mòbil no selecciona text ✅ Feta (2026-08-26)

- [x] **Selecció de text fora de la partida**: les fitxes ja eren
      no-seleccionables, però la selecció llarga del mòbil s'estén al text
      seleccionable més proper — mantenir premuda una fitxa (o fallar-la per un
      pèl) acabava seleccionant noms de jugadors, «Ordena:» o la línia del
      torn. Ara tota la pantalla de joc (`.app-joc`) porta `user-select: none`
      (amb les variants `-webkit-`), `-webkit-touch-callout: none` i
      `-webkit-tap-highlight-color: transparent`.
- [x] **Els camps d'escriure segueixen vius**: `input` i `textarea` dins de la
      partida tornen a `user-select: text` explícitament, que a WebKit
      l'herència del `none` els deixaria sense cursor de selecció.

**Criteris d'acceptació (verificats)**: 73 proves de navegador en verd. La
nova (projecte mòbil) comprova per estil calculat que jugadors, «Ordena:» i
les jugades de la taula són `user-select: none`, fa un manteniment llarg de
debò (CDP, 700 ms) sobre una fitxa de la taula i confirma que no queda res
seleccionat, i que el camp del nom del menú continua sent `text`.

### El repàs: quiz de les oportunitats perdudes ✅ Feta (2026-08-26)

- [x] **Detecció** (`missedChances.ts`): cada cop que el jugador roba (o
      passa) havent-hi jugada possible, se'n guarda el moment sencer — taula,
      faristol, torn, si havia obert — i la millor jugada trobada. Busca amb
      `chooseBestPlay` sense limitacions (jokers, allargaments i reordenació:
      el mateix que el nivell expert). Es desa amb la partida
      (`SavedGame.misses`, validat com els autors) i sobreviu a recarregar.
- [x] **La crida del final**: el resum diu «N cops has robat fitxa quan hi
      havia jugada possible» amb el botó «Fes el quiz del repàs»; si no t'has
      deixat res, felicita (`.quiz-crida` / `.quiz-crida-neta`).
- [x] **El quiz** (`QuizScreen.tsx`): cada oportunitat torna a posar aquella
      taula i aquell faristol **sobre el mateix tauler de sempre** (BoardView,
      feltre, faristol de fusta, tocar i arrossegar): l'intent es corregeix
      amb el mateix `applyMove` del motor (cap regla duplicada, errors amb les
      seves paraules), «Mostra la solució» ensenya la jugada en acció (les
      fitxes cauen il·luminades al tauler, `fitxa-revelada` +
      `acabada-de-jugar`) i el resum final compta trobades i ensenyades.
- [x] **Apaïsat**: la capçalera del repàs flota sobre el feltre com la tira de
      jugadors (`.quiz-cap` amb `pointer-events: auto`).

### Problemes trobats

- Cap: el disseny va sortir net a la primera perquè tot era reutilitzable
  (BoardView pur, `turnDraft` pur, `useDragTile` genèric, `chooseBestPlay`
  amb `playerIndex` qualsevol). La partida sintètica d'un sol jugador i sense
  sac (`stateFromMiss`) passa per `applyMove` sense tocs: només `createGame`
  exigeix 2+ jugadors.

### El repàs sense repeticions i amb marcs d'origen ✅ Feta (2026-08-26)

- [x] **La mateixa jugada perduda no s'apunta dos cops** (`addMiss`): robar
      torn rere torn amb el mateix grup a la mà apuntava el mateix error cada
      vegada. La identitat d'una oportunitat és el conjunt de fitxes del
      faristol que baixava (`missKey`); es guarda el primer torn, i els
      següents només si la jugada possible ha canviat (s'hi ha sumat una altra
      errada o la taula permet més coses).
- [x] **Marcs d'origen al quiz**: quan la jugada està feta (trobada o
      ensenyada), cada fitxa porta marc segons d'on venia — turquesa
      (`--accent-taula`, el color de les teves jugades) per a les del
      faristol, daurat sòlid (`--robada`) per a les que ja eren a la taula i
      la jugada recol·locava; les que no es movien no porten res. La regla de
      «moguda» (`movedBoardTileIds`): una fitxa no s'ha mogut si la seva
      jugada d'origen sobreviu sencera dins de la mateixa jugada nova (encara
      que creixi); si s'ha desfet, totes les seves fitxes compten com a
      mogudes. Els textos del quiz diuen els colors i els comptes.
- [x] **Ferramenta**: `TileView` accepta `mark` ('played' | 'moved', amb nota
      per als lectors de pantalla) i `MeldView`/`BoardView` passen un
      `marks: Map`. El sac de `entraAmbPartida` (e2e) ara es pot triar (`sac`).

**Criteris d'acceptació (verificats)**: 174 tests (dedupe amb creixement
d'oportunitat, allargar-no-mou, reordenació que mou l'escala sencera) i 79
proves de navegador: el camí llarg ara roba tres cops (el segon idèntic no
s'apunta: 2 al repàs, no 3) i comprova els marcs `played`/`moved` a la
trobada i a la solució; una prova nova força la reordenació (grup de sets +
escala 8-11 desfent la 7-8-9) i comprova 4 turqueses, 3 daurades i la
llegenda. Captures amb els dos marcs.

### Formes per al daltonisme, quiz guiat amb correcció i desfer/refer ✅ Feta (2026-08-26)

- [x] **Forma del color a cada fitxa** (`ColorShape` a TileView): al racó de
      dalt a la dreta, petita i en `currentColor` — triangle el vermell,
      cercle el blau, quadrat el negre, rombe el taronja — perquè amb
      daltonisme els colors també es distingeixin. En `em`, escala amb la
      fitxa; els jokers no en porten. Les mostres del menú també la duen.
- [x] **Estil per defecte capgirat** (`useTileStyle`): ara surt la fitxa de
      color amb número i forma en blanc; la clàssica (crema amb número i
      forma del color) queda com a alternativa. La tria desada es respecta;
      la mostra predeterminada va primera al menú.
- [x] **Quiz guiat**: la pista diu quantes fitxes baixava la jugada, les
      marca (turquesa al faristol, daurat les de la taula que caldrà
      recol·locar) i el comptador va dient quantes queden per col·locar.
- [x] **Correcció verd/vermell**: «Comprova» valida amb el motor i després
      corregeix contra la millor jugada — marc gruixut verd
      (`--encert-taula`) les fitxes amb les mateixes companyes que a la
      solució (`meldKeysByTile`), vermell gruixut les que no; el text compta
      encertades, mal col·locades i pendents. «Corregeix» (llapis) torna a
      l'intent sense perdre res; cada oportunitat compta com a trobada un
      sol cop (`scored`).
- [x] **Desfer i refer de debò**: l'intent és una història de passos
      (`history` + `cursor`); «Desfés» i «Refés» van moviment a moviment, i
      un moviment nou després de desfer estronca el que hi havia per davant.

### Problemes trobats

- [2026-08-26] Les fitxes marcades porten la nota al `aria-label` («9 blau
  (baixava del faristol)»), i el selector exacte `[aria-label="9 blau"]` de
  `baixaGrup` no les troba: dins del quiz les proves cliquen amb el prefix
  (`[aria-label^="9 blau"]`). El primer `.rack .tile` d'una partida real pot
  ser un joker (sense color ni forma): les proves d'estil trien
  `:not(.tile-joker)`.

**Criteris d'acceptació (verificats)**: 174 tests i 81 proves de navegador.
Les d'estil comproven el blanc per defecte, la forma a cada numèrica (14 −
jokers), les mostres immunes en tots dos sentits i la persistència del
clàssic triat. La del quiz fa el cicle sencer: comptador 3→2→3→2 amb
desfer/refer, error del motor a mitges, «Perfecte!» amb 3 verds, grup de
tres on tocava el de quatre (0 verds, 3 vermells, 1 pendent), «Corregeix» i
4 verds, i resum «2 de 2» sense comptar dos cops la corregida.

### Jeroglífics de debò: interrelacionats, sense regals, i col·lecció al menú ✅ Feta (2026-08-27)

- [x] **Un jeroglífic ha de valer la pena** (`detectMissedChances`, plural):
      la millor jugada es parteix en grups interrelacionats — jugades de la
      solució que comparteixen fitxes d'una mateixa jugada original van
      juntes (union-find sobre les jugades canviades) — i cada grup és un
      trencaclosques independent amb la seva solució (la resta de la taula,
      intacta, també per validar-la amb el motor). Els grups d'una sola
      fitxa (el quart color d'un grup, allargar una escala amb una fitxa) es
      descarten: mínim 2 fitxes. Abans d'obrir no es parteix res: els 30
      punts lliguen totes les jugades noves.
- [x] **Dedupe per grup**: `addMiss` ja treballa amb la clau del grup
      (fitxes del faristol que baixa); el mateix grup en torns diferents
      només s'apunta el primer cop, i si creix (s'hi suma una altra errada)
      és un jeroglífic nou.
- [x] **Col·lecció persistent** (`useJeroglifics`, `remigi:jeroglifics`):
      cada jeroglífic nou de la partida va també a la col·lecció (dedupe per
      clau, els 30 més nous). Amb 3 o més, el menú del jugador ofereix
      «Jeroglífics (N)» al costat de «Partida nova»: jugar o fer
      jeroglífics, en qualsevol moment; la partida continua viva a sota.
- [x] **Rebatejat a la interfície**: crida del final («N'han sortit N
      jeroglífics»), capçalera («Jeroglífic i de N»), resum («N'has resolt X
      de N») i botons; `QuizScreen` pren `closeLabel` («Torna al resum» /
      «Torna a la partida»).

### Problemes trobats

- Cap de nou; la partició en grups va encaixar amb la resta perquè la
  solució de cada grup continua sent una taula sencera legal (les jugades no
  tocades hi són tal qual), i tot el que ja hi havia (marcs, comptador,
  correcció, validació amb el motor) funciona per diferència entre taula i
  solució sense saber res de la partició.

**Criteris d'acceptació (verificats)**: 176 tests (el quart color i
l'allargament d'una fitxa no són jeroglífics; dues fitxes que s'aguanten sí;
grups independents separats i cadascun legal; el regal del costat no
s'endú l'escala; la sortida sencera com un sol jeroglífic) i 83 proves de
navegador, amb una de nova: col·lecció de 3 sembrada, «Jeroglífics (3)» al
menú, se n'obre el primer i es torna a la partida.

### Respostes alternatives bones, i el tauler del jeroglífic net ✅ Feta (2026-08-27)

- [x] **Una resposta correcta val encara que no sigui la programada**: si
      l'intent és legal i baixa tantes fitxes com la millor jugada (o més),
      és «Perfecte!» — tot verd, res de vermell — encara que l'arranjament
      sigui un altre (partir l'escala de sis en dues de tres, o fer-ho amb
      altres fitxes de la mà). El text distingeix els tres casos: clavada a
      la solució, «per un altre camí igual de bo», o «més i tot». La
      comparació fitxa a fitxa amb la solució queda només com a pista quan
      la resposta es queda curta.
- [x] **Cap marc previ sobre la taula**: mentre proves el jeroglífic, només
      les teves fitxes (faristol) van marcades en turquesa; les de la taula
      queden netes — dins de la partida els marcs de taula volen dir altres
      coses (autors, robada) i confonien. L'avís que caldrà recol·locar el
      diu el text de la pista; el marc daurat es queda per a «Mostra la
      solució».

**Criteris d'acceptació (verificats)**: 176 tests i 85 proves de navegador,
amb una de nova: l'escala de sis partida en dues de tres és «Perfecte!» amb
6 verds, sense «Corregeix» ni «Mostra la solució»; i la del jeroglífic amb
recol·locació comprova que durant la prova el tauler no porta cap marc
(0 daurats, 0 turqueses a la taula) i que la solució ensenyada sí.

### El ✓ verd d'encert, i marcs fitxa a fitxa només per als bots ✅ Feta (2026-08-27)

- [x] **Símbol verd de correcte al mig de la pantalla** (`.quiz-encert`): en
      resoldre un jeroglífic (legal + tantes fitxes com la millor jugada),
      un gran ✓ dins d'un cercle verd apareix centrat, com l'avís de torn
      (fix, sense clics, decoratiu), amb un pop d'entrada i esvaïment sol
      (1,5 s). Es neteja en canviar de jeroglífic o mirar la solució.
- [x] **Marcs del tauler, fitxa a fitxa i només dels bots**
      (`meldOwners.ts` reescrit): fora els marcs de jugada sencera
      (`.meld.owned`); ara cada fitxa que un bot acaba de posar porta el marc
      del seu color individualment (`.board .tile[data-bot]`) — si només ha
      allargat una escala, només es marca la fitxa afegida. La clau és
      l'identificador de la fitxa, així que el marc la segueix encara que la
      taula es reordeni o el jugador la mogui al seu torn. Les jugades del
      jugador humà no es marquen (només netegen les marques velles), i robar
      o passar no esborra res. El desat (`SavedGame.owners`) conserva la
      forma `[string, number][]`: claus velles de jugada simplement no
      casen i les partides antigues es reprenen sense marc.

### Problemes trobats

- Cap; el canvi de granularitat va sortir net perquè el color per `--marc`
  ja anava per selector d'atribut (`.board [data-bot='N']`), que serveix
  igual per a fitxes que per a jugades.

**Criteris d'acceptació (verificats)**: 172 tests (updateOwners reescrit:
allargar marca només l'afegida, l'humà neteja, la reordenació del bot marca
només les de la seva mà) i 85 proves de navegador reescrites: un sol bot per
moviment i cap `.meld[data-bot]`, les teves jugades sense marc, la partida
represa amb autors per fitxa, el marc que segueix la fitxa quan tu jugues, i
el `.quiz-encert` visible en resoldre (al camí normal i a l'alternatiu).

### El «glitch» de robar i rebre quatre fitxes ✅ Feta (2026-08-27)

- [x] **Diagnòstic**: el motor roba sempre exactament una fitxa (cobert pels
      tests de nucli). El que passava: «Robar fitxa» estava actiu amb
      l'esborrany a mitges, la robada s'aplicava sobre l'estat del motor
      (que no veu l'esborrany) i el torn següent totes les fitxes que el
      jugador tenia col·locades sense acabar la jugada tornaven de cop al
      faristol juntament amb la robada — la il·lusió de «m'han donat 4 o 5
      fitxes noves», sobretot al final de partida, quan es fan proves.
- [x] **Arranjament** (`useGame.draw`): amb canvis a l'esborrany
      (`hasChanges`), robar no roba — surt l'avís «Tens fitxes a mig
      col·locar: acaba la jugada o desfés els canvis abans de robar», i no
      es perd ni es guanya res, com a la taula de debò. Reordenar només
      fitxes de la taula (sense baixar-ne cap) no bloqueja: allà robar
      restaura la taula i no toca el faristol.

**Criteris d'acceptació (verificats)**: 171 tests i 87 proves de navegador,
amb la regressió nova: col·locar una fitxa, robar → avís i res no es mou
(faristol 3, taula 1, torn teu); desfer canvis i robar → una fitxa i només
una, amb la marca de robada.

### Invariants del motor i actualització automàtica de l'app ✅ Feta (2026-08-27)

- [x] **Prova d'invariants** (`core/test/invariants.test.ts`): 5 partides
      senceres simulades (3 jugadors, expert amb reordenació inclòs) i, a
      cada moviment: robar dona exactament una fitxa (cap amb el sac buit) al
      faristol de qui roba i a ningú més, el sac baixa d'una, i el conjunt
      global de fitxes és sempre el mateix — cap duplicada, cap perduda. Si
      això passa, qualsevol «m'han donat quatre fitxes» és percepció de la
      interfície, no del motor.
- [x] **L'app instal·lada s'actualitza sola** (`main.tsx`): el registre del
      service worker ara comprova si hi ha versió nova cada cop que l'app
      torna a ser visible (`registration.update()` a `visibilitychange`), i
      quan la versió nova pren el control (skipWaiting + claim) la pàgina es
      recarrega un sol cop — la partida es desa a cada moviment, així que es
      reprèn on era. El primer registre de la vida no recarrega
      (`hadController`). Abans, una PWA oberta dies seguits no rebia mai les
      correccions publicades: el probable motiu que el glitch de robar «tornés
      a passar» després d'arreglat.

### El motor de la IA, encapsulat i substituïble (remigi-engine) ✅ Feta (2026-08-28)

Demanat pel jugador: abans de cap laboratori d'evolució de la IA, separar-la
completament de la resta de l'app com un **motor independent amb API estable**,
a l'estil Stockfish — sense Campió/Challenger encara, sense self-play, sense
canviar ni una jugada de cap nivell.

- [x] **Capa pública `src/engine/`**: `createEngine({seed|rng})` amb
      `engine.play(state, {playerIndex, level, rubberBanding, overrides,
      maxNodes})` → `{move, engineVersion, level, thinkingTimeMs, nodes,
      searchLimited, rearrangeUsed, foundPlay, tilesPlayed}`, i
      `engine.analyze` (millor jugada sense errors humans, determinista; l'usa
      la detecció de jeroglífics). `ENGINE_VERSION = "1.0.0"` a `version.ts`.
      Les implementacions segueixen modulars a `ai/` — el motor és la porta,
      no una còpia.
- [x] **Diagnòstic sense canviar cap decisió**: `stats` opcional que travessa
      `decideAiMove` → `chooseBestPlay` → `bestRearrangement` (nodes,
      sostre tocat, reordenació usada, jugada trobada), i `maxNodes`
      configurable des de fora.
- [x] **Artefacte `dist/remigi-engine.js`** (`npm run build:engine`): un únic
      fitxer ESM autocontingut (esbuild, plataforma «neutral»: importar res de
      Node o del navegador fa fallar el build), amb `remigi-engine.d.ts` i
      banner de versió. Reproduïble; `dist/` no es versiona.
- [x] **La web i el simulador parlen només amb el motor**: `useGame` fa
      `engine.play`, `missedChances` fa `engine.analyze`, `simulate.ts` crea
      un motor per partida (mateixa llavor → mateixa partida) i imprimeix
      versió i nodes. `decideAiMove`/`chooseBestPlay` queden exportats per
      compatibilitat i tests.
- [x] **Regressió comportamental**: 25 partides de referència (5 nivells × 5
      llavors) capturades ABANS de la refactorització cridant la IA d'abans;
      `engineRegression.test.ts` les torna a jugar per l'API del motor i
      exigeix el mateix moviment a cada torn (hash de trajectòria,
      `test/fixtures/engine-baseline.json`).
- [x] **Tests del motor** (24 de nous): instanciació sense UI, jugada amb
      Node, mateixa llavor = mateixa jugada, novell i expert com abans,
      `play` ≡ `decideAiMove` amb el mateix RNG, diagnòstic de reordenació,
      bundle en memòria sense React/DOM/Node i que juga una partida sencera
      carregat com a mòdul.
- [x] **Prova de fum de l'artefacte** (`npm run smoke:engine -w @remigi/core`):
      Node pelat carrega el `.js` generat, hi juga dues vegades la mateixa
      partida i exigeix resultats idèntics.
- [x] **Docs**: `docs/ENGINE.md` (API, exemples Node i Web Worker, build,
      versionat, què és públic i què intern, com regenerar el baseline) i
      `docs/ARQUITECTURA.md` i README actualitzats.

**Criteris d'acceptació (verificats)**:

- `npm run typecheck`, `npm test` (123 core + 73 web) i `npm run build` en
  verd; `npm run build:engine` genera l'artefacte i `smoke:engine` el fa
  jugar amb Node.
- El simulador (`--games 30 --seed 42` i `--duel 20 --seed 7`) dona
  **exactament els mateixos resultats** abans i després de la refactorització
  (mateixes victòries, mateixes puntuacions, mateixos torns), ara passant per
  l'API del motor.
- Les 25 empremtes de trajectòria del baseline coincideixen moviment a
  moviment amb el que juga el motor nou: cap nivell no ha canviat ni una
  jugada.

**Decisions**:

- **L'artefacte inclou les regles mínimes** (`createGame`, `applyMove`,
  `finalScores`…): el contracte estable del motor és `createEngine` +
  `ENGINE_VERSION`, però un `remigi-engine.js` que pot fer anar partides tot
  sol és el que farà possibles les simulacions massives amb Node pelat.
- **El RNG és del motor, no de la crida**: `createEngine({seed})` arrossega la
  seqüència entre decisions, que és com es reprodueix una partida sencera; per
  a una decisió aïllada es crea un motor nou amb la llavor.
- **Cap Web Worker encara**: l'API és pura i síncrona sobre JSON (res del
  DOM), així que el pas a worker és un embolcall de missatges documentat a
  `docs/ENGINE.md`; fer-lo ara seria codi mort (el pitjor torn de l'expert és
  ~176 ms).

### Problemes trobats

- [2026-08-28] Cap regressió: la migració del simulador i de la web al motor
  ha sortit neta a la primera (sortida del simulador idèntica byte a byte i
  els 196 tests en verd), perquè el motor crida exactament el mateix
  `decideAiMove` de sempre amb el mateix consum de RNG.

### REMIGI AI LAB: el laboratori Motor A vs Motor B ✅ Feta (2026-08-28)

Demanat pel jugador: transformar **aquest clon** en el laboratori de
desenvolupament de la IA — la pantalla principal deixa de ser el joc i passa a
ser una consola per comparar motors, amb el joc humà conservat a `#joc`. Sense
cap millora deliberada de força: primer separar i mesurar, amb l'Expert de
sempre com a referència (`expert-v1`, fixat pel test de regressió).

- [x] **Capa `src/lab/` al core** (parla només amb l'API pública del motor):
      `catalog.ts` (especs de motor: id, versió, estratègia, color, config,
      rol Campió/Challenger, `factory` opcional per a artefactes externs;
      afegir una versió = afegir una entrada), `match.ts` (runner pas a pas
      A vs B: diagnòstic per torn, llavors de motor derivades de la de la
      partida, invariant de 106 fitxes a cada moviment, errors capturats),
      `tournament.ts` (N partides amb **llavors aparellades**: cada llavor es
      juga des dels dos seients; agregats per motor i partides interessants
      amb el `MatchSetup` de reproducció), `hieroglyph.ts` (la mètrica),
      `stats.ts` i `report.ts` (JSON `remigi-ai-lab-report/1` i
      `AI_REPORT.md`, amb conclusió descriptiva, mai decisió de promoció).
- [x] **Mètrica «jeroglífics»** documentada i determinista: successora per
      intersecció màxima; esteses +1, alterades +2, fitxes recol·locades +1
      (jokers +1 extra); trams 0 / 1–2 / 3–5 / 6–9 / **10+ = jeroglífic**. Es
      calcula fora del motor, després de decidir: no pot influir en cap
      jugada (test que refà la partida amb l'API pelada i exigeix estat final
      idèntic).
- [x] **CLI** (`npm run lab`): `--list`, torneig amb progrés i taula
      comparativa, `--match` torn a torn, `--json`/`--report`, i l'ordre de
      reproducció impresa per a cada partida interessant.
- [x] **La web és el laboratori** (`apps/web/src/lab/`, pantalla per defecte;
      el joc humà sencer a `#joc` i enllaçat pel menú del jugador): targetes
      Motor A/B amb selector, config i victòries acumulades; taula amb les
      **dues mans a la vista**; marcs del color del motor (baixades) i
      daurats (recol·locades); velocitats pas a pas → màx; fitxa de
      diagnòstic per jugada; timeline clicable que **rebobina taula i mans**;
      dashboard comparatiu (partida en viu / últim torneig); torneigs en
      **Web Worker** amb progrés i cancel·lació; partides interessants amb
      «Reprodueix»; exportació JSON i AI_REPORT.md des del navegador.
- [x] **Tests**: 44 de nous al core (mètrica cas per cas, catàleg, matches
      deterministes i sense contaminació entre costats, torneig que quadra,
      informes) + `labSession.test.ts` a la web + 8 proves e2e noves del
      laboratori (partida a màx, pas a pas, reproducció per llavor, canvi de
      motor, torneig de 10 amb reproducció, exportació, anada i tornada al
      joc humà). `npm run test:lab` els agrupa.
- [x] **Docs**: `docs/AI-LAB.md` (tot el laboratori, mètrica inclosa, com
      afegir un motor, com exportar el guanyador), retocs a `ENGINE.md` i
      `ARQUITECTURA.md` (capa `lab`), README amb la identitat de laboratori,
      i `AI_REPORT.md` de mostra generat d'un torneig real de 100 partides.

**Criteris d'acceptació (verificats)**:

- `npm run typecheck`, `npm test` (167 core + 78 web), `npm run build`,
  `npm run build:engine` + `smoke:engine` i les **103 proves de navegador**
  en verd (les 4 d'injecció de partida es van adaptar, vegeu problemes).
- Torneig real de 100 partides Expert v1 vs Challenger 30k (llavor 42,
  aparellades): **62–38** per a l'Expert, 44,5 s; a 10 partides sortia 5–5 —
  el sostre de nodes es nota amb mostra gran, que és exactament el que el
  laboratori ha de saber ensenyar. Informe a `AI_REPORT.md`.
- Reproducció comprovada de debò: la «jugada individual més complexa» del
  torneig (complexitat 92, torn 94, llavor 75, comença B) reapareix idèntica
  reproduint la partida pel CLI i per la interfície.
- El mateix torneig executat dues vegades dona resultats idèntics (test), i
  la mateixa partida visual repetida amb «Reinicia» acaba igual (prova e2e).

**Decisions**:

- **Les llavors dels motors es deriven de la de la partida** (`seed·2+seient+1`):
  el `MatchSetup` (motors, llavor, qui comença) identifica una partida del
  tot, i cada seient té la seva seqüència de RNG — les errades simulades d'un
  costat no toquen mai l'altre.
- **Llavors aparellades per defecte** als torneigs: la mateixa llavor des
  dels dos seients neutralitza l'avantatge de començar i el repartiment.
- **El catàleg no porta cap estratègia nova**: la referència i variants de
  configuració (Challenger 30k, nivells). El circuit sencer queda validat
  sense canviar ni una jugada, que era el requisit.
- **«Jeroglífics» del laboratori ≠ jeroglífics-quiz del joc humà**: el nom és
  volgut (són la mateixa mena de jugada), però la mètrica és telemetria de
  motors i viu al core; el quiz continua intacte a la web.

### Problemes trobats

- [2026-08-28] **Les proves e2e amb partida injectada van petar** en passar el
  joc humà a `#joc`: `page.goto('./#joc')` després d'una altra navegació al
  mateix camí és un canvi de fragment (mateix document) i l'script
  d'injecció de `localStorage` no s'executava mai. Resolt amb un
  `page.reload()` dins d'`entraAmbPartida`, que força la càrrega de debò;
  els senyals `e2e:net`/`e2e:llavor` ja evitaven la doble neteja.
- [2026-08-28] El test «les mètriques d'A no contaminen B» s'ofegava en el
  temps límit de vitest per abús de partides expert–expert. Reescrit amb una
  sola partida expert–novell, que és la que de debò discrimina (errades i
  reordenacions només poden ser d'un costat).
- [2026-08-28] `npm run lab -- --report AI_REPORT.md` escrivia el fitxer dins
  de `packages/core` (el cwd del workspace). Resolt resolent els camins
  relatius contra `INIT_CWD`, que és des d'on s'ha executat l'ordre.

### Publicació del laboratori i separació de les dades de producció ✅ Feta (2026-08-28)

En anar a publicar el clon van sortir dues coses, una de configuració i una
que hauria fet perdre dades de debò.

- [x] **Pages no estava activat** a `segueix/remigi-lab`: el desplegament
      fallava amb «Create Pages site failed: Resource not accessible by
      integration». El `enablement: true` del flux no basta si el lloc no
      existeix — el `GITHUB_TOKEN` no el pot crear. **És una passa manual**:
      Settings → Pages → Source: GitHub Actions, i tornar a llançar el flux.
      Documentat al README.
- [x] **Espai de noms propi al navegador** (`storage/namespace.ts`): publicats,
      el laboratori (`/remigi-lab/`) i el joc de producció (`/remigi/`)
      comparteixen **origen**, i `localStorage` és per origen, no per ruta.
      Amb les claus de sempre, jugar la partida humana del laboratori hauria
      sobreescrit el perfil, la partida a mitges i la col·lecció de
      jeroglífics del Remigi de debò. Ara tot el que el clon desa va a
      `remigi-lab:*`: el `KeyValueStore` de la web ho aplica en un sol lloc
      (`NamespacedStore`, que bescanvia el prefix `remigi:` del motor) i les
      preferències que escriuen a `localStorage` directament ho fan amb
      `labKey`.
- [x] **Memòria cau del service worker separada** (`remigi-lab-v1`), i la
      neteja de generacions velles filtrada pel seu prefix: esborrar per nom
      diferent hauria destruït la memòria cau del joc de producció (i tots dos
      s'haurien anat esborrant l'un a l'altre a cada activació).
- [x] **La migració `rummikub:*` → `remigi:*` s'ha retirat del clon**: era
      història del joc de producció i, en aquest origen compartit, hauria
      escrit justament a les claus que s'estan protegint.

**Criteris d'acceptació (verificats)**: 167 + 77 tests i les 103 proves de
navegador en verd; dues proves noves fixen que el perfil del clon va a
`remigi-lab:profile:local` i que un perfil de producció ja desat **ni es
llegeix ni es sobreescriu**. Comprovat també amb el navegador sobre el build:
sembrant `remigi:profile:local` i `remigi:game` a l'origen i jugant al
laboratori (nom nou i un torn), les dues claus de producció queden intactes i
el laboratori crea les seves.

### Problemes trobats

- [2026-08-28] **Doble prefix**: en posar `labKey` a `savedGame.ts` i, a
  sobre, al `KeyValueStore` de la web, la clau quedava
  `remigi-lab:remigi-lab:game` i la partida desada no es trobava mai (ho van
  destapar 8 proves e2e del quiz, que injecten partides). La regla queda
  clara: **qui passa per un `KeyValueStore` fa servir la clau lògica**
  (`remigi:game`) i el prefix el posa el store, un sol cop; només qui escriu a
  `localStorage` directament (preferències, col·lecció) crida `labKey`.
- [2026-08-28] Una prova de `savedGame` escrivia la clau a mà
  (`'remigi:game'`) i, en canviar-la, comprovava `null` per haver escrit on no
  tocava: passava per la raó equivocada. Resolt exportant `SAVED_GAME_KEY` del
  mòdul i fent-la servir a la prova.

---

### El primer experiment del cicle: Challenger 500k ✅ Fet (2026-08-28)

El primer ús de debò del laboratori acabat de construir: la hipòtesi més
barata (només configuració, zero canvis de codi) passada pel cicle sencer
hipòtesi → cribratge → confirmació.

- **Hipòtesi**: el sostre de 120.000 nodes de la cerca de reordenació es queda
  curt — quan s'esgota, el motor recula a la jugada voraç. Amb 500.000, les
  posicions complexes es resolen i es guanyen partides.
- **Challenger**: `challenger-500k` al catàleg (nivell expert, `maxNodes`
  500.000). Cap canvi a `ai/`: el baseline de regressió ni es toca.
- **Cribratge** (100 partides, llavor base 42): 54–46 per al Challenger.
  Dins del soroll, però amb la firma del mecanisme: 58 cerques limitades
  contra 137 de l'Expert.
- **Confirmació** (1.000 partides, llavor base 7000, independent de la del
  cribratge): **557–443 (55,7%)** per al Challenger — unes 3,6 desviacions
  estàndard per sobre de l'empat, i encara més sòlid amb les llavors
  aparellades. Firma consistent: cerques limitades 514 contra 1.468,
  reordenacions 4.092 contra 3.750, jeroglífics 3.523 contra 3.181,
  complexitat mitjana 12,05 contra 10,44 i la jugada més complexa del
  laboratori fins ara (98). Cost: el doble de temps per decisió (14,6 ms de
  mitjana, p95 68,8 ms) — de sobres per a la web, on la pausa del bot és de
  3 s. `AI_REPORT.md` (arrel) és l'informe d'aquesta confirmació.
- **Conclusió**: la primera millora real del motor és **confirmada i és de
  franc en codi** (un número). La promoció a Campió (`expert-v2`, i el nivell
  expert del joc amb 500k) **no s'ha fet**: és una decisió de l'usuari, i el
  cicle és expressament manual.

### Problemes trobats

*(cap: el circuit va anar fi de punta a punta al primer experiment real)*

---

### Promoció: expert-v2 (500k) és el nou Campió ✅ Feta (2026-08-28)

Aprovada per l'usuari després de la confirmació 557–443. La promoció completa,
en cinc peces:

- [x] **El nivell expert juga a 500.000 nodes**: `AiParams` guanya `maxNodes`
      opcional (absent = el sostre del cercador, 120.000) i `decideAiMove` el
      respecta amb la prioritat crida explícita > overrides > nivell. És el
      camí perquè la millora arribi també al joc humà i al simulador, no
      només al laboratori.
- [x] **`ENGINE_VERSION` 1.0.0 → 1.1.0** (MINOR: la IA juga diferent).
- [x] **Catàleg**: `expert-v2` nou Campió (turquesa, 500k, versió 1.1.0);
      `expert-v1` queda **congelat per sempre com a línia de base** — sense
      rol, gris, i amb `maxNodes: 120_000` explícit perquè el canvi del nivell
      per defecte no li mogui el comportament; `challenger-30k` ara es
      compara amb la referència; `challenger-500k` es conserva perquè les
      ordres de reproducció dels informes de la promoció segueixin funcionant.
      Test nou: **només hi pot haver un Campió** al catàleg.
- [x] **Baseline de regressió regenerat i assumit**: només canvien 2 de les 25
      partides de referència, totes dues del nivell expert (les altres 3
      llavors d'expert no tocaven mai el sostre de 120k). Comprovat game a
      game contra el fixture anterior: cap altre nivell no es mou ni una
      jugada. Els tests de regressió porten ara temps límit propi (l'expert a
      500k triga més que els 5 s per defecte de vitest).
- [x] **El laboratori s'obre amb la comparació canònica**: Expert v2 (Campió)
      contra Expert v1 (referència), llavor 42.

**Criteris d'acceptació (verificats)**: typecheck i les dues suites en verd;
`build:engine` + `smoke:engine` amb la v1.1.0; el duel de sanitat per CLI
Expert v2 contra Expert v1 (100 partides, llavor 42) reprodueix el 54–46 del
cribratge de la promoció; proves e2e al dia amb la pantalla nova.

**Decisions**:

- **La referència es pinta explícita, no es congela el defecte**: el nivell
  expert per defecte ÉS el motor viu (500k pertot); qui vulgui el
  comportament v1 el demana amb `maxNodes: 120_000`, que és exactament el que
  fa l'entrada `expert-v1` del catàleg.
- **`engine.analyze` no canvia** (cerca al sostre del cercador, 120k): és la
  detecció de jeroglífics-quiz del joc humà i no forma part de la promoció;
  si mai es vol apujar, que sigui una decisió mesurada a part.
- Els bots experts del joc humà passen a gastar fins a ~mig segon de càlcul
  en el pitjor cas (p95 ~69 ms), dins de la pausa de 3 s del torn del bot.

### Problemes trobats

- [2026-08-28] Els tests de regressió van petar per **temps límit**, no per
  discrepància: les 5 partides d'expert a 500k triguen ~7 s i el límit per
  defecte de vitest és de 5 s. Resolt amb `timeout` propi als tests de nivell
  (60 s) i al de regeneració (300 s).

---

### La corba de nodes, tancada: Challenger 1M ✅ Tancat sense promoció (2026-08-28)

El pas següent de la corba de nodes, programat aquí i **executat per l'usuari
al seu ordinador**.

- [x] `challenger-1m` al catàleg: nivell expert, `maxNodes` 1.000.000 (el
      doble del Campió).
- [x] Executat per l'usuari: 1.000 partides aparellades, llavor base 42
      (325 s a la seva màquina). Va anar directe a la confirmació sense
      cribratge previ — acceptable perquè no hi havia hagut selecció que
      pogués esbiaixar, i amb resultat nul no cal segona llavor.
- [x] **Resultat: 508–492 (50,8%) per al Challenger — a mig sigma de
      l'empat: soroll.** La firma mecànica ho explica: les cerques ofegades
      baixen (283 → 139) però ja no compren partides; la feina mitjana per
      cerca gairebé no puja (19.984 → 23.349 nodes) perquè la immensa
      majoria de cerques acaben molt per sota de 500k. La victòria més
      contundent d'A i la de B són la mateixa partida (llavor 526, ±121):
      els dos motors juguen pràcticament idèntic en gairebé tots els
      repartiments.
- [x] **Decisió (regla pre-registrada): via tancada, cap promoció.** El
      Campió queda validat al genoll de la corba: 30k ≪ 120k < **500k** ≈ 1M.
      L'entrada del catàleg queda marcada VIA TANCADA (es conserva per
      reproduir l'experiment).

### Problemes trobats

*(cap: resultat nul net, que és informació igual de bona — estalvia doblar el
cost de càlcul per no res)*

### Hipòtesi massa estreta, no falsa: Challenger Punts 🔍 (2026-08-28)

La primera hipòtesi **estratègica** (la següent segons la regla
pre-registrada), programada aquí i **pendent que l'usuari l'executi** al seu
ordinador.

- [x] **Hipòtesi**: a igualtat de fitxes jugades, l'Expert tria arbitràriament
      entre propostes; desfer-se de més punts (i quedar-se a la mà les fitxes
      barates) hauria de reduir la magnitud de les derrotes (els −121 venen
      dels 13 i els jokers encallats).
- [x] **Implementació, tota rere `preferPointsTieBreak` (apagat per defecte a
      tots els nivells: el baseline de regressió no es mou ni una jugada)**:
      a la cerca de reordenació, cost compost `fitxes·10000 + punts` — entre
      repartiments amb les mateixes fitxes col·locades, es queda les de menys
      valor pendent (jokers a 30); i l'empat voraç–reordenació es resol per
      punts baixats en comptes de sempre-voraç. Mai no fa jugar ni una fitxa
      més ni una menys: només tria entre empats.
- [x] `challenger-punts` al catàleg (nivell expert, mateix pressupost de 500k
      que el Campió, overrides amb la bandera), i el paràmetre surt a la
      secció de Diferències.
- [x] Tests (`test/preferPoints.test.ts`): l'empat de manual
      ([J,2r,3r,13b,13k] → baixa [13,13,J] i es queda {2,3}), la bandera no
      canvia mai el nombre de fitxes, el challenger juga determinista i
      sense errors, i la diferència amb el Campió és la bandera i no el
      pressupost.
- [x] **Cribratge de l'usuari** (100 partides, llavor 42): contra el Campió,
      **49–51** (+0,9 punts de mitjana). Dins de la banda de soroll.
- [x] L'usuari va córrer també contra `expert-v1`: 44–56. **Aquesta
      comparació està confosa** i no diu res del desempat: barreja la
      bandera amb el pressupost de nodes (120k vs 500k), i la firma ho
      delata (nodes 12.834 vs 24.424, cerques limitades 131 vs 58) — és el
      retrat de la promoció del 500k, no de la hipòtesi. Contra el mateix
      rival i la mateixa llavor, l'expert-v2 pelat feia 54–46: el desempat
      hi afegeix +2 victòries de 100, o sigui soroll.
- [x] **La sonda ho explica** (`--probe`, eina nova; vegeu docs/AI-LAB.md):
      en 100 partides, **3.012 moviments del challenger i només 13 jugades
      canviades** — 0,4% dels moviments, **1,1% de les jugades**, una cada
      ~8 partides. `tilesDelta` 0, com mana l'invariant.
- [x] **Veredicte: la hipòtesi no és falsa, és massa estreta.** Quan
      s'activa fa exactament el que havia de fer — **6,8 punts pendents
      menys per canvi** (88 en 100 partides) —, i el +0,9 de punts mitjans
      del torneig quadra en magnitud amb aquests 0,88 punts per partida. El
      problema és la freqüència: amb 1,1% d'activació, cap torneig no pot
      mesurar la idea. **No es corre la confirmació de 1.000 partides**:
      donaria 50% ± soroll digués el que digués la idea.
- [ ] **Pas següent proposat** (pendent de decisió de l'usuari): eixamplar
      la regla — acceptar una jugada amb **una fitxa menys** si es desfà de
      força més punts (un 13 i un joker encallats són 43 punts), amb el
      llindar com a paràmetre. Això sí que s'activaria sovint i llavors el
      torneig mesuraria la idea de debò.

**Lliçó de mètode, per a tots els experiments futurs: sondejar abans de
confirmar.** Un torneig igualat té dues lectures (idea dolenta / idea que no
s'activa) i el marcador sol no les distingeix. La sonda triga un minut i
estalvia confirmacions inútils — o pitjor, la conclusió equivocada.

### Problemes trobats

- [2026-08-28] **Cribratge confós**: comparar el challenger amb `expert-v1`
  barrejava dues diferències alhora (la bandera i el pressupost de nodes) i
  el 56% semblava una victòria de la hipòtesi quan era la del 500k que ja
  teníem mesurada. Regla que en queda: **un challenger es mesura sempre
  contra el Campió vigent**, que és qui només difereix en allò que es prova.

### El registre antic de l'experiment 1M (substituït pel tancament de dalt)

<details><summary>Registre original, abans dels resultats</summary>

### Challenger 1M (registre previ) ⏸️ (2026-08-28)

El pas següent de la corba de nodes, **programat aquí i executat per l'usuari
al seu ordinador** (decisió seva: el laboratori remot no el corre).

- [x] `challenger-1m` al catàleg: nivell expert, `maxNodes` 1.000.000 (el
      doble del Campió). Hipòtesi a contrastar: si la corba 30k→120k→500k ja
      s'aplana, no guanyarà clarament i la via dels nodes queda tancada.
- [ ] Cribratge (usuari): `npm run lab -- --engine-a expert-v2 --engine-b
      challenger-1m --games 100 --seed 42`
- [ ] Confirmació (usuari): `... --games 1000 --seed 9000 --json
      informe-1m.json --report informe-1m.md` (llavor base independent del
      cribratge i de la promoció anterior).
- [ ] Decisió amb els resultats: ≥55% sostingut → candidat a promoció;
      50–52% → corba amortitzada, es tanca la via i es passa a la hipòtesi
      següent (desempat per punts).

</details>

---

## Riscos coneguts (a vigilar quan toqui)

- ~~**Vite + workspace amb font TS**~~ (Fase 2): **tancat**. `@remigi/core`
  publica `main` apuntant a `src/index.ts` i Vite 8 el transpila com a codi del
  projecte, tant en `dev` com en `build`. No calen àlies ni `optimizeDeps`.
  Compte si algun dia es publica el paquet fora del monorepo: llavors sí que
  caldrà compilar-lo i canviar `main`/`types` cap a `dist`.
- **Cost del solver òptim** (Fase 6): la reordenació completa de taula és
  combinatòria; cal límit de temps/nodes i, si s'escau, executar-lo en un
  Web Worker perquè no bloquegi la UI.
- **localStorage no disponible** (navegació privada, permisos): tots els
  accessos han de degradar a memòria sense trencar la partida (previst a la
  Fase 2).
- **Empat d'Elo entre dos nivells**: `suggestOpponents` tria el més fluix en
  cas d'empat exacte (comportament actual del `closestDifficultyIndex`); és
  intencionat (val més quedar-se curt que passar-se), no ho «arreglis» sense
  motiu.
