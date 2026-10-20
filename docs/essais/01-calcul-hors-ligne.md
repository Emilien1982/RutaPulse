# Essai 1 — Calcul VTT hors ligne : résultats

> Terminé le 19 octobre 2026 (verdict en tête). Spec : [01-calcul-hors-ligne-spec.md](01-calcul-hors-ligne-spec.md).
> Code jetable : `essais/01-calcul-hors-ligne/`.

## Verdict

**Création d'itinéraire hors ligne en v1 : oui, sous condition.**

- La technique marche : Valhalla tourne dans l'app Expo, sans réseau, sur
  les simulateurs Android et iOS. Le calcul est rapide, le paquet léger,
  l'app grossit peu, rien ne plante.
- Le doute porte sur la qualité des itinéraires : la distance (C4) et le
  dénivelé (C5) ne suivent pas assez les références. Entre deux points,
  Valhalla prend souvent un autre chemin (cause prouvée plus bas).
- **Condition** : Émilien juge au moins 4 itinéraires sur 5 praticables
  sur les cartes (C3). S'il les refuse, le repli en ligne ne réglerait
  probablement pas le problème : openrouteservice calcule lui aussi sur les
  données OSM. Ce point n'est pas mesuré.

| # | Critère | Attendu | Mesuré | Verdict | Preuve |
|---|---|---|---|---|---|
| C1 | Mode avion | Calcul sans réseau, Android et iOS | Android : banc complet en mode avion, réponses identiques octet pour octet à celles avec réseau. iOS : 0 octet de trafic réseau de l'app pendant le banc, mais pas de vrai mode avion (le simulateur partage le réseau du Mac) | Android **oui** ; iOS **partiel** | `app/preuves/android-avion-fin-banc.png`, `analyse/resultats/ios-nettop.txt` |
| C2 | Temps (indicatif) | 30 km, 5 points, médiane de 10 < 3 s | R2 à 5 points (32,9 km) : médiane 38,5 ms (Android), 5,9 ms (iOS). 1er calcul après ouverture : 212 ms et 123 ms | **oui (indicatif)** : le simulateur et l'émulateur utilisent le processeur du Mac | `analyse/resultats/<plateforme>/resultats.json` |
| C3 | Praticable | 4 sur 5 jugés par Émilien | En attente du jugement | **à juger** | `docs/essais/captures/R1-mac.png` à `R5-mac.png` |
| C4 | Distance ± 5 % | Chaque référence | 2 sur 4 (R2 +0,8 %, R4 +3,0 % ; R3 +7,5 %, R5 −9,2 %) ; R1 à part : −3,9 % | **non** | `analyse/resultats/ios/tableau.md` |
| C5 | D+ ± 10 % | Chaque référence | 2 sur 4 (R2 −5,0 %, R5 −9,8 % ; R3 +14,0 %, R4 +10,6 %) ; R1 à part : −5,8 % | **non** | idem |
| C6 | Français | Instructions en français | `fr-FR`, 431 instructions sur 431 en français, sur les deux plateformes | **oui** | réponses `R*.json` |
| C7 | Paquet ≤ 150 Mo | Calcul + altitude | 80 561 284 octets (76,8 Mo) | **oui** | étape 1 |
| C8 | App + 50 Mo au plus | Poids ajouté | Android, APK arm64 : +7,8 Mo (APK universel 4 architectures : +30,1 Mo). iOS, .app simulateur release : +26,6 Mo (indicatif) | **oui** | tableau C8 plus bas |
| C9 | 50 calculs sans plantage | 50 sur 50 | 50 sur 50 sur Android (2,3 s) et sur iOS (0,5 s), 0 erreur | **oui** | `resultats.json` |

**R1 est jugée à part** : sa référence est reconstruite à partir d'une
relation OSM qui a 20 sauts de plus de 100 m. Ses chiffres ne comptent pas
dans C4 et C5.

**Identique sur les trois moteurs** : les tracés calculés sur Android, iOS
et le Mac (Docker) sont identiques octet pour octet pour R1 à R5. Une seule
série de captures suffit donc.

## Étape 1 — Paquet de zone « Nancy » (19 octobre 2026)

### Contenu

| Fichier | Rôle | Taille mesurée |
|---|---|---|
| `valhalla_tiles.tar` | Tuiles de calcul Valhalla 3.9.1, avec l'altitude intégrée (16 fichiers) | 28 692 480 octets (27,4 Mo) |
| `elevation/N48/N48E005.hgt`, `N48E006.hgt` | Tuiles d'altitude HGT (grille d'altitudes), non compressées | 2 × 25 934 402 = 51 868 804 octets (49,5 Mo) |
| `zone.json` | Nom, limites, date des données OSM, tailles | 289 octets |
| **Total calcul + altitude** (tar + HGT) | | **80 561 284 octets (76,8 Mo)** ; 80 561 573 avec `zone.json` |

Instrument : `stat -f %z` (taille exacte du fichier). Le script
`fabriquer-zone.sh` mesure encore le dossier d'altitude avec `du`, qui
arrondit au bloc disque (51 871 744 octets) : à corriger.

- Zone : longitudes 5.84 à 6.52, latitudes 48.47 à 48.92.
- Données : extrait OpenStreetMap Lorraine de Geofabrik, daté du
  18 octobre 2026 à 20 h 25 (UTC).
- Piste d'économie, non testée : les HGT compressés (`.hgt.gz`), que
  Valhalla sait lire, pèseraient bien moins lourd.

### Temps de fabrication (Mac M4, Docker arm64)

| Étape | Durée |
|---|---|
| Téléchargement de l'extrait Lorraine (171 Mo) | 9,9 s (mesuré à la main, hors script) |
| Découpe de la zone (osmium) | 1,4 s |
| Frontières administratives | 0,5 s |
| Altitude (téléchargement des 2 tuiles) | 1,6 s |
| Tuiles de calcul | 5,2 s |
| Archive tar | 0,3 s |

### Preuve que le paquet calcule

`essais/01-calcul-hors-ligne/zone/verifier-zone.sh` lance `valhalla_service`
(Docker) sur le paquet seul. Requête : vélo `mountain`, `fr-FR`, une altitude
tous les 30 m, de 48.6905,6.1080 à 48.7180,6.0750 (forêt de Haye). Sortie,
relancée par la session principale :

```
distance : 6.15 km, durée estimée : 26 min
instructions (17) :
  - Pédalez vers le nord.
  - Tournez à gauche.
  - Gardez la droite à la fourche.
altitudes : 206 points (pas 30.0 m), 206 non nulles, min 270.9, max 341.0
RÉSULTAT : OK
```

### Références préparées

Fichier : `essais/01-calcul-hors-ligne/zone/references/references.json`.
Dénivelé calculé : altitude rééchantillonnée tous les 30 m, puis seuil de
5 m (hystérésis : on ne compte une montée qu'après 5 m de hausse).

| # | Nom et source | Distance | D+ annoncé | D+ du GPX | D+ avec les altitudes du paquet |
|---|---|---|---|---|---|
| R1 | Circuit VTT balisé forêt de Haye, [relation OSM 11656724](https://www.openstreetmap.org/relation/11656724) | 21,4 km | — | — (pas d'altitude) | 257 m |
| R2 | Petite Suisse Lorraine à VTT, [relation OSM 15712020](https://www.openstreetmap.org/relation/15712020) | 34,9 km (35 annoncés) | 260 m | — | 478 m |
| R3 | Forêt de Haye, [VisuGPX A7jnmrvO13](https://www.visugpx.com/A7jnmrvO13) | 25,1 km | 270 m | 359 m | 421 m |
| R4 | Rando VTT Ludres 2014, [VisuGPX 1397404889](https://www.visugpx.com/1397404889) | 40,9 km | 590 m | 575 m | 601 m |
| R5 | La Pompéenne, [VisuGPX DaKN8WtCIZ](https://www.visugpx.com/DaKN8WtCIZ) | 44,5 km | 860 m | 745 m | 783 m |

Premier constat : le dénivelé dépend beaucoup de la source et de la
méthode. L'écart avec la valeur annoncée va de −13 % à +84 %.

Décision du pilotage (19 octobre) pour le critère C5 : on compare le D+ de
l'itinéraire calculé au D+ de la référence **calculé de la même façon, avec
les altitudes du paquet** (dernière colonne). On mesure ainsi le calcul
d'itinéraire, pas les données d'altitude. Les D+ annoncés et ceux des GPX
restent ici pour information. La justesse des altitudes du paquet face à
l'IGN est une question à part, non bloquante.

## Étape 2 — Calcul sur l'émulateur Android (19 octobre 2026)

- App : Expo SDK 58.0.16, React Native 0.88.0, module local
  `valhalla-route` (Expo Modules API) qui appelle valhalla-mobile 0.6.4
  (Maven). Code : `essais/01-calcul-hors-ligne/app/`.
- Émulateur : **Pixel 6, Android 14 (API 34), arm64**. L'AVD (appareil
  virtuel Android) prévu, `Pixel_6_API_33`, est en x86_64 : il ne démarre
  pas sur un Mac Apple Silicon. Un nouvel AVD `Pixel_6_API_34_arm64` a été
  créé, avec une image système déjà installée.
- Build debug : `BUILD SUCCESSFUL in 1m 45s`. L'APK de debug pèse
  57 706 710 octets, dont `libvalhalla-wrapper.so` 7,5 Mo. Ce n'est pas la
  mesure du critère C8, qui se fera en version « release » (étape 3).
- Le paquet est copié dans les fichiers de l'app par
  `installer-zone.sh android` (`adb push`, puis `run-as`). Il n'est pas
  dans l'APK.
- Ouverture du moteur : 7 011 ms (une fois, au démarrage).

Preuve : capture `essais/01-calcul-hors-ligne/app/preuves/01-R3.png`, journal
`app/preuves/journal.txt`. Premiers calculs, 5 points de passage :

| Réf | Distance calculée | Distance de la référence | Écart | Calcul | Instructions |
|---|---|---|---|---|---|
| R1 | 11,81 km | 21,36 km | −45 % | 42 ms | 25 |
| R2 | 31,82 km | 34,89 km | −9 % | 83 ms | 44 |
| R3 | 21,68 km | 25,10 km | −14 % | 384 ms (1er appel), 70 ms ensuite | 49 |
| R4 | 27,21 km | 40,91 km | −33 % | 385 ms | 78 |
| R5 | 13,48 km | 44,46 km | −70 % | 36 ms | 42 |

Toutes les instructions sont en français (« Pédalez vers le sud-ouest. »,
« Serrez à droite dans Rue des Talintés. »). Aucun plantage.

Limite du protocole : avec 5 points seulement, Valhalla prend le plus
court entre deux points. Une boucle sinueuse est donc raccourcie (R5 :
−70 %). Les écarts mesurent surtout le manque de points, pas la qualité
du moteur. Question posée au pilotage avant l'étape 3.

## Étape 3 — Comparaison avec les références

### Sur le Mac (contrôle de la chaîne, avant les simulateurs)

Valhalla 3.9.1 dans Docker, même paquet, même requête que l'app. Points de
passage le long de la référence, environ tous les 2 km (12 à 24 points ;
limite de Valhalla pour le vélo : 50). Tableau complet :
`essais/01-calcul-hors-ligne/analyse/resultats/mac/tableau.md`.

| Réf. | Points | Distance réf. → calculée | Écart | ± 5 % | D+ réf. → calculé | Écart | ± 10 % |
|---|---|---|---|---|---|---|---|
| R1 | 12 | 21,36 → 19,94 km | −6,6 % | non | 257 → 220 m | −14,4 % | non |
| R2 | 19 | 34,89 → 35,59 km | +2,0 % | oui | 478 → 468 m | −2,1 % | oui |
| R3 | 14 | 25,10 → 26,29 km | +4,7 % | oui | 421 → 475 m | +12,8 % | non |
| R4 | 22 | 40,91 → 42,12 km | +3,0 % | oui | 601 → 665 m | +10,6 % | non |
| R5 | 24 | 44,46 → 43,13 km | −3,0 % | oui | 783 → 742 m | −5,2 % | oui |

Captures : `docs/essais/captures/R1-mac.png` à `R5-mac.png`.

### Cause des écarts de dénivelé (question du pilotage)

Script : `analyse/diagnostic-denivele.py`. Détail par tronçon :
`analyse/resultats/mac/diagnostic-denivele.md`. Chaque tracé est coupé
aux points de passage ; un tronçon est « autre chemin » si l'itinéraire
s'écarte de plus de 25 m de la référence.

| Réf. | Écart D+ | Dû aux autres chemins | Dû au seuil de 5 m | Reste |
|---|---|---|---|---|
| R1 | −37 m | −26 m (7 tronçons sur 11) | 0 m | −11 m |
| R2 | −10 m | +2 m (5 sur 18) | −10 m | −2 m |
| R3 | +54 m | +68 m (7 sur 13) | −5 m | −9 m |
| R4 | +64 m | +65 m (16 sur 21) | −5 m | +4 m |
| R5 | −41 m | −39 m (20 sur 23) | +2 m | −4 m |

Hypothèses du pilotage :
- **(a) autres chemins : cause prouvée** pour R1, R3 et R4. Exemple R3 :
  le tronçon 10 fait 3,35 km au lieu de 2,00 km, à plus de 25 m de la
  référence sur 80 % de sa longueur, avec +50 m de D+. Les tronçons où
  l'itinéraire suit la référence ont presque le même D+.
- **(b) pas d'altitude : écartée.** Les deux tracés sont rééchantillonnés
  de la même façon (pas mesuré 29,1 à 29,7 m). L'écart reste du même signe
  avec des seuils de 0, 2, 5 et 10 m.
- **(c) hors zone ou sans altitude : écartée.** 0 point hors zone, 0
  altitude manquante.
- **(d) autres : faibles.** Sur les tronçons communs, l'altitude lue sur la
  trace et sur l'itinéraire diffère de 0,02 à 0,35 m en moyenne : pas de
  décalage sur la pente. Les petits allers-retours de l'itinéraire autour
  d'un point (R3, R4, R5) font partie des « autres chemins ».
- **R1** : la référence est reconstruite à partir d'une relation OSM et
  présente 20 sauts de plus de 100 m. Son écart vient aussi des autres
  chemins, mais la référence elle-même reste douteuse.

Conclusion : le dénivelé mesure bien le calcul d'itinéraire. Entre deux
points espacés de 2 km, Valhalla choisit souvent un autre chemin que la
référence, et ce chemin monte plus ou moins. Le critère n'est pas modifié.

### Calibration du profil VTT (demande du pilotage)

Script : `analyse/calibrer.py`. Détail : `analyse/resultats/calibration.md`.
Réglages par défaut de Valhalla pour le vélo : `use_roads`, `use_hills`
et `avoid_bad_surfaces` valent 0,25 (documentation « latest », non figée
sur 3.9.1). Quatre combinaisons testées en plus du réglage actuel.

Règle de choix, fixée avant les mesures : meilleure part moyenne de
l'itinéraire à moins de 25 m de la référence (R2 à R5) ; à moins de
2 points d'écart, plus petit écart moyen de D+.

| Combinaison | Part à < 25 m (moy. R2–R5) | Écart D+ moyen (abs.) | Distance ± 5 % (R2–R5) | D+ ± 10 % (R2–R5) |
|---|---|---|---|---|
| Actuel (tout à 0,25) | 62,3 % | 7,7 % | 4/4 | 2/4 |
| **A : `use_roads` 0** | **65,0 %** | 9,9 % | 2/4 | 2/4 |
| B : `avoid_bad_surfaces` 0 | 62,3 % | 7,7 % | 4/4 | 2/4 |
| C : `use_hills` 0,5 | 62,5 % | 8,9 % | 2/4 | 2/4 |
| D : A + B | 65,0 % | 9,9 % | 2/4 | 2/4 |

**Retenue : A (`use_roads: 0`)**, par la règle. Le gain est petit
(+2,7 points) et A tient moins bien la distance que le réglage actuel. R4
ne change avec aucun réglage : ses points de passage imposent le chemin.
Les captures `docs/essais/captures/R*-mac.png` sont refaites avec A.

### Verdict C4 et C5 sur le Mac, réglage A

Mêmes moteur et tuiles que sur les simulateurs : les résultats des
simulateurs seront comparés à ceux-ci (étape suivante).

| Réf. | Distance | ± 5 % | D+ | ± 10 % |
|---|---|---|---|---|
| R2 | +0,8 % | oui | −5,0 % | oui |
| R3 | +7,5 % | non | +14,0 % | non |
| R4 | +3,0 % | oui | +10,6 % | non |
| R5 | −9,2 % | non | −9,8 % | oui |
| R1 (à part) | −3,9 % | oui | −5,8 % | oui |

- **C4 (distance ± 5 %) : non atteint.** 2 références sur 4 fiables
  (R2, R4).
- **C5 (D+ ± 10 %) : non atteint.** 2 sur 4 (R2, R5).
- **R1 est jugée à part** : sa référence, reconstruite à partir d'une
  relation OSM, a 20 sauts de plus de 100 m. Ses bons chiffres ne
  comptent pas dans le verdict.
- Cause (prouvée plus haut) : entre deux points, Valhalla prend souvent un
  autre chemin que la référence. Sur R5, on voit de longues lignes droites
  (laies forestières) et de petits allers-retours autour des points de
  passage.

### Sur les simulateurs (builds release)

- Requête de l'app égale à celle du Mac (`requete-type.json`, réglage
  `use_roads: 0`, points tous les 2 km), vérifiée pour R1 à R5.
- Banc lancé sans clic (fichier `banc-demande.json` dans les documents de
  l'app). Résultats : `analyse/resultats/android/`, `android-avion/`, `ios/`.
- Émulateur Android 14 arm64 (Pixel 6) ; simulateur iPhone 17, iOS 26.5.

| Mesure | Android (release) | iOS (release) |
|---|---|---|
| Ouverture du moteur (à froid) | 1 110,8 ms | 38 ms (ouverture différée au 1er calcul) |
| 1er calcul (R1) | 212,2 ms | 123,3 ms |
| C2 : médiane de 10, R2 à 5 points | 38,5 ms (34,2 à 54,5) | 5,9 ms (5,5 à 6,9) |
| C9 : 50 calculs | 50 réussis, 0 erreur, 2 254,5 ms | 50 réussis, 0 erreur, 503,2 ms |

C8, poids ajouté par Valhalla (`stat -f %z`, app release avec et sans le
module) :

| Build | Avec | Sans | Ajout |
|---|---|---|---|
| APK arm64 seul (cas d'un vrai téléphone) | 30 076 351 o | 22 260 853 o | +7,8 Mo |
| APK universel (4 architectures) | 98 142 110 o | 68 076 901 o | +30,1 Mo |
| .app iOS simulateur (`du -sk`, dossier) | 83 808 Ko | 57 200 Ko | +26,6 Mo |
| Binaire principal iOS | 27 332 400 o | 1 653 920 o | +25,7 Mo |

Le .app du simulateur n'est pas une app de téléphone (ni découpage par
appareil ni compression de l'App Store) : chiffre iOS indicatif.

### Ouverture du moteur : risque pour l'utilisateur

- Android : 7 s en debug, **1,1 s en release**. iOS : l'ouverture est
  différée, son coût est dans le 1er calcul (123 ms).
- Risque : un écran figé d'environ 1 s, plus sur un téléphone lent, si on
  ouvre le moteur au moment du premier calcul.
- Parade proposée (non testée) : ouvrir le moteur en arrière-plan dès que
  l'app démarre avec une zone installée, garder l'instance ouverte, et
  afficher « préparation de la zone… » si l'utilisateur calcule avant la
  fin. À mesurer sur un vrai téléphone.

### Autres constats

- Demi-tours dans les instructions : R3 2, R4 4, R5 1 (« Faites
  demi-tour »). Ce sont les petits allers-retours visibles sur les cartes,
  autour de certains points de passage. À juger par Émilien.
- Séparateur décimal : Android écrit « 1.5 kilomètres », iOS et le Mac
  « 1,5 kilomètres ». Sans doute la langue de l'émulateur. À corriger dans
  l'app (petit défaut, C6 reste acquis).
- iOS : SwiftPM (gestionnaire de paquets Swift) reste bloqué sur ce Mac en
  téléchargeant le binaire de valhalla-mobile. Contournement : copie locale
  du paquet 0.6.4, binaire vérifié par son empreinte
  (`app/modules/valhalla-route/ios/preparer-spm-local.sh`). La forme normale
  (URL distante) reste à éprouver sur une autre machine.
- Android release : l'app n'est pas débogable, la copie du paquet passe par
  `adb root`. Ça marche sur un émulateur, pas sur un vrai téléphone. La
  vraie app téléchargera le paquet elle-même (ADR 0003).

## Ce qui n'est pas vérifié

- Le jugement « praticable » (C3) : il revient à Émilien.
- Le vrai mode avion sur iOS.
- Le temps de calcul et l'ouverture du moteur sur un vrai téléphone
  (le simulateur et l'émulateur utilisent le processeur du Mac).
- Le poids ajouté sur une vraie app iOS (IPA).
- La justesse des altitudes du paquet face à l'IGN (question à part).
- La mémoire utilisée par le moteur.
- Pourquoi Valhalla choisit un autre chemin que la référence (réglages,
  données OSM, sens de passage) : la cause est localisée, pas expliquée.

## Essai 1-bis — Qualité du choix des chemins (20 octobre 2026)

Jugement d'Émilien sur l'essai 1 : itinéraires praticables (C3 atteint),
mais peu intéressants : trop de ville, trop de laies, de petites boucles,
des pistes de la référence évitées. Tout est mesuré sur le Mac (Docker),
dont les tracés sont identiques à ceux des simulateurs.

**Résultat : aucun gain net. Réglage conservé : celui de l'essai 1**
(`bicycle_type: mountain`, `use_roads: 0`, points intermédiaires
`through`). Le garde-fou de la spec s'applique : arrêt.

### Mesures

Outil : `analyse/mesurer-1bis.py`. Tableau complet, par référence :
`analyse/resultats/1bis/mesures.md`. Diagnostics :
`analyse/resultats/1bis/diagnostics.md`.

Classement par `trace_attributes` : piste = `highway=track` ; sentier =
`path`, `footway`, `cycleway`… hors zone dense ; route/ville = le reste ;
laie = piste ou route de service à surface roulante (`compacted`,
`paved`). La largeur et la rectitude ne sont pas connues : « laie » est une
approximation.

Moyennes R2 à R5 (R1 à part, référence douteuse) :

| Combinaison | Cas | Piste + sentier | Route/ville | Laies | Demi-tours (R2–R5) | Distance ± 10 % | À < 25 m de la réf. |
|---|---|---|---|---|---|---|---|
| **Trace de référence** | — | 80,1 % | 19,9 % | 19,6 % | — | — | — |
| 0 : essai 1 | 2 km | 79,6 % | 20,4 % | 19,7 % | 7 | 4/4 | 65,0 % |
| 0 : essai 1 | 5 points | 80,3 % | 19,7 % | 22,2 % | 1 | 1/4 | 40,3 % |
| 0b : points `break` | 5 points | 81,0 % | 19,0 % | 22,7 % | 1 | 2/4 | 41,5 % |
| 1 : cap de la référence | 2 km | 79,3 % | 20,7 % | 19,4 % | 6 | 4/4 | 66,5 % |
| 2 : rayon 50 m | 2 km | 79,6 % | 20,4 % | 19,7 % | 7 | 4/4 | 65,0 % |
| 3 : rayon 50 m, candidats égaux | 2 km | 79,9 % | 20,1 % | 20,0 % | 5 | 3/4 | 63,7 % |
| 3 : rayon 50 m, candidats égaux | 5 points | 80,4 % | 19,6 % | 23,6 % | 1 | 1/4 | 39,9 % |
| 4 : `use_living_streets` 0, `avoid_bad_surfaces` 0 | 2 km | 79,1 % | 20,9 % | 19,7 % | 7 | 4/4 | 64,8 % |
| 4 : idem | 5 points | 81,7 % | 18,3 % | 22,9 % | 1 | 1/4 | 34,8 % |
| 5 : tuiles, piste au coût d'un sentier | 2 km | 79,7 % | 20,3 % | 30,3 % | 7 | 4/4 | 61,5 % |
| 5 : idem | 5 points | 81,1 % | 18,9 % | 35,9 % | 1 | 1/4 | 36,0 % |
| 6 : tuiles, 5 + bonus VTT (`route=mtb`, `mtb:scale`) | 2 km | 79,6 % | 20,4 % | 29,8 % | 7 | 4/4 | 62,7 % |
| 6 : idem | 5 points | 80,7 % | 19,3 % | 37,7 % | 1 | 1/4 | 44,1 % |

Les combinaisons 1 et 2 donnent en 5 points les mêmes chiffres que la 0 :
sans cap fourni par l'utilisateur, la requête est la même.

### Règle de choix : inapplicable

La règle fixée d'avance demande 0 demi-tour dans le cas 2 km. Aucune
combinaison n'y arrive (5 au mieux). La part piste + sentier ne bouge
presque pas (79,1 à 81,7 %). Les combinaisons de tuiles (5 et 6)
augmentent les laies (30 à 38 % au lieu de 20 %), à l'inverse du but.
Aucun réglage n'est donc retenu à la place de l'essai 1.

### Ce que les mesures apprennent

- **Les itinéraires calculés ont la même composition que les références** :
  80 % de piste et sentier, 20 % de route ou ville, 20 % de laies. R2 a
  41 % de route ou ville, et sa référence 40 %. La plainte « trop de ville »
  ne se voit pas dans la moyenne. Elle tient plutôt au choix des tronçons.
- **Pistes évitées près de Clairlieu (R4)** : accès vélo ouvert, surface
  `compacted` (tags réels, par exemple way 112162210
  `highway=track, tracktype=grade2`). Ni l'accès ni la surface ne sont en
  cause. Valhalla prend un chemin moins coûteux : dans `bicyclecost.cc`, une
  piste coûte 1,5 contre 1,2 pour un sentier. Exemple : une piste de
  1 862 m (D+ 25 m) est remplacée par un sentier parallèle de 1 409 m
  (D+ 16 m). Sur 15 tronçons évités testés un à un, 4 sont suivis si on les
  demande directement.
- **Allers-retours du cas 5 points** (R4 4,3 km, R5 3,8 km réellement
  parcourus deux fois) : le départ et l'arrivée de la boucle sont au même
  endroit (22 et 36 m d'écart), et les points intermédiaires sont proches.
  Le plus court chemin de P1 à P3 et celui de P3 à P5 se recouvrent, et
  l'itinéraire revient sur ses pas. Exemple R5 : 1,11 km parcouru deux fois
  entre (48,80221 ; 6,06751) et (48,79813 ; 6,07105). Valhalla ne compte pas
  de demi-tour à un point `through` placé au fond d'un chemin, d'où 0 ou
  1 demi-tour seulement.
- **Cas 5 points** : Valhalla prend le chemin le moins coûteux entre les
  points, il ne cherche pas une belle boucle. R5 fait 16 km au lieu de 44.
  C'est la limite principale pour l'usage réel.

### Pour plus tard

- Le vrai levier n'est pas un réglage : c'est le **but du calcul**. Un
  vététiste veut une boucle intéressante, pas le plus court chemin entre
  ses points. Pistes : faire poser plus de points (ou tracer au doigt),
  interdire de repasser par le même tronçon, ou générer des boucles
  (fonction absente de valhalla-mobile).
- Un coût VTT réellement modifiable demande de changer `bicyclecost.cc`,
  donc de maintenir notre version de Valhalla (rejeté par l'ADR 0002).
  BRouter, réputé pour ses profils VTT, n'existe pas sur iOS.
- Les cartes avant/après ne sont pas produites : sans réglage meilleur, il
  n'y a pas d'« après ». Les cartes de l'essai 1
  (`docs/essais/captures/R*-mac.png`) montrent le réglage conservé, cas
  2 km. Le cas 5 points n'a pas de carte : `captures.py` dessine toujours
  les points tous les 2 km, il faudrait le modifier.

### Non vérifié

- `trace_attributes` en `edge_walk` échoue (erreur 443) : la mesure
  utilise `walk_or_snap`. Couverture ≥ 98,2 % de la longueur calculée, et
  92 à 105 % pour les traces de référence.
- Le seuil « ville » (densité ≥ 6) est calé sur les données : la
  documentation ne définit pas l'échelle de `edge.density`.
- La documentation en ligne de Valhalla est celle de la dernière version.
  Seuls `bicyclecost.cc` et `graph.lua` ont été lus en 3.9.1.

## Outils installés sur le Mac

| Outil | Comment | Pourquoi |
|---|---|---|
| osmium-tool 1.19.1 | Homebrew | Découper la zone, lire les relations OSM |
| Image `ghcr.io/valhalla/valhalla:3.9.1` (942 Mo) | Docker | Fabriquer les tuiles, vérifier le calcul sur le Mac |
| AVD `Pixel_6_API_34_arm64` (dans `~/.android/avd`) | `avdmanager`, image système déjà présente | Émulateur Android arm64 |
| Paquets npm de l'app (dans `app/node_modules`) | npm | App Expo de l'essai |
| Pods CocoaPods et paquets Swift de l'app (dans `app/ios/`, ignoré par git) | CocoaPods 1.17 (déjà installé), SwiftPM | Build iOS |
| Copie locale de valhalla-mobile 0.6.4 (91 Mo, `app/modules/valhalla-route/ios/vendor/`, ignorée par git) | script, binaire vérifié par empreinte | Contourner le blocage de SwiftPM |

Incident : `docker pull` restait bloqué, même pour une image minuscule. Le
développeur a téléchargé les couches de l'image depuis ghcr.io, vérifié
leur empreinte (hash), puis les a chargées avec `docker load`. Sur une autre
machine, un simple `docker pull` suffit.
