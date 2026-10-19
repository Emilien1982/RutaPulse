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
| 2 | Configuration agentique → [docs/02](docs/02-configuration-agentique.md) | 🔧 config créée, épreuve à lancer |
| 3 | Cadrage produit, design, architecture, stack, découpage | — |
| 4+ | Développement par petites phases | — |

## Décisions prises

- 2026-10-19 — Dossier du projet : `~/dev_ai/vtt-nav` (nom provisoire).
- 2026-10-19 — Style : phrases simples et concrètes ; tout terme anglais ou sigle est traduit entre parenthèses.
- 2026-10-19 — Config validée : 5 sous-agents (architecte, designer et relecteur sur Opus 5.5 ; développeur et testeur sur Sonnet 5.5), circuit `/phase`, épreuve.
- 2026-10-19 — Dépôt public sur GitHub : e-mail noreply en config locale git.
- 2026-10-19 — Session principale : Opus 5.5.

## Décisions en attente

- Effort de la session principale : `high` recommandé (actuellement `medium`), à régler par Émilien dans l'app.

## Prochaine étape

Finir l'épreuve (branche `epreuve`) dans une session ouverte directement dans
`vtt-nav` : relecture avec git, bug volontaire, test des restrictions.

## Épreuve : constats à ce jour
- Développeur (Sonnet) : fonction correcte du premier coup, preuves fournies.
- Testeur (Sonnet) : 13 tests écrits d'après la spec, 13 réussis.
- Relecteur (Opus) : code jugé correct, mais il n'a pas pu lancer git.
- Défaut de configuration : la session a démarré dans `dev_ai`, le dossier
  parent. Les hooks des agents pointent alors vers un mauvais chemin et
  bloquent tout. Corrigé dans les fichiers (commit c96786f), mais cette
  session garde l'ancienne définition des agents. Règle : toujours ouvrir
  la session dans le dossier du projet.
