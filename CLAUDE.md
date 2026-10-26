# vtt-nav — app de navigation VTT

Deux objectifs : une app de qualité grand public, et apprendre à Émilien le
développement agentique. Émilien est le Product Owner (responsable du
produit) : il valide le design, l'architecture, le découpage des phases et
toute phase coûteuse avant son lancement.

## État du projet
- `PILOTAGE.md` : phase en cours, décisions prises et en attente. À lire en
  début de session, à mettre à jour à la fin de chaque étape.
- `docs/` : documents de travail et ADR (`docs/adr/`, une décision par fichier).
- `design/` : maquettes et valeurs de référence du design.

## Qui parle à Émilien
- Seule la session de pilotage parle à Émilien. Une session de phase ou
  d'essai ne lui pose jamais de question et ne termine pas son tour sur une
  question pour lui : elle envoie ses questions au pilotage (SendMessage),
  avec sa recommandation, et continue ce qui ne dépend pas de la réponse.

## Comment on travaille
- Une phase suit toujours le circuit de la skill `/phase`.
- La session principale ne code pas : elle délègue au `developpeur`, puis
  fait contrôler par le `relecteur` et le `testeur`.
- Une tâche à la fois. Un commit par tâche terminée et contrôlée.
- Une affirmation de succès s'accompagne d'une preuve : voir la skill `/verif`.
- Avant de bâtir sur une API de plateforme (GPS, cartes, capteurs), l'éprouver
  par un essai jetable.

## Style d'écriture (code, docs, messages)
- Français simple et concret. Une idée par phrase. Pas de formules creuses.
- Un terme anglais ou un sigle est traduit entre parenthèses à sa première
  apparition dans le document.
- Noms de code et commentaires en anglais (convention du code), le reste en
  français.

## Git
- Dépôt destiné à être public : e-mail noreply déjà réglé en config locale,
  ne pas le changer. Aucun secret dans le dépôt.
- Messages de commit en français, à l'impératif, une ligne de titre courte.

## Stack et règles de code
- App : Expo SDK 58 (React Native 0.88), TypeScript strict, Expo Router,
  dans `mobile/`. Choix détaillés : ADR 0001 à 0010.
- Structure, règles d'import entre dossiers, nommage et tests : ADR 0011.
  ESLint (contrôle du code) refuse un import interdit.
- Textes visibles en français, seulement dans `mobile/src/core/i18n/fr.ts`,
  lus par `t()`.
- `mobile/android/` et `mobile/ios/` sont générés : ne pas les modifier.

## Fabrique de zones (`zones/`)
- Python et pytest (ADR 0012) ; format des paquets et du catalogue : ADR 0003.
- Tests : `cd zones && .venv/bin/python -m pytest -q`. Fabriquer sur le Mac :
  `cd zones && .venv/bin/python -m zonefactory build <zone> --version <n>`.
- En production, les zones sont fabriquées sur GitHub (workflow « Fabriquer
  une zone », machine ARM, lancé à la main). Ajouter une zone : quelques
  lignes dans `zones/zones.json`, sans code.

## Commandes (depuis `mobile/`)
- `npm run verify` : types, puis lint, puis tests. Doit passer avant chaque
  commit. La CI (vérification automatique sur GitHub) lance la même commande.
- `npm run typecheck`, `npm run lint` (ESLint + Prettier, 0 avertissement),
  `npm test` (Jest), `npm run format` (formate tout).
- App sur simulateur : `npx expo run:ios --device "iPhone 17"` ou
  `npx expo run:android`. Shell non interactif : exporter
  `ANDROID_HOME=$HOME/Library/Android/sdk` et `LANG=fr_FR.UTF-8`.
- Parcours Maestro (outil de test de bout en bout) : `maestro test e2e/`.
- Un hook (crochet automatique) formate et contrôle chaque fichier de
  `mobile/` modifié par un agent (`.claude/hooks/qualite.py`). Une erreur
  ESLint bloque l'agent jusqu'à correction.
