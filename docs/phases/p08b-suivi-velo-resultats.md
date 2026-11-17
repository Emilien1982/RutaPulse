# Phase 8b — Finitions du suivi : résultats

> Commencée le 16 novembre 2026, terminée le 17 novembre 2026, en deux
> sessions de phase (passation après T3 ; un arrêt pour la limite
> d'utilisation de 5 heures pendant T6).
> Spec : [p08b-suivi-velo-finitions.md](p08b-suivi-velo-finitions.md)
> (critères C1 et C9 à C16).
> Branche `claude/phase-8b-finitions-suivi-c712c4`, poussée, non fusionnée.
>
> **Les 9 critères de la phase 8b sont tenus, dont 4 avec réserve.** C1 et
> C9 : la luminosité réelle d'iOS ne se voit pas sur simulateur. C10 : la
> flèche de l'onglet Carte n'est pas vue sur Android. C12 : léger tassement
> des pointillés de l'écart pendant la seconde d'un recadrage sur iOS. C13 :
> le temps par position n'est mesuré qu'en Node. Les réserves sont écrites
> plus bas.

## En bref

- **Luminosité** pendant le suivi : « Automatique » ou « Maximum », dans
  l'onglet Réglages (v1/80) et dans le panneau 31b ouvert par la roue
  dentée de l'écran de suivi. C'est le même réglage, gardé d'une sortie à
  l'autre. Luminosité rendue à la fin du suivi et en arrière-plan.
- **Onglet Carte** (maquette 90) : point bleu avec flèche de cap et halo de
  précision, nord en haut ; bouton de recentrage à trois états (repos,
  « suit ma position », position refusée) ; hors de la zone à moins de
  10 km, cadrage commun sur la position et le bord le plus proche. Le
  point de l'écran de suivi prend aussi la flèche et le halo.
- **Trait de liaison** en pointillés sur l'écran Infos et pendant le
  suivi. Il ne compte ni dans la distance, ni dans les directions, ni dans
  le GPX.
- **Arrivée** : le panneau du haut prend la même distance que « Reste » ;
  sous 30 m, il dit seulement « Arrivée ».
- `npm run verify` : 270 suites, **3 052 tests** réussis. `pytest` :
  **280 tests** réussis (fabrique inchangée). CI verte (run plus bas).
- Rien n'a ralenti : l'onglet Carte s'ouvre en 1108 ms sur Android (1137
  avant) et 110 ms sur iOS (118 avant).

## Où sont les preuves

Toutes dans le dépôt, sous `docs/phases/preuves/p08b/` (abrégé `p08b/`).
Chaque dossier a son `LISEZMOI.md`.

| Quoi | Chemin |
|---|---|
| ADR 0021, « Complément 8b » (§ 8 à 12, accepté le 16 novembre 2026) et « Écarts acceptés pendant la phase 8b » | [0021-suivi-sur-le-velo.md](../adr/0021-suivi-sur-le-velo.md) |
| Maquettes complétées en T1 | `design/v1/90-carte.html`, `design/30-suivi-velo.html`, `design/31b-suivi-reglages.html` |
| Essai T1 (C1) | `p08b/t1-essai/LISEZMOI.md` |
| T2 luminosité (C9) | `p08b/t2/LISEZMOI.md` |
| T3 onglet Carte et point du suivi (C10) | `p08b/t3/LISEZMOI.md` |
| T4 trait de liaison et arrivée (C11, C12) | `p08b/t4/LISEZMOI.md` |
| T5 mesures, Maestro, traces, captures (C13, C14, C16) | `p08b/t5/LISEZMOI.md` |
| Comparaisons du designer | `design/comparaisons/p08b-t2-luminosite.md`, `design/comparaisons/p08b-t6-finitions.md` |
| Parcours Maestro | `mobile/e2e/p08b-luminosite-carte.yaml`, `mobile/e2e/p08b-luminosite-carte-ios.yaml` |
| `pytest` | `p08b/pytest.txt` |

## Critère par critère

| Critère | Verdict | Preuves |
|---|---|---|
| C1 Essai d'abord | tenu ; luminosité iOS partielle (le simulateur ignore l'écriture) | `p08b/t1-essai/LISEZMOI.md` (luminosité Android, cap de la position, caméra qui suit puis repos) |
| C9 Luminosité | tenu ; luminosité réelle vue sur Android seulement (iOS : téléphone, phase 10) | `p08b/t2/LISEZMOI.md` (sections « Critère par critère » et « Après corrections ») ; `design/comparaisons/p08b-t2-luminosite.md` (B1 et M2 corrigés) ; Maestro C14 |
| C10 Onglet Carte | tenu ; flèche de l'onglet Carte non vue sur Android (le fournisseur d'essai n'accepte pas de cap) ; pincement non testable sur simulateur | `p08b/t3/LISEZMOI.md` (ouvertures 2,5 km, 9,5 km, coin, plus de 10 km, trois états, D1 corrigé) ; `p08b/t5/LISEZMOI.md` (traces rejouées, `ios-carte-2-trace-fleche-halo-suit.png`, `android-carte-2-trace-suit.png`) |
| C11 Trait de liaison | tenu | tests `routeLinks.test.ts`, `routeLinksT4Testeur.test.ts` (directions, longueur, GPX identiques ; aucun trait sur les circuits), `TrackingLinkLayerT4.test.tsx` (style validé par MapLibre) ; `p08b/t4/ios-6-infos-liaison.png`, `android-4-infos-liaison.png`, `ios-8c-suivi-liaison-sous-trace-150m.png`, `android-6b-arrivee-150m-liaison-visible.png` |
| C12 Remarques de la 8a | tenu avec réserve : « Arrivée » prouvé ; pointillés de l'écart légèrement serrés (25 à 35 %) pendant la seconde d'un recadrage sur iOS, normaux à l'arrêt (décision du pilotage du 17 novembre) | `p08b/t4/ios-8-arrivee-280m-egal-reste.png`, `ios-9-arrivee-sous-30m.png`, `android-6-arrivee-240m-egal-reste.png`, `android-7-arrivee-sous-30m.png` ; `p08b/t4/journal-zoom-ecart.txt` ; `ios-ecart-recadrage-c21.png` (en mouvement), `ios-ecart-recadrage-c23.png` (à l'arrêt) |
| C13 Rapidité | tenu ; temps par position mesuré en Node seulement | `p08b/t5/c13-ouverture-carte.txt` (onglet Carte, 7 ouvertures à froid par version) ; `p08b/t5/c13-depart-android-brut.txt` (départ de 1,75 à 1,89 s pour 34,9 km, adb compris) ; `c13-depart-ios-run1-commands.json` à `run3` (43 km, environ 1 s net) ; `p08b/t5/c13-banc-8a.txt` (1,0 ms au plus par position) |
| C14 Maestro | tenu : Android en mode avion (37 étapes), iOS sans (32 étapes) | `p08b/t5/maestro-android-c14.txt`, `p08b/t5/maestro-ios-c14.txt` |
| C15 verify, pytest, CI | tenu | `p08b/t5/verify-testeur.txt` (270 suites, 3 052 tests) ; `p08b/pytest.txt` (280 tests) ; run de la CI plus bas |
| C16 Captures comparées | tenu ; aucun écart bloquant ; 6 écarts mineurs (M1 à M6) reportés en phase 10 | `design/comparaisons/p08b-t6-finitions.md` ; captures de `p08b/t5/`, `p08b/t4/`, `p08b/t3/` |

## Intégration continue

Workflow « verify », run [44004427637](https://github.com/Emilien1982/RutaPulse/actions/runs/44004427637) sur le commit d4af60c : réussi (lu par l'API publique de GitHub le 17 novembre 2026).

## Écarts acceptés

Écrits dans l'ADR 0021, « Écarts acceptés pendant la phase 8b » :
`updateSettings` dans son propre fichier ; réglage lu par
`TrackingScreen` ; sélecteur partagé `ui/Segmented.tsx` ; « Recherche du
GPS » qui ne ferme pas le panneau 31b ; marge du haut au-dessus du
panneau ; permission accordée par la première demande ; point sous les
marqueurs sur l'écran de création ; toucher avant la première position ;
`TrackingSource.links` facultatif ; remède du § 11.2 non appliqué.

## Incidents de la phase

- **Place sur le Mac** : de 34 Go à 19 Go pendant la mesure C13 (trois
  constructions iOS). Le développeur a effacé, sans demander, la
  construction iOS de la version de référence (6,5 Go dans le DerivedData
  d'Xcode, hors du worktree). C'était sa propre construction, faite pour
  la mesure : pas de dégât, mais un écart à la règle « rien effacer hors du
  worktree ». Signalé au pilotage le 17 novembre ; la consigne est
  répétée à chaque sous-agent depuis.
- **Limite d'utilisation de 5 heures** atteinte pendant T6 : le designer a
  repris là où il s'était arrêté.
- Une capture de T5 (`android-carte-1-position-fixe-halo-100m.png`) ne
  montrait pas le point, contrairement à son LISEZMOI. Vu par le designer,
  corrigé dans le LISEZMOI.

## Reporté

- **Phase 10 (vrai téléphone)** :
  - luminosité réelle, surtout sur iOS, et après une fermeture de force ;
  - flèche de cap de l'onglet Carte sur Android ; confort de la flèche ;
    précision réelle du halo ;
  - pincement à deux doigts pendant « suit » ;
  - temps par position dans Hermes (le moteur JavaScript de l'app) ;
  - écarts mineurs du designer en T6, non corrigés (décision du pilotage
    du 17 novembre ; détail dans `design/comparaisons/p08b-t6-finitions.md`).
    Aucun ne trompe le cycliste ni ne contredit la spec :
    - **M1** : sur Android, le trait de liaison est fait de tirets, pas de
      points ronds (`p08b/t4/android-4-infos-liaison.png`,
      `p08b/t4/android-6b-arrivee-150m-liaison-visible.png`,
      `p08b/t5/android-suivi-1-en-route-fleche-halo-roue.png`) ;
    - **M2** : le trait d'un point posé hors chemin finit sans repère
      (`p08b/t4/ios-6-infos-liaison.png`, `p08b/t4/android-4-infos-liaison.png`) ;
    - **M3** : sur iOS, quand le GPS est perdu, le halo reste autour du
      rond gris (`p08b/t3/ios-suivi-3-gps-perdu-apres-d1.png`) ;
    - **M4** : le trait de liaison dépassé reste magenta
      (`p08b/t4/ios-8c-suivi-liaison-sous-trace-150m.png`,
      `p08b/t4/android-6b-arrivee-150m-liaison-visible.png`) ;
    - **M5** : sur iOS, pendant « Recherche du GPS », le panneau 31b ouvert
      fait trop dézoomer la carte ; cause supposée : la marge héritée par
      `fitBounds`, non prouvée (`p08b/t5/ios-p8b-c14-03-panneau-automatique.png`,
      `p08b/t5/ios-p8b-c14-04-panneau-maximum.png`, à comparer avec
      `p08b/t5/ios-p8b-c14-02-suivi-roue-fermee.png`) ;
    - **M6** : sur iOS, un filet de 0,5 pt dans le sélecteur de Réglages
      (`p08b/t5/ios-p8b-c14-01-reglages-automatique.png`) ;
  - panneau 31b avec le texte agrandi sur un petit écran (le simulateur
    iPhone SE du Mac est sous iOS 15.2, trop ancien pour l'app).
