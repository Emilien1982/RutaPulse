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
| 3 | Cadrage produit → [docs/03](docs/03-cadrage-produit.md), puis architecture, design, découpage | 🔧 cadrage validé, étude d'architecture en cours |
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
- 2026-10-19 — Une session par phase d'exécution ; la session de pilotage reste avec Émilien.

## Décisions en attente

- Valider la stack proposée par l'architecte (étape 3b).

## Prochaine étape

Étape 3b : l'`architecte` étudie les 6 risques techniques et propose la stack,
dans une session ouverte dans `vtt-nav`.

## Épreuve de la configuration (phase 2) : bilan
- Les 5 garde-fous testés marchent (développeur, testeur, relecteur) :
  messages de blocage reçus et fichiers vérifiés.
- Bug volontaire détecté deux fois : par le relecteur en lisant le code, et
  par le test de symétrie.
- Défaut trouvé et corrigé : une session démarrée dans le dossier parent
  garde un mauvais chemin vers les hooks. Règle : ouvrir la session dans
  `vtt-nav`.
- Faiblesse des tests : aucun cas général avec une valeur de référence.
  Consigne ajoutée au testeur.
- Limites connues, acceptées : le développeur et le testeur peuvent écrire
  par une commande shell (le relecteur contrôle le diff) ; architecte et
  designer non testés.
- Le code de l'épreuve est supprimé ; il reste dans l'historique git.
