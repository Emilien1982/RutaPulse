# Phase 6 — Mes itinéraires et GPX (spec validée)

> 3 novembre 2026. Spec de la session de pilotage, **validée par Émilien
> le 3 novembre 2026**, avec les choix déjà faits. Découpage :
> [docs/05](../05-decoupage-v1.md), ligne 6. Fonctions du cadrage : 4 (mes
> itinéraires) et 5 (GPX). S'appuie sur l'ADR 0007 (données locales :
> SQLite et TanStack Query), l'ADR 0016 (itinéraire en création),
> l'ADR 0017 (calcul des infos), l'ADR 0018 (décision 5 : un itinéraire
> gardé garde son tracé, ses infos sont recalculées), les décisions de
> design 9 et 11 ([docs/06](../06-decisions-design.md)) et les maquettes
> v1/10, v1/20 et v1/40.

## Objectif

Garder ses itinéraires sur le téléphone, les retrouver, et les échanger
avec d'autres applications par un fichier GPX (format standard d'échange
de traces GPS).

## Ce que tu verras à la fin

- **Pendant la création**, le bouton « Enregistrer » de la maquette 10.
  L'itinéraire est gardé avec un nom par défaut, puis l'écran Infos
  s'ouvre avec ce nom en titre.
- **Sur l'onglet Itinéraires** (maquette 40), la liste de tes itinéraires,
  le plus récent en haut. Chaque ligne montre le nom, la distance, le D+,
  la durée, la zone et l'origine (« créé le 3 nov. », « GPX importé le
  3 nov. »). Une liste vide explique comment créer ou importer.
- **Toucher un itinéraire** ouvre son écran Infos. Ses infos (D+, terrain,
  difficulté) sont recalculées sur la zone en service : un itinéraire fait
  avant une mise à jour de zone gagne la difficulté. Son tracé, lui, ne
  change jamais tout seul.
- **« Modifier »** rouvre l'itinéraire dans la création. « Enregistrer »
  remplace l'ancienne version.
- **Pour chaque itinéraire** : renommer, exporter en GPX (feuille de
  partage du téléphone : e-mail, Fichiers, autre app) et supprimer (avec
  confirmation).
- **« Importer un GPX »** en haut de la liste : on choisit un fichier dans
  le téléphone, il rejoint la liste. Un GPX hors de tes zones est accepté,
  avec un message qui propose la zone (décision de design 11).
- Les itinéraires restent après la fermeture de l'app. Tout marche en mode
  avion, sauf l'envoi d'un GPX par e-mail, bien sûr.

## Critères d'acceptation

| # | Critère | Comment on le vérifie |
|---|---|---|
| C1 | **Essai d'abord** : `expo-sqlite` (base locale), le choix d'un fichier (`expo-document-picker`) et la feuille de partage (`expo-sharing`) marchent sur Android et iOS, avec Expo SDK 58. Un fichier GPX posé dans le simulateur s'importe ; un fichier écrit par l'app part par la feuille de partage | Essai jetable de T1, sorties brutes et captures gardées |
| C2 | Les itinéraires sont gardés dans SQLite et lus par TanStack Query (ADR 0007). Le schéma de la base a un numéro de version, et une montée de version est prévue et testée | Tests ; ADR 0019 |
| C3 | « Enregistrer » garde : le nom, les points, les modes des tronçons, le tracé, la zone et sa version, l'origine et les dates. Après l'app tuée puis relancée, l'itinéraire est là, identique | Tests ; parcours sur simulateur |
| C4 | Nom par défaut selon la décision de design 9 : « commune, date » si l'essai de T1 trouve la commune hors ligne sans nouvelle zone ; sinon la date seule (« Itinéraire du 3 nov. »), la commune en V2. Renommer : nom non vide, 60 caractères au plus | Tests ; captures |
| C5 | La liste suit la maquette 40 : tri par dernière modification, chiffres de chaque ligne, origine, liste vide. Renommer et supprimer mettent la liste à jour aussitôt. Supprimer demande une confirmation | Tests ; captures release |
| C6 | **Tracé gardé, infos recalculées** (ADR 0018, décision 5) : à l'ouverture, les infos sont recalculées sur le tracé gardé, avec la zone en service. Un itinéraire gardé sous une zone sans table de difficulté montre la difficulté une fois la zone mise à jour. Le tracé gardé ne change pas | Tests avec une fausse zone ; test sur simulateur |
| C7 | « Modifier » rouvre l'itinéraire dans la création. Les tronçons qu'on ne touche pas gardent leur tracé gardé ; seuls les tronçons touchés sont recalculés. « Enregistrer » remplace l'itinéraire ; « Fermer sans enregistrer » le laisse intact | Tests ; parcours Maestro |
| C8 | Zone absente : si la zone d'un itinéraire a été supprimée, il reste dans la liste, avec un message clair. On peut le renommer, l'exporter ou le supprimer. Ses infos disent ce qui manque, sans plantage | Tests ; capture |
| C9 | **Export GPX** : un fichier GPX 1.1 avec le nom et le tracé, et les altitudes quand elles sont connues. Le fichier est valide selon le schéma officiel GPX 1.1 | Tests ; contrôle `xmllint` sur le Mac des fichiers sortis du simulateur |
| C10 | **Import GPX** : accepte une trace (`trk`, un ou plusieurs segments) ou une route (`rte`). Refuse, avec un message en français, un fichier vide, illisible, sans tracé, ou de plus de 20 Mo. Le fichier est lu comme une donnée : jamais d'appel réseau, jamais d'entité externe XML | Tests sur des fichiers d'exemple écrits par le testeur, dont des cas piégés |
| C11 | **Aller-retour** : exporter un itinéraire puis réimporter le fichier donne le même tracé, à 1 m près, et la même distance, à 10 m près | Test Jest ; essai sur simulateur |
| C12 | Un GPX hors de toutes tes zones est accepté, avec un message qui propose la zone (décision de design 11). Distance calculée ; D+, terrain et difficulté « indisponibles hors zone » | Tests ; capture |
| C13 | Rapidité, en version finale : la liste de 50 itinéraires s'ouvre en moins de 1 s ; un GPX de 10 000 points s'importe en moins de 3 s ; les infos d'un itinéraire gardé de 40 km s'affichent en moins de 1 s | Mesures en release, mêmes méthodes qu'en phase 5 |
| C14 | Parcours Maestro, en mode avion : créer, enregistrer, retrouver dans la liste, renommer, ouvrir les infos, modifier, supprimer ; importer un GPX | Réussi sur Android ; sur iOS, sans mode avion |
| C15 | `npm run verify` passe, `pytest` passe, la CI est verte | Sorties et run GitHub |
| C16 | Captures release sur les deux simulateurs, comparées par le designer aux maquettes 10, 20 et 40 | Comparaison écrite dans `design/comparaisons/` |

## Hors périmètre

- « Ouvrir avec RutaPulse » depuis une autre app (Fichiers, e-mail) : il
  faut toucher aux réglages natifs des deux plateformes. Possible plus
  tard ; ici, on importe depuis l'app.
- Dossiers, tri au choix, recherche dans la liste : la liste restera
  courte en v1.
- Sauvegarde en ligne, comptes, synchronisation (cadrage : plus tard).
- Autres formats (KML, FIT, TCX) ; points d'intérêt (`wpt`) d'un GPX ;
  import ou export de plusieurs itinéraires d'un coup.
- « Démarrer le suivi » : phase 8. Circuits balisés : phase 7.
- Le trait de liaison d'un point posé hors chemin : il reste hors du GPX,
  comme il est hors de la distance. À trancher avant la phase 8 (déjà noté
  dans PILOTAGE.md).
- Rendre modifiable un GPX importé : phase 7 (question 1).

## Tâches, dans l'ordre

| # | Qui | Tâche |
|---|---|---|
| T1 | `developpeur` pour l'essai, puis `architecte` et `designer` | **Essai jetable** sur les deux simulateurs : `expo-sqlite`, choix d'un fichier, feuille de partage (C1) ; trouver la commune de départ hors ligne avec la zone actuelle (C4). Puis l'**ADR 0019** : schéma de la base et montée de version, place du code (`core/gpx/` pour lire et écrire le GPX, `shared-data/` pour la base et Query, `features/routes/`), ce qu'on garde, « Modifier » d'un itinéraire gardé (C7), recalcul des infos (C6), zone absente (C8), règles de l'import (C10), choix de la bibliothèque XML. Le designer complète la maquette 40 : liste vide, renommer, confirmation de suppression, messages d'import, GPX hors zone, nom en titre de l'écran Infos. **Le pilotage te montre cette maquette pour validation** |
| T2 | `developpeur` | `core/gpx/` : lire et écrire le GPX, en logique pure, avec ses tests et les cas piégés |
| T3 | `developpeur` | La base : schéma, montée de version, lecture et écriture par Query, avec leurs tests |
| T4 | `developpeur` | « Enregistrer » dans la création, nom par défaut, écran Infos d'un itinéraire gardé, recalcul des infos, « Modifier » |
| T5 | `developpeur` | L'onglet Itinéraires : liste, renommer, supprimer, liste vide, zone absente |
| T6 | `developpeur` | Import et export GPX : choix du fichier, messages d'erreur, GPX hors zone, feuille de partage |
| T7 | `testeur` | Aller-retour (C11), `xmllint` (C9), mesures C13, app tuée puis relancée (C3), parcours Maestro C14, captures release |
| T8 | `designer` | Compare les captures aux maquettes 10, 20 et 40, et liste les écarts |

Chaque tâche de code passe ensuite par le `relecteur`, puis par le
`testeur`, un par un. Une tâche de corrections suit T8 si le designer trouve
des écarts bloquants.

## Coût et risques

- **Taille : G**, soit 3 sessions de travail ou plus, enchaînées dans une
  session de phase. Échelle de docs/05 : **P** (petite) = 1 session,
  **M** (moyenne) = 2 sessions, **G** (grande) = 3 sessions ou plus.
  Docs/05 l'estimait à M. Elle grossit à cause du recalcul des infos
  (ADR 0018), de « Modifier » sur un tracé gardé et des cas difficiles du
  GPX (fichiers mal formés, hors zone).
- **Risque 1** : trois modules Expo nouveaux (`expo-sqlite`,
  `expo-document-picker`, `expo-sharing`). L'essai de T1 les éprouve sur
  les deux simulateurs avant tout code.
- **Risque 2** : la commune de départ hors ligne. Si les tuiles de la zone
  ne la donnent pas simplement, on prend la date seule, comme la décision
  de design 9 le permet. Aucune nouvelle zone dans cette phase.
- **Risque 3** : les fichiers GPX venus d'ailleurs sont très variés. Le
  testeur écrit des fichiers d'exemple dans les formes courantes (plusieurs
  segments, route seule, sans altitude, avec extensions) et des cas
  piégés.
- **Risque 4** : « Modifier » un itinéraire gardé après une mise à jour de
  zone. Les tronçons non touchés gardent leur tracé (C7) ; l'architecte
  fixe la règle dans l'ADR 0019.
- **Ce que tu devras faire** : valider cette spec et répondre à la
  question 1 (fait) ; valider la maquette 40 complétée (T1) ; valider la fusion.
  Aucune manipulation sur GitHub.

## Question 1 : un GPX importé peut-il être modifié ? (tranchée : non, en v1)

Un GPX importé est une trace de centaines ou milliers de points, sans les
points de passage de l'app. Pour le modifier dans la création, il faudrait
le transformer en points de passage, puis recalculer les chemins : le
tracé changerait.

- **Recommandation : pas modifiable en v1 dans cette phase.** On peut le
  voir, voir ses infos, le renommer, l'exporter, le supprimer, et le suivre
  plus tard (phase 8). Le bouton « Modifier » n'apparaît pas pour lui. La
  phase 7 doit de toute façon transformer un circuit balisé (lui aussi une
  trace) en itinéraire modifiable : on y fera le même geste pour les deux.
  La phase 6 reste ainsi plus petite.
- Autre choix : le rendre modifiable dès cette phase, par un découpage en
  points de passage. La phase grossit, et le tracé importé change dès qu'on
  le modifie.

**Décision d'Émilien (3 novembre)** : un GPX importé n'est pas modifiable
dans cette phase. Le geste « trace → itinéraire modifiable » se fera en
phase 7, pour les circuits balisés et les GPX.

## Choix déjà faits par le pilotage (tu peux les changer)

1. « Enregistrer » garde tout de suite, avec le nom par défaut, sans
   demander de nom. On renomme ensuite depuis la liste. Moins de gestes au
   bord du chemin.
2. Après « Enregistrer », l'écran Infos de l'itinéraire s'ouvre.
3. La liste est triée par dernière modification, le plus récent en haut.
4. Supprimer demande une confirmation ; renommer, non.
5. L'export contient le tracé et ses altitudes, pas les points de passage
   ni le trait de liaison.
6. La liste montre les chiffres gardés au dernier enregistrement ou à la
   dernière ouverture. Ils sont mis à jour quand on ouvre l'itinéraire.
