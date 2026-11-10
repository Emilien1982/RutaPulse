# Phase 7 — Circuits VTT balisés, et trace modifiable

> 9 novembre 2026. Spec de la session de pilotage, **validée par
> Émilien**, avec l'ADR 0020 et la maquette v1/12 (même jour). Ajout du
> 9 novembre : « Dupliquer » (C16). Découpage : [docs/05](../05-decoupage-v1.md), ligne 7.
> Fonction du cadrage : 9 (circuits VTT balisés). S'appuie sur l'ADR 0003
> (paquets de zone, fichier `trails.geojson`), l'ADR 0016 (itinéraire en
> création), l'ADR 0018 (mise à jour d'une zone), l'ADR 0019 (itinéraires
> gardés, tronçons gardés, GPX), la décision de design 7
> ([docs/06](../06-decisions-design.md)), la maquette v1/12 et l'essai 3.
> Reprend la décision d'Émilien du 3 novembre : le geste « trace →
> itinéraire modifiable » sert aux circuits balisés **et** aux GPX importés.

## Objectif

Voir les circuits VTT balisés sur la carte, et partir d'un circuit ou d'un
GPX importé pour en faire un itinéraire qu'on peut modifier, sans que son
tracé change tant qu'on n'y touche pas.

## Ce que tu verras à la fin

- **Sur l'onglet Carte**, les circuits VTT balisés de la zone, en trait
  coloré épais, avec leur nom le long du trait. Autour de Nancy, il y en a
  deux (forêt de Haye, Petite Suisse lorraine).
- **Toucher un circuit** ouvre la feuille de la maquette 12 : nom,
  longueur, boucle ou non, et le bouton « En faire un itinéraire ».
- **« En faire un itinéraire »** ouvre la création avec le circuit déjà
  posé, dans son sens. Il est découpé en points de passage, un tous les
  kilomètres environ. Pour une boucle, le départ est le point du circuit
  le plus proche de toi (décision de design 7). Le tracé est exactement
  celui du circuit.
- **Tu le modifies comme un itinéraire créé** : déplacer, ajouter ou
  supprimer un point, passer un tronçon à la main, annuler. Seuls les
  tronçons touchés sont recalculés ; le reste garde le tracé du circuit.
- **« Enregistrer »** le garde dans l'onglet Itinéraires, avec le nom du
  circuit et l'origine « circuit balisé, le 9 nov. ».
- **Un GPX importé** a maintenant un bouton « Modifier » sur son écran
  Infos. Le même geste le découpe en points de passage et ouvre la
  création, avec son tracé intact.
- Un circuit en plusieurs morceaux s'affiche, mais sa feuille explique
  qu'il ne peut pas devenir un itinéraire en v1 (décision de design 7).
- Tout marche en mode avion.

## Comment le geste marche (en bref)

La phase 6 a déjà les **tronçons gardés** (ADR 0019, § 4) : quand on rouvre
un itinéraire, un tronçon qu'on ne touche pas reprend sa forme gardée,
sans calcul. Le geste réutilise ce mécanisme :

1. on prend la trace (circuit ou GPX), dans l'ordre et dans son sens ;
2. on pose un point de passage environ tous les kilomètres, **sur** la
   trace, plus le départ et l'arrivée ;
3. chaque tronçon entre deux points reçoit comme forme gardée le morceau
   de trace correspondant ;
4. on ouvre la création avec ce brouillon.

Le tracé ne change donc pas à l'ouverture. Dès qu'on déplace un point, ses
deux tronçons sont recalculés par le moteur, comme d'habitude.

Un point de difficulté : dans OpenStreetMap, les voies d'un circuit ne
sont pas rangées dans l'ordre du parcours (essai 3). Il faut les remettre
bout à bout. La phase le fait dans la **fabrique de zones**, en Python :
le paquet de zone reçoit, pour chaque circuit d'un seul morceau, sa ligne
ordonnée dans le sens du circuit. D'où une nouvelle version de la zone
Nancy (v6).

## Critères d'acceptation

| # | Critère | Comment on le vérifie |
|---|---|---|
| C1 | **Essai d'abord** : sur les deux simulateurs, toucher une ligne fine de la carte MapLibre la sélectionne sans gêner les autres gestes ; un circuit découpé en points de passage, rouvert dans la création, garde son tracé ; déplacer un point ne recalcule que ses deux tronçons. Les deux circuits de Nancy se remettent en ordre (sens, boucle ou non) | Essai jetable de T1, sorties brutes et captures gardées |
| C2 | **Fabrique** : `trails.geojson` donne, pour chaque circuit d'un seul morceau, sa ligne ordonnée dans le sens de la relation OSM, et s'il est une boucle. Un circuit en plusieurs morceaux, ou impossible à ordonner (fourche, variante), n'a pas de ligne ordonnée. Format décrit dans l'ADR 0003 | `pytest`, avec des cas fabriqués : voie à l'envers, sous-relation, boucle, fourche, morceaux séparés |
| C3 | **Zone Nancy v6** fabriquée sur GitHub (workflow « Fabriquer une zone »), publiée, et mise à jour dans l'app depuis la v5 (mécanisme de la phase 5b). Une zone plus ancienne, sans ligne ordonnée, montre les circuits, et sa feuille propose de mettre la zone à jour | Run GitHub vérifié par l'API publique ; test sur simulateur ; tests |
| C4 | **Couche des circuits** sur l'onglet Carte et dans la création : trait coloré et nom, sous le tracé de l'itinéraire, au-dessus des voies. On ne touche un circuit que sur l'onglet Carte (dans la création, toucher pose un point) | Tests ; captures release |
| C5 | **Feuille du circuit** (maquette 12) : nom (ou numéro), longueur, boucle ou aller simple, attribution « Tracé du circuit : OpenStreetMap ». Circuit en plusieurs morceaux : message clair, pas de bouton | Tests ; captures |
| C6 | **« En faire un itinéraire »** : création ouverte avec le circuit découpé, dans son sens. Boucle : départ au point le plus proche de ta position, ou au départ du circuit si la position est inconnue. Aller simple : départ au début du circuit | Tests de la logique pure ; parcours sur simulateur |
| C7 | **Fidélité** : avant toute modification, le tracé de la création est celui du circuit à 1 m près, et sa longueur à 10 m près. Aucun calcul du moteur n'est lancé à l'ouverture | Tests Jest sur les deux circuits de Nancy ; essai sur simulateur |
| C8 | **Modifier** : déplacer, ajouter ou supprimer un point recalcule seulement les tronçons touchés. « Annuler » revient au tracé du circuit. Un circuit qui sort de la zone se modifie dans la zone ; hors zone, le tronçon garde son tracé et un message le dit | Tests ; parcours Maestro |
| C9 | **Enregistrer** : nom par défaut = nom du circuit (sinon « Circuit du 9 nov. »), « (2) » s'il existe déjà ; origine « circuit balisé ». La base passe en version 2, avec une montée de version testée depuis la version 1 | Tests sur un vrai SQLite ; captures |
| C10 | **GPX modifiable** : bouton « Modifier » sur l'écran Infos d'un GPX importé, même geste et même fidélité (C7). Un GPX entièrement hors de tes zones n'a pas ce bouton, ou un message dit pourquoi. « Enregistrer » suit la question 1 | Tests ; parcours Maestro |
| C11 | **Infos inchangées** : un circuit ou un GPX devenu itinéraire, non touché, a la même distance (à 10 m) et le même D+ (à 5 m) qu'avant le geste | Tests Jest ; mesure sur simulateur |
| C12 | **Rapidité**, en version finale : le geste prend moins de 1 s pour un circuit de 35 km et pour un GPX de 10 000 points ; glisser un point reste fluide (100 ms au plus d'arrêt, comme en phase 4) | Mesures en release, méthodes des phases 4 et 6 |
| C13 | Parcours Maestro, en mode avion : toucher un circuit, en faire un itinéraire, déplacer un point, enregistrer, le retrouver dans la liste ; importer un GPX, le modifier, enregistrer | Réussi sur Android ; sur iOS, sans mode avion |
| C14 | `npm run verify` passe, `pytest` passe, la CI est verte | Sorties et run GitHub |
| C15 | Captures release sur les deux simulateurs, comparées par le designer aux maquettes 10, 12, 20 et 40 | Comparaison écrite dans `design/comparaisons/` |
| C16 | **Dupliquer** : depuis le menu « ⋮ » ou l'appui long, juste après « Renommer », pour toute origine. La copie s'appelle « <nom> (copie) », puis « (copie 2) », 60 caractères au plus. Elle garde l'origine et le tracé de l'original, ses dates sont celles de la copie, elle arrive en haut de la liste. La modifier ne change pas l'original | Tests sur un vrai SQLite ; parcours Maestro |

Précisions du 9 novembre (réponses d'Émilien, ADR 0020) :

- C2 : la règle d'ordre est **tolérante** (ADR 0020, § 2). Elle retire
  les petits culs-de-sac et petites boucles, garde une branche d'une
  variante, et refuse un circuit dont elle retirerait plus de 15 %.
- C8 : aucun point de passage hors de la zone. La partie hors zone reste
  un seul tronçon gardé ; une bulle le dit à l'ouverture.
- C11 : le D+ d'un circuit ou d'un GPX non touché est calculé d'une seule
  requête par suite de tronçons non touchés (parade b, ADR 0020, § 6).
  Après une retouche, le D+ est un ordre de grandeur (environ ±6 %).

## Hors périmètre

- Circuits en plusieurs morceaux : affichés seulement (décision de design 7).
- Choisir le sens ou le départ d'un circuit ; ajouter un circuit à un
  itinéraire déjà commencé.
- Liste ou recherche des circuits ; filtre par couleur ou difficulté du
  balisage.
- Circuits d'autres sources qu'OpenStreetMap ; circuits hors des zones
  téléchargées.
- Générer des boucles automatiquement (cadrage : plus tard).
- Une 2e zone (Nancy reste la seule zone publiée).
- Le trait de liaison d'un point posé hors chemin : à trancher avant la
  phase 8 (déjà noté).
- Un D+ plus précis après une retouche (lissage des altitudes) : plus
  tard, peut-être jamais.

## Tâches, dans l'ordre

| # | Qui | Tâche |
|---|---|---|
| T1 | `developpeur` pour l'essai, puis `architecte` et `designer` | **Essai jetable** sur les deux simulateurs (C1) : toucher une ligne de la carte ; découper un circuit en tronçons gardés et le rouvrir ; ordonner les deux circuits de Nancy en Python. Puis l'**ADR 0020** : format de la ligne ordonnée (et ADR 0003 complété), règle du découpage (espacement des points, points posés sur la trace, aller simple et boucle, départ le plus proche), tronçons gardés venus d'une trace, circuit qui sort de la zone, origine `trail` et montée de la base en version 2, « Modifier » d'un GPX. Le designer complète la maquette 12 : couche sur la carte, feuille d'un circuit en plusieurs morceaux, zone à mettre à jour, bouton « Modifier » d'un GPX (maquette 20), origine dans la liste (maquette 40). **Le pilotage te montre la maquette et l'ADR pour validation** |
| T2 | `developpeur` | **Fabrique** : ligne ordonnée et boucle dans `trails.geojson`, avec ses tests `pytest` ; zone Nancy fabriquée sur le Mac et contrôlée. Puis **tu lances le workflow** pour publier la v6 (le pilotage te donne la marche à suivre) |
| T3 | `developpeur` | **Logique pure** dans `core/` : trace → brouillon avec tronçons gardés (découpage, sens, départ le plus proche), avec ses tests |
| T4 | `developpeur` | **Couche des circuits** et feuille du circuit (maquette 12), zone ancienne |
| T5 | `developpeur` | **« En faire un itinéraire »**, création ouverte, Enregistrer avec l'origine « circuit balisé », base en version 2 |
| T6 | `developpeur` | **« Modifier » d'un GPX importé**, avec la règle de la question 1, puis **« Dupliquer »** (C16) |
| T7 | `testeur` | Mise à jour v5 → v6 sur simulateur (C3), fidélité (C7, C11), mesures C12, parcours Maestro C13, captures release |
| T8 | `designer` | Compare les captures aux maquettes 10, 12, 20 et 40, et liste les écarts |

Chaque tâche de code passe ensuite par le `relecteur`, puis par le
`testeur`, un par un. Une tâche de corrections suit T8 si le designer trouve
des écarts bloquants.

## Coût et risques

- **Taille : G**, soit 3 sessions de travail ou plus, enchaînées dans une
  session de phase. Échelle de docs/05 : **P** (petite) = 1 session,
  **M** (moyenne) = 2 sessions, **G** (grande) = 3 sessions ou plus.
  Docs/05 l'estimait à P, quand elle ne prévoyait que la couche et un geste
  simple. Elle grossit pour trois raisons : remettre les voies en ordre
  dans la fabrique (avec une nouvelle zone), le geste commun aux GPX
  (décision du 3 novembre), et la montée de la base en version 2. Pour
  repère, la phase 6 (taille G) a duré environ 2 jours de travail effectif.
- **Quota** : une phase G avec simulateurs coûte environ 6 points du quota
  de la semaine par heure dans ses tâches de test. La règle de la réserve
  s'applique : la phase s'arrête proprement si elle approche la réserve,
  et reprend seule.
- **Risque 1** : remettre les voies en ordre. Un circuit peut avoir une
  fourche, une variante ou un aller-retour sur la même voie. Si la
  fabrique ne trouve pas un ordre sûr, le circuit reste affiché mais pas
  transformable (comme un circuit en morceaux). L'essai de T1 le teste sur
  les deux circuits de Nancy ; `pytest` sur les cas difficiles.
- **Risque 2** : toucher une ligne fine au doigt sur la carte. L'essai de
  T1 l'éprouve sur les deux simulateurs ; la parade est une zone de
  toucher plus large que le trait.
- **Risque 3** : Nancy n'a que 2 circuits, tous deux d'un seul morceau. Les
  cas « plusieurs morceaux » et « fourche » se testent avec des données
  fabriquées (Jest et `pytest`), pas à l'écran.
- **Risque 4** : un circuit qui sort de la zone. Hors zone, le moteur ne
  peut rien recalculer. Les tronçons hors zone gardent leur tracé ; un
  message le dit (C8).
- **Ce que tu devras faire** : valider cette spec et répondre à la
  question 1 (fait) ; valider la maquette 12 complétée et l'ADR 0020 (T1) ;
  lancer le workflow « Fabriquer une zone » pour Nancy v6 en choisissant
  la branche de la phase (T2) ; valider la fusion.

## Question 1 : quand on modifie un GPX importé, que devient l'original ? (tranchée : on le remplace)

« Modifier » ouvre la création avec la trace du GPX. Au moment
d'« Enregistrer » :

- **Recommandation : on remplace le GPX par l'itinéraire modifié**, comme
  pour un itinéraire créé (phase 6). La liste reste courte. L'origine
  devient « GPX modifié le 9 nov. ». Le fichier d'origine reste là où tu
  l'avais pris (Fichiers, e-mail), et tu peux l'exporter avant de modifier.
- Autre choix : on garde le GPX intact, et « Enregistrer » crée un nouvel
  itinéraire (« Itinéraire du 9 nov. »). Tu gardes les deux, mais la liste
  s'allonge à chaque essai.

**Décision d'Émilien (9 novembre)** : on remplace le GPX par
l'itinéraire modifié. L'origine devient « GPX modifié le … ».

## Choix déjà faits par le pilotage (tu peux les changer)

1. Un point de passage environ tous les kilomètres, posé sur la trace.
   Assez pour retoucher un passage, pas trop pour la lisibilité.
   L'architecte peut ajuster cet écart après l'essai.
2. Le nom par défaut est le nom du circuit ; sans nom, son numéro (`ref`) ;
   sinon « Circuit du 9 nov. ».
3. Les circuits sont visibles dans la création, mais on ne peut les toucher
   que sur l'onglet Carte. Dans la création, toucher pose un point.
4. Aller simple : le départ est toujours le début du circuit, pour ne pas
   en couper une partie. Boucle : le point le plus proche de toi.
5. Remettre les voies en ordre se fait dans la fabrique (Python), pas dans
   l'app. La donnée est contrôlée une fois, sur le Mac et sur GitHub, et
   l'app reste simple. Prix : une zone Nancy v6 à publier.
6. Pas de bouton pour masquer les circuits en v1 : il n'y en a que deux
   autour de Nancy.
