# Essai jetable de la tâche T1 (phase 4) : glisser un point, recalcul limité par Pacer

Date : 27 octobre 2026. Branche jetable `claude/p04-essai-glisser` (commit
`79b8b28`, jamais poussée, jamais fusionnée). Le code de l'essai est copié ici
en `useDragTrial.tsx.txt` (hook) ; l'essai modifie aussi `ZoneMap.tsx`
(quelques lignes de branchement).

## Versions

- `@tanstack/react-pacer` **0.24.1** (version exacte, dernière version publiée,
  pas de tag « beta » ni « next » sur npm : `dist-tags` = `latest` seulement ;
  l'ADR 0007 la dit « bêta », elle est en 0.x).
- Dépend de `@tanstack/pacer` 0.23.1 et de `@tanstack/react-store` ^0.11.2
  (déjà dans l'app). `@tanstack/pacer` dépend de `@tanstack/devtools-event-client`
  ^0.5.0 et de `@tanstack/store`. Pair déclaré : `react-dom` (déjà installé par
  Expo, rien d'ajouté). Paquet en ESM pur (`"type": "module"`).
- `@maplibre/maplibre-react-native` 11.5.0, Expo SDK 58, iPhone 17 (iOS 26.5),
  `Pixel_6_API_34_arm64` (`emulator-5554`).
- Metro charge Pacer en version finale (release) sur les deux plateformes :
  aucune erreur, aucun réglage Metro. Le limiteur utilisé est `useThrottler`
  (`wait: 200`, `leading: true`, `trailing: true`) ; il a `cancel()`, que
  `useThrottledCallback` n'expose pas. Au relâchement : `cancel()` puis un
  calcul explicite avec la position finale.

## Rejouer

Build : `npx expo run:ios --device "iPhone 17" --configuration Release`,
`npx expo run:android --variant release --device emulator-5554` (depuis la
branche jetable). Puis :

- iOS : `maestro --device DAF21CEF-2D81-4ABE-9CEC-689BCF1A295D test p04-t1-glisser-ios.yaml`
  (voie B : `p04-t1-glisser-ios-voie-b.yaml`).
- Android : `sh p04-t1-glisser-android.sh <sortie.json>` (adb, `input swipe`
  2000 ms).
- Résultat : `<documents>/essai/glisser.json` (une entrée par geste de la
  session). iOS : `xcrun simctl get_app_container <udid> fr.rutapulse.app data`.
  Android : `adb -s emulator-5554 shell cat /data/data/fr.rutapulse.app/files/essai/glisser.json`
  (`adb root` fonctionne sur cet émulateur).
- Le bouton « Snap » de l'écran écrit `snap.json` (essais de la question a et b).

Un lancement = un geste mesuré à froid (l'app est relancée à chaque fois, le
fichier est donc copié après chaque geste).

## Mesures (version finale, 3 gestes par plateforme, voie A)

Zone Nancy v3, 3 points A, B, C dans la forêt de Haye (points de la phase 3),
B glissé, les 2 tronçons A-B et B-C recalculés par le vrai moteur
(`computeRoute`, même chemin que l'app). « Calculs » = rafales d'exécution du
limiteur, chacune calculant les 2 tronçons.

| Geste | Durée | Évts de glisser | Calculs pendant le geste | Écart mini entre 2 calculs | Calcul final au relâchement | Arrêt max du fil JS | Carte déplacée |
|---|---|---|---|---|---|---|---|
| iOS 1 | 5,60 s | 168 | 28 | 199,5 ms | oui (7,6 ms) | 25,5 ms | non |
| iOS 2 | 5,62 s | 168 | 28 | 199,9 ms | oui (8,9 ms) | 30,4 ms | non |
| iOS 3 | 5,62 s | 168 | 28 | 199,8 ms | oui (9,8 ms) | 29,8 ms | non |
| Android 1 | 2,03 s | 68 | 10 | 205,4 ms | oui (10,2 ms) | 85,3 ms | non |
| Android 2 | 2,05 s | 64 | 10 | 200,2 ms | oui (8,9 ms) | 88,0 ms | non |
| Android 3 | 2,02 s | 70 | 9 | 201,3 ms | oui (5,6 ms) | 83,8 ms | non |

- Seuil C11 (aucun arrêt de plus de 100 ms) : tenu, mais **avec peu de marge
  sur Android** (84 à 88 ms). Témoin sans geste, même méthode, 2 s, 20 s après
  l'ouverture : iOS 29,6 ms, Android 35,5 ms. Le geste ajoute donc environ
  50 ms sur Android. La cause n'est pas identifiée (l'arrêt arrive à des
  moments différents d'un geste à l'autre, 1,2 à 1,8 s après le début, sans lien
  net avec un calcul : le moteur prend 3 à 12 ms). Pistes si besoin : moins
  de mises à jour de la source GeoJSON, pas de `setState` par événement.
- Cadence : au plus un calcul toutes les 200 ms (écart mini 199,5 ms, gigue du
  minuteur). Le compteur `max_calculs_par_seconde` des JSON vaut 5 ou 6 : 6
  quand une fenêtre fermée de 1000 ms contient 6 calculs espacés d'exactement
  200 ms ; c'est le même rythme de 5 par seconde.
- Événements : 168 évts en 5,6 s sur iOS (30 par seconde), 65 en 2 s sur
  Android (33 par seconde) ; ils arrivent pendant le geste (premier évt à
  10-30 ms), pas seulement à la fin.
- Position finale juste : l'événement de fin donne la position du marqueur
  (cohérente avec l'image). Android : fin du doigt (790, 822) px = (301,0 ;
  313,1) dp, position rendue (300,4 ; 313,7) dp, écart moins de 1 dp. iOS : le
  glisser commence par un appui long (voir plus bas), le marqueur rend la fin
  à (251, 341) pt pour un doigt qui finit à (261, 330) pt : retard d'environ
  15 pt (environ 70 m au zoom 14), constant sur les 3 gestes. À corriger ou
  à accepter dans la conception : la position à retenir est celle de
  l'événement, pas celle du doigt.
- Un échec de calcul pendant le geste n'a pas été provoqué dans cet essai
  (C12 relève des tests de T3).

## Les deux voies de glisser

| Voie | iOS | Android |
|---|---|---|
| **A : `ViewAnnotation` `draggable`** (c'est le `PointAnnotation` des versions 10 ; il a été renommé en 11.5.0) avec `onDragStart`, `onDrag`, `onDragEnd` | **Marche.** Événements pendant le geste, la carte reste fixe, position finale = celle du marqueur. **Il faut un appui long avant de bouger** (reconnaisseur natif de MapLibre) | **Marche.** Événements pendant le geste, la carte reste fixe, position finale juste. Pas d'appui long nécessaire |
| **B : `Marker` + `PanResponder`** (position convertie avec `unproject`) | **Ne marche pas** : la carte se déplace en même temps que le marqueur (100 événements de déplacement de carte pendant le geste, centre déplacé d'environ 290 m), la position calculée est fausse (30 m au lieu de 400 m) | **Ne marche pas** : le `PanResponder` ne reçoit aucun événement, la carte se déplace, le marqueur ne bouge pas |

Voie retenue : **A**. Piège iOS : le geste doit commencer par un appui long
d'environ 0,5 s. Pour l'automatiser, Maestro `swipe` ne sait pas faire
« appui puis glisser » ; contournement : un `swipe` **très lent** (6000 ms
pour 85 pt) : pendant les 0,5 premières secondes le doigt bouge de moins de
10 pt, le reconnaisseur d'appui long démarre, puis le glisser suit. Avec un
`swipe` de 2000 ms sur la même distance, c'est la carte qui bouge (essayé,
la carte s'est déplacée, aucun événement de glisser). Sur un vrai téléphone,
l'utilisateur doit donc faire un appui long sur le point : à dire dans l'interface
(infobulle ou vibration). Autres voies non essayées : appui long sur une
couche puis suivi des événements de la carte avec `dragPan` coupé.

Toutes les mesures ci-dessus sont en voie A. Voie B : un seul geste par
plateforme (iOS : `ios-release-voieB-1.json` ; Android : aucun événement donc
pas de JSON).

## Réponses pour l'ADR 0016

**(a) Le moteur renvoie-t-il la position recalée ?** Oui, mais **pas dans
`trip.locations`** : cette liste répète les coordonnées demandées, sans
recalage (vérifié, identique au 6e chiffre). Le point recalé est le **premier
point du tracé du premier tronçon** et le **dernier point du tracé du dernier
tronçon** (`legs[].shape`, polyligne à 6 décimales). La distance point touché
vers chemin se mesure donc sans appel de plus : distance entre le point
demandé et cette extrémité du tracé. Mesuré dans l'app, sur les 2 plateformes,
identique à Valhalla 3.9.1 sur le Mac (Docker, même paquet) :

| Point posé | Distance au chemin |
|---|---|
| sur B | 0 m |
| 600 m à l'ouest de B | 195,9 m |
| 1000 m à l'ouest de B | 160,4 m |
| 2000 m au sud de B | 206,1 m |
| 2000 m au nord de B | 108,8 m |

La forêt de Haye est très maillée : sur 21 points testés autour de B (Mac,
`snap-mac-valhalla-3.9.1.txt`), le plus éloigné d'un chemin était à 206 m.
Aucun test n'a eu de point à plus de 300 m d'un chemin, faute d'endroit
assez vide : la mesure d'un point très éloigné n'est pas prouvée.

**(b) Valhalla refuse-t-il au-delà d'un rayon ?** Oui, avec **`search_cutoff`**
placé dans la location (en mètres, par point). `search_cutoff: 200` : le point
à 206,1 m est refusé, ceux à 195,9 m et 160,4 m passent. `search_cutoff: 100`
refuse ceux à 195,9, 160,4 et 108,8 m et accepte le point sur B. Code
d'erreur : **171**, « No suitable edges near location » (JSON `error_code`
171 sur le Mac). Dans l'app, le module natif rend `{"code":171,"message":...}`
(sur Android le message est préfixé `ValhallaError(code=171, ...)`) :
`parseRouteResponse` le lit déjà comme `outOfZone` (`code === 171`), donc le
**même code sert pour « hors zone » et « plus de 200 m d'un chemin »** : à
séparer dans l'ADR (par exemple un test de la zone avant le calcul, comme le
fait déjà `useRouteCreation`). `radius` (option `radius: 200`) **ne refuse
rien** : le point à 206 m passe. Seuls `search_cutoff` et la mesure de
recalage permettent le seuil de 200 m. Le seuil de 200 m se pose alors soit
par `search_cutoff: 200` (un seul calcul, refus 171), soit par la mesure ci-dessus
(permet un message précis ou un seuil modifiable).

## Ce qui n'est pas prouvé

- Un vrai téléphone (émulateur et simulateur seulement) ; Android à 85 ms sur
  émulateur : à remesurer sur un vrai téléphone.
- Un point à plus de 300 m d'un chemin ; un échec du moteur pendant le geste.
- L'appui long iOS au doigt (sur le simulateur, il est imité par un `swipe`
  lent de Maestro).
- Plus de 2 points glissés à la suite dans une même session (un geste par
  lancement).

## Vérification de l'empreinte du paquet Nancy v3

SHA-256 de `valhalla_tiles.tar` en fin d'essai (`shasum -a 256` dans le
conteneur du simulateur ; `adb shell sha256sum` sur l'émulateur), identique
sur les deux, égale à l'attendu :
`7fa29249411c75fd0cc651b4f0e06baf9dbd80109eea7df51b8116b7ceb07a44`.
