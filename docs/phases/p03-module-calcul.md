# Phase 3 — Module de calcul d'itinéraire (spec, à valider)

> 27 octobre 2026. Spec de la session de pilotage, **à valider par Émilien**
> avant tout code. Découpage : [docs/05](../05-decoupage-v1.md), ligne 3.
> Fonction du cadrage : 2 (base). S'appuie sur l'ADR 0002 (Valhalla, réglage
> retenu), sur l'essai 1 (module jetable sur la branche locale
> `claude/essai-1-9fd65c`) et sur les ADR 0011, 0013 et 0014.

## Objectif

Le moteur de calcul Valhalla, branché proprement dans l'app sur la zone
téléchargée. On touche un départ et une arrivée sur la carte, et
l'itinéraire VTT s'affiche, **sans réseau**.

## Ce que tu verras à la fin

- Sur l'onglet Carte, un bouton « Nouvel itinéraire ». Tu touches un
  départ, puis une arrivée : l'itinéraire apparaît en magenta, avec sa
  distance et sa durée estimée, comme dans la maquette 10.
- Un point touché hors de la zone donne un message clair, comme dans la
  maquette 52.
- Tout marche en mode avion.

## Critères d'acceptation

| # | Critère | Comment on le vérifie |
|---|---|---|
| C1 | Un module natif à nous (`mobile/modules/`) appelle valhalla-mobile 0.6.4, sur Android et iOS. Il se **compile depuis un dépôt cloné à neuf**, sans manipulation à la main ni fichier hors de git | Clone neuf, génération des dossiers natifs, compilation et lancement sur les deux simulateurs |
| C2 | Le moteur s'ouvre en arrière-plan au démarrage, quand une zone est prête. L'écran ne se fige pas. Un calcul demandé avant la fin de l'ouverture attend, puis aboutit | Temps d'ouverture mesuré en version finale ; test |
| C3 | Départ et arrivée touchés dans la zone : l'itinéraire est calculé hors ligne, dessiné en magenta, avec distance et durée | Captures en mode avion sur les deux simulateurs |
| C4 | Le réglage de l'ADR 0002 est appliqué : `bicycle_type: mountain`, `use_roads: 0`, points intermédiaires `through` | Test sur la requête envoyée au moteur |
| C5 | **Mêmes itinéraires que la référence** : les 5 parcours de référence, calculés dans l'app avec la zone publiée v3, donnent des tracés identiques à ceux calculés sur le Mac. Les simulateurs du Mac sont en ARM, comme un téléphone : cela répond à la question laissée ouverte par la phase 1 | Script de comparaison, sur les deux plateformes |
| C6 | Les erreurs ont un message en français : point hors de la zone, aucun chemin trouvé, moteur indisponible. Jamais de plantage | Tests, et captures pour le point hors zone |
| C7 | Un calcul de 30 km avec 5 points prend moins de 1 s sur simulateur. C'est une mesure indicative : un vrai téléphone sera plus lent | Mesure en version finale |
| C8 | Le poids ajouté à l'app est mesuré : 50 Mo au plus | Taille de l'APK et de l'app iOS, avant et après |
| C9 | `npm run verify` passe, avec des tests de l'enveloppe TypeScript (le moteur natif est simulé). La CI est verte | Sortie de `verify` et run GitHub |
| C10 | Un parcours Maestro : mode avion, toucher deux points, voir l'itinéraire et sa distance | Parcours réussi sur Android ; sur iOS, autant que le simulateur le permet |

## Hors périmètre

- Les points de passage, le déplacement d'un point, l'annulation et le tracé
  à la main : phase 4.
- Le profil d'altitude, le terrain et la difficulté : phase 5.
- L'enregistrement de l'itinéraire : phase 6.
- Les indications de direction pour le suivi : phases 8 et 9. Le module les
  renvoie déjà, mais l'app ne les affiche pas encore.

## Tâches, dans l'ordre

| # | Qui | Tâche |
|---|---|---|
| T1 | `architecte` | ADR 0015 : le module natif. Fonctions exposées à TypeScript, fil d'exécution du calcul (jamais sur le fil de l'interface), ouverture et fermeture du moteur, changement de zone, et surtout **distribution reproductible de valhalla-mobile sur iOS**. L'essai 1 avait dû le copier à la main, à cause d'un blocage de SwiftPM (gestionnaire de paquets Swift). |
| T2 | `developpeur` | Le module natif dans `mobile/modules/`, réécrit proprement d'après l'essai 1, avec son enveloppe TypeScript. |
| T3 | `developpeur` | Le cycle de vie du moteur : ouverture en arrière-plan au démarrage, attente des calculs, changement de zone, erreurs. Logique pure dans `core/`, branchement dans `shared-data/` si plusieurs fonctionnalités s'en servent (ADR 0014). |
| T4 | `developpeur` | L'interface minimale sur l'onglet Carte : « Nouvel itinéraire », départ, arrivée, tracé magenta, résumé distance et durée, message hors zone. Seulement les éléments de la maquette 10 utiles à cette phase. |
| T5 | `testeur` | Comparaison des 5 références avec le Mac (C5), mesures C2, C7 et C8, parcours Maestro, compilation depuis un clone neuf (C1). |
| T6 | `designer` | Compare les captures à la maquette 10 pour les éléments de la phase, et liste les écarts. |

Chaque tâche de code passe ensuite par le `relecteur` et le `testeur`, un par
un.

## Coût et risques

- **Taille : M à G**, soit 2 à 3 sessions, enchaînées dans une session
  ouverte dans `vtt-nav`.
- **Risque 1, le plus sérieux** : installer valhalla-mobile sur iOS de façon
  reproductible. L'essai 1 avait contourné un blocage de SwiftPM par une
  copie locale de 91 Mo, hors de git. T1 doit trouver une solution propre,
  et l'éprouver avant T2.
- **Risque 2** : le temps d'ouverture du moteur (7 s mesurées en version de
  développement dans l'essai 1). La parade est l'ouverture en arrière-plan,
  mesurée en C2.
- **Risque 3** : valhalla-mobile a une petite communauté (ADR 0002). Notre
  module garde une enveloppe fine, pour pouvoir changer de version ou
  compiler Valhalla nous-mêmes un jour.
- **Ce que tu devras faire** : rien. Les questions passeront par le
  pilotage.
