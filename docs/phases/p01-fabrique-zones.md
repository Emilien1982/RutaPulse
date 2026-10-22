# Phase 1 — Fabrique de zones (spec, à valider)

> 21 octobre 2026. Spec de la session de pilotage, **à valider par Émilien**
> avant tout code. Découpage : [docs/05](../05-decoupage-v1.md), ligne 1.
> S'appuie sur l'ADR 0003 et sur les scripts des essais 1 et 3.

## Objectif

Fabriquer et publier un paquet de zone complet **sans ton Mac** : un clic
sur GitHub, et la zone est disponible au téléchargement pour l'app.

## Ce que tu verras à la fin

- Sur GitHub, dans l'onglet « Actions », une tâche « Fabriquer une zone » :
  tu choisis la zone, tu cliques, et environ 10 minutes plus tard la zone
  est publiée.
- Dans l'onglet « Releases » (versions publiées), la zone Nancy, avec ses
  fichiers, et un catalogue `catalogue.json` qui liste les zones.
- Ajouter une zone, c'est ajouter quelques lignes dans un fichier, sans
  écrire de code.

## Critères d'acceptation

| # | Critère | Comment on le vérifie |
|---|---|---|
| C1 | Un seul script fabrique un paquet complet : calcul (Valhalla), altitude, carte, relief, courbes, circuits balisés, description de la zone | Lancé sur le Mac pour Nancy : liste des fichiers et tailles exactes |
| C2 | Les zones sont décrites dans `zones/zones.json` (nom, limites, extrait OpenStreetMap à utiliser) ; ajouter une zone ne demande aucun code | Ajout d'une 2e zone d'essai par le seul fichier |
| C3 | Chaque fichier du paquet a son empreinte SHA-256 (somme de contrôle qui prouve qu'un fichier n'est pas abîmé) | Une empreinte recalculée après téléchargement est identique |
| C4 | Le catalogue `catalogue.json` décrit chaque zone : nom, limites, date des données, version, taille, empreintes, adresses de téléchargement | Validé par un schéma (description formelle du format) et par des tests |
| C5 | Le workflow GitHub Actions fabrique et publie la zone Nancy en release | Le run réussi sur GitHub, et la release visible |
| C6 | Un fichier publié se télécharge et correspond à son empreinte | Téléchargement depuis la release, puis comparaison |
| C7 | La zone se refait à l'identique, et calcule comme l'essai 1. (1) Refaite sur le Mac depuis l'adresse datée de l'extrait noté par la zone publiée : mêmes tracés, octet pour octet, sur les 5 références. (2) Sur les 5 références, distance à ± 2 % et D+ à ± 5 % de l'essai 1 ; un écart plus grand est expliqué | Script de comparaison de l'essai 1, lancé sur la zone publiée et sur la zone refaite. Critère modifié le 21 octobre 2026 par décision du pilotage (ADR 0003, « Risque C7 ») |
| C8 | Les mentions de licence sont dans le paquet (OpenStreetMap sous ODbL, OpenMapTiles, Mapterhorn, IGN) | Fichier `LICENCES.md` du paquet |
| C9 | Le script est testé : génération du catalogue, empreintes, lecture de `zones.json` | Tests lancés par la CI, avec leur nombre |
| C10 | Aucun secret : la publication utilise le jeton fourni automatiquement par GitHub Actions | Audit du workflow et de l'historique |

## Hors périmètre

- Le téléchargement dans l'app : phase 2.
- La demande de zone depuis l'app et la fabrication automatique : V2.
- La mise à jour automatique et régulière des zones.

## Tâches, dans l'ordre

| # | Qui | Tâche |
|---|---|---|
| T1 | `architecte` | Format du paquet et du catalogue : liste des fichiers, nom des releases, version, schéma de `catalogue.json`. Mise à jour de l'ADR 0003. |
| T2 | `developpeur` | `zones/` : un script unique qui reprend proprement ceux des essais 1 et 3 (sans les copier tels quels), `zones.json`, empreintes et `LICENCES.md`. Vérifié sur le Mac pour Nancy. |
| T3 | `developpeur` | Génération et validation de `catalogue.json`, avec tests. |
| T4 | `developpeur` | Workflow GitHub Actions : déclenché à la main, avec le choix de la zone ; publication en release ; mise à jour du catalogue ; mise en cache des 1,4 Go d'annexes de Planetiler, pour ne pas les retélécharger à chaque fois. |
| T5 | `testeur` | Téléchargement depuis la release, contrôle des empreintes, comparaison avec la zone des essais (C6, C7). |
| T6 | session de la phase | Casser exprès : une empreinte fausse doit être détectée, et un `zones.json` invalide doit être refusé. |

Chaque tâche de code passe ensuite par le `relecteur` et le `testeur`, lancés
un par un.

## Coût et risques

- **Taille : M**, soit environ 2 sessions, dans une session ouverte dans
  `vtt-nav`.
- **Risque 1** : GitHub n'autorise un déclenchement à la main que si le
  workflow existe déjà sur `main`. Pour l'essai, la session le déclenche par
  un push sur sa branche, puis le déclenchement à la main sera vérifié après
  la fusion.
- **Risque 2** : la CLI `gh` n'est pas connectée. La session lit les
  résultats par l'API publique de GitHub, limitée à 60 requêtes par heure.
  Elle doit donc espacer ses vérifications.
- **Risque 3** : les machines gratuites de GitHub. Les mesures de l'essai 3
  restent très en dessous des limites : 2,7 Go de mémoire sur 16, environ
  3 Go de disque sur 14.
- **Ce que tu devras faire :** rien pendant la phase. Après la fusion, un
  clic dans l'onglet « Actions », pour vérifier le déclenchement à la main.
