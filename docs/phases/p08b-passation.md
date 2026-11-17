# Phase 8b — Passation après T6 (fin de phase)

> 17 novembre 2026. Note de la session de phase. La spec
> ([p08b-suivi-velo-finitions.md](p08b-suivi-velo-finitions.md)) fait foi.
> Les résultats sont dans
> [p08b-suivi-velo-resultats.md](p08b-suivi-velo-resultats.md).

## État exact

- Worktree : `/Users/utilisateur/dev_ai/vtt-nav/.claude/worktrees/eloquent-kalam-fad4f0`,
  branche `claude/phase-8b-finitions-suivi-c712c4`, **poussée**, non
  fusionnée (accord d'Émilien attendu).
- Commits de cette session, après la passation de T3 (`7c7abe5`) :
  - `adf5d6c` **T4** trait de liaison (C11) et distance de l'arrivée (C12) ;
  - `27177be` **T5** parcours Maestro et preuves (C13, C14) ;
  - `1d668aa` **T6** comparaison du designer (C16) ;
  - `d4af60c` résultats de la phase et écarts T4 dans l'ADR 0021 ;
  - puis le commit de cette passation et du run de la CI.
- `npm run verify` : 270 suites, 3052 tests réussis. `pytest` : 280.
- Pas de tâche de corrections : le designer n'a trouvé aucun écart
  bloquant. Six écarts mineurs (M1 à M6) sont reportés.
- Simulateurs : la release de `adf5d6c` est installée sur `iPhone 17` et
  sur `emulator-5584`, luminosité remise sur « Automatique ».

## Décisions du pilotage pendant cette session

- C12b : remède du § 11.2 non appliqué, « tenu avec réserve : léger
  tassement pendant la seconde du recadrage sur iOS, absent à l'arrêt ».
- Effacement du DerivedData de référence par le développeur : noté, sans
  dégât ; consigne « aucun effacement hors du worktree » répétée.

## Pièges appris dans cette session

- Les constructions iOS mangent la place vite (34 Go → 19 Go pour trois
  constructions). Une seule construction par plateforme.
- Mesure d'une version de référence : un worktree jetable n'a ni
  `android/`, ni `ios/`, ni `node_modules` ; le développeur les a copiés
  ou liés.
- Le suivi se termine dès 30 m du dernier point : l'état « Arrivée » sans
  chiffre ne se voit qu'en démarrant près de l'arrivée.
- Android, onglet Carte : le fournisseur d'essai « fused » n'accepte pas
  de cap, donc pas de flèche sur l'émulateur.
- Une capture peut être prise avant la première position : regarder
  chaque image citée avant de l'écrire comme preuve.
