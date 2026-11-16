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

## 3. Pas 2 (14 novembre) : même scénario avec la correction 33f64e9 — défaut toujours visible sur l'émulateur

Règle de 33f64e9 : une position prise avant le départ du suivi
(`location.timestamp < startedAt`) est ignorée. APK release reconstruit
et installé sur `emulator-5584`. Même scénario que § 1.

| Capture | Vu |
|---|---|
| `android-p2-01-apres-demarrer-avant-depart-reel.png` | juste après « Démarrer le suivi » |
| `android-p2-02-depart-reel.png` | 6 s après le début du rejeu : « 1,7 km jusqu'au tracé », Reste 14,3 km, D+ restant 79 m |
| `android-p2-03-depart-reel-14s.png` | « 60 m jusqu'au tracé », Reste 15,8 km (attendu 34,8 km) |
| `android-p2-04-terminer.png` | Reste 15,2 km |
| `android-p2-05-sortie-terminee.png` | 2,8 km, D+ 64 m pour environ 350 m rejoués |

Hypothèse non vérifiée : l'émulateur donne à la position du `geo fix` une
heure récente, au moment où il la livre à l'app ; la règle ne la voit donc
pas comme ancienne. La règle protège sans doute une position en cache sur
un vrai téléphone, pas ce scénario. Le « Reste » faux montre aussi que
l'avancement reste calé sur la première position acceptée, même quand
toutes les suivantes la contredisent. Suite : voir les résultats de la phase.

## 4. Pas 3 (16 novembre) : règle de cohérence 051c657 — défaut propre à l'émulateur, reporté à la phase 10

APK release de 051c657 (« BUILD SUCCESSFUL » vérifié), `emulator-5584`.
Même scénario que § 3 ; 30 positions rejouées (environ 0,75 km attendus).

| Capture | Vu | Attendu |
|---|---|---|
| `android-p3-01-apres-demarrer-avant-depart-reel.png` | « Recherche du GPS… », Reste 34,9 km | idem |
| `android-p3-02-depart-reel-6s.png` | « 1,7 km jusqu'au tracé », Reste 14,3 km | Reste ≈ 34,8 km |
| `android-p3-03-depart-reel-14s.png` | Reste 15,9 km | ≈ 34,5 km |
| `android-p3-04-fin-rejeu.png` | Reste 15,5 km | ≈ 34,1 km |
| `android-p3-05-confirmer-terminer.png` | boîte « Terminer » | — |
| `android-p3-06-sortie-terminee.png` | 2,6 km, D+ 66 m | ≈ 0,75 km |

**Cause, mesurée** : pendant « Recherche du GPS… », `dumpsys location` lu
trois fois à 3 s d'écart donne la même position (celle du `geo fix`) avec
une heure qui avance (« et » suit le temps écoulé). L'émulateur repousse le
`geo fix` environ chaque seconde, daté « maintenant ». Le filtre
`takenAt < startedAt` ne la voit donc pas comme ancienne, et deux positions
identiques sont cohérentes entre elles (vitesse 0) : la règle ne se
déclenche pas.

**Décision du pilotage (14 novembre)** : ce cas est propre à l'émulateur ;
il est noté dans les résultats et reporté à la phase 10 (vrai téléphone).
Sur un vrai téléphone, une position en cache garde son heure ancienne : le
filtre de 33f64e9 la rejette, et un saut brutal est rattrapé par 051c657.

**À regarder en phase 10** : « Reste 14,3 km » au lieu d'environ 33 km
laisse penser que la position éloignée a été placée sur un passage plus
tardif de la boucle. Non analysé ici.
