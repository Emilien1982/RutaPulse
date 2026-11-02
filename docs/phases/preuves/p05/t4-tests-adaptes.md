# Phase 5, T4 : tests déjà commités adaptés par le testeur

Date : 28 octobre 2026. Base : commit `c403d6c`. Le branchement de T4 casse
4 tests commités. La relecture juge que les 4 échecs viennent du changement
voulu par l'ADR 0017 : le D+ est affiché (C6), le résumé change en une fois
quand distance **et** altitudes sont connues ou en échec (§ 6), et les
altitudes d'un tronçon à la main arrivent de façon asynchrone (§ 5).
Adaptations faites par le testeur, contrôlées par le relecteur contre le
diff.

| # | Test | Fichier:ligne (après) | Ce qui change | Pourquoi | Avant / après |
|---|---|---|---|---|---|
| 1 | « full path… "Enregistrer" and "D+" absent », renommé « … "Enregistrer" absent, "D+" shown » | `mobile/src/features/map/DraftScreenPortT4Testeur.test.tsx`:314 (titre), 321-324 | `D\+` retiré des mots absents ; ajout de `getByText('Montée (D+)')` | Le D+ est affiché depuis la phase 5 (C6). « Enregistrer » reste absent | Avant : `Enregistrer` et `D\+` absents. Après : `Enregistrer` absent, « Montée (D+) » présent |
| 2 | « the second touch computes, the figures fade meanwhile… » | `DraftScreenPortT4Testeur.test.tsx`:294-296 | Un `flush()` de plus après `finish(SUCCESS)` | Les altitudes arrivent un tour après la route ; le résumé attend les deux (§ 6) | Avant : opacité 0,55 reçue, `undefined` attendue. Après : opacité `undefined`, « 25,1 km », « 1 h 35 » |
| 3 | « A4: the dash › shows during the first computation, then gives way to the figures » | `mobile/src/features/map/DraftScreenT8Spec.test.tsx`:281-283 | Un `flush()` de plus avant les chiffres | Même raison | Avant : « — » reçu, « 2,0 km » attendu. Après : « 2,0 km » et « 10 min » |
| 4 | « relink by hand (T5) › "Relier" is one action… » | `mobile/src/features/map/DraftScreenT5.test.tsx`:215-217 | `await flush()` après `press('route-error-relink')` | Les altitudes du tronçon à la main sont asynchrones (§ 5) | Avant : « — » reçu, `/km$/` attendu. Après : la distance finit par « km » |

Aucun des quatre n'est resté en attente après un tour de plus : pas de
défaut du code. Le test 4 passait parfois sans changement (1 fois sur 3
lancements isolés) : il dépendait d'un timing. Avec le `flush()`, il a passé
6 lancements de suite.
