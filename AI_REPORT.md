# Informe del laboratori Remigi AI Lab

Generat: 2026-08-28T10:21:55.829Z · motor remigi-engine v1.0.0 · 100 partides (llavor base 42, llavors aparellades amb seients bescanviats) · 44.5 s de càlcul.

## Motors comparats

| Motor | id | versió | estratègia | nivell | maxNodes | mistakeRate |
|---|---|---|---|---|---:|---:|
| Expert v1 | `expert-v1` | 1.0.0 | voraç + reordenació completa | expert | — | 0 |
| Challenger 30k | `challenger-30k` | 1.0.0+n30k | voraç + reordenació completa | expert | 30000 | 0 |

### Diferències de configuració

```text
versió
  A: 1.0.0
  B: 1.0.0+n30k
maxNodes
  A: —
  B: 30000
```

## Resultat

| Mètrica | Expert v1 (A) | Challenger 30k (B) |
|---|---:|---:|
| Victòries | 62 | 38 |
| % victòries | 62% | 38% |
| Punts mitjans | 9.2 | -9.2 |
| Fitxes jugades/torn | 1.02 | 0.98 |
| Temps mitjà/jugada | 10 ms | 4.1 ms |
| p95 temps/jugada | 76.9 ms | 23.1 ms |
| Nodes mitjans/cerca | 16218 | 7230 |
| Cerques limitades | 205 | 378 |
| Reordenacions | 374 | 318 |
| Errades simulades | 0 | 0 |
| Jeroglífics | 326 | 270 |
| Jeroglífics/partida | 3.26 | 2.7 |
| Complexitat mitjana | 11.08 | 8.68 |
| Jugada més complexa | 92 | 81 |
| Màx. fitxes recol·locades | 50 | 43 |
| Màx. jugades alterades | 22 | 22 |

Mitjana de torns per partida: 62.3.

Un **jeroglífic** és una jugada amb complexitat de reconstrucció ≥ 10
segons la mètrica del laboratori (vegeu `docs/AI-LAB.md`): telemetria
determinista que no influeix en cap decisió del motor.

## Partides interessants

Cada partida es reprodueix exactament amb la seva llavor i el seient inicial:

- **Victòria més contundent d’A** — El motor A guanya per 88 punts. (partida 43, llavor 63, comença A)
  `npm run lab -- --match --engine-a expert-v1 --engine-b challenger-30k --seed 63 --first A`
- **Victòria més contundent de B** — El motor B guanya per 71 punts. (partida 10, llavor 46, comença B)
  `npm run lab -- --match --engine-a expert-v1 --engine-b challenger-30k --seed 46 --first B`
- **Partida més llarga** — 97 torns. (partida 91, llavor 87, comença A)
  `npm run lab -- --match --engine-a expert-v1 --engine-b challenger-30k --seed 87 --first A`
- **Partida amb més nodes de cerca** — 2726344 nodes explorats entre tots dos motors. (partida 33, llavor 58, comença A)
  `npm run lab -- --match --engine-a expert-v1 --engine-b challenger-30k --seed 58 --first A`
- **Partida amb més jeroglífics** — 11 jugades amb complexitat ≥ 10. (partida 13, llavor 48, comença A)
  `npm run lab -- --match --engine-a expert-v1 --engine-b challenger-30k --seed 48 --first A`
- **Jugada individual més complexa** — Complexitat 92 (motor A, torn 94). (partida 68, llavor 75, comença B)
  `npm run lab -- --match --engine-a expert-v1 --engine-b challenger-30k --seed 75 --first B`

## Conclusió

**Expert v1** guanya la comparació: 62 victòries contra 38 de Challenger 30k (62% de les partides vàlides).

Expert v1 fa les jugades més complexes (complexitat mitjana 11.08 vs 8.68; 326 jeroglífics vs 270).
