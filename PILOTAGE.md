# Pilotage — app de navigation VTT

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
| 3 | Cadrage produit, design, architecture, stack, découpage | ⏳ prochaine |
| 4+ | Développement par petites phases | — |

## Décisions prises

- 2026-10-19 — Dossier du projet : `~/dev_ai/vtt-nav` (nom provisoire).
- 2026-10-19 — Style : phrases simples et concrètes ; tout terme anglais ou sigle est traduit entre parenthèses.
- 2026-10-19 — Config validée : 5 sous-agents (architecte, designer et relecteur sur Opus 5.5 ; développeur et testeur sur Sonnet 5.5), circuit `/phase`, épreuve.
- 2026-10-19 — Dépôt public sur GitHub : e-mail noreply en config locale git.
- 2026-10-19 — Session principale : Opus 5.5, effort `high`.
- 2026-10-19 — Une session par phase d'exécution ; la session de pilotage reste avec Émilien.

## Décisions en attente

- Lancer la phase 3 (cadrage produit).

## Prochaine étape

Phase 3 : cadrage produit. Interviewer Émilien sur l'usage de l'app (qui,
quand, quoi), puis proposer le périmètre de la première version.

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
