# Informe del laboratori Remigi AI Lab

Generat: 2026-08-28T15:15:56.764Z · motor remigi-engine v1.0.0 · 1000 partides (llavor base 7000, llavors aparellades amb seients bescanviats) · 693.5 s de càlcul.

## Motors comparats

| Motor | id | versió | estratègia | nivell | maxNodes | mistakeRate |
|---|---|---|---|---|---:|---:|
| Expert v1 | `expert-v1` | 1.0.0 | voraç + reordenació completa | expert | — | 0 |
| Challenger 500k | `challenger-500k` | 1.0.0+n500k | voraç + reordenació completa | expert | 500000 | 0 |

### Diferències de configuració

```text
versió
  A: 1.0.0
  B: 1.0.0+n500k
maxNodes
  A: —
  B: 500000
```

## Resultat

| Mètrica | Expert v1 (A) | Challenger 500k (B) |
|---|---:|---:|
| Victòries | 443 | 557 |
| % victòries | 44.3% | 55.7% |
| Punts mitjans | -3.5 | 3.5 |
| Fitxes jugades/torn | 0.98 | 1 |
| Temps mitjà/jugada | 7.3 ms | 14.6 ms |
| p95 temps/jugada | 56.8 ms | 68.8 ms |
| Nodes mitjans/cerca | 13740 | 24729 |
| Cerques limitades | 1468 | 514 |
| Reordenacions | 3750 | 4092 |
| Errades simulades | 0 | 0 |
| Jeroglífics | 3181 | 3523 |
| Jeroglífics/partida | 3.18 | 3.52 |
| Complexitat mitjana | 10.44 | 12.05 |
| Jugada més complexa | 92 | 98 |
| Màx. fitxes recol·locades | 49 | 50 |
| Màx. jugades alterades | 25 | 25 |

Mitjana de torns per partida: 63.1.

Un **jeroglífic** és una jugada amb complexitat de reconstrucció ≥ 10
segons la mètrica del laboratori (vegeu `docs/AI-LAB.md`): telemetria
determinista que no influeix en cap decisió del motor.

## Partides interessants

Cada partida es reprodueix exactament amb la seva llavor i el seient inicial:

- **Victòria més contundent d’A** — El motor A guanya per 114 punts. (partida 41, llavor 7020, comença A)
  `npm run lab -- --match --engine-a expert-v1 --engine-b challenger-500k --seed 7020 --first A`
- **Victòria més contundent de B** — El motor B guanya per 114 punts. (partida 42, llavor 7020, comença B)
  `npm run lab -- --match --engine-a expert-v1 --engine-b challenger-500k --seed 7020 --first B`
- **Partida més llarga** — 108 torns. (partida 272, llavor 7135, comença B)
  `npm run lab -- --match --engine-a expert-v1 --engine-b challenger-500k --seed 7135 --first B`
- **Partida amb més nodes de cerca** — 18855713 nodes explorats entre tots dos motors. (partida 272, llavor 7135, comença B)
  `npm run lab -- --match --engine-a expert-v1 --engine-b challenger-500k --seed 7135 --first B`
- **Partida amb més jeroglífics** — 18 jugades amb complexitat ≥ 10. (partida 922, llavor 7460, comença B)
  `npm run lab -- --match --engine-a expert-v1 --engine-b challenger-500k --seed 7460 --first B`
- **Jugada individual més complexa** — Complexitat 98 (motor B, torn 96). (partida 439, llavor 7219, comença A)
  `npm run lab -- --match --engine-a expert-v1 --engine-b challenger-500k --seed 7219 --first A`

## Conclusió

**Challenger 500k** guanya la comparació: 557 victòries contra 443 de Expert v1 (55.7% de les partides vàlides).

Challenger 500k fa les jugades més complexes (complexitat mitjana 12.05 vs 10.44; 3523 jeroglífics vs 3181).
