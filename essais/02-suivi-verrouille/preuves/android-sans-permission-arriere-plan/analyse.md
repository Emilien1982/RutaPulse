## Résultats (android)

| # | Critère | Attendu | Mesuré | Verdict |
|---|---|---|---|---|
| C1 | ≥ 1 position par 5 s, aucun trou > 30 s | moyenne ≥ 1, trou ≤ 30 s | 0 positions sur 290 s couverts (23:14:16 à 23:19:06) ; 0.00 positions par 5 s ; plus grand trou 290.1 s (23:14:16 à 23:19:06, bords inclus) ; écart d'horloge appareil/Mac non estimé (tolérance : celle de l'horloge de l'appareil) | ÉCHEC |
| C2 | Nouveau texte < 5 s après le palier | ≥ 20 changements vus, tous < 5 s | 0 changements vus sur 7 paliers ; 0 < 5 s (0 % des paliers) ; 7 jamais vu(s) | ÉCHEC |
| C3 | Notification unique | ≤ 1 | max 1 notification(s) de l'app sur 300 relevés | OK |

### C2 : détail par palier

Résolution : 1 s (l'observateur lit une fois par seconde). L'heure d'injection est prise juste avant l'envoi de la position.

| k | d du point (m) | injection | vu | délai (s) |
|---|---|---|---|---|
| 1 | 203 | 23:14:47 | jamais | - |
| 2 | 403 | 23:15:27 | jamais | - |
| 3 | 603 | 23:16:07 | jamais | - |
| 4 | 801 | 23:16:47 | jamais | - |
| 5 | 1001 | 23:17:27 | jamais | - |
| 6 | 1201 | 23:18:07 | jamais | - |
| 7 | 1405 | 23:18:48 | jamais | - |
