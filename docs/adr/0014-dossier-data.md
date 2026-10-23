# ADR 0014 — Un dossier `src/data/` pour les données partagées entre fonctionnalités

- Statut : Proposé le 2026-10-24, à valider par Émilien
- Date : 2026-10-24 (phase 2, tâche T1 de [p02-carte-hors-ligne](../phases/p02-carte-hors-ligne.md))
- Modifie l'ADR 0011, §§ 2 et 3 (structure du code et règle de
  dépendance). Né de l'[ADR 0013](0013-telechargement-zones.md).

ADR veut dire « Architecture Decision Record » (fiche de décision
d'architecture).

## Contexte

- La phase 2 a deux données lues par plusieurs fonctionnalités (features) :
  - le réglage « Wi-Fi seulement » : son interrupteur est dans l'écran
    Zones (maquette 41) **et** dans Réglages (maquette 80) ;
  - les zones installées : l'écran Zones les liste, la Carte affiche l'une
    d'elles.
- Le code qui lit ces données utilise `expo-file-system` et des hooks
  (fonctions React réutilisables) de TanStack Query. Les deux écrans
  doivent partager les mêmes clés de Query, sinon l'un ne voit pas les
  changements de l'autre.
- L'ADR 0011 interdit à une fonctionnalité d'en importer une autre. Ce que
  deux fonctionnalités partagent descend dans `ui/` (composants
  d'affichage) ou dans `core/` (TypeScript pur, sans `expo-*` ni React).
  Aucun des deux ne convient pour un hook qui lit un fichier.
- Le besoin reviendra : les itinéraires gardés dans SQLite seront lus par
  plusieurs écrans (ADR 0007).

## Décision

- Nouveau dossier **`mobile/src/data/`** : l'accès aux données gardées sur
  le téléphone (fichiers, réglages ; plus tard SQLite) et les hooks Query
  qui les lisent ou les écrivent, **quand au moins deux fonctionnalités
  s'en servent**. Ce qui ne sert qu'à une fonctionnalité reste dans son
  dossier.
- Un sous-dossier par domaine : `data/zones/`, `data/settings/`.
- Pas de composant React dans `data/` : seulement des fonctions et des
  hooks. Les calculs restent dans `core/` (ADR 0011) ; `data/` les branche
  sur les vraies API du téléphone.

Règle de dépendance, qui remplace le tableau du § 3 de l'ADR 0011 (ajouts
en gras) :

| Dossier | Peut importer | Ne doit pas importer |
|---|---|---|
| `src/app/` | `features/`, `expo-router`, **bibliothèques (pour `QueryClientProvider`)** | `core/`, `ui/`, **`data/`**, `modules/` |
| `src/features/<x>/` | `ui/`, `core/`, **`data/`**, `modules/`, bibliothèques | une autre fonctionnalité |
| **`src/data/`** | **`core/`, bibliothèques (`expo-*`, TanStack, React pour les hooks)** | **`features/`, `ui/`, `app/`, `modules/`** |
| `src/ui/` | `core/`, React, React Native | `features/`, **`data/`**, `modules/` |
| `src/core/` | `core/`, bibliothèques en TypeScript pur | React, React Native, `expo-*`, `modules/`, **`data/`** |
| `modules/` | ses fichiers, `expo-modules-core` | tout `src/` |

- `data/` n'importe pas `modules/` : aucun besoin connu. On l'ouvrira par
  un nouvel ADR si une phase en a besoin.
- Tests : une fonction de `data/` qui a une logique (condition, boucle) a
  un test Jest, avec une imitation (mock) des modules `expo-*`. Un hook qui
  ne fait qu'appeler `useQuery` n'en a pas besoin : les tests d'écran le
  couvrent.
- ESLint (contrôle du code) : à compléter en T3 de la phase 2, avec les
  règles de `data/` et l'interdiction de `data/` depuis `app/`, `ui/` et
  `core/`.

## Alternatives rejetées

- **Ranger ce code dans `ui/`** : `ui/` contient des composants
  d'affichage. Y mettre la lecture de fichiers mélangerait deux rôles.
- **Le dupliquer dans chaque fonctionnalité** : deux copies qui finiront par
  différer, alors que les clés de Query doivent être identiques.
- **Tout passer par `core/`, avec les API du téléphone en paramètre** : la
  logique y est déjà (ADR 0013). Il reste à brancher les vraies API à un
  endroit partagé : c'est ce que fait `data/`.
- **Permettre à une fonctionnalité d'en importer une autre** : les
  dépendances deviendraient vite un sac de nœuds. La règle actuelle est
  simple et ESLint la vérifie.

## Conséquences

- Positif : une place claire pour les données partagées, dès maintenant et
  pour les itinéraires.
- Négatif : un dossier et des règles ESLint de plus.
- L'ADR 0011 reste valable, sauf son tableau du § 3, remplacé par celui-ci.
