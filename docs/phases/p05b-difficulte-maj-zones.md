# Phase 5b — Difficulté VTT et mise à jour des zones (spec validée)

> 2 novembre 2026. Spec de la session de pilotage, **validée par Émilien
> le 2 novembre 2026**, avec les choix déjà faits. Née de la décision d'Émilien du
> 28 octobre 2026 (question 1 de la [phase 5](p05-infos-itineraire.md)).
> Découpage : [docs/05](../05-decoupage-v1.md), ligne 5 (la difficulté).
> Fonction du cadrage : 3 (fin). S'appuie sur l'ADR 0003 (paquet et
> catalogue), l'ADR 0005 (sources des infos), l'ADR 0012 (fabrique),
> l'ADR 0013 (téléchargement des zones), l'ADR 0017 (calcul des infos) et
> les maquettes v1/20 et v1/41.

## Objectif

Savoir si un itinéraire est technique avant de partir, quand la carte le
sait. Et pouvoir recevoir une zone plus récente sans tout effacer.

## L'échelle de difficulté VTT (`mtb:scale`)

OpenStreetMap (OSM, la carte libre et collaborative) note la difficulté
d'un chemin pour le VTT avec l'étiquette `mtb:scale`, de 0 à 6. L'app
l'affiche sous la forme S0 à S6, comme la maquette 20 :

| Niveau | Mot affiché | À quoi ça ressemble |
|---|---|---|
| S0 | très facile | Chemin roulant, sans obstacle. Pente douce |
| S1 | facile | Petits obstacles : racines, pierres. Virages larges |
| S2 | moyen | Obstacles plus gros, petites marches, sol meuble. Virages serrés |
| S3 | difficile | Blocs, marches hautes, épingles. Bonne technique de pilotage |
| S4 | très difficile | Très raide, marches et épingles serrées. Technique de trial |
| S5 | extrême | Passages à peine roulables, même pour un expert |
| S6 | non roulable | Vélo porté |

- Les valeurs avec « + » ou « − » (par exemple `1+`) comptent dans leur
  niveau entier (S1). Une valeur qui n'est pas un niveau de 0 à 6 est
  ignorée : le chemin est « inconnu ».
- Autour de Nancy, la difficulté n'est connue que sur environ 4 % des
  sentiers et 1,4 % des pistes (ADR 0005). Le plus souvent, l'app dira
  « inconnue ». C'est voulu (cadrage, fonction 3).
- On ne montre **pas** `sac_scale` (difficulté de randonnée) : une 2e
  échelle, avec d'autres lettres, embrouillerait.

## Ce que tu verras à la fin

- **Sur l'écran Infos**, une ligne « Difficulté », comme dans la
  maquette 20 : par exemple « S1 (facile) sur 4 % ; inconnue sur 96 %, la
  carte la donne rarement. »
- **Sur GitHub**, une zone Nancy v4 qui contient la table des
  difficultés. Tu la fabriques toi-même avec le workflow « Fabriquer une
  zone », en cours de phase.
- **Sur l'écran Zones**, ta zone Nancy v3 déjà téléchargée affiche
  « Mise à jour disponible ». Un bouton télécharge la v4 à côté de la v3.
  La v3 reste utilisable pendant le téléchargement. Quand la v4 est prête,
  l'app passe dessus et efface la v3.
- Tout marche en mode avion, sauf le téléchargement, bien sûr.

## Critères d'acceptation

| # | Critère | Comment on le vérifie |
|---|---|---|
| C1 | **Essai d'abord** : `trace_attributes` renvoie l'identifiant de voie OSM (`edge.way_id`) hors ligne, sur Android et iOS, avec la zone Nancy v3. Ces identifiants sont bien ceux des voies OSM traversées | Essai jetable de T1, sorties brutes gardées, contrôle de quelques voies sur l'extrait OSM |
| C2 | La fabrique ajoute au paquet une table « identifiant de voie → difficulté VTT », pour les voies de la zone qui ont `mtb:scale`. Format décrit dans l'ADR 0003 (mis à jour). Les valeurs invalides sont écartées et comptées dans le journal de fabrication | Tests pytest ; fabrication de Nancy sur le Mac ; comptage comparé à une requête osmium indépendante |
| C3 | Le paquet reste conforme : `SHA256SUMS`, catalogue, contrôle de la release publiée. Une app de la phase 5 qui lirait le nouveau catalogue ne plante pas | Tests pytest ; test Jest de `parseCatalogue` sur le nouveau catalogue |
| C4 | **Zone Nancy v4 publiée** par le workflow GitHub, lancé à la main par Émilien depuis la branche de la phase. Catalogue en version 4. `sha256sum -c` passe sur la release téléchargée | Run GitHub réussi ; contrôle par le pilotage |
| C5 | Le calcul de la difficulté vit dans `core/` : chaque tronçon reçoit le niveau de ses voies, puis les parts de chaque niveau et de « inconnue » sont calculées en distance. Elles font 100 %. Un tronçon à la main compte comme « inconnue » | Tests sur des cas connus |
| C6 | **Même difficulté que le Mac** : sur les 5 itinéraires de référence, plus un 6e choisi exprès sur des voies notées, les parts de l'app sont égales à 1 point près à celles calculées sur le Mac avec la même table | Script de comparaison rejouable, sur les deux plateformes, avec la zone v4 |
| C7 | L'écran Infos montre la ligne « Difficulté » de la maquette 20 : les niveaux connus, du plus fréquent au moins fréquent, puis « inconnue ». Une part sous 1 % est écrite « moins de 1 % ». Sans aucune donnée : « Difficulté inconnue, la carte la donne rarement. » | Tests ; captures release |
| C8 | Une zone sans table de difficulté (la v3) marche comme avant : la ligne dit « inconnue », sans erreur | Test ; capture |
| C9 | L'écran Zones signale une version plus récente d'une zone prête, d'après le catalogue, selon la maquette 41 complétée par le designer. La mise à jour se lance seulement à la main (décision de design 10) et suit la règle « Wi-Fi seulement » | Tests ; captures |
| C10 | **Mise à jour sûre** : la nouvelle version se télécharge dans son propre dossier (ADR 0013). L'ancienne reste en service jusqu'à la fin des contrôles. Après une coupure ou l'app fermée, on reprend ou on annule, et l'ancienne version marche toujours. Jamais de mélange des deux versions, jamais de zone à moitié prête | Tests avec un faux réseau ; essai de coupure sur simulateur |
| C11 | Le passage à la nouvelle version ne casse rien : le moteur de calcul et la carte rouvrent la nouvelle version au bon moment (règle fixée par l'ADR 0018). Un itinéraire en cours de création n'est ni perdu ni faussé. L'ancienne version est effacée seulement quand plus rien ne la lit | Tests ; parcours sur simulateur |
| C12 | Les infos d'un itinéraire de 40 km s'affichent toujours en moins de 1 s, en version finale (comme C9 de la phase 5) | Mesure en release, même méthode |
| C13 | Parcours Maestro : à partir de Nancy v3 installée, mettre à jour vers la v4, créer un itinéraire, ouvrir les infos, voir la ligne « Difficulté » | Réussi sur Android et iOS (iOS sans mode avion) |
| C14 | `npm run verify` passe, `pytest` passe, la CI est verte | Sorties et run GitHub |
| C15 | Captures release sur les deux simulateurs, comparées par le designer aux maquettes 20 et 41 | Comparaison écrite dans `design/comparaisons/` |

## Hors périmètre

- La difficulté **sur la carte** (couleur des chemins selon `mtb:scale`) :
  plus tard, si tu le demandes.
- Choisir son itinéraire selon la difficulté (éviter le S3, par exemple) :
  Valhalla ne connaît pas `mtb:scale` (ADR 0002).
- `sac_scale` (difficulté de randonnée) et `mtb:scale:uphill` (difficulté
  en montée).
- Mise à jour automatique des zones, ou vérification en arrière-plan : la
  mise à jour reste à la main (décision de design 10).
- Une 2e zone ou une zone côtière.
- Effacer les anciennes releases sur GitHub : voir la question 1.

## Tâches, dans l'ordre

| # | Qui | Tâche |
|---|---|---|
| T1 | `developpeur` pour l'essai, puis `architecte` et `designer` | **Essai jetable** : `trace_attributes` avec `edge.way_id`, hors ligne, sur les deux simulateurs (C1). Puis l'**ADR 0018** : format de la table, place dans le paquet et le catalogue (ADR 0003 mis à jour), calcul de la difficulté (ADR 0017 complété), mise à jour d'une zone et moment du passage à la nouvelle version (ADR 0013 complété). Le designer ajoute à la maquette 41 l'état « Mise à jour disponible » et la mise à jour en cours. **Le pilotage te montre cette maquette pour validation** |
| T2 | `developpeur` | La fabrique : la table des difficultés, ses tests, une fabrication de Nancy sur le Mac |
| T3 | **Émilien** | Lancer le workflow « Fabriquer une zone » sur la branche de la phase (le pilotage te donne le pas-à-pas). Le pilotage contrôle la release v4 et le catalogue |
| T4 | `developpeur` | L'app : la mise à jour d'une zone (écran Zones, téléchargement à côté, passage, effacement de l'ancienne version) |
| T5 | `developpeur` | L'app : `edge.way_id` dans la demande de terrain, lecture de la table, calcul dans `core/`, ligne « Difficulté » sur l'écran Infos |
| T6 | `testeur` | Comparaison au Mac (C6), mesure C12, parcours Maestro C13, essai de coupure C10, captures release |
| T7 | `designer` | Compare les captures aux maquettes 20 et 41, et liste les écarts |

Chaque tâche de code passe ensuite par le `relecteur`, puis par le
`testeur`, un par un. Une tâche de corrections suit T7 si le designer trouve
des écarts bloquants.

## Coût et risques

- **Taille : M**, soit 2 sessions de travail, enchaînées dans une session
  de phase. Échelle de docs/05 : **P** (petite) = 1 session, **M**
  (moyenne) = 2 sessions, **G** (grande) = 3 sessions ou plus.- **Risque 1** : `edge.way_id` est documenté par Valhalla, mais pas encore
  éprouvé avec valhalla-mobile sur le téléphone. L'essai de T1 le prouve
  avant tout code. Sans lui, il faudrait retrouver les voies par leur
  géométrie : plus lourd, et la phase repasserait par toi.
- **Risque 2** : la v4 part d'un extrait OSM plus récent. Les tracés de
  référence peuvent changer un peu. Les tests de la phase 5 gardent leurs
  données v3 ; la comparaison C6 se fait sur la v4.
- **Risque 3** : le passage à la nouvelle version pendant que le moteur ou
  la carte lisent encore l'ancienne. L'ADR 0018 fixe le moment sûr
  (choix 3 plus bas) ; C10 et C11 le contrôlent.
- **Ce que tu devras faire** : valider cette spec et répondre à la
  question 1 ; valider la maquette de la mise à jour (T1) ; lancer le
  workflow (T3, environ 5 minutes de ta part) ; valider la fusion.

## Question 1 : combien de versions de zone garder sur GitHub ? (tranchée : les 2 dernières)

Il y a déjà 3 releases de Nancy (v1 à v3), d'environ 110 Mo chacune. La v4
fera la 4e. GitHub ne facture rien et ne limite pas le total, mais la page
des releases s'encombre.

- **Recommandation : garder les 2 dernières** (la v4 et la v3). Une zone
  déjà téléchargée continue de marcher même si sa release est effacée : les
  fichiers sont sur le téléphone. Seul un téléchargement de la v3 commencé
  avant la publication de la v4 échouerait, puis proposerait la v4.
  Tu effaces toi-même la v1 et la v2 sur GitHub, après la fusion (le
  pilotage te dit où cliquer).
- Autre choix : tout garder, pour l'historique.

**Décision d'Émilien (2 novembre)** : garder les 2 dernières versions.

## Choix déjà faits par le pilotage (tu peux les changer)

1. La ligne « Difficulté » donne la part de chaque niveau connu, puis la
   part « inconnue », comme la maquette 20. Pas de note globale unique.
2. Un tronçon à la main compte comme « inconnue ».
3. Le passage à la nouvelle version se fait quand aucune création
   d'itinéraire n'est ouverte. Si tu crées un itinéraire au moment où la v4
   est prête, l'app finit la création sur la v3 et passe à la v4 ensuite.
   L'architecte peut proposer plus simple dans l'ADR 0018.
4. Le workflow est lancé sur la branche de la phase, sans fusion
   préalable : la v4 est publiée avant la fusion, ce qui ne gêne pas l'app
   actuelle (elle télécharge un fichier de plus, sans s'en servir).
