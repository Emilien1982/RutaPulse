## Résultats (android)

| # | Critère | Attendu | Mesuré | Verdict |
|---|---|---|---|---|
| C1 | ≥ 1 position par 5 s, aucun trou > 30 s | moyenne ≥ 1, trou ≤ 30 s | 300 positions sur 300 s couverts (18:55:33 à 19:00:33) ; 5.00 positions par 5 s ; plus grand trou 1.1 s (18:58:47 à 18:58:48, bords inclus) ; écart horloge appareil - Mac estimé +0.58 s (comprend la latence d'envoi) | OK |
| C2 | Nouveau texte < 5 s après le palier | ≥ 20 changements vus, tous < 5 s | 7 changements vus sur 7 paliers ; médiane 0.8 s ; maximum 0.8 s ; 6 < 5 s (86 % des paliers) ; 0 jamais vu(s) ; 1 délai(s) < -1 s (texte vu avant l'injection : anormal) | ÉCHEC |
| C3 | Notification unique | ≤ 1 | max 1 notification(s) de l'app sur 315 relevés | OK |

### C2 : détail par palier

Résolution : 1 s (l'observateur lit une fois par seconde). L'heure d'injection est prise juste avant l'envoi de la position.

| k | d du point (m) | injection | vu | délai (s) |
|---|---|---|---|---|
| 1 | 203 | 18:56:14 | 18:56:15 | 0.8 |
| 2 | 403 | 18:56:54 | 18:56:55 | 0.8 |
| 3 | 603 | 18:57:34 | 18:57:35 | 0.8 |
| 4 | 801 | 18:58:14 | 18:58:15 | 0.8 |
| 5 | 1001 | 18:58:54 | 18:58:55 | 0.8 |
| 6 | 1201 | 18:59:34 | 18:59:35 | 0.8 |
| 7 | 1405 | 19:00:15 | 18:55:33 | -282.2 |
