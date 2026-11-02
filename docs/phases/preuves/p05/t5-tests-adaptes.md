# Phase 5, T5 : tests déjà commités adaptés par le testeur

Date : 2 novembre 2026. Base : commit `36035d8`. L'écran Infos fait passer
la création dans une pile imbriquée (ADR 0017 § 7) : `app/draft.tsx`
devient le dossier `app/draft/` (`_layout.tsx`, `index.tsx`, `infos.tsx`),
et le Store et la zone viennent de `DraftSession`. Dix suites commitées
rendaient `<DraftScreen />` seul (erreur « useDraftSession needs a
DraftSession », 186 tests). La relecture juge le changement voulu.

Aide de test **nouvelle** : `mobile/src/features/map/testing/DraftInSession.tsx`
rend `<DraftSession><DraftScreen /></DraftSession>` avec le **vrai**
`DraftSession`. Les imitations de `useInstalledZones` et `useGlyphsReady`
restent dans chaque test : l'attente de la zone reste testée.

| Fichiers (dans `mobile/src/features/map/`) | Ce qui change | Pourquoi | Avant / après |
|---|---|---|---|
| `DraftScreen.test.tsx`, `DraftScreenSpec.test.tsx`, `DraftScreenT5.test.tsx`, `DraftScreenT5Spec.test.tsx`, `DraftScreenT8.test.tsx`, `DraftScreenT8Spec.test.tsx`, `DraftScreenInfosT4.test.tsx`, `DraftScreenInfosT4Spec.test.tsx`, `DraftScreenPortT4Testeur.test.tsx` (2 rendus), `DraftScreenZonePortT4Testeur.test.tsx` | `import { DraftScreen } from './DraftScreen'` devient `import { DraftInSession } from './testing/DraftInSession'` ; `<DraftScreen />` devient `<DraftInSession />`. Aucune assertion modifiée | ADR 0017 § 7 | Avant : 10 suites rouges, 186 tests. Après : vertes |
| `DraftScreenSpec.test.tsx`, test « C1 … is a route of the root stack, outside (tabs), as a full screen modal » | Le contrôle de `src/app/draft.tsx` devient celui de `src/app/draft/_layout.tsx`, `index.tsx`, `infos.tsx` ; ajouts : `draft.tsx` absent, `(tabs)/draft` absent. Contrôles de `app/_layout.tsx` inchangés (`name="draft"`, `fullScreenModal`, `gestureEnabled: false`) | `app/draft.tsx` est devenu un dossier. Intention gardée : route de la pile racine, hors des onglets, en plein écran | Avant : `draft.tsx` existe. Après : les trois fichiers existent, `draft.tsx` non |

Aucun test n'est resté rouge après l'enrobage : pas de défaut du code
suspecté.
