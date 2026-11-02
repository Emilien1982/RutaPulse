# Phase 5, T9 : tests adaptés par le testeur

Date : 2 novembre 2026. Base : commit `c498a2a`. Les corrections de la
comparaison du designer ([p05-t8.md](../../../../design/comparaisons/p05-t8.md),
section « Décisions pour T9 » comprise) cassent 17 tests commités. La
relecture juge les 17 changements voulus. Chemins depuis `mobile/src/`.

| Fichier | Test | Ce qui change | Pourquoi | Avant / après |
|---|---|---|---|---|
| `core/route-info/chart.test.ts` | « puts the lowest altitude at the bottom… » (renommé « keeps 12 % of room under the lowest altitude, more above the highest ») | Valeurs de y pour 100 à 130 m, tracé de 84 | C7 : étendue max(écart, 100) / 0,85, bas à −12 % | 81 / 3 / 42 devient 73,92 / 84 − (44,1176 / 117,647) × 84 / 84 − (29,1176 / 117,647) × 84 |
| idem | « keeps a flat route flat » | y pour 200 → 202 m, `MIN_SPAN_M` = 100 | C7 | `81 − (2/20) × 78` devient `84 − (16,1176 / 117,647) × 84` |
| idem | « does not divide by zero… » | y d'un point seul ≈ 84 × 0,88 | C7 | 81 devient 73,92 |
| `features/map/infoGeometry.test.ts` | « surrounds the points and the whole drawn line » | Inégalités strictes deviennent `toBeCloseTo` (boîte exacte) | C2 : plus de marge de 0,0005° | Une boîte exacte est plus stricte |
| idem | « handles 200 000 coordinates » | `west` et `south` : `<` devient `<=` | C2 : le minimum exact vaut 6 et 48 | `east`, `north` inchangés |
| `features/map/RouteInfoScreen.test.tsx` | « frames the whole route on a map that does not move » | 4 inégalités deviennent `toBeCloseTo(…, 10)` | C2 | Boîte sans marge |
| idem | « says "Altitudes indisponibles" and keeps the rest » | `info-ascent` et `info-descent` présents avec « — » ; titre « Profil et terrain » présent | C6 : les 4 cases et le titre restent | Gardé : `info-profile` absent, ligne « Altitudes indisponibles », distance, durée, Route 25 %, carte |
| `features/map/RouteInfoScreenSpec.test.tsx` | C10 « altitudes of one leg out of two missing… » | Cases « — » et titre présents | C6 | idem |
| idem | C10 « a null altitude inside a profile… » | `info-ascent` présent avec « — » | C6 | Absent, puis présent |
| `features/map/DraftScreenInfosT4.test.tsx` | « ascent (D+) in the creation summary (mockup 10) » | Fenêtre fixée à 411 dp, `fontScale` 1 (`jest.spyOn(Dimensions, 'get')`, restauré après chaque test) | Sous Jest, la fenêtre simulée fait 750 à l'échelle 2, soit 375 dp : mode compact (moins de 390, décision 2) | Aucune attente retirée |
| `features/map/DraftScreenT8.test.tsx` | « T8: empty summary » | idem | idem | idem |
| `features/map/DraftScreenT8Spec.test.tsx` | « A4: the dash » (4 tests) | idem | idem | idem |
| `features/map/DraftScreenPortT4Testeur.test.tsx` | « port: creating a route » (2 tests) | idem | idem | idem |

Hors table des tests commités : `features/map/T9DesignFixes.test.tsx` (du
développeur, **jamais commité**), « keeps the usual look at 390 dp », écart
attendu 12 devenu 16 (décision 2 : 16 en mode normal, 12 en compact).

Précision (relecture) : dans les quatre fichiers `DraftScreen*`, la fausse
fenêtre de 411 dp est posée par un `beforeEach` au niveau du fichier. Elle
vaut donc pour **tous** les tests de ces fichiers, pas seulement pour les
8 listés. L'intention reste la même : un téléphone courant, en mode normal.
Le mode compact est testé à part (`T9DesignFixes.test.tsx`,
`T9DesignFixesSpec.test.tsx`).
