# Phase 3 — Module de calcul d'itinéraire : résultats

> 27 octobre 2026. Spec : [p03-module-calcul.md](p03-module-calcul.md).
> Branche `claude/adoring-williamson-4f81fd`, poussée, non fusionnée.

## En bref

- Sur l'onglet Carte, « Nouvel itinéraire », puis un départ et une
  arrivée : l'itinéraire VTT est calculé **sur le téléphone, sans
  réseau**, dessiné en magenta, avec sa distance et sa durée. Un point
  hors de la zone donne la feuille « Point hors de votre zone ».
- Les 10 critères sont tenus. Réserves : iOS n'a pas de vrai mode avion
  sur le simulateur ; tout est mesuré sur simulateurs, pas sur un vrai
  téléphone.
- **Le blocage de l'essai 1 sur iOS est levé** : il venait du bac à sable
  (sandbox) du terminal de Claude Code, pas de SwiftPM. valhalla-mobile
  s'installe maintenant par sa forme normale, depuis un clone neuf.
- **Question ARM de la phase 1 réglée** : les 5 parcours de référence,
  calculés dans l'app sur iOS et Android, sont identiques, point pour
  point, à ceux calculés sur le Mac.
- `npm run verify` : 62 suites, 576 tests réussis. CI verte.
- ADR 0015 (module natif, `shared-data/` seul importateur) accepté.

## Liens

| Quoi | Adresse |
|---|---|
| Run `verify` du dernier commit de code (T7, 328e5d8) | https://github.com/Emilien1982/RutaPulse/actions/runs/40521238435 |
| Run `verify` de T4 (commit aae7605) | https://github.com/Emilien1982/RutaPulse/actions/runs/40500010648 |
| ADR 0015 | [0015-module-natif-calcul.md](../adr/0015-module-natif-calcul.md) |
| Comparaison aux maquettes (T6) | [design/comparaisons/p03-t6.md](../../design/comparaisons/p03-t6.md) |
| Preuves | [preuves/p03/](preuves/p03/) |

## Critères

Captures dans [captures/](captures/), préfixe `p03-`, toutes en version
finale (release), sans le menu de développement d'Expo. Simulateurs :
iPhone 17 (iOS 26.5) et émulateur Android 14 `Pixel_6_API_34_arm64`, tous
deux en ARM, comme un téléphone.

| # | Attendu | Mesuré | Preuve | Verdict |
|---|---|---|---|---|
| C1 | Module natif à nous, valhalla-mobile 0.6.4, compilé depuis un clone neuf, sans manipulation | Clone de la branche **poussée sur GitHub** (aae7605), puis `npm ci`, `npx expo prebuild --clean`, compilation release iOS et Android : tout passe, sans autre commande. iOS : `spm_dependency` distant, version exacte 0.6.4. Android : Maven 0.6.4. Le binaire iOS venait du cache SwiftPM ; le téléchargement sans cache est prouvé en T1 (`swift package resolve` hors bac à sable, 48 s, empreinte vérifiée par SwiftPM) | [c1-clone-neuf.md](preuves/p03/c1-clone-neuf.md) ; ADR 0015 § 6 | **oui** |
| C2 | Ouverture en arrière-plan, écran non figé, calcul demandé pendant l'ouverture : attend puis aboutit | Release, 3 démarrages à froid par plateforme : ouverture 0,18 à 0,28 s (iOS), 0,62 à 0,74 s (Android). R1 demandé pendant l'ouverture : réussi 6 fois sur 6. Arrêt du fil JavaScript : 17 à 24 ms (iOS) ; 204 à 272 ms (Android), **dû au démarrage de l'app** : la mesure témoin sans moteur donne 202 à 296 ms | `ios-release-*.json`, `android-release-*.json` ; [témoin](preuves/p03/c2-temoin/LISEZMOI.md) ; `routingEngineSpec.test.ts` | **oui**, réserve Android ci-dessous |
| C3 | Itinéraire calculé hors ligne, magenta, distance et durée | Forêt de Haye : tracé magenta, « 1,5 km · 6 min » (iOS), « 1,1 km · 4 min » (Android, **mode avion**, icône visible) | `p03-ios-2-itineraire.png`, `p03-android-2-itineraire-avion.png`, `p03-ios-4-liaison.png`, `p03-android-4-liaison.png` | **oui** (iOS sans vrai mode avion) |
| C4 | Réglage ADR 0002 : `mountain`, `use_roads: 0`, `through` | Requête construite par `buildRouteRequest` ; `break` aux extrémités, `through` entre, `fr-FR`, kilomètres. Requêtes réelles gardées | `routeRequestSpec.test.ts` ; [c5/requetes/](preuves/p03/c5/requetes/) | **oui** |
| C5 | Les 5 références : mêmes tracés dans l'app que sur le Mac | iOS et Android (3 passages chacun) contre Valhalla 3.9.1 sur le Mac (Docker), même paquet v3 (SHA-256 `7fa29249…7a44`) : même nombre de points, écart 0,0, même distance. R1 20,532 km ; R2 35,172 km ; R3 26,981 km ; R4 42,123 km ; R5 40,353 km. Rejouable : `python3 -I c5/comparer.py` → « TOUS IDENTIQUES » | [comparaison-C5.md](preuves/p03/comparaison-C5.md) ; [c5/LISEZMOI.md](preuves/p03/c5/LISEZMOI.md) | **oui** |
| C6 | Erreurs en français, jamais de plantage | Hors zone, aucun chemin, moteur indisponible, zone illisible, échec : chacun a son titre et son texte. Codes réels de Valhalla relevés sur les deux simulateurs (171, 442, rejets du module). Un rejet imprévu ne bloque plus l'écran | `p03-ios-3-hors-zone.png`, `p03-android-3-hors-zone.png` ; `fixtures/`, `routeResponseSpec.test.ts`, `RouteCreationT4Testeur.test.tsx` | **oui** |
| C7 | 30 km, 5 points, moins de 1 s (indicatif) | **R2 réduit à 5 points** (départ, 3 intermédiaires, arrivée : 32,257 km), 10 calculs : médianes 8 à 8,5 ms (iOS), 7,9 à 17,5 ms (Android). Maximum isolé 45,7 ms | `ios-release-*.json`, `android-release-*.json` (clé `c7`) | **oui (indicatif)** |
| C8 | Poids ajouté : 50 Mo au plus | Vrai téléphone Android (arm64 seul) : **+7,7 Mo**. iPhone (binaire arm64 seul) : **+12,4 Mo**. APK universel 4 architectures : +30,0 Mo. `.app` du simulateur (deux architectures) : +26,9 Mo | [c8-poids.md](preuves/p03/c8-poids.md) | **oui** |
| C9 | `verify` passe, enveloppe testée avec un moteur simulé, CI verte | 62 suites, 576 tests. Moteur simulé dans `jest.setup.js` et par un faux module passé à `core/routing/` | run 40521238435 (`success`) | **oui** |
| C10 | Parcours Maestro : mode avion, deux points, itinéraire et distance | `e2e/p03-itineraire-hors-ligne.yaml` : Android release en mode avion, EXIT 0 ; iOS release, EXIT 0 (sans mode avion) | [c10-maestro.txt](preuves/p03/c10-maestro.txt) | **oui** |

Rappel : « R2 complet » (35,172 km, un point tous les 2 km) sert à C5 ;
« R2 à 5 points » (32,257 km) sert à C7, comme le demande la spec.

## Ce qui a été construit

- **T1, essai jetable et ADR 0015.** La cause du blocage SwiftPM de
  l'essai 1 est trouvée : le bac à sable du terminal de Claude Code empêche
  SwiftPM de télécharger le binaire ; curl le télécharge en 1 s. Hors bac à
  sable, la forme normale marche ; dans le bac à sable aussi, une fois le
  binaire en cache. Un clone neuf compile et calcule sur les deux
  plateformes (branche locale jetable `claude/p03-essai-installation`).
- **T2, module natif** `mobile/modules/valhalla-route/` : `open`, `close`,
  `route`, JSON brut, un verrou, codes `ERR_ENGINE_NOT_OPEN`,
  `ERR_ZONE_UNREADABLE`, `ERR_ENGINE`. Sorties réelles des deux
  simulateurs gardées dans `src/core/routing/fixtures/`.
- **T3, cycle de vie** : `core/routing/` (requête, réponse, sortes
  d'erreur, moteur à file d'attente) ; `shared-data/routing/`, seul
  importateur du module natif (ESLint le vérifie) ; ouverture au démarrage
  par `features/shell/RoutingEngineStarter`.
- **T4, interface** sur la Carte : bouton « Nouvel itinéraire » (seulement
  avec une zone), départ, arrivée, tracé magenta, distance et durée,
  feuille d'erreur de la maquette 52 réduite.
- **T5, preuves** : banc de mesure jetable (branche locale
  `claude/p03-banc`), mesures release, comparaison au Mac, clone neuf,
  poids, Maestro, captures.
- **T6, comparaison aux maquettes** : 3 écarts bloquants, 3 pour plus
  tard, 7 mineurs.
- **T7, correction des 3 bloquants** : trait de liaison en pointillés entre
  un marqueur posé hors chemin et le bout du tracé (décision du pilotage) ;
  bouton de recentrage sous la bulle d'aide sur petit écran ; point refusé
  gardé visible au-dessus de la feuille d'erreur. Preuves en release : `p03-ios-4-liaison.png`, `p03-android-4-liaison.png` (pointillés ronds sous le tracé), `p03-iphone-se-bulle.png`, `p03-iphone-se-hors-zone.png` (écran d'iPhone SE, 375 × 667 points, sous iOS 26.5 : le simulateur « iPhone SE » existant est en iOS 15.2, trop ancien pour l'app), `p03-android-360-bulle.png`, `p03-android-360-hors-zone.png` (émulateur réglé en 360 × 640 dp). Deux allers-retours avec le relecteur : l'ordre réel des couches de MapLibre, puis sa liste d'attente vidée sur iOS. Le parcours Maestro reçoit maintenant une position simulée au lancement sur Android.

Décisions prises dans la phase : une durée s'affiche au moins « 1 min » ;
un point touché après l'arrivée remplace l'arrivée ; la liaison n'est
comptée ni dans la distance ni dans la durée ; aucun seuil de refus d'un
point loin d'un chemin.

## Ce qui n'est pas vérifié

- **Un vrai téléphone** : temps d'ouverture du moteur, temps de calcul,
  arrêt du fil JavaScript au démarrage (≈ 0,2 s sur l'émulateur Android,
  dû au démarrage de l'app d'après la mesure témoin ; un petit effet du
  moteur n'est pas exclu, 3 passages seulement), poids réel téléchargé
  depuis les stores, mémoire.
- **iOS sans réseau** : pas de vrai mode avion sur le simulateur. Le
  calcul n'utilise pas le réseau (même chemin de code qu'Android, prouvé
  en mode avion).
- **Le téléchargement du binaire SwiftPM sans cache, dans le bac à
  sable** : il bloque (cause connue). Prouvé hors bac à sable en T1 ; la
  règle pour les agents est dans l'ADR 0015 § 6.
- **Les durées et les manœuvres** des 5 références ne sont pas comparées
  au Mac : seulement les coordonnées et la distance.
- **Le code 170** (régions non reliées) n'a pas pu être provoqué ; le 442
  ne l'est qu'avec un point isolé et `minimum_reachability: 1`.
- Le parcours Maestro touche des points par pourcentage d'écran : il
  dépend de la position de départ et du zoom d'ouverture.

## Écarts restants, non bloquants

Détail dans la [comparaison T6](../../design/comparaisons/p03-t6.md).

- **Phase 4** : la barre d'onglets reste visible pendant la création (les
  maquettes 10 et 52 la prévoient en plein écran) ; la pose « se gratte
  le casque » du vététiste et la scène de la maquette 52.
- **Avant la phase 8** : le tracé est probablement dessiné par-dessus le
  point bleu de position.
- Mineurs : espace fine avant l'unité, écart entre « Distance » et
  « Durée », ombres, halo du point refusé, étiquette « Hors de la zone »,
  pictogramme « + » sur « Nouvel itinéraire », « Retirer ce point » en lien
  quand « Relier à la main » arrivera.
- Le texte hors zone dit « aucune zone de RutaPulse » sans lire le
  catalogue : vrai tant que Nancy est la seule zone.
- Jest affiche toujours « A worker process has failed to exit
  gracefully » (déjà vu en phase 2).

## Questions en attente d'Émilien

1. La liaison entre un marqueur et le tracé doit-elle compter dans la
   distance, la durée, le suivi et le GPX exporté ? En phase 3 : non, on
   affiche les chiffres du moteur. À trancher avant la phase 8.
2. Au-delà de quelle distance d'un chemin l'app doit-elle refuser un point
   plutôt que tracer une longue liaison ? Proposition du designer : environ
   200 m, avec la feuille « Aucun chemin trouvé ». Rien n'est codé.

## Ce qui a été appris sur les agents

- **Chercher la cause avant le contournement.** L'essai 1 avait contourné
  le blocage SwiftPM par une copie locale de 91 Mo. Trois commandes
  (SwiftPM dans le bac à sable, curl, SwiftPM hors bac à sable) ont montré
  que l'outil de l'agent était en cause, pas la bibliothèque. La solution
  propre était la forme normale.
- **Les limites de l'agent font partie de l'environnement.** Le bac à
  sable change le comportement des outils réseau. La règle est écrite dans
  l'ADR 0015 : un agent bloqué le signale, il ne contourne pas.
- **Le relecteur lit le code natif des bibliothèques.** Deux défauts de
  T7 n'étaient visibles dans aucun test Jest : l'ordre réel des couches de
  MapLibre et sa liste d'attente vidée sur iOS. Le relecteur les a trouvés
  dans le code Objective-C de MapLibre RN.
- **Les tests du testeur, écrits d'après la spec, trouvent ce que ceux du
  développeur ratent** : un rejet imprévu qui bloquait l'écran (T4).
- **Une mesure témoin tranche mieux qu'un avis.** Le pilotage a refusé
  « cause non attribuée » pour l'arrêt Android : la mesure sans moteur a
  réglé la question en 3 démarrages.
- **Deux allers-retours suffisent** sur chaque tâche de code (T4 et T7 en
  ont utilisé deux). Les comptes rendus précis (fichier, ligne, scénario
  qui casse, correction) ont été corrigés du premier coup.
- **Un scénario Maestro peut modifier l'état** : `carte-hors-ligne`
  supprime la zone. Après plusieurs cycles de mode avion, l'émulateur
  avait perdu son Wi-Fi ; la zone n'a été rétablie qu'en coupant
  « Wi-Fi seulement ». Vérifier l'empreinte de la zone après.
- **Changement de pilote en cours de phase** : deux sessions ont donné des
  consignes contradictoires. La règle suivie : continuer le travail, et ne
  basculer qu'après la confirmation de la session qui a lancé la phase.

## À reporter dans PILOTAGE.md

- Phase 3 terminée sur la branche `claude/adoring-williamson-4f81fd`, à
  fusionner après relecture d'Émilien. 10 critères tenus, CI verte.
- ADR 0015 accepté le 27 octobre 2026 : module natif `valhalla-route`
  (open, close, route) ; `shared-data/` seul importateur d'un module natif
  ; distribution iOS par `spm_dependency` distant.
- Le blocage SwiftPM de l'essai 1 venait du bac à sable de Claude Code.
  Ne pas vider `~/Library/Caches/org.swift.swiftpm` sur le Mac.
- Question ARM de la phase 1 réglée : tracés identiques app et Mac sur
  les 5 références.
- Décisions : durée affichée au moins « 1 min » ; trait de liaison en
  pointillés, non compté dans la distance.
- En attente d'Émilien : liaison dans la distance et le GPX ; seuil de
  refus d'un point loin d'un chemin.
- À vérifier sur un vrai téléphone : ouverture du moteur et arrêt du fil
  JavaScript au démarrage (Android) ; temps de calcul ; mémoire.
- Phase 4 : création en plein écran (sans barre d'onglets) ; scène de la
  maquette 52. Avant la phase 8 : tracé sous le point bleu.
- Branches locales jetables, non poussées : `claude/p03-essai-installation`,
  `claude/p03-banc`.
