# Analyse de `ios`

Écarts calculés par rapport à la référence (distance de la trace, D+ avec les altitudes du paquet).

| Réf. | Points | Dist. réf. (km) | Dist. Valhalla (km) | Dist. forme (km) | Écart dist. | ±5 % | D+ réf. (m) | D+ calculé (m) | Écart D+ | ±10 % |
|---|---|---|---|---|---|---|---|---|---|---|
| R1 | 12 | 21.36 | 20.53 | 20.51 | -3.9 % | OK | 257 | 242 | -5.8 % | OK |
| R2 | 19 | 34.89 | 35.17 | 35.13 | +0.8 % | OK | 478 | 454 | -5.0 % | OK |
| R3 | 14 | 25.10 | 26.98 | 26.96 | +7.5 % | NON | 421 | 480 | +14.0 % | NON |
| R4 | 22 | 40.91 | 42.12 | 42.08 | +3.0 % | OK | 601 | 665 | +10.6 % | NON |
| R5 | 24 | 44.46 | 40.35 | 40.31 | -9.2 % | NON | 783 | 706 | -9.8 % | OK |

Verdict de distance : écart de `trip.summary.length` à la distance de la référence.

