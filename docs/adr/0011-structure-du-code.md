# ADR 0011 — Structure du dépôt et du code, nommage, tests

- Statut : Accepté le 2026-10-21 ; tableau du § 3 remplacé par l'[ADR 0014](0014-dossier-shared-data.md) le 2026-10-26, puis par l'[ADR 0015](0015-module-natif-calcul.md) le 2026-10-27
- Date : 2026-10-21 (phase 0, tâche T1 de [p00-socle](../phases/p00-socle.md))

ADR veut dire « Architecture Decision Record » (fiche de décision
d'architecture).

## Contexte

- La phase 0 crée l'app vide : 4 onglets (Carte, Itinéraires, Zones,
  Réglages). Réglages est un onglet depuis la décision de design du
  21 octobre 2026 (docs/06, « Retouches »). Les agents y ajouteront du code pendant 10 phases.
- Déjà décidé : Expo SDK 58 et dossiers natifs générés (ADR 0001), textes
  lus par `t()` (ADR 0007), Expo Router (ADR 0008), Jest, Testing Library
  et Maestro (ADR 0009).
- Depuis le SDK 55, le modèle de projet d'Expo range les écrans dans
  `src/app/`, avec l'alias (raccourci d'import) `@/` vers `src/`.
- L'autolinking (branchement automatique des modules natifs) cherche les
  modules locaux dans `./modules` par défaut. L'essai 1 l'a utilisé.

## Décision

### 1. Le dépôt

```
vtt-nav/
├── mobile/                 app Expo, identifiant fr.rutapulse.app
├── zones/                  fabrique des paquets de zone (créé en phase 1)
├── docs/  design/          inchangés
├── .github/workflows/verify.yml   CI (vérification automatique sur GitHub)
└── CLAUDE.md  PILOTAGE.md
```

- Un seul `package.json`, dans `mobile/`. Toutes les commandes de l'app se
  lancent depuis `mobile/`, la CI aussi (`working-directory: mobile`).
- `mobile/android/` et `mobile/ios/` sont générés et ignorés par git.

### 2. L'app, à la fin de la phase 0

```
mobile/
├── src/
│   ├── app/                  écrans Expo Router, fichiers minces
│   │   ├── _layout.tsx       pile racine : les onglets
│   │   └── (tabs)/
│   │       ├── _layout.tsx   barre des 4 onglets
│   │       ├── index.tsx     Carte
│   │       ├── routes.tsx    Itinéraires
│   │       ├── zones.tsx     Zones
│   │       └── settings.tsx  Réglages
│   ├── features/             fonctionnalités (features)
│   │   ├── map/MapScreen.tsx + MapScreen.test.tsx
│   │   ├── routes/RoutesScreen.tsx + test
│   │   ├── zones/ZonesScreen.tsx + test
│   │   └── settings/SettingsScreen.tsx + test
│   ├── core/                 logique pure
│   │   └── i18n/             textes (i18n : internationalisation)
│   │       ├── fr.ts         tous les textes français
│   │       └── t.ts + t.test.ts
│   └── ui/                   composants partagés (créé au premier besoin)
├── modules/                  modules natifs à nous (créé en phase 2 ou 3)
└── e2e/open-all-screens.yaml scénario Maestro (E2E : de bout en bout)
```

- Un fichier de `src/app/` importe l'écran de sa fonctionnalité, l'affiche
  et règle la navigation (titre, onglet). Il ne contient aucune logique.
- Une fonctionnalité regroupe son écran, ses hooks (fonctions React
  réutilisables) et son usage de Query et Store (ADR 0007).
- Un calcul sans React va dans `core/`, même s'il ne sert qu'à une
  fonctionnalité. Il se teste alors sans téléphone.
- Un module natif garde son enveloppe TypeScript dans son dossier
  (`modules/<nom>/index.ts`), comme le prévoit Expo.

### 3. Règle de dépendance entre dossiers

| Dossier | Peut importer | Ne doit pas importer |
|---|---|---|
| `src/app/` | `features/`, `expo-router` | `core/`, `ui/`, `modules/` |
| `src/features/<x>/` | `ui/`, `core/`, `modules/`, bibliothèques | une autre fonctionnalité |
| `src/ui/` | `core/`, React, React Native | `features/`, `modules/` |
| `src/core/` | `core/`, bibliothèques en TypeScript pur | React, React Native, `expo-*`, `modules/` |
| `modules/` | ses fichiers, `expo-modules-core` | tout `src/` |

- Ce que deux fonctionnalités partagent descend dans `ui/` ou `core/`.
- ESLint (contrôle du code) vérifie la règle (`no-restricted-imports`), en T3.
- Les imports passent par l'alias `@/` (exemple : `@/core/i18n/t`).

### 4. Nommage

- Dossiers : minuscules et tirets (`route-planner`).
- Écrans Expo Router : minuscules, car ce sont des adresses (`settings.tsx`).
- Composant : fichier à son nom, en PascalCase (`MapScreen.tsx`). Un écran
  finit par `Screen`.
- Autres fichiers : camelCase, du nom de leur export principal
  (`formatDistance.ts`). Un hook commence par `use` (`useRoutes.ts`).
- Fonctions et variables en camelCase ; types et composants en PascalCase.
- Exports nommés. Export par défaut seulement dans `src/app/` (exigé).
- Code, noms, commentaires et noms de tests : en anglais.
- Textes visibles : en français, seulement dans `core/i18n/fr.ts`, lus par
  `t()`. Aucun texte français écrit en dur dans un composant.
- Vocabulaire : itinéraire = `route`, tracé en création = `draft`, suivi =
  `tracking`, paquet de zone = `zone`.

### 5. Tests

| Quoi | Outil | Ce qui est obligatoire |
|---|---|---|
| Fonction exportée de `core/` | Jest | Toujours. Un calcul a au moins un cas comparé à une valeur de référence externe (ADR 0009) |
| Écran de `features/` | Testing Library | Il s'affiche avec ses textes français ; plus un test par action de l'utilisateur (appui, saisie) |
| Composant de `ui/` | Testing Library | S'il a une logique (état, condition) |
| Module natif | Essai ou Maestro, sur simulateur | Dans Jest, il est remplacé par une imitation (mock) |
| Parcours de l'utilisateur | Maestro | Un scénario par parcours cité dans les critères d'une phase |
| Correction d'un défaut | Selon l'endroit | Un test qui échoue avant la correction et passe après |

- Le test est à côté du code : `MapScreen.test.tsx` près de `MapScreen.tsx`.
  Pas de dossier `__tests__/`.
- Aucun test dans `src/app/` : Expo Router y prendrait chaque fichier pour
  un écran. La navigation entre écrans est prouvée par Maestro.
- Scénarios Maestro : `mobile/e2e/<parcours>.yaml`, lancés par le `testeur`.
- Scripts : `typecheck` (TypeScript strict, sans produire de fichier),
  `lint` (ESLint puis contrôle du formatage par Prettier), `test` (Jest).
- `verify` les enchaîne dans cet ordre et s'arrête à la première erreur.
- La CI lance `npm run verify` à chaque push et à chaque demande de fusion.
  Elle ne lance pas Maestro, qui demande un simulateur.

## Alternatives rejetées

- **`app/` à la racine de `mobile/`, à côté de `src/`** (proposé d'abord) :
  ce n'est plus le modèle d'Expo. Si `src/app/` existe aussi, Expo Router
  ignore `app/` sans prévenir.
- **Modules natifs dans `src/`** : il faudrait changer le réglage de
  l'autolinking. `modules/` est la place par défaut, éprouvée par l'essai 1.
- **Tests dans `__tests__/`** : loin du code, on oublie de les modifier.
- **Monorepo** (dépôt à plusieurs paquets liés) : utile si `zones/` et l'app
  partageaient du code. Ce n'est pas le cas.

## Conséquences

- Positif : chaque agent sait où ranger un fichier et ce qu'il doit tester.
- Négatif : la configuration ESLint par dossier est à tenir à jour.
- À vérifier en T2 : le modèle d'Expo SDK 58 crée bien `src/app/` et
  l'alias `@/`. Sinon, on adapte le projet à cet ADR.

## Sources

- Dossier `src/` dans Expo Router : https://docs.expo.dev/router/reference/src-directory/
- Alias d'import avec TypeScript : https://docs.expo.dev/guides/typescript/
- Modules locaux, dossier `modules/` : https://docs.expo.dev/modules/get-started/
- Autolinking, réglage `nativeModulesDir` : https://docs.expo.dev/modules/autolinking/
