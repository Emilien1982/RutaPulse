# Essai jetable de la tâche T1 (phase 5) : altitudes, terrain, point agrandi

Date : 28 octobre 2026. Branche jetable `claude/p05-essai-infos` (commit
`9d68b81`, jamais poussée, jamais fusionnée). Le code de l'essai est copié
dans `code/` en `.txt`. Ce fichier est écrit par la session de phase, à
partir du compte rendu du développeur et des fichiers de ce dossier : le
garde-fou interdit `docs/` au développeur (voir « Écart » en bas).

## Versions

- valhalla-mobile 0.6.4, Expo SDK 58, iPhone 17 (iOS 26.5),
  `Pixel_6_API_34_arm64`. Zone Nancy v3. Version finale (release) sur les
  deux. Android en mode avion (`airplane_mode_on` = 1).
- Mac : image Docker `ghcr.io/valhalla/valhalla:3.9.1`, mêmes requêtes.

## Signatures exactes (sources 0.6.4)

- iOS (`Valhalla.swift`) : `height(rawRequest:) throws -> String` et
  `traceAttributes(rawRequest:) throws -> String`. Les versions typées
  existent, mais celle de `height` ne sait pas rendre `null` : on garde les
  versions brutes.
- Android (`Valhalla.kt`) : `heightRaw(requestJson: String): String` et
  `traceAttributesRaw(requestJson: String): String`.
- Dans le module d'essai, les deux fonctions copient `route` : mêmes
  erreurs, JSON `{code, message}` pour un refus de Valhalla.

## Rejouer

- Build release : `npx expo run:ios --device "iPhone 17" --configuration Release`,
  `npx expo run:android --variant release` (depuis la branche jetable ; il
  faut d'abord `npm ci` puis `npx expo prebuild --clean`, sinon la build iOS
  échoue sur `MapLibre/MapLibre.h`).
- Partie A : `sh p05-t1-ios.sh`, `sh p05-t1-android.sh` (67 étapes, une
  réponse brute par étape dans `ios/` et `android/`, `a-fini.json` =
  `{"done":true,"steps":67}` sur les deux).
- Mac : `python3 -I rejouer-sur-mac.py` (réponses dans `mac/`, 66 étapes :
  le JSON invalide n'est pas rejoué), `python3 -I reference-essai1-mac.py`
  (méthode de l'essai 1).
- Comparaison : `python3 -I comparer.py` → [comparaison.txt](comparaison.txt).
- Partie B : `sh p05-t1-b-ios.sh`, `sh p05-t1-b-android.sh`, parcours
  `p05-t1-glisser-ios*.yaml`. Captures dans `captures/`.

## Réponses

### 1. Hors ligne sur les deux plateformes ?

Oui. `height` et `traceAttributes` marchent sur iOS et Android avec
Nancy v3, Android en mode avion. Réponses de même forme sur iOS, Android et
Mac. Seule différence de `route` : le texte vocal, « 1.5 » sur Android
contre « 1,5 » ailleurs.

### 2. Profil d'un tronçon : `elevation_interval` ou `height` ?

- `route` + `elevation_interval: 30` : `trip.legs[i].elevation`, à une
  décimale, sans les distances.
- `height` + `resample_distance: 30` + `range: true` : `range_height` =
  `[distance, altitude]`, en entiers (`height_precision: 1` donne une
  décimale).
- Même nombre de points ; écart maximal de 0,5 à 2,1 m entre les deux.

D+ (méthode de l'essai 1, seuil 5 m), iOS :

| Trajet | Essai 1 | `elevation_interval` | `height` précision 0 | `height` précision 1 |
|---|---|---|---|---|
| A-B | 10 | 10,8 | 10 | 10,9 |
| Phase 3 | 102 | 110,2 | 105 | 113,8 |
| R1 | 242 | 221,9 | 243 | 235,0 |
| R2 | 454 | 428,6 | 462 | 438,7 |
| R3 | 480 | 484,9 | 489 | 484,9 |
| R4 | 665 | 638,6 | 671 | 677,3 |
| R5 | 706 | 689,5 | 702 | 689,7 |

**Recommandation : `height` + `resample_distance: 30` + `range: true`,
précision 0.** Un seul chemin de code pour les tronçons calculés et à la
main (C4). Il donne les distances. Il coûte moins de 1 ms sur 40 km. En
précision 0, le D+ est identique sur iOS, Android et Mac pour les 7 trajets ;
en précision 1, il diffère de 0,2 à 0,4 m.

Point par point, quelques altitudes diffèrent de ±1 m entre plateformes :
les points rééchantillonnés se décalent de 1e-6° selon la plateforme. Le
D+ reste identique en précision 0.

**Conséquence pour C3** : le Mac doit appeler `height` avec les mêmes
paramètres sur la même forme, ou reprendre les altitudes de l'app. Les
chiffres de l'essai 1 ne servent pas de référence : son rééchantillonnage
maison diffère de 1 à 9 m en D+.

### 3. `height` hors zone ou sans altitude

- Réponse normale avec des `null` : pas d'erreur, pas de −32768. Exemple :
  `[244, 281, null]`. Les points (47,5 ; 6,0) et (10 ; 10) donnent tout
  `null`.
- Piège : l'altitude vient des tuiles HGT (1° × 1°), pas du rectangle de la
  zone. Un point hors zone mais dans une tuile HGT reçoit une altitude.
- Refus : forme vide ou absente → code 312 ; JSON invalide → code −1. Un
  seul point est accepté.

### 4. `trace_attributes`

- `walk_or_snap` marche sur tous les cas.
- `edge_walk` : erreur 443 sur R1 à R5, mais réussit sur A-B et le trajet
  de la phase 3. On garde `walk_or_snap`.
- Champs obtenus avec les filtres : `use`, `road_class`, `surface`,
  `density`, `length`, `way_id`, `begin_shape_index`, `end_shape_index`
  (Valhalla ajoute `source_percent_along`, `target_percent_along`, `sign`).
  À la racine : `shape` recalée, `units`, `alternate_paths`. Les indices se
  rapportent à la forme recalée. Les filtres réduisent la réponse de 40 Ko à
  5,5 Ko sur A-B.
- Couverture (somme des `edge.length` / longueur) : 100 % (A-B, phase 3),
  99,98 à 99,99 % (R1, R2, R3, R5), **99,04 % (R4)**, deux sauts d'indice
  non expliqués. Les parts doivent donc se rapporter à la somme des arêtes.
- Erreurs : forme vide → 114 ; un point → 123 ; hors tuiles → 444 ; ligne
  droite à la main → 444. Un tronçon à la main ne passe donc pas par
  `traceAttributes`.

### 5. Durées (ms, premier appel / à chaud, release)

| Appel | Trajet | iOS | Android |
|---|---|---|---|
| `route` | A-B | 1,2 / 0,6 | 1,3 / 0,9 |
| `height` + range | A-B | 0,4 / 0,2 | 0,5 / 0,3 |
| `traceAttributes` | A-B | 0,8 / 0,3 | 1,0 / 0,6 |
| `route` | R4 (42 km) | 12,0 / 10,7 | 12,0 / 10,2 |
| `height` + range | R4 | 0,9 / 0,7 | 0,7 / 0,7 |
| `traceAttributes` | R4 | 36,7 / 25,0 | 44,4 / 28,2 |
| `traceAttributes` | R5 (40 km) | 22,1 / 21,7 | 12,9 / 10,9 |

Tailles sur R4 : `route` 77 Ko, `height` 22 Ko, `traceAttributes` 79 Ko.
Ces durées ne comptent ni le décodage JSON ni le calcul en TypeScript.

### 6. Partie B : point agrandi avec halo

| Variante | iOS | Android |
|---|---|---|
| Style seul pendant le glisser (clé constante), 28 → 40 + halo | Marche | Geste continu, mais l'image ne change pas |
| Idem, la vue racine change de taille | Marche | Geste continu, image inchangée |
| Point choisi par un toucher (la clé change au toucher), puis glissé | Grand + halo pendant tout le geste | Idem |
| Clé changée dans `onDragStart` (témoin) | Plantage (SIGABRT, `-[MLRNPointAnnotation setDragState:animated:]`) | Geste coupé |

**Voie qui marche sur les deux** : donner l'aspect `marqueur.point-deplace`
(rond de 40, chiffre de 18, halo) à tout **point choisi**, et ne jamais
changer la clé pendant un glisser. Un point non choisi saisi directement
reste à 28 sur Android. Piste non essayée : un marqueur fantôme posé par
`onDragStart`.

Sur iOS, `onDrag` renvoie toujours la position de départ ; seul `onDragEnd`
donne la bonne. Sur Android, `onDrag` suit le doigt.

Captures regardées : `captures/ios-inner-pendant-1.jpg`,
`captures/android-chosen-pendant-1.jpg` (grand point avec halo pendant le
geste), et par le développeur `inner`, `outer`, `chosen`, `keychange` des
deux plateformes.

## Remise en ordre

- SHA-256 de `valhalla_tiles.tar` en fin d'essai : `7fa29249…7a44` sur iOS
  (`shasum`) et Android (`adb shell sha256sum`).
- Mode avion coupé, dossiers `essai/` effacés. L'app d'essai reste
  installée (pour garder la zone) jusqu'à la prochaine build de phase.
- Cache `~/Library/Caches/org.swift.swiftpm` non touché.

## Non vérifié

- Un vrai téléphone ; un vrai mode avion sur iOS.
- Le marqueur fantôme pour un point non choisi.
- Une limite de taille de forme dans Valhalla (rien vu à 42 km).
- La cause des sauts d'arêtes de R4.
- Le D+ calculé en TypeScript : seul le calcul Python est comparé ici.
- La justesse des altitudes (hors périmètre).

## Écart

Le garde-fou a refusé au développeur l'écriture dans `docs/`. Avant ce
refus, il avait déjà créé par Bash les fichiers de ce dossier (scripts,
JSON, captures, code). La règle vise le rôle, pas l'outil : c'est un
contournement involontaire, noté dans les résultats de la phase. Le contenu
a été contrôlé par la session de phase (comparaison relue, deux captures
regardées, `a-fini.json` lus).
