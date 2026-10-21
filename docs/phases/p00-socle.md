# Phase 0 — Socle du projet (spec, à valider)

> 21 octobre 2026. Spec de la session de pilotage, **à valider par Émilien**
> avant tout code. Découpage : [docs/05](../05-decoupage-v1.md), ligne 0.

## Objectif

Une app Expo vide mais propre, qui démarre sur les deux simulateurs, avec
tous les garde-fous de qualité actifs **avant** d'écrire la première
fonctionnalité.

## Ce que tu verras à la fin

- L'app « RutaPulse » qui s'ouvre sur les simulateurs iOS et Android, avec
  ses 3 onglets vides (Carte, Itinéraires, Zones) et un écran Réglages vide.
- Sur GitHub, une coche verte sur chaque push : lint, types et tests vérifiés
  automatiquement.
- La preuve que chaque garde-fou bloque vraiment un défaut, parce qu'on l'a
  cassé exprès.

## Critères d'acceptation

| # | Critère | Comment on le vérifie |
|---|---|---|
| C1 | L'app démarre sur le simulateur iOS et l'émulateur Android, en version de développement | Captures des deux simulateurs |
| C2 | Les 3 onglets et l'écran Réglages s'affichent, avec les noms français, et la navigation de l'un à l'autre marche | Test Maestro (outil de test de bout en bout) sur les deux plateformes |
| C3 | TypeScript (JavaScript typé) en mode strict, 0 erreur | `npm run typecheck` |
| C4 | Lint (contrôle de style) et formatage, 0 erreur | `npm run lint` |
| C5 | Jest (outil de test) et Testing Library : au moins un test d'écran qui passe | `npm test`, avec le nombre de tests exécutés |
| C6 | Une seule commande lance tout | `npm run verify` = types + lint + tests |
| C7 | Un hook (crochet automatique) de Claude Code formate et vérifie chaque fichier modifié par un agent | Écrire un fichier mal formaté : le hook le corrige ou le signale |
| C8 | La CI (vérification automatique sur GitHub) lance `verify` à chaque push et refuse un défaut | Un push avec un test cassé exprès donne une croix rouge, puis la correction redonne une coche verte |
| C9 | La structure du code et les règles sont écrites | ADR 0011, et `CLAUDE.md` mis à jour (commandes, règles) |
| C10 | Aucune donnée personnelle ni secret dans le dépôt | Audit avant le push |

## Hors périmètre

- La carte, le calcul d'itinéraire, les données : phases 1 à 3.
- Le style années 70 et la direction B : seulement les noms des écrans, sans
  mise en forme.
- La distribution (APK, TestFlight) : phase 10.
- Le code des essais : on ne le copie pas.

## Tâches, dans l'ordre

| # | Qui | Tâche |
|---|---|---|
| T1 | `architecte` | ADR 0011 : structure du dépôt (`mobile/` pour l'app, `zones/` pour la fabrique de la phase 1), organisation du code de l'app (écrans, fonctionnalités, modules natifs, logique pure), règles de nommage, et règles sur ce qui doit être testé. |
| T2 | `developpeur` | Créer le projet Expo SDK 58 dans `mobile/`, TypeScript strict, Expo Router (navigation entre écrans) avec les 3 onglets et l'écran Réglages. Identifiant de l'app : `fr.rutapulse.app`. |
| T3 | `developpeur` | ESLint (lint), Prettier (formatage), Jest + Testing Library avec un premier test, et les scripts `typecheck`, `lint`, `test`, `verify`. |
| T4 | session de pilotage | Hooks de Claude Code (formatage et lint après chaque modification) ; mise à jour de `CLAUDE.md` et de la skill `/verif` avec les vraies commandes. C'est de la configuration protégée : les agents n'y ont pas accès. |
| T5 | `developpeur` | Workflow GitHub Actions : `verify` à chaque push et à chaque demande de fusion. |
| T6 | `testeur` | Maestro : un scénario « l'app démarre, les 4 écrans s'ouvrent », sur les deux simulateurs, avec captures. |
| T7 | session de pilotage | Casser exprès chaque garde-fou (formatage, lint, test, CI), constater qu'il bloque, puis réparer. |

Chaque tâche de code passe ensuite par le `relecteur` et le `testeur`.

## Coût et risques

- **Taille : M**, soit environ 2 sessions, enchaînées dans une session
  ouverte dans `vtt-nav`.
- **Risque 1** : le SDK 58 d'Expo est très récent. Repli prévu : le SDK 57
  (ADR 0001).
- **Risque 2** : Maestro sur le simulateur iOS 26.5. On le mesure en T6 ;
  si Maestro bloque, le critère C2 se prouve par des captures, et on le note.
- **Risque 3** : les machines gratuites de GitHub Actions sont limitées en
  minutes pour les dépôts privés, mais pas pour un dépôt public. Le nôtre
  est public : rien à payer.
