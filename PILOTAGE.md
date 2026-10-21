# Pilotage — RutaPulse, app de navigation VTT

> Tableau de bord du projet. Relu au début de chaque session, mis à jour à la
> fin de chaque étape. Si une décision n'est pas ici ou dans un ADR, elle
> n'est pas prise.

## Objectif

1. **Réel :** apprendre le développement agentique de qualité.
2. **Support :** une app de navigation VTT digne d'un produit grand public.

## Règles du jeu

- Émilien est **Product Owner** : il valide le design, l'architecture, le
  découpage des phases, et toute phase coûteuse (temps ou tokens) **avant**
  son lancement.
- À l'intérieur d'une phase validée, la session principale tranche et annonce.
- Phases petites, chacune avec un livrable démontrable et des preuves.

## Phases

| # | Phase | État |
|---|---|---|
| 1 | Bonnes pratiques agentiques → [docs/01](docs/01-bonnes-pratiques-agentiques.md) | ✅ validé |
| 2 | Configuration agentique → [docs/02](docs/02-configuration-agentique.md) | ✅ fait, épreuve réussie |
| 3 | Cadrage produit → [docs/03](docs/03-cadrage-produit.md), puis architecture, design, découpage | 🔧 cadrage et architecture validés → [docs/04](docs/04-architecture.md) ; essai 1 ✅ ([résultats](docs/essais/01-calcul-hors-ligne.md)), essais 1, 2 et 3 ✅ ([résultats](docs/essais/)) ; maquettes et découpage proposés |
| 4+ | Développement par petites phases | — |

## Décisions prises

- 2026-10-19 — Dossier du projet : `~/dev_ai/vtt-nav` (nom provisoire).
- 2026-10-19 — Style : phrases simples et concrètes ; tout terme anglais ou sigle est traduit entre parenthèses.
- 2026-10-19 — Config validée : 5 sous-agents (architecte, designer et relecteur sur Opus 5.5 ; développeur et testeur sur Sonnet 5.5), circuit `/phase`, épreuve.
- 2026-10-19 — Dépôt public sur GitHub : e-mail noreply en config locale git.
- 2026-10-19 — Session principale : Opus 5.5, effort `high`.
- 2026-10-19 — Nom de l'app : RutaPulse. Dépôt public : github.com/Emilien1982/RutaPulse.
- 2026-10-19 — Pas de relecture sur GitHub (PR) pour l'instant : trop lourd pour le gain.
- 2026-10-19 — v1 : création d'itinéraires VTT (aussi hors ligne), suivi avec indications écrites et notification téléphone verrouillé, Android + iOS, test interne (voir docs/03).
- 2026-10-19 — V2 : guidage vocal, économiseur d'écran.
- 2026-10-19 — Préférences de stack d'Émilien : React Native (qu'il connaît bien) ; bibliothèques TanStack quand elles conviennent (il veut les découvrir).
- 2026-10-19 — TanStack DB retiré de la v1 : Query, qui lit SQLite, suffit.
- 2026-10-19 — Essais sur simulateurs iOS et Android, pour limiter les manipulations d'Émilien.
- 2026-10-19 — Stack validée : Expo + React Native, MapLibre, Valhalla sur le téléphone, TanStack Query/Store/Pacer (ADR 0001 à 0010 acceptés).
- 2026-10-19 — Zone test : autour de Nancy (forêt de Haye, Petite Suisse lorraine).
- 2026-10-20 — Essai 1 : calcul hors ligne prouvé sur simulateurs Android et iOS. Émilien juge les itinéraires praticables (C3), mais peu intéressants en VTT : trop de ville, de laies et de petites boucles, et les pistes sont évitées. La création hors ligne reste en v1.
- 2026-10-20 — Essai 1-bis : aucun réglage ne rend les itinéraires plus « VTT ». Valhalla cherche le chemin le moins coûteux entre les points, pas une belle boucle. On garde Valhalla et son réglage de l'essai 1.
- 2026-10-20 — Cadrage modifié : recalcul en direct, tracé à la main par tronçon, circuits VTT balisés d'OSM (fonction 9). Génération de boucles : plus tard.
- 2026-10-20 — Essai 3 : carte hors ligne prouvée (MapLibre + PMTiles, 29 Mo pour Nancy), circuits balisés dans le paquet (2 seulement autour de Nancy), GitHub Actions jugé faisable.
- 2026-10-21 — Style hors navigation : affiche des années 70 (style 3), personnage du vététiste récurrent, illustrations minimales en v1.
- 2026-10-21 — Design : direction B (contrastée) validée pour la navigation ; réponses aux 13 questions dans [docs/06](docs/06-decisions-design.md). Écrans hors navigation : styles « décalés » à explorer (piste : cartoon épuré).
- 2026-10-21 — Essai 2 : suivi d'1 h écran verrouillé prouvé sur Android (notification unique, mise à jour en 1,8 s au plus) et iOS (Live Activity, 1 s au plus). Corrections pour le développement dans l'ADR 0006.
- 2026-10-20 — Le dénivelé reste en v1 : il est fourni par Valhalla, son calcul n'est pas le problème.
- 2026-10-19 — Une session par phase d'exécution ; la session de pilotage reste avec Émilien.

## Décisions en attente

- Valider le style années 70 appliqué à tous les écrans hors navigation.
- Valider le découpage de la v1 en 11 phases ([docs/05](docs/05-decoupage-v1.md)).

## À vérifier sur un vrai téléphone (plus tard, en une fois)

- Temps de calcul d'un itinéraire.
- Consommation de batterie (écran allumé et verrouillé).
- Précision du GPS en forêt.
- Live Activity iOS avec un compte Apple gratuit (signature : 2 identifiants + App Group, sans push).
- Suivi verrouillé sur batterie : mode Doze et économies d'énergie des fabricants ; notification visible sur l'écran verrouillé (canal de faible importance).

## Prochaine étape

Émilien valide les maquettes (`design/`, avec 13 questions dans
`design/LISEZMOI.md`) et le découpage (docs/05). Ensuite : phase 0 (socle du
projet) et phase 1 (fabrique de zones), qui ne dépendent pas du design.
