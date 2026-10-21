## Résultats (ios)

| # | Critère | Attendu | Mesuré | Verdict |
|---|---|---|---|---|
| C1 | ≥ 1 position par 5 s, aucun trou > 30 s | moyenne ≥ 1, trou ≤ 30 s | 302 positions sur 300 s couverts (19:33:11 à 19:38:11) ; 5.04 positions par 5 s ; plus grand trou 1.2 s (19:34:32 à 19:34:33, bords inclus) ; écart horloge appareil - Mac estimé +0.12 s (comprend la latence d'envoi) | OK |
| C2 | Nouveau texte < 5 s après le palier | ≥ 20 changements vus, tous < 5 s | 0 changements vus sur 7 paliers ; 0 < 5 s (0 % des paliers) ; 7 jamais vu(s) | ÉCHEC |
| C3 | Notification unique | ≤ 1 | max 1 Live Activity active(s) ; 0 événement(s) notif dans le journal (info) ; max 0 ligne(s) « Indication » sur une même capture | OK |

### C2 : détail par palier

Résolution : 1 s (l'observateur lit une fois par seconde). L'heure d'injection est prise juste avant l'envoi de la position.

| k | d du point (m) | injection | vu | délai (s) |
|---|---|---|---|---|
| 1 | 203 | 19:33:52 | jamais | - |
| 2 | 403 | 19:34:32 | jamais | - |
| 3 | 603 | 19:35:12 | jamais | - |
| 4 | 801 | 19:35:52 | jamais | - |
| 5 | 1001 | 19:36:32 | jamais | - |
| 6 | 1201 | 19:37:12 | jamais | - |
| 7 | 1405 | 19:37:53 | jamais | - |
