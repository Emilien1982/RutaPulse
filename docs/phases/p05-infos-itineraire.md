# Phase 5 — Infos de l'itinéraire (spec, à valider)

> 28 octobre 2026. Spec de la session de pilotage, **à valider par Émilien**
> avant tout code. Découpage : [docs/05](../05-decoupage-v1.md), ligne 5.
> Fonction du cadrage : 3. S'appuie sur l'ADR 0005 (sources des infos),
> l'ADR 0015 (module de calcul), l'ADR 0016 (itinéraire en création), la
> méthode de dénivelé de l'essai 1, la maquette v1/20 et les écarts laissés
> par la phase 4 ([comparaison p04-t7](../../design/comparaisons/p04-t7.md)).

## Objectif

Savoir à quoi ressemble un itinéraire avant de partir : combien il monte,
par où il passe, et sur quel terrain.

## Ce que tu verras à la fin

- Pendant la création, le résumé affiche la distance, la **montée (D+)** et
  la durée, comme dans la maquette 10.
- Toucher le résumé ouvre l'écran **Infos** (maquette 20) :
  - distance, durée, montée et descente (D+ et D−) ;
  - le profil d'altitude, avec l'altitude la plus basse et la plus haute ;
  - la part de route, de piste et de sentier ;
  - la carte de l'itinéraire dans sa fenêtre en arche ;
  - un bouton « Modifier », qui ramène à la création.
- Tout marche en mode avion.

## Critères d'acceptation

| # | Critère | Comment on le vérifie |
|---|---|---|
| C1 | Le module natif expose deux fonctions de plus : `height` (altitudes d'une suite de points) et `traceAttributes` (type des voies traversées). Elles marchent hors ligne sur Android et iOS, avec la zone Nancy v3 | Essai jetable de T1, puis tests et sorties brutes gardées, comme en phase 3 |
| C2 | D+ et D− sont calculés par notre code, dans `core/`, avec la méthode de l'essai 1 : une altitude tous les 30 m, puis un seuil de 5 m | Tests sur des profils connus |
| C3 | **Même dénivelé que le Mac** : sur les 5 itinéraires de référence, le D+ et le D− de l'app sont égaux, à 1 m près, à ceux calculés sur le Mac avec les mêmes altitudes et la même méthode | Script de comparaison rejouable, sur les deux plateformes |
| C4 | Un tronçon tracé à la main a aussi ses altitudes (fonction `height`). Il compte dans le dénivelé et dans le profil | Test ; capture d'un itinéraire mixte |
| C5 | Le terrain est classé en route, piste et sentier, avec la règle de l'essai 1 (`trace_attributes`), écrite et testée dans `core/`. Les tronçons à la main forment une 4e part, « À la main ». Les parts font 100 % | Tests ; comparaison au Mac sur les 5 références, à 1 point près |
| C6 | Le résumé de la création affiche la montée (D+). Il se met à jour après chaque action, jamais pendant un glisser | Tests ; capture |
| C7 | L'écran Infos s'ouvre en touchant le résumé de la création. « Modifier » revient à la création, avec l'itinéraire intact. « Démarrer le suivi » n'apparaît pas (phase 8). L'en-tête dit « Nouvel itinéraire » (le nom arrive en phase 6) | Tests ; parcours Maestro |
| C8 | Le profil d'altitude suit la maquette 20 : bandes, altitudes basse et haute, terrain coloré dessous. La carte en arche montre le tracé en entier, avec l'attribution courte et le bouton « i » | Captures release ; comparaison du designer |
| C9 | Les infos d'un itinéraire de 40 km s'affichent en moins de 1 s sur simulateur, en version finale. Le glisser de la phase 4 reste fluide : aucun arrêt du fil JavaScript de plus de 100 ms | Mesures en release, mêmes méthodes qu'en phase 4 |
| C10 | Jamais de plantage. Si les altitudes ou le terrain manquent, l'écran Infos le dit en français et montre le reste | Tests |
| C11 | La ligne « Difficulté » n'apparaît pas encore (voir la question 1 plus bas) | Test |
| C12 | `npm run verify` passe, la CI est verte | Sortie de `verify` et run GitHub |
| C13 | Un parcours Maestro, en mode avion : créer un itinéraire, ouvrir les infos, voir le D+ et les parts de terrain, revenir par « Modifier » | Réussi sur Android ; sur iOS, sans mode avion |
| C14 | Les trois écarts « plus tard » de la phase 4 sont faits : point glissé agrandi avec un halo (après un essai sur MapLibre), bulle « À la main » à chaque passage dans ce mode jusqu'à la première touche, note « À la main : 0,6 km » de la maquette 11 | Captures release ; comparaison du designer |
| C15 | Captures release sur les deux simulateurs, comparées par le designer aux maquettes 10, 11 et 20 | Comparaison écrite dans `design/comparaisons/` |

## Hors périmètre

- **La difficulté VTT** (`mtb:scale`) : voir la question 1.
- L'enregistrement, le nom et la liste « Mes itinéraires » : phase 6.
- « Démarrer le suivi » : phase 8.
- Recaler la durée sur la pente ou le terrain : la durée reste celle de
  Valhalla (ADR 0005). À revoir avec des sorties réelles.
- Comparer les altitudes à celles de l'IGN : l'essai 1 l'a laissé de côté.
  On mesure ici notre calcul, pas la qualité des altitudes.

## Tâches, dans l'ordre

| # | Qui | Tâche |
|---|---|---|
| T1 | `developpeur` pour l'essai, puis `architecte` | **Essai jetable** : appeler `height` et `trace_attributes` de valhalla-mobile 0.6.4 hors ligne, sur les deux simulateurs, et garder les réponses brutes. Essai MapLibre du point agrandi avec halo. Puis l'ADR 0017 : les deux fonctions du module, où vit le calcul des infos (`core/`, `shared-data/`, `features/`), quand on calcule (après chaque action, jamais pendant un glisser), le cache par tronçon (ADR 0016), l'écran Infos dans Expo Router |
| T2 | `developpeur` | Le module natif : `height` et `traceAttributes`, codes d'erreur, sorties réelles gardées pour les tests |
| T3 | `developpeur` | La logique pure dans `core/` : D+ et D−, profil, classement du terrain, parts, tronçons à la main |
| T4 | `developpeur` | Le branchement : calcul des infos par tronçon avec cache, D+ dans le résumé de la création |
| T5 | `developpeur` | L'écran Infos (maquette 20) : chiffres, profil, terrain, carte en arche, « Modifier » |
| T6 | `developpeur` | Les trois écarts de la phase 4 (C14) |
| T7 | `testeur` | Comparaison au Mac (C3 et C5), mesures C9, parcours Maestro C13, captures release |
| T8 | `designer` | Compare les captures aux maquettes 10, 11 et 20, et liste les écarts |

Chaque tâche de code passe ensuite par le `relecteur`, puis par le
`testeur`, un par un. Une tâche de corrections suit T8 si le designer trouve
des écarts bloquants.

## Coût et risques

- **Taille : M à G**, soit 2 à 3 sessions, enchaînées dans une session de
  phase.
- **Risque 1** : valhalla-mobile expose `height` et `traceAttributes` dans
  son code Swift (vérifié par le pilotage). Il reste à prouver qu'elles
  marchent hors ligne sur les deux plateformes. L'essai de T1 le fait avant
  tout code. L'essai 1 avait vu `trace_attributes` échouer en mode
  `edge_walk` (erreur 443) : on utilise `walk_or_snap`, comme alors.
- **Risque 2** : le calcul des infos pendant la création. On ne calcule
  qu'après chaque action, et par tronçon avec un cache, pour garder le
  glisser fluide (C9).
- **Ce que tu devras faire** : valider cette spec, répondre à la
  question 1, puis valider la fusion.

## Question 1 pour toi : la difficulté VTT

La difficulté `mtb:scale` n'est **pas** dans les zones publiées. Pour
l'afficher, il faut :

1. une table « voie → difficulté » ajoutée par la fabrique de zones ;
2. une zone Nancy v4, fabriquée par le workflow GitHub, que tu lances à la
   main ;
3. dans l'app, la **mise à jour d'une zone** déjà téléchargée, qui n'existe
   pas encore.

Et autour de Nancy, la difficulté n'est connue que sur environ 4 % des
chemins.

**Ma recommandation** : sortir la difficulté de la phase 5, et en faire une
petite phase à part (5b), avec la mise à jour des zones, qu'il faudra de
toute façon un jour. La phase 5 reste ainsi de taille M à G, sans
manipulation de ta part.

L'autre choix : tout faire dans la phase 5, qui passe alors à G ou plus,
avec le lancement du workflow par toi en cours de phase.

## Choix déjà faits par le pilotage (tu peux les changer)

1. Les tronçons à la main forment une 4e part de terrain, « À la main ».
2. L'écran Infos s'ouvre en touchant le résumé de la création.
3. Les infos se calculent après chaque action, jamais pendant le glisser.
