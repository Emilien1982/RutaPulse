# Phase 0 — Socle du projet : résultats

> 21 octobre 2026. Spec : [p00-socle.md](p00-socle.md). Branche
> `claude/phase-0-socle-db4136`. Captures : [captures/](captures/).

## Verdict

**Le socle est en place, et chaque garde-fou bloque un défaut quand on le
casse exprès.** L'app RutaPulse démarre sur les deux simulateurs, avec ses
4 onglets (Carte, Itinéraires, Zones, Réglages). `npm run verify` passe en
local et sur GitHub.

Une limite : le hook (crochet automatique) de Claude Code est prouvé avec le
même message que Claude Code lui envoie, mais pas encore dans une vraie
session (voir C7).

Changement en cours de phase : Réglages est devenu un **4e onglet** (décision
de design du 21 octobre, docs/06, « Retouches »). Les critères C1 et C2
parlent donc de 4 onglets.

## Critères

| # | Critère | Attendu | Mesuré | Verdict | Preuve |
|---|---|---|---|---|---|
| C1 | Démarrage, version de développement | Captures iOS et Android | L'app s'ouvre sur l'onglet Carte, sur l'iPhone 17 (iOS 26.5) et sur le Pixel 6 (Android 14) | **oui** | `captures/p00-c1-ios.png`, `captures/p00-c1-android.png` (avant le passage à 4 onglets) |
| C2 | 4 écrans, noms français, navigation | Maestro (outil de test de bout en bout) sur les 2 plateformes | Scénario `mobile/e2e/open-all-screens.yaml` : 14 étapes réussies, 3 optionnelles sautées, 0 échec, sur iOS et sur Android. Avec « Zonex » au lieu de « Zones », il échoue | **oui** | `captures/p00-c2-{ios,android}-{carte,itineraires,zones,reglages}.png` |
| C3 | TypeScript strict, 0 erreur | `npm run typecheck` | `strict: true` dans `tsconfig.json` ; `tsc --noEmit` sort avec le code 0 | **oui** | sortie de `npm run verify` |
| C4 | Lint et formatage, 0 erreur | `npm run lint` | ESLint (contrôle du code) avec 0 avertissement toléré, puis `prettier --check .` : code 0 | **oui** | idem |
| C5 | Au moins un test d'écran | `npm test` | 5 suites, **9 tests** réussis : les 4 écrans et leurs titres, plus `t()` | **oui** | idem |
| C6 | Une seule commande | `npm run verify` | Enchaîne types, lint et tests, et s'arrête à la première erreur | **oui** | `mobile/package.json` |
| C7 | Hook de formatage et de contrôle | Fichier mal formaté corrigé ou signalé | Le script `.claude/hooks/qualite.py` reformate un fichier mal formaté (code 0). Il refuse une erreur ESLint (code 2 et message renvoyé à l'agent). Mais Claude Code lit les hooks au démarrage d'une session : dans cette session, ni moi ni un sous-agent ne l'avons vu se déclencher | **partiel** : script prouvé, déclenchement réel non vu | T7 ci-dessous |
| C8 | La CI lance `verify` et refuse un défaut | Vert, rouge exprès, vert | Job `verify` : réussi (a484d1c), échoué à l'étape « Run npm run verify » (b794650, test cassé exprès), réussi (a181152) | **oui** | [vert](https://github.com/Emilien1982/RutaPulse/actions/runs/39626166512), [rouge](https://github.com/Emilien1982/RutaPulse/actions/runs/39627330409), [vert](https://github.com/Emilien1982/RutaPulse/actions/runs/39627542298) |
| C9 | Structure et règles écrites | ADR 0011, `CLAUDE.md` | ADR 0011 (statut « Proposé ») ; `CLAUDE.md` : sections « Stack et règles de code » et « Commandes » ; skill `/verif` : commandes du projet | **oui** | `docs/adr/0011-structure-du-code.md` |
| C10 | Aucun secret, aucune donnée personnelle | Audit avant le push | 0 occurrence des motifs `sk-ant-`, `AIza`, `ghp_`, `gsk_`, clé privée, dans l'arbre et dans l'historique de la branche. Auteur et committer en noreply sur tous les commits. Aucun chemin local ni e-mail dans les fichiers de la phase | **oui** | audit refait avant chaque push |

## T7 — Chaque garde-fou cassé exprès

| Garde-fou | Défaut introduit | Blocage constaté | Réparation |
|---|---|---|---|
| Formatage (Prettier) | `export   const   hookProbe  =   (a:number,b:number)=>{return a+b}` dans `src/core/hookProbe.ts` | `npm run verify` : `[warn] src/core/hookProbe.ts`, code 1. Le hook reformate le fichier (code 0), puis `verify` repasse (code 0) | Fichier supprimé |
| Lint (ESLint) | `import { Text } from 'react-native'` dans `src/core/` (interdit par l'ADR 0011) | `no-restricted-imports … core/ must stay pure TypeScript`, `verify` code 1. Le hook sort avec le code 2 et le message « ESLint refuse … » | Fichier supprimé, `verify` code 0 |
| Test (Jest) | `toBe('Zonex')` au lieu de `'Zones'` | `Expected: "Zonex" Received: "Zones"`, `Tests: 1 failed, 8 passed, 9 total`, code 1 | Valeur remise : 9 tests réussis, code 0 |
| CI (GitHub Actions) | Le même test cassé, poussé (commit b794650) | Job en échec en 41 s, étape « Run npm run verify » en échec : [run](https://github.com/Emilien1982/RutaPulse/actions/runs/39627330409) | Commit de retour a181152 : job réussi en 31 s, [run](https://github.com/Emilien1982/RutaPulse/actions/runs/39627542298) |

Le relecteur a aussi trouvé un défaut que `verify` attrape : le premier
scénario Maestro n'était pas formaté. `prettier --check` l'a refusé ; le
formatage l'a réparé. Le hook l'aurait corrigé tout seul dans une session
qui l'a chargé.

## Déroulé et allers-retours

- T1 (architecte) : ADR 0011. Deux écarts à la spec, à faire valider :
  écrans dans `mobile/src/app/` (modèle d'Expo depuis le SDK 55), modules
  natifs dans `mobile/modules/` (place par défaut de l'autolinking).
- T2 (développeur) : aucun aller-retour. Le relecteur propose de ne pas
  garder `features/navigation/` : chaque fonctionnalité exporte son titre.
- T3 (développeur) : 1 aller-retour. Le relecteur a trouvé deux trous dans
  la règle d'import (le dossier `modules/`, et les chemins relatifs). Le
  testeur a écrit les 3 tests d'écran qui manquaient.
- 4e onglet (développeur) : diff de 3 fichiers relu par la session
  principale, contrôlé par Maestro en T6.
- T4 (session principale) : hook `qualite.py`, `CLAUDE.md`, `/verif`. Le
  garde-fou des agents (`garde.py`) reconnaît maintenant `e2e/` comme
  dossier de tests, sinon le testeur n'aurait pas pu écrire le scénario.
- T5 (développeur) : 1 aller-retour. Versions des actions passées de v5 à
  v7 (vérifiées en ligne), et un commit de `main` n'annule plus le
  précédent.
- T6 (testeur) : le risque 2 ne s'est pas réalisé, Maestro marche sur
  iOS 26.5. Sur iOS, le nom d'un onglet est « Itinéraires, tab, 2 of 4 » :
  le scénario tape donc `Itinéraires.*`.
- Le testeur de T2 a travaillé avec celui de T3, car Jest n'existait pas
  encore en T2.

## Versions et outils installés

- App : expo 58.0.16, react-native 0.88.0, expo-router 58.0.24,
  typescript 6.0.3, expo-dev-client 58.0.14, react-dom 19.3.0 (exigé par
  expo-router ; sans lui, `npm install` échoue sur un conflit de versions).
- Qualité : eslint 9.39, eslint-config-expo 58.0.4, prettier 3.9,
  jest 30.5, jest-expo 58.0.11, @testing-library/react-native 14.1.0,
  test-renderer 1.3.0.
- CI : Node 24 (version LTS, support long), actions/checkout v7,
  actions/setup-node v7.
- Sur le Mac : **Maestro 2.11.0** (CLI), dans `~/.maestro/`, téléchargé
  depuis la publication officielle sur GitHub, somme SHA-256 vérifiée.
  Java 17 était déjà là.

## Incident GitHub pendant la phase

Le 21 octobre vers 17 h 30, GitHub Actions était en « service dégradé »
(page de statut de GitHub, incident sur les délais de traitement). Effet
constaté : pour les commits a484d1c et a181152, le **job** `verify` est
terminé et réussi (toutes ses étapes en succès, lues par l'API publique),
mais le **run** qui le contient est resté affiché « en cours », sans
conclusion, pendant plus de 15 minutes. Le run rouge (b794650) s'est bien
terminé « failure ». La preuve de C8 repose donc sur l'état des jobs. Il
faudra revoir les runs une fois l'incident fini.

## À reporter dans PILOTAGE.md (par le pilotage, à la fusion)

- Phase 0 (socle) faite sur la branche `claude/phase-0-socle-db4136`.
- Décision en attente : accepter l'ADR 0011, avec ses deux écarts à la spec
  (écrans dans `mobile/src/app/`, modules natifs dans `mobile/modules/`).
- Décision en attente : prouver le hook de qualité dans une nouvelle session
  (C7).
- Prise en cours de phase : Réglages est un 4e onglet (docs/06).

## Ce qui reste non vérifié

- **C7 en conditions réelles** : il faut une session de Claude Code qui
  démarre dans ce dépôt après l'ajout du hook. Essai à faire : demander à
  un agent d'écrire un fichier mal formaté sous `mobile/`, et constater
  qu'il est reformaté.
- Les journaux détaillés de la CI demandent une connexion à GitHub ; la
  preuve retenue est l'état de chaque étape, lu par l'API publique.
- La première capture (C1) montre encore le lien « Réglages » de
  l'en-tête, d'avant le 4e onglet ; les captures de C2 montrent l'état
  final.
- Icônes des onglets : provisoires (triangles sur iOS, carrés barrés sur
  Android). Hors périmètre.
