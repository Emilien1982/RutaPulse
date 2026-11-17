# Phase 8b, T4 : trait de liaison et remarques de la 8a — preuves

17 novembre 2026. Critères C11 et C12 de la spec
(`docs/phases/p08b-suivi-velo-finitions.md`). Règles : ADR 0021, § 10 et
§ 11. Ce fichier est écrit par la session de phase à partir des comptes
rendus du développeur et du testeur : le garde-fou réserve au testeur les
fichiers de test. Chaque chemin cité existe dans ce dossier.

## Contrôle T4-a (développeur, iOS release avec journal temporaire)

But : savoir si le zoom réel de la caméra diffère du zoom prévu par
`boundsZoom` pendant l'écart (cause supposée des pointillés serrés).

- `journal-zoom-ecart.txt` : 42 cadrages en écart. Une fois la caméra
  arrêtée, zoom prévu et zoom réel sont égaux (par exemple 16,927 et
  16,926). Pendant le mouvement, le réel reste 0,06 à 0,12 sous le prévu.
  Les lignes à 18,000 des deux côtés sont au plafond `MAX_ZOOM` : elles
  ne mesurent rien.
- `journal-brut-essai-ecart.txt`, `journal-brut-essai0-approche.txt` :
  journaux bruts (essai 0 : phase d'approche, 10,506 prévu, 10,504 réel).
- `ecart.png`, `avant-ecart.png` : captures de cet essai.
- `ios-build.txt`, `ios-demarrer-suivi.yaml` : construction et parcours.
- Décision : l'hypothèse de l'ADR (marge héritée par `fitBounds`) n'est
  pas confirmée. Le cadrage n'est pas changé. Le pilotage est d'accord
  (17 novembre).

## Tests

- `verify-dev.txt` : après le développeur, 269 suites, 3048 tests réussis.
- `verify-testeur.txt` : après le testeur, 270 suites, 3052 tests réussis.
- Tests ajoutés par le testeur : `mobile/src/core/routes/routeLinksT4Testeur.test.ts`
  (directions identiques avec et sans liaison, après `buildGuidance` ;
  aucun trait sur les deux circuits de `nancyCircuits.json`).

## Captures du testeur (release)

Itinéraire de test : 3 points posés à Villey-Saint-Étienne, le point 2
en plein champ à environ 40 m du chemin. iOS : `iPhone 17`. Android :
`emulator-5584`. Suivi rejoué avec `trace-itineraire-liaison.json` (voir
`decode-trace.py`, `ios-waypoints-liaison.txt`, `ios-marche-ecart.txt`).

| Point | iOS | Android | Verdict |
|---|---|---|---|
| Liaison sur l'écran Infos | `ios-6-infos-liaison.png` | `android-4-infos-liaison.png` | prouvé |
| Liaison pendant le suivi | `ios-7-suivi-depart.png`, `ios-8c-suivi-liaison-sous-trace-150m.png` | `android-5-suivi-depart.png`, `android-6b-arrivee-150m-liaison-visible.png` | prouvé pour la présence ; l'ordre des couches (sous le tracé) ne se voit pas à l'écran, couvert par `TrackingLinkLayerT4.test.tsx` |
| Arrivée au-dessus de 30 m : chiffre du haut égal à « Reste » | `ios-8-arrivee-280m-egal-reste.png`, `ios-8b-arrivee-60m-egal-reste.png` | `android-6-arrivee-240m-egal-reste.png`, `android-6b-arrivee-150m-liaison-visible.png` | prouvé |
| Arrivée sous 30 m : « Arrivée » sans chiffre | `ios-9-arrivee-sous-30m.png` | `android-7-arrivee-sous-30m.png` | prouvé (suivi démarré à environ 20 m de l'arrivée, voir note) |
| Pointillés de l'écart pendant un recadrage | `ios-ecart-recadrage-c21.png` (en mouvement, environ 15 px par point), `-c22.png`, `-c23.png` (arrêt, environ 21 px), `-c24.png`, `-c28.png` | `android-ecart-recadrage-g15.png`, `-g16.png`, `-g17.png`, `-g20.png` (environ 24 à 28 px, stable) | iOS : léger tassement pendant la seconde du mouvement, absent à l'arrêt ; Android : espacement gardé, début du mouvement non saisi |

Autres fichiers :
- création de l'itinéraire : `ios-0-ouverture.png`, `ios-1-liste.png`,
  `ios-2-creation.png`, `ios-3-creation-points.png`,
  `ios-4-apres-enregistrer.png`, `ios-5-creation-hors-chemin.png`,
  `android-0-ouverture.png`, `android-2-creation.png`,
  `android-3-creation-hors-chemin.png`, `android-6c-arrivee-resume.png` ;
- constructions : `ios-build-testeur.txt`, `gradle-release-testeur.txt`.

## Notes

- Le suivi se termine dès que la position est à 30 m ou moins du dernier
  point (après 90 % du parcours et 100 m roulés). L'état « Arrivée » sans
  chiffre ne se voit donc qu'en démarrant près de l'arrivée. Conforme à
  l'ADR 0021, § 11.1.
- Pointillés pendant un recadrage (C12b) : le tassement mesuré à l'image
  (25 à 35 %) ne dure que la seconde du mouvement ; il est plus faible que
  « 4 points pour 10 » de la 8a. Réserve envoyée au pilotage avec ces
  preuves.
- Écart à l'ADR § 10.3 : `TrackingSource.links` est facultatif
  (`links?:`), pour ne pas modifier des tests déjà commités.
  `sourceOfCreated` et `sourceOfGpx` le remplissent toujours.
