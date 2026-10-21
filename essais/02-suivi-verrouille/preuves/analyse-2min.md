## Résultats (android)

| # | Critère | Attendu | Mesuré | Verdict |
|---|---|---|---|---|
| C1 | ≥ 1 position par 5 s, aucun trou > 30 s | moyenne ≥ 1, trou ≤ 30 s | 119 positions sur 120 s couverts (22:05:37 à 22:07:37) ; 4.96 positions par 5 s ; plus grand trou 1.8 s (22:07:21 à 22:07:23, bords inclus) ; écart horloge appareil - Mac estimé +0.60 s (comprend la latence d'envoi) | OK |
| C2 | Nouveau texte < 5 s après le palier | ≥ 20 changements vus, tous < 5 s | 2 changements vus sur 2 paliers ; médiane 0.6 s ; maximum 0.6 s ; 2 < 5 s (100 % des paliers) ; 0 jamais vu(s) | INSUFFISANT (< 20 changements) |
| C3 | Notification unique | ≤ 1 | max 1 notification(s) de l'app sur 135 relevés | OK |

### C2 : détail par palier

Résolution : 1 s (l'observateur lit une fois par seconde). L'heure d'injection est prise juste avant l'envoi de la position.

| k | d du point (m) | injection | vu | délai (s) |
|---|---|---|---|---|
| 1 | 203 | 22:06:18 | 22:06:19 | 0.6 |
| 2 | 403 | 22:06:58 | 22:06:59 | 0.6 |
