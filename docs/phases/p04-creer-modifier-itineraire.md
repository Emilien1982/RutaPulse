# Phase 4 — Créer et modifier un itinéraire (spec, à valider)

> 27 octobre 2026. Spec de la session de pilotage, **à valider par Émilien**
> avant tout code. Découpage : [docs/05](../05-decoupage-v1.md), ligne 4.
> Fonction du cadrage : 2 (complète). Décisions de design : 6 (Boucler) et
> 8 (tracé à la main) de [docs/06](../06-decisions-design.md). S'appuie sur
> la phase 3 ([résultats](p03-module-calcul-resultats.md)), l'ADR 0007
> (TanStack Store et Pacer), l'ADR 0015 (module de calcul) et les maquettes
> v1/10, v1/11 et v1/52.

## Objectif

Construire un vrai itinéraire VTT sur la carte, et le retoucher jusqu'à ce
qu'il plaise, sans réseau.

## Ce que tu verras à la fin

- « Nouvel itinéraire » ouvre la création **en plein écran**, sans la barre
  d'onglets, comme dans la maquette 10.
- Chaque touche sur la carte ajoute un point à la fin. Les points sont
  numérotés. L'itinéraire se calcule tronçon par tronçon (un tronçon relie
  deux points qui se suivent).
- Tu **glisses un point** : l'itinéraire se recalcule pendant le geste.
- Tu choisis un point, puis « Supprimer ». « Annuler » défait la dernière
  action. « Boucler » ajoute le départ comme dernier point.
- Le choix « Par les chemins / À la main » vaut pour le prochain tronçon.
  « À la main » trace une ligne droite en tirets, comme dans la maquette 11.
- Un point trop loin d'un chemin, ou hors de la zone, ouvre une feuille
  d'erreur. Elle propose « Relier ce point à la main » ou « Retirer ce
  point » (maquette 52).
- En bas : la distance et la durée de tout l'itinéraire.

## Critères d'acceptation

| # | Critère | Comment on le vérifie |
|---|---|---|
| C1 | La création s'ouvre en plein écran, sans barre d'onglets. La croix ferme la création. S'il y a au moins 2 points, une boîte de confirmation native demande « Abandonner cet itinéraire ? » | Captures ; test |
| C2 | Ajouter : chaque touche ajoute un point à la fin. Seul le nouveau tronçon est calculé | Test sur le nombre d'appels au moteur ; capture à 4 points ou plus |
| C3 | Déplacer : un point se glisse au doigt. Pendant le geste, les tronçons voisins se recalculent au plus 5 fois par seconde (TanStack Pacer). Au relâchement, un dernier calcul donne le résultat juste. Les autres tronçons ne bougent pas | Test avec un faux moteur et une fausse horloge ; mesure dans l'app en version finale ; enregistrement vidéo ou suite de captures |
| C4 | Supprimer : on touche un point pour le choisir, puis « Supprimer ». Ses deux voisins sont reliés par un tronçon recalculé. Supprimer le départ ou l'arrivée raccourcit l'itinéraire | Tests ; captures |
| C5 | Annuler : ajout, déplacement, suppression, Boucler et changement de mode d'un tronçon s'annulent un par un, jusqu'à 50 actions. Un état déjà calculé revient **sans nouveau calcul** (cache de TanStack Query, clé = les deux points et le mode du tronçon) | Tests sur le nombre d'appels au moteur |
| C6 | Boucler ajoute le départ comme dernier point. Le bouton est grisé avec moins de 2 points | Test ; capture |
| C7 | À la main : le mode choisi s'applique au prochain tronçon ajouté. Un tronçon à la main est une ligne droite en tirets (maquette 11). Sa distance est comptée. Sa durée est estimée à la vitesse moyenne des tronçons calculés par le moteur, ou à 10 km/h s'il n'y en a pas. La carte se zoome jusqu'au zoom 18 | Tests ; capture au zoom 18 |
| C8 | Point à plus de 200 m d'un chemin : refusé, avec la feuille « Aucun chemin trouvé ». Entre le point touché et le chemin, à moins de 200 m, la liaison en pointillés de la phase 3 reste. Elle n'est comptée ni dans la distance ni dans la durée | Tests ; capture |
| C9 | Point hors de la zone : feuille de la maquette 52, avec « Relier ce point à la main » et « Retirer ce point ». Pas de bouton « Télécharger » : il n'y a qu'une zone | Capture en mode avion |
| C10 | Le résumé (distance, durée) est la somme des tronçons. Il se met à jour après chaque action. La durée minimale reste « 1 min » | Tests |
| C11 | L'écran reste fluide pendant le glisser : aucun arrêt du fil JavaScript de plus de 100 ms, en version finale, sur les deux simulateurs | Mesure, même méthode que C2 de la phase 3 |
| C12 | Jamais de plantage. Un calcul qui échoue pendant le glisser laisse l'ancien tracé du tronçon. Le dernier calcul au relâchement donne la feuille d'erreur s'il échoue | Tests |
| C13 | `npm run verify` passe, avec des tests du modèle de l'itinéraire (logique pure dans `core/`). La CI est verte | Sortie de `verify` et run GitHub |
| C14 | Un parcours Maestro, en mode avion : 3 points, en supprimer un, annuler, tracer un tronçon à la main, voir la distance changer | Parcours réussi sur Android ; sur iOS, sans mode avion |
| C15 | Captures en version finale, sur les deux simulateurs, comparées par le designer aux maquettes 10, 11 et 52 | Comparaison écrite dans `design/comparaisons/` |

## Hors périmètre

- « Enregistrer » et le nom par défaut : phase 6. Le bouton n'est pas
  affiché.
- D+, profil d'altitude, part de terrain, difficulté : phase 5.
- Circuits balisés sur la carte : phase 7.
- **Insérer un point au milieu** du tracé (en touchant la ligne) : pas dans
  cette phase. On ajoute à la fin, et on déplace. À rediscuter après usage.
- Compter la liaison en pointillés dans la distance : avant la phase 8
  (décision du 27 octobre).
- Le tracé dessiné sous le point bleu de position : avant la phase 8.

## Tâches, dans l'ordre

| # | Qui | Tâche |
|---|---|---|
| T1 | `architecte`, puis `developpeur` pour l'essai | ADR 0016 : le modèle de l'itinéraire en création (points, tronçons et leur mode, historique pour annuler) ; où vit chaque morceau (`core/`, `shared-data/`, `features/`) ; recalcul par tronçon avec TanStack Query et Pacer ; plein écran avec Expo Router ; mesure du seuil de 200 m (point recalé renvoyé par le moteur, ou rayon de recherche de Valhalla). **Essai jetable avant l'ADR** : glisser un marqueur de MapLibre sur les deux simulateurs, avec un recalcul pendant le geste, et mesurer la fluidité. TanStack Pacer est en bêta : l'essai prouve aussi qu'il s'installe et marche sous React Native |
| T2 | `developpeur` | Le modèle pur dans `core/` : ajouter, déplacer, supprimer, Boucler, mode d'un tronçon, annuler, somme des tronçons, durée d'un tronçon à la main |
| T3 | `developpeur` | Le recalcul : un tronçon à la fois, cache par tronçon, cadence limitée pendant le glisser, seuil de 200 m, erreurs |
| T4 | `developpeur` | L'écran plein écran : points numérotés, glisser, choix d'un point, barre d'outils (Annuler, Boucler, Supprimer), choix « Par les chemins / À la main », résumé, confirmation à la fermeture. Avec les écarts laissés par la phase 3 : scène de la maquette 52, espace fine avant l'unité, petits écarts listés dans `design/comparaisons/p03-t6.md` |
| T5 | `developpeur` | Le tracé à la main (tirets, zoom 18) et la feuille d'erreur complète : « Aucun chemin trouvé », « Relier ce point à la main », « Retirer ce point » |
| T6 | `testeur` | Mesures C3 et C11 en version finale, parcours Maestro C14, captures release des deux simulateurs |
| T7 | `designer` | Compare les captures aux maquettes 10, 11 et 52, et liste les écarts |

Chaque tâche de code passe ensuite par le `relecteur`, puis par le
`testeur`, un par un.

## Coût et risques

- **Taille : G**, soit 3 sessions ou plus, enchaînées dans une session de
  phase. C'est la phase la plus lourde de la v1 : elle porte la valeur
  principale de l'app.
- **Risque 1, le glisser d'un point sur la carte.** MapLibre pour React
  Native gère le glisser d'un marqueur différemment sur iOS et sur Android.
  Recalculer pendant le geste ajoute une charge. L'essai de T1 le prouve
  avant tout code.
- **Risque 2, TanStack Pacer est en bêta** (ADR 0007). L'essai le vérifie.
  Si Pacer ne convient pas, la parade est une petite fonction maison de
  limitation, testée, sans changer le reste.
- **Risque 3, la taille.** Si la phase dépasse 3 sessions, le pilotage la
  coupe en deux : T1 à T4 d'abord (les points calculés), puis T5 (à la
  main). Chaque moitié se fusionne à part, avec ton accord.
- **Ce que tu devras faire** : rien, sauf valider cette spec et la fusion.
  Les questions passeront par le pilotage.

## Choix déjà faits par le pilotage (tu peux les changer)

1. Un point s'ajoute toujours **à la fin**. L'insertion au milieu attend.
2. La croix demande une confirmation dès 2 points, car rien n'est encore
   enregistré (l'enregistrement arrive en phase 6).
3. La durée d'un tronçon à la main suit la vitesse moyenne des tronçons
   calculés, ou 10 km/h.
4. Annuler remonte jusqu'à 50 actions. Pas de « Rétablir » (refaire une
   action annulée) : la maquette n'en a pas.
