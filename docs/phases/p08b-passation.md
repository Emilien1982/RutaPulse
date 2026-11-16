# Phase 8b — Passation après T3

> 17 novembre 2026, nuit. Note de la session de phase pour la session qui
> reprend dans le même worktree. La spec
> ([p08b-suivi-velo-finitions.md](p08b-suivi-velo-finitions.md)) fait foi.

## État exact

- Worktree : `/Users/utilisateur/dev_ai/vtt-nav/.claude/worktrees/eloquent-kalam-fad4f0`,
  branche `claude/phase-8b-finitions-suivi-c712c4`. Rien de poussé. Rien
  en cours, `git status` propre.
- Commits de la phase, dans l'ordre :
  - `d351964` preuves de l'essai T1 ;
  - `a04b950` ADR 0021 (complément 8b) et maquettes 90, 30, 31b ;
  - `dc68b1b` complément 8b accepté (validé par Émilien le 16 novembre,
    questions (a) et (b) : oui) ;
  - `b3570a9` **T2** luminosité (C9) ;
  - `e62cb17` **T3** onglet Carte et point du suivi (C10).
- `npm run verify` : 265 suites, 3036 tests réussis sur `e62cb17`
  (`docs/phases/preuves/p08b/t3/verify-apres-d1.txt`).
- Simulateurs : la release de `e62cb17` est installée sur `iPhone 17` et
  sur `emulator-5584` (zone Nancy v6 et itinéraires gardés en place).
- Place : 34 Go libres. Quota de la semaine : 39 %.

## Preuves déjà écrites

- T1 : `docs/phases/preuves/p08b/t1-essai/LISEZMOI.md`.
- T2 : `docs/phases/preuves/p08b/t2/LISEZMOI.md` (section « Après
  corrections ») ; comparaison du designer
  `design/comparaisons/p08b-t2-luminosite.md` (écarts B1 et M2 corrigés).
- T3 : `docs/phases/preuves/p08b/t3/LISEZMOI.md` (section « Après
  correction de D1 »). Le designer n'a pas encore comparé les captures de
  T3 : ce sera en T6.
- Décisions prises pendant la phase : ADR 0021, « Écarts acceptés pendant
  la phase 8b ».

## Prochaine tâche : T4

Trait de liaison sur l'écran Infos et pendant le suivi (C11), et les deux
remarques du testeur de la 8a (C12). Règles : ADR 0021, § 10 et § 11.
- § 10 : l'écran Infos d'un itinéraire créé sur une zone en service le
  dessine déjà ; il manque dans `PlainInfos` (cas `leaves`) et pendant le
  suivi.
- § 11 : « Arrivée » prend la même distance que « Reste », et dit
  seulement « Arrivée » sous 30 m ; pour les pointillés de l'écart, le
  développeur journalise d'abord le zoom prévu et le zoom réel (contrôle
  T4-a).

Puis T5 (testeur : traces rejouées, C13, Maestro C14, captures release),
T6 (designer : 30, 31b, v1/80, v1/90), les résultats dans
`docs/phases/p08b-suivi-velo-resultats.md`, la poussée de la branche et
la CI.

## Ce qui reste non prouvé (à reprendre en T5)

- **C13, ouverture de l'onglet Carte** : il faut une version de référence
  (la branche avant T3, par exemple `b3570a9`) construite en release, et
  un journal temporaire « carte chargée », pour comparer.
- Pincement à deux doigts pendant « suit » (impossible sur les
  simulateurs : phase 10).
- Cas « toucher sans position, puis glissement » sur iOS (le simulateur
  garde une position).
- Rayon du halo mesuré à l'image ; flèche de l'onglet Carte sur Android.
- iOS : la luminosité réelle (le simulateur ignore l'écriture).
- iOS : pendant la perte du GPS, le halo bleu clair reste autour du rond
  gris : à juger par le designer en T6.

## Pièges

- **Garde-fou du testeur** : il refuse au testeur d'écrire un
  `LISEZMOI.md` de preuves. Accord du pilotage : le testeur met le texte
  dans son compte rendu, et la session de phase écrit le fichier, en
  vérifiant que chaque chemin cité existe.
- Le relecteur ne peut lancer que des commandes git simples : lui donner
  les diffs par chemin (scratchpad) et la sortie de `npm run verify`.
- **Émulateur Android et onglet Carte** : l'onglet demande une précision
  « BALANCED » et le GPS de l'émulateur reste éteint ; `geo fix` n'y
  arrive pas. Contournement du testeur : fournisseur d'essai « fused »
  (`docs/phases/preuves/p08b/t3/a-mock.sh`, `a-mock-rejeu.py`), sans cap.
  L'écran de suivi, lui, reçoit bien `geo fix`.
- iOS : `simctl location clear` n'empêche pas l'app de recevoir l'ancienne
  position.
- Android : deux `input tap` rapprochés ouvrent la fiche d'un circuit ;
  pour un double toucher, deux `input swipe` de 40 ms à 150 ms d'écart.
- Les imitations de MapLibre dans Jest ne valident pas les filtres :
  `mobile/src/features/map/UserPuckLayersT3Testeur.test.tsx` passe chaque
  filtre au validateur officiel. Faire de même pour toute nouvelle couche
  (trait de liaison de T4).
- iPhone SE du Mac sous iOS 15.2 : l'app (iOS 16.4 au moins) ne s'y
  installe pas.
- Les preuves pèsent lourd (environ 120 Mo pour T1 à T3, PNG pleine
  taille) ; c'était déjà le cas en 8a (95 Mo).
- Règles de toujours : jamais `npx expo run:android` (téléphone
  R5CR21B1KDW souvent branché) ; `df -h /` avant chaque construction ;
  pas de recherche depuis `/` ; processus arrêtés par PID.
