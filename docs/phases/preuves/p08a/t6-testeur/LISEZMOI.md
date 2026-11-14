# Phase 8a, T6 — preuves du testeur (pas 1)

Build release du commit d00f67d, émulateur Android `emulator-5584`, taps par
`adb input tap` (sans Maestro). Écrit par la session de phase d'après le
rapport du testeur (le garde-fou ne lui permet d'écrire que des tests).

Trace : circuit « Petite Suisse Lorraine à VTT » (34,9 km), une position
tous les 25 m, une par seconde, depuis le vrai départ ; décalée de 60 m sur
les positions 14 à 21. Script : `essais/08-suivi-velo/t6-outils/trace_ecart_60m.py`.

## 1. Position ancienne au départ — défaut confirmé

`geo fix` à 2 km sur la route, puis « Démarrer le suivi », puis rejeu depuis
le vrai départ.

| Capture | Vu |
|---|---|
| `android-p1-premiere-position-ancienne.png` | « Recherche du GPS… », Reste 34,9 km |
| `android-p1-depart-reel-reste-33-0km-tracé-1-7km.png` | au vrai départ : « 1,7 km jusqu'au tracé », Reste 33,0 km, D+ restant 428 m. L'avancement est calé sur la position ancienne |
| `android-p1-sortie-terminee-2-9km-saut-compte.png` | « Terminer » : 2,9 km, D+ 43 m pour environ 175 m roulés. Le saut est compté |

Conclusion : la première position reçue est la dernière gardée par
l'émulateur, envoyée avant « Démarrer ». Elle fausse l'avancement, le
« Reste », la distance et le D+ réels. À corriger (tâche de corrections,
recommandation acceptée par le pilotage : ignorer les positions antérieures
au départ du suivi).

## 2. C5, écart puis retour — conforme

Départ propre (`geo fix` du départ avant « Démarrer »).

| Capture | Vu |
|---|---|
| `android-c5-01-depart-propre-reste-34-8km.png` | Reste 34,8 km, D+ 459 m, « Légèrement à droite sur la piste », 30 m |
| `android-c5-02-ecart-60m-jusqu-au-trace.png` | « 60 m jusqu'au tracé », « Le guidage reprend sur le tracé. », en-tête blanc, pas d'alerte ; Reste 34,5 km |
| `android-c5-03-guidage-repris-apres-retour.png` | « Tournez à gauche sur la piste » dans 1,4 km ; Reste 34,1 km, D+ restant 433 m ; l'avancement continue |

Seuls le début, le milieu et la fin de l'écart sont capturés.

## Pas encore fait

Mesures C12, Maestro C13, iOS, arrière-plan (C8) sur appareil.
