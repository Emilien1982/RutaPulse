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
À définir en phase 3 (ADR à venir). Préférences d'Émilien : React Native ;
bibliothèques TanStack quand elles conviennent au besoin.
