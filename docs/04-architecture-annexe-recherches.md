# Étape 3b — Annexe : détail des recherches

> 19 octobre 2026. Détail des solutions comparées pour les 6 risques de
> [docs/03](03-cadrage-produit.md), avec les sources. La synthèse lisible est
> dans [docs/04-architecture.md](04-architecture.md).
>
> Règle suivie : un chiffre ou une date vient d'une source citée. Quand je
> n'ai pas pu vérifier un point, c'est écrit « non vérifié ». Les dates de
> version viennent de GitHub, de npm (le registre des paquets JavaScript) ou
> de Maven Central (le registre des paquets Android), consultés le
> 19 octobre 2026.

## Mots utilisés

- OSM (OpenStreetMap) : la carte libre et collaborative du monde. Ses
  données sont sous licence ODbL (Open Database License, licence de base de
  données ouverte) : usage gratuit, mention « © OpenStreetMap » obligatoire.
- Tuile : un carré de carte. Une carte est découpée en milliers de tuiles.
- PMTiles : un format qui range toutes les tuiles d'une zone dans un seul
  fichier.
- SDK (kit de développement) : une bibliothèque fournie pour une plateforme.
- Étiquette OSM (tag) : une information attachée à une voie, par exemple
  `surface=gravel` (surface en gravier).
- MNT (modèle numérique de terrain) : une grille d'altitudes.

---

## Risque 1 — Calcul d'itinéraire VTT sur le téléphone, sans réseau

### Solutions comparées

| Solution | Licence | Dernière version | Android | iOS | Coût |
|---|---|---|---|---|---|
| **Valhalla** (moteur de calcul en C++) | MIT | 3.9.1 du 6 oct. 2026 [1] | via valhalla-mobile | via valhalla-mobile | 0 |
| **valhalla-mobile** (Valhalla compilé pour mobile, par Rallista) | MIT | 0.6.4 du 6 oct. 2026 [2] | oui, paquet Maven | oui, Swift Package Manager (gestionnaire de paquets d'Apple) | 0 |
| BRouter (moteur réputé pour le vélo) | MIT | 1.7.10 du 17 juil. 2026 [3] | oui (Java) | **non** : aucun portage iOS trouvé [4] | 0 |
| GraphHopper hors ligne | non vérifié | portage iOS « expérimental » annoncé en 2014, rien de récent trouvé [5] | ancien | non | — |
| Routeur maison en TypeScript | à nous | à écrire | oui | oui | 0 |
| openrouteservice, service en ligne (repli) | service gratuit avec clé | moteur 10.1.0 du 14 oct. 2026 [6] | en ligne | en ligne | 0 dans le quota |

### Ce que dit la documentation de Valhalla

- Profil vélo `bicycle_type` avec la valeur `mountain` : « vélo adapté à la
  plupart des surfaces », vitesse de base 16 km/h. Réglages `use_roads`,
  `use_hills`, `avoid_bad_surfaces` [7].
- Instructions écrites disponibles en français (`fr-FR`) [7].
- Profil d'altitude : paramètre `elevation_interval`, avec 30 m conseillés.
  Pas de dénivelé total fourni : il faudra le calculer [7].
- L'action `trace_attributes` donne, voie par voie : `surface`, `use`
  (exemples : `road`, `track`, `cycleway`, `mountain_bike`, `footway`),
  `sac_scale` (difficulté de randonnée), pentes, identifiant OSM de la voie
  (`way_id`) [8].
- L'étiquette `mtb:scale` (difficulté VTT) n'est **pas** lue par le script
  qui prépare les données de Valhalla. Le mot « mtb » n'y apparaît que pour
  les réseaux d'itinéraires VTT [9].

### Ce que dit valhalla-mobile

- « Une version iOS et Android de Valhalla ». Actions disponibles sur les
  deux plateformes : `route`, `trace_route`, `trace_attributes`, `height`,
  `sources_to_targets`. Tout tourne sur des tuiles de calcul téléchargées
  sur le téléphone [10].
- Releases (versions publiées) régulières en 2026 : 0.3.1 (25 janv.),
  0.4.0 (13 févr.), 0.5.0 (20 mars), 0.5.1 (10 avr.), 0.6.0 à 0.6.3 (août),
  0.6.4 (6 oct.) [2].
- Petite communauté : 80 étoiles et 6 tickets ouverts sur GitHub [11].
- iOS : installation documentée seulement par Swift Package Manager. Le
  README (fichier de présentation) parle aussi de compiler soi-même un
  `xcframework` (bibliothèque iOS précompilée) [12]. **Non vérifié** :
  l'intégration dans un projet Expo, qui utilise CocoaPods (autre
  gestionnaire de paquets iOS). React Native sait dépendre d'un paquet Swift
  depuis la 0.75, avec des contraintes d'édition de liens [13].
- **Non vérifié** : taille ajoutée à l'app, mémoire utilisée, temps de
  calcul sur téléphone. À mesurer par l'essai 1.
- Ferrostar (SDK de navigation qui utilise Valhalla) existe, mais je n'ai pas
  trouvé de paquet React Native publié sur npm [14]. Écarté pour la v1.

### Repli en ligne : openrouteservice

- Offre gratuite : 2 000 calculs d'itinéraire par jour, 40 par minute.
  **Lu via un moteur de recherche** : la page des offres [15] se charge en
  JavaScript et je n'ai pas pu la lire directement.
- Limites lues directement : 50 points de passage au plus, 6 000 km au plus
  pour le vélo [16].
- **Non vérifié** dans la documentation officielle : le nom exact du profil
  VTT (`cycling-mountain` cité sur les forums) et la langue française des
  instructions [17].
- Demande une clé personnelle. Le dépôt est public : la clé ne doit jamais y
  être écrite.

### Conclusion du risque 1

Recommandation : Valhalla sur le téléphone via valhalla-mobile, enveloppé
dans un petit module natif Expo. Repli si l'essai échoue : calcul en ligne
par openrouteservice, et création hors ligne reportée en V2.

**Risque restant : élevé** tant que l'essai 1 n'est pas réussi. La brique
existe et vit, mais personne n'a documenté son usage depuis React Native.

---

## Risque 2 — Cartes hors ligne

### Solutions comparées

| Solution | Licence | Maintenance | Android / iOS | Coût | Hors ligne permis ? |
|---|---|---|---|---|---|
| **MapLibre React Native** (affichage de carte) | MIT | 11.5.0 du 4 oct. 2026 [18] | oui / oui | 0 | outil, pas une source |
| **Planetiler** (fabrique les tuiles sur l'ordinateur à partir d'un extrait OSM) | Apache 2.0 | 0.10.2 du 29 mars 2026 [19] | — | 0 | oui, c'est nous qui produisons |
| Protomaps (fichier PMTiles du monde, refait chaque jour) | données ODbL, code BSD-3 | builds (versions construites) quotidiens [20] | — | 0 | oui, en copiant chez soi |
| OpenFreeMap (serveur de tuiles gratuit) | données ODbL | conditions du 14 oct. 2026 [21] | — | 0 | oui, ≤ 3 000 tuiles ou 50 Mo par téléchargement, ≤ 4 requêtes en parallèle [21] |
| tile.openstreetmap.org | — | — | — | 0 | **non**, interdit [22] |
| MapTiler Cloud | offre gratuite non commerciale [23] | — | — | 0 puis payant | clause hors ligne non lue (texte coupé) |
| Géoplateforme IGN (cartes de l'État) | Licence ouverte Etalab depuis 2021 [24] | — | — | 0 | limites de téléchargement en masse **non trouvées** |

### Points vérifiés

- MapLibre React Native v11 : uniquement la « New Architecture » (nouvelle
  architecture de React Native), React Native ≥ 0.80, Expo ≥ 54. Ne marche
  pas dans Expo Go (l'app de démonstration d'Expo) : il faut une version de
  développement [25] [26].
- Téléchargement de zones par `OfflineManager.createPack` (zoom mini et maxi,
  limites de la zone) [27].
- MapLibre Native (le moteur sous MapLibre React Native) lit le format
  PMTiles depuis Android 11.8.0 et iOS 6.10.0 [28]. **Non vérifié** : la
  lecture d'un fichier PMTiles local depuis MapLibre React Native v11.
- Schéma OpenMapTiles (organisation des données dans les tuiles, utilisé par
  OpenFreeMap et Planetiler) : la couche des voies porte `surface`,
  `bicycle` et `mtb_scale`. **Pas de courbes de niveau** [29].
- MapLibre Native ne calcule pas les courbes de niveau : une proposition a
  été refusée en mai 2026 [30]. Il faut donc les fabriquer à l'avance.
- MapLibre Native sait afficher un ombrage du relief à partir d'un MNT en
  tuiles. Source possible : Mapterhorn, tuiles d'altitude gratuites au
  format PMTiles, code BSD-3, données de licences variées [31].
- Planetiler écrit directement des fichiers PMTiles, avec le profil
  OpenMapTiles. Il faut alors afficher « © OpenMapTiles » [19].

### Hébergement des fichiers de zone, sans coût

| Solution | Limites | Coût |
|---|---|---|
| **GitHub Releases** (fichiers joints à une version du dépôt) | fichier < 2 Gio, 1 000 fichiers par version, pas de limite de bande passante [32] | 0 |
| Cloudflare R2 (stockage en ligne) | 10 Go par mois gratuits, sortie gratuite [33] | 0 dans la limite |

### Conclusion du risque 2

Recommandation : fabriquer nous-mêmes, sur le Mac, un fichier de carte par
zone (Planetiler + relief + courbes), l'héberger sur GitHub Releases, et
l'afficher avec MapLibre React Native. En ligne, hors des zones
téléchargées, la carte peut venir d'OpenFreeMap, qui utilise le même schéma.

**Risque restant : moyen.** La lecture d'un PMTiles local et la fabrication
des courbes de niveau sont à éprouver (essai 3).

---

## Risque 3 — Altitude

| Source | Licence | Précision | Hors ligne | Remarque |
|---|---|---|---|---|
| **Tuiles d'altitude de Valhalla** (format HGT) | données ouvertes, accès sans compte AWS [34] | non chiffrée par la source | oui | Valhalla s'en sert pour les pentes et le profil [7] [35] |
| Copernicus GLO-30 | licence Copernicus, gratuite [36] | 30 m | oui | modèle de **surface** : inclut bâtiments et végétation [36] |
| **IGN RGE ALTI 5 m** | Licence ouverte Etalab 2.0 [37] | 5 m, lidar (laser aéroporté) | oui | France seulement, terrain nu |
| Mapterhorn | code BSD-3, données variées [31] | non vérifié pour la France | oui | idéal pour l'ombrage du relief |

Points importants :
- Valhalla renvoie une liste d'altitudes le long de l'itinéraire, pas le
  dénivelé total [7]. Nous calculerons le dénivelé avec un lissage (sinon le
  bruit des mesures gonfle le dénivelé).
- Copernicus mesure le haut des arbres en forêt [36]. C'est gênant pour le
  VTT, qui roule souvent en forêt.

Recommandation : commencer avec les tuiles d'altitude standard de Valhalla.
L'essai 1 compare le dénivelé à une référence externe. Si l'écart dépasse
10 %, passer au RGE ALTI de l'IGN converti au format HGT.

**Risque restant : faible.**

---

## Risque 4 — Type de voie et difficulté, en France

Mesures taginfo (statistiques des étiquettes OSM) pour la France, données
du 18 octobre 2026 [38] [39] [40] [41] :

| Voies | Nombre | `surface` | `tracktype` | `smoothness` | `sac_scale` | `mtb:scale` |
|---|---|---|---|---|---|---|
| `highway=track` (pistes) | 2 037 306 | 16,0 % | 33,9 % | 3,2 % | — | 1,4 % |
| `highway=path` (sentiers) | 1 024 969 | 28,7 % | — | 4,5 % | 7,4 % | 4,0 % |

Toutes voies confondues, `mtb:scale` est présent sur 72 284 voies en
France [38].

Ce que j'en conclus :
- **Type de voie (route, piste, sentier)** : toujours connu, car chaque
  voie OSM a une étiquette `highway`. Valhalla le renvoie (`use`) [8].
- **Surface** : connue sur une minorité de voies (16 à 29 %).
- **Difficulté VTT** : rare (1 à 4 % des pistes et sentiers). Le cadrage dit
  « difficulté quand la carte la connaît » : l'app affichera souvent
  « inconnue ».
- Valhalla ne garde pas `mtb:scale` [9]. Il faudra une petite table
  « identifiant de voie → difficulté », fabriquée avec la zone.

**Risque restant : faible**, puisque le cadrage accepte une difficulté
inconnue. Le résultat sera pauvre sur la difficulté : à dire aux
utilisateurs.

---

## Risque 5 — Suivi téléphone verrouillé, une seule notification

| Solution | Licence | Maintenance | Android | iOS | Coût | Verdict |
|---|---|---|---|---|---|---|
| **expo-location, nouvelle API `next`** | MIT [42] | Expo SDK 58 du 15 oct. 2026 [43] ; API en **bêta** [44] | oui | oui | 0 | retenu |
| **expo-widgets** (Live Activities : bandeau en direct sur l'écran verrouillé d'iOS) | MIT [42] | Expo SDK 58 [43] | notifications personnalisées | oui | 0 | retenu pour iOS, à éprouver |
| expo-notifications (notifications locales) | MIT [42] | Expo SDK 58 | oui | oui | 0 | repli iOS |
| expo-live-activity (Software Mansion) | — | **archivé** le 1er juin 2026 [45] | — | — | — | rejeté |
| Notifee | — | **archivé** en avril 2026 [46] | — | — | — | rejeté |
| react-native-background-geolocation (Transistor Software) | commerciale | non vérifié | oui | oui | licence payante pour les versions finales Android ; prix vu chez un revendeur : 399 USD, non vérifié [47] | rejeté (coût) |

Points vérifiés :
- Android : le service de premier plan (foreground service, tâche qui
  continue avec une notification visible) affiche une notification. Rappeler
  `ensureBackgroundSessionStarted` « re-poste sa notification avec les
  nouvelles options » : c'est le moyen de la mettre à jour [44]. Le service
  doit être **démarré** quand l'app est au premier plan [44].
- Android 14 et plus : permission `FOREGROUND_SERVICE_LOCATION`. Android 13
  et plus : sans la permission de notifier, le suivi marche mais la
  notification ne s'affiche pas [44] [48].
- iOS : mode d'arrière-plan `location` et permission de localisation [44].
- iOS : réutiliser le même identifiant de notification **remplace** la
  précédente [49]. Selon une source secondaire, la nouvelle notification
  alerte à nouveau [49]. Le niveau `passive` (sans son ni allumage d'écran)
  existe dans expo-notifications [50].
- Expo Go ne permet pas la localisation en arrière-plan : il faut une
  version de développement [48].

Non vérifié :
- Que la notification Android se met bien à jour quand l'app est en
  arrière-plan.
- Les limites d'Apple sur la fréquence de mise à jour d'une Live Activity
  depuis l'app en arrière-plan. La page d'Apple n'a pas pu être lue.
- Si les Live Activities marchent avec un compte Apple gratuit (elles
  demandent un « App Group », groupe d'apps qui partagent des données [51]).

**Risque restant : moyen.** Les briques existent, mais l'API Android est en
bêta et la partie iOS n'est pas éprouvée.

---

## Risque 6 — Batterie

Mesures publiées :
- OsmAnd (app de navigation hors ligne) : écran allumé 6 %/h, GPS 5 %/h,
  navigation écran allumé 12 %/h, enregistrement écran éteint 6 %/h. OsmAnd
  prévient que cela varie selon l'appareil [52].
- Témoignages de cyclistes : 14 à 20 %/h en navigation écran allumé [53].
- Conseils Android : précision et fréquence élevées coûtent cher ; garder
  les mises à jour de quelques secondes pour l'usage au premier plan ;
  regrouper les positions quand on peut attendre [54].

Ordre de grandeur pour une sortie de 4 h : 25 % écran verrouillé, 50 à 80 %
écran allumé. C'est jouable mais à mesurer sur nos téléphones.

**Risque restant : moyen.** Mesure dans l'essai 2.

---

## Vérifications pour la stack (ensemble des technologies)

| Brique | Version | Date | Licence | Source |
|---|---|---|---|---|
| Expo SDK 58 (React Native 0.88) | 58.0.16 | SDK publié le 15 oct. 2026 | MIT | [43] [55] |
| Expo Router (navigation par fichiers) | 58.0.24 | 19 oct. 2026 | MIT | [56] |
| MapLibre React Native | 11.5.0 | 4 oct. 2026 | MIT | [18] |
| valhalla-mobile | 0.6.4 | 6 oct. 2026 | MIT | [2] |
| @tanstack/react-query | 5.104.5 | 19 oct. 2026 | MIT | [57] |
| @tanstack/react-store | 0.11.2 | 29 sept. 2026 | MIT | [57] |
| @tanstack/react-db | 0.5.11 | 18 oct. 2026 | MIT | [57] [58] |
| @tanstack/expo-db-sqlite-persistence | 0.2.36 | 18 oct. 2026 | non vérifié | [59] |
| @tanstack/react-pacer | 0.24.1 (bêta) | 5 oct. 2026 | non vérifié | [57] [60] |
| @tanstack/react-form | 1.33.5 | 11 août 2026 | non vérifié | [57] |
| @testing-library/react-native | 14.1.0 | 8 oct. 2026 | non vérifié | [61] |
| Maestro (tests de bout en bout) | CLI 2.11.0 | 29 sept. 2026 | Apache 2.0 | [62] [63] |
| Detox (autre outil de bout en bout) | 20.51.4 | 16 juin 2026 | non vérifié | [64] |
| @tmcw/togeojson (lecture GPX) | 7.1.3 | 9 oct. 2026 | BSD-2 | [65] |
| @turf/turf (calculs géographiques) | 7.4.0 | 3 août 2026 | non vérifié | [66] |

Autres faits utiles :
- La documentation de React Native recommande de démarrer avec un framework
  (cadre de travail) comme Expo [67].
- Expo Modules API : écrire un module natif en Swift et Kotlin [68].
- Expo SDK 58 est sorti il y a 4 jours ; SDK 57 utilise React Native 0.86
  [69].
- EAS Build (service de compilation d'Expo) : offre gratuite de 15 versions
  Android et 15 versions iOS par mois ; la compilation sur sa propre machine
  est possible [70].
- CocoaPods passerait en lecture seule le 2 décembre 2026, selon un blog
  d'éditeur ; **non vérifié** à la source [13].
- Compte Apple gratuit : app valable 7 jours, 3 appareils, 3 apps par
  appareil, installation par Xcode [71]. Apple Developer Program : 99 USD par
  an [72]. TestFlight (distribution de test d'Apple) demande ce programme.

## TanStack, bibliothèque par bibliothèque

| Bibliothèque | Marche en React Native ? | Utile ici ? |
|---|---|---|
| Query | oui, « conçue pour marcher directement avec React Native » [73] | oui : calcul d'itinéraire (asynchrone), catalogue des zones, téléchargements. Attention : par défaut, une requête est mise en pause sans réseau ; régler `networkMode: 'always'` pour les appels locaux [74] |
| Store | oui, utilisable hors des composants [75] | oui : état du tracé en cours (avec annulation) et état du suivi, mis à jour par la tâche GPS hors de l'écran |
| DB | oui, avec persistance SQLite pour Expo [58] [59] | oui pour « Mes itinéraires » ; version 0.x, donc à isoler |
| Pacer | non mentionné [60], code JavaScript pur | oui, petit usage : limiter la fréquence des mises à jour (écran, notification, recalcul) ; en bêta |
| Form | oui, « devrait marcher directement » [76] | **non en v1** : un seul champ (renommer) |
| Router | **non** : React et ReactDOM seulement [77] | non : Expo Router |
| Virtual | non vérifié pour React Native | non : listes courtes, `FlatList` suffit |
| Table, Start | pour le web | non |

## Sources

1. Valhalla, dernière release : https://api.github.com/repos/valhalla/valhalla/releases/latest — licence MIT : https://raw.githubusercontent.com/valhalla/valhalla/master/COPYING
2. valhalla-mobile sur Maven Central : https://repo1.maven.org/maven2/io/github/rallista/valhalla-mobile/ — releases : https://github.com/Rallista/valhalla-mobile/releases
3. BRouter, release : https://api.github.com/repos/abrensch/brouter/releases/latest — dépôt : https://api.github.com/repos/abrensch/brouter
4. BRouter, site : https://brouter.de/brouter/index.html — Kurviger, guide du calcul hors ligne (la page ne dit pas « Android seulement » ; je le déduis de l'installation de BRouter par Google Play) : https://docs.kurviger.com/app/manual/offline_routing
5. GraphHopper pour iOS (2014) : https://lists.openstreetmap.org/pipermail/graphhopper/2014-November/001357.html — forum Android : https://discuss.graphhopper.com/t/offlne-routing-on-android/9176
6. openrouteservice, release : https://api.github.com/repos/GIScience/openrouteservice/releases/latest
7. Valhalla, API de calcul : https://valhalla.github.io/valhalla/api/route/api-reference/
8. Valhalla, API `trace_attributes` : https://valhalla.github.io/valhalla/api/map-matching/
9. Valhalla, script de préparation des données : https://raw.githubusercontent.com/valhalla/valhalla/master/lua/graph.lua
10. valhalla-mobile, page du dépôt : https://github.com/Rallista/valhalla-mobile
11. valhalla-mobile, données GitHub : https://api.github.com/repos/Rallista/valhalla-mobile
12. valhalla-mobile, README : https://raw.githubusercontent.com/Rallista/valhalla-mobile/main/README.md
13. Paquets Swift dans React Native : https://www.callstack.com/blog/integrating-swift-package-manager-with-react-native-libraries — CocoaPods (blog d'éditeur) : https://www.courier.com/blog/cocoapods-end-of-life-heres-what-to-do
14. Ferrostar sur npm : https://registry.npmjs.org/-/v1/search?text=ferrostar&size=5
15. openrouteservice, offres : https://openrouteservice.org/plans/
16. openrouteservice, limites : https://openrouteservice.org/restrictions/
17. openrouteservice, options : https://giscience.github.io/openrouteservice/api-reference/endpoints/directions/routing-options
18. MapLibre React Native, releases : https://github.com/maplibre/maplibre-react-native/releases — npm : https://registry.npmjs.org/@maplibre/maplibre-react-native/latest
19. Planetiler, release : https://api.github.com/repos/onthegomap/planetiler/releases/latest — dépôt : https://github.com/onthegomap/planetiler
20. Protomaps, téléchargements : https://docs.protomaps.com/basemaps/downloads — outil `pmtiles` : https://docs.protomaps.com/pmtiles/cli
21. OpenFreeMap, conditions : https://openfreemap.org/tos/ — accueil : https://openfreemap.org/
22. Politique des tuiles OSM : https://operations.osmfoundation.org/policies/tiles/
23. MapTiler, conditions : https://www.maptiler.com/terms/cloud/
24. Données IGN gratuites depuis 2021 : https://next.ink/brief_article/les-donnees-publiques-de-lign-libres-et-gratuites-des-le-1er-janvier-2021/
25. MapLibre React Native, démarrage : https://maplibre.org/maplibre-react-native/docs/setup/getting-started
26. MapLibre React Native, Expo : https://maplibre.org/maplibre-react-native/docs/setup/expo
27. MapLibre React Native, OfflineManager : https://maplibre.org/maplibre-react-native/docs/modules/offline-manager
28. Lettre MapLibre, janvier 2025 : https://maplibre.org/news/2025-02-03-maplibre-newsletter-january-2025/
29. Schéma OpenMapTiles : https://openmaptiles.org/schema/
30. Lettre MapLibre, mai 2026 : https://maplibre.org/news/2026-06-03-maplibre-newsletter-may-2026/
31. Mapterhorn : https://mapterhorn.com/ — accès aux données : https://mapterhorn.com/data-access/
32. GitHub Releases : https://docs.github.com/en/repositories/releasing-projects-on-github/about-releases
33. Cloudflare R2, tarifs : https://developers.cloudflare.com/r2/pricing
34. Terrain Tiles sur AWS : https://registry.opendata.aws/terrain-tiles/
35. Mapzen, altitude et vélo dans Valhalla : https://mapzen.com/blog/making-the-grade-elevation-influenced-bicycle-routing
36. Copernicus DEM sur AWS : https://registry.opendata.aws/copernicus-dem/
37. RGE ALTI 5 m : https://gee-community-catalog.org/projects/france5m/ — RGE sur data.gouv.fr : https://www.data.gouv.fr/fr/datasets/58e5842688ee386c65805755
38. taginfo France, `mtb:scale` : https://taginfo.geofabrik.de/europe/france/api/4/key/stats?key=mtb:scale
39. taginfo France, `highway=path` : https://taginfo.geofabrik.de/europe/france/api/4/tag/stats?key=highway&value=path
40. taginfo France, `highway=track` et étiquettes associées : https://taginfo.geofabrik.de/europe/france/api/4/tag/combinations?key=highway&value=track&filter=ways&sortname=together_count&sortorder=desc&rp=100&page=1
41. taginfo France, étiquettes associées à `highway=path` : https://taginfo.geofabrik.de/europe/france/api/4/tag/combinations?key=highway&value=path&filter=ways&sortname=together_count&sortorder=desc&rp=100&page=1
42. Dépôt Expo, licence MIT : https://api.github.com/repos/expo/expo
43. Expo SDK 58 : https://expo.dev/changelog/sdk-58 — journal : https://expo.dev/changelog
44. expo-location, API `next` (SDK 58) : https://docs.expo.dev/versions/v58.0.0/sdk/location-next.md
45. expo-live-activity : https://github.com/software-mansion-labs/expo-live-activity
46. Notifee archivé : https://earezki.com/ai-news/2026-04-10-notifee-is-archived-heres-a-maintained-new-architecture-drop-in-replacement/
47. Transistor Software : https://github.com/nederev/react-native-background-geolocation — prix chez un revendeur : https://www.techjockey.com/detail/transistor-software
48. expo-location : https://docs.expo.dev/versions/latest/sdk/location/
49. Apple, identifiant de notification : https://developer.apple.com/tutorials/data/documentation/usernotifications/unnotificationrequest/identifier.md — source secondaire : https://zenn.dev/donchan922/articles/4a4531b0ac5fb7
50. expo-notifications : https://docs.expo.dev/versions/latest/sdk/notifications/
51. expo-widgets : https://docs.expo.dev/versions/latest/sdk/widgets/
52. OsmAnd, batterie : https://osmand.net/docs/user/troubleshooting/general
53. Forum vélo électrique : https://forums.electricbikereview.com/goto/post?id=701556
54. Android, localisation et batterie : https://developer.android.com/develop/sensors-and-location/location/battery
55. Expo sur npm : https://registry.npmjs.org/expo/latest
56. Expo Router sur npm : https://registry.npmjs.org/-/v1/search?text=expo-router&size=3
57. Paquets TanStack sur npm : https://registry.npmjs.org/-/v1/search?text=%40tanstack%2Freact&size=50
58. TanStack DB, persistance SQLite : https://tanstack.com/db/latest/docs/guides/sqlite-persistence — dépôt : https://api.github.com/repos/TanStack/db
59. Persistance TanStack DB sur npm : https://registry.npmjs.org/-/v1/search?text=react-native-db-sqlite-persistence&size=5
60. TanStack Pacer : https://tanstack.com/pacer/latest/docs/overview
61. Testing Library sur npm : https://registry.npmjs.org/-/v1/search?text=%40testing-library%2Freact-native&size=3
62. Maestro, release : https://api.github.com/repos/mobile-dev-inc/maestro/releases/latest
63. Maestro, dépôt : https://api.github.com/repos/mobile-dev-inc/maestro
64. Detox sur npm : https://registry.npmjs.org/-/v1/search?text=detox&size=3
65. togeojson sur npm : https://registry.npmjs.org/-/v1/search?text=%40tmcw%2Ftogeojson&size=2
66. Turf sur npm : https://registry.npmjs.org/-/v1/search?text=%40turf%2Fturf&size=2
67. React Native, démarrage : https://reactnative.dev/docs/environment-setup
68. Expo Modules API : https://docs.expo.dev/modules/overview/
69. Expo SDK 58 bêta : https://expo.dev/changelog/sdk-58-beta — SDK 57 : https://expo.dev/changelog/sdk-57
70. Offres Expo : https://docs.expo.dev/billing/plans/
71. Comptes Apple : https://developer.apple.com/support/compare-memberships/
72. Apple Developer Program, inscription : https://developer.apple.com/programs/enroll/
73. TanStack Query et React Native : https://tanstack.com/query/latest/docs/framework/react/react-native
74. TanStack Query, mode réseau : https://tanstack.com/query/latest/docs/framework/react/guides/network-mode
75. TanStack Store : https://tanstack.com/store/latest/docs/overview
76. TanStack Form et React Native : https://tanstack.com/form/latest/docs/framework/react/guides/react-native
77. TanStack Router, démarrage rapide : https://github.com/TanStack/router/blob/main/docs/router/quick-start.md
