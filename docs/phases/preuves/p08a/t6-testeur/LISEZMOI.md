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

## 5. Pas 4 (16 novembre) : Android, C8, C12, C13, captures

APK release de 051c657 sur `emulator-5584`. Circuit « Petite Suisse
Lorraine à VTT », 34,9 km, D+ 459 m, rejoué tous les 50 m, une position par
seconde. Avant chaque « Démarrer le suivi » : `geo fix` du vrai départ.

### C12 — rapidité (release), mesures externes

La méthode des phases 4 et 6 (banc compilé dans l'app) demande de modifier
l'app : non reprise ici.

| Seuil | Mesure | Verdict |
|---|---|---|
| Départ < 2 s (35 km) | `screencap` en boucle après le tap : écran de suivi avec « Reste 34,9 km » visible à 363–488 ms ; écran stable (fin du cadrage) à 1 748, 1 634 et 1 491 ms | tenu |
| Position < 50 ms | temps CPU du fil JavaScript (`/proc/<pid>/task/*/stat`) : 370 ms pour 30 positions, soit 12 ms par position **en moyenne**, rendus et minuteur compris | moyenne tenue ; maximum non mesuré |
| Écran ≤ 1 mise à jour/s | 4 positions/s envoyées, captures toutes les 0,4 s pendant 24 s : 22 changements (0,92/s), écarts de 0,35 à 2,67 s | cadence tenue en moyenne ; deux écarts courts non expliqués (échantillonnage probable) ; garanti par le code (`timeInterval: 1000`, règle des 900 ms) |

### C8 — écran allumé et arrière-plan : conforme

- `dumpsys power` : `SCREEN_BRIGHT_WAKE_LOCK` de `fr.rutapulse.app`
  pendant le suivi ; aucun en arrière-plan (HOME) ; de retour au retour ;
  aucun sur « Sortie terminée » ni après « Fermer ».
- Arrière-plan 15 s pendant le rejeu : `android-p4-04` (Reste 32,8 km)
  → `android-p4-05` (accueil) → `android-p4-06` (32,8 km, intact) →
  `android-p4-07` (31,4 km, le suivi reprend). Les positions reçues en
  arrière-plan sont ignorées. `android-p4-09` : « Sortie terminée » 2,5 km
  après une pause, la perte correspond à la pause.
- **Anomalie vue une fois** : « Terminer » a ramené à Infos sans résumé
  après environ 4 km. **Explication de la session** (lecture de
  `trackingState.ts`) : ce rejeu partait sans positions immobiles, à 50 m/s.
  Chaque deuxième position est alors jugée non plausible (≥ 25 m/s) par la
  règle de cohérence de 051c657, qui repart de zéro à chaque position : la
  distance roulée reste nulle, d'où le retour direct à Infos (moins de 100 m).
  C'est un effet du rejeu à 180 km/h, pas d'un vrai vélo. Les rejeux qui
  partent de positions immobiles (C13) passent.

### C13 — Maestro en mode avion : réussi sur Android

Mode avion par `adb shell cmd connectivity airplane-mode enable` (remis à la
fin). `maestro --device emulator-5584 test mobile/e2e/<parcours>.yaml`.

- `mobile/e2e/p08a-suivi-terminer.yaml` : 21 étapes réussies
  (`android-p4-c13b-maestro-sortie.txt`) : démarrer, « Tournez à gauche »,
  « Terminer », boîte, « SORTIE TERMINÉE » (780 m, D+ 27 m), « Fermer », Infos.
- `mobile/e2e/p08a-suivi-arrivee.yaml` : réussi, `exit 0`
  (`android-p4-c13a-maestro-sortie.txt`, environ 13 min) : Reste 34,9 km,
  direction qui change, écart « 60 m jusqu'au tracé » puis retour,
  « ARRIVÉE ! » 33,9 km (la trace s'arrête un peu avant la fin), « Fermer ».

### Captures `android-p4-`

`01` panneau jaune 100 m et boîte « Terminer la sortie ? » ; `02`, `03`
suivi ; `04` à `07` arrière-plan ; `09` sortie terminée ; `c13a-01` à
`c13a-07` parcours de l'arrivée ; `c13b-01` à `c13b-04` parcours
« Terminer ».

### Non vérifié à ce pas

Maximum de temps par position ; « Suivez le tracé » sur appareil ; retour
système d'Android dans un parcours Maestro (vu une fois à la main) ; iOS.

## 6. Pas 5 (16 novembre) : iOS, banc C12

**App testée : release du commit d00f67d** sur « iPhone 17 » (pas de
construction : 18 Go libres, sous le seuil de 20 Go). Depuis, seules les
règles de départ ont changé (`trackingState.ts`, `placement.ts`,
`useGpsFixes.ts`) ; l'interface est identique. Les règles de départ
(33f64e9, 051c657) ne sont donc pas dans cette app. Itinéraire « Itinéraire
du 4 nov. » (622 m), simulateur placé au premier point avant le départ.

### C13 iOS (sans mode avion, permis par la spec) : réussi

- `mobile/e2e/p08a-suivi-terminer-ios.yaml` : 21 étapes réussies
  (`ios-p5-c13b-maestro-sortie.txt`), à la 3e tentative (regex de l'espace
  fine, puis bouton de la boîte tapé par position).
- `mobile/e2e/p08a-suivi-arrivee-ios.yaml` : réussi du premier coup
  (`ios-p5-c13a-maestro-sortie.txt`) : direction qui change, écart de 60 m
  puis retour, « ARRIVÉE ! » 720 m (le détour allonge), « Fermer ».
- Le rejeu `ios_replay.py` se lance à côté (commandes en tête des YAML).
  Traces : `ios-p5-trace-4nov-5m.json`, `ios-p5-trace-4nov-5m-ecart60m.json`.

### Captures `ios-p5-`

`c13a-01` à `c13a-07` (arrivée, dont `c13a-04` écart « 40 m jusqu'au
tracé ») ; `c13b-01` à `c13b-04` (« Terminer ») ;
`direction-panneau-blanc-270m` ; `panneau-jaune-50m-retour-6s` ;
`suivez-le-trace-troncon-main` (itinéraire « Test tronçon main au
milieu ») ; `c8-01` à `c8-03`. Pas obtenue : l'attente du GPS (le
simulateur garde toujours une position).

### C8 iOS : conforme

Réglages ouvert 17 s pendant le rejeu, puis retour : Reste 400 m → 250 m,
direction intacte, puis 190 m et panneau jaune. L'avancement continue. Non
vérifié sur iOS : le verrou d'écran allumé.

### C12, maximum par position (Node, pas Hermes)

`mobile/src/core/tracking/perf.bench.test.ts` : circuit de 34,9 km, une
position tous les 10 m (3 491 positions), directions enregistrées du moteur.

```
BENCH C12 reduceTracking, with directions: 3491 positions, max 2.000 ms (position no 12), p99 1.000 ms, mean 0.019 ms
BENCH C12 reduceTracking, without directions: 3491 positions, max 1.000 ms (position no 6), p99 1.000 ms, mean 0.017 ms
BENCH C12 reduceTracking + panelOf + remainingOf: 3491 positions, max 1.000 ms (position no 0), p99 1.000 ms, mean 0.018 ms
```

`performance.now()` est arrondi à 1 ms sous Jest. Max < 50 ms tenu avec
une grande marge en Node ; pas de mesure Hermes sur téléphone. Avec la
moyenne de 12 ms par position mesurée sur l'émulateur (§ 5, rendus
compris), C12 est tenu sauf pour le maximum sur appareil, non mesuré.

### Défaut trouvé : « ARRIVÉE ! » immédiate à 0 m

Itinéraire non bouclé de 622 m. Simulateur placé sur le point d'arrivée,
puis « Démarrer le suivi » : « ARRIVÉE ! » tout de suite, 0 m, D+ « — »
(`ios-p5-defaut-arrivee-immediate-0m.png`). Vu deux fois. C6 demande 90 %
du tracé **parcouru**. Traité dans la tâche de corrections.

`cd mobile && npm run verify` : 247 suites, 2 890 tests, vert.
