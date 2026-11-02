# Phase 5, T10 : tests adaptés par le testeur

Date : 2 novembre 2026. Base : commit `a12641b` plus le diff non commité de
T10 (E1 : marge intérieure compensée du résumé ; E2 : `maxFontSizeMultiplier`
à 1 sur l'attribution courte). Chemins depuis `mobile/`.

| Fichier | Test | Ce qui change | Pourquoi | Avant / après |
|---|---|---|---|---|
| `src/features/map/T9DesignFixes.test.tsx` | « has the same row box open or not (nothing moves) » | L'objet attendu reçoit `paddingHorizontal` 6, `paddingVertical` 4, `marginHorizontal` −6, `marginVertical` −4 | E1 : le « D » de « Distance » ne doit plus être rogné par le coin arrondi. Les marges négatives rendent la place : la boîte visible ne bouge pas. Changement voulu (écart E1 du designer) | 5 clés deviennent 9 clés. L'intention (même boîte ouvert ou non, rien ne bouge) est gardée |
| idem | « the closed row has that same box » | idem, sur la ligne fermée (`route-open-infos-off`, parent) | idem | idem |
| `e2e/p05-infos.yaml` (Maestro, lignes 96 et 117) | C13 | `visible: 'Modifier'` et `tapOn: 'Modifier'` deviennent `id: 'info-modify'` | Sur iOS, le nom accessible du bouton est « Modifier l'itinéraire » : le texte « Modifier » n'est pas trouvé. L'identifiant marche sur les deux plateformes | Texte, puis `testID` (déjà utilisé par les tests Jest) |

Note sur les cartes : `ZoneMap.tsx` est la carte de l'onglet Carte ;
la carte de la création est `DraftScreen.tsx`. E2 touche les deux, plus
`RouteInfoMap.tsx` (Infos).

Test ajouté **par le testeur**, dans le fichier du développeur
`src/features/map/T10IosFixes.test.tsx` (non commité) : « leaves the summary
figures and the "Distance" legend scalable » (E2 ne plafonne que
l'attribution, pas les chiffres ni la légende). Les autres tests de ce
fichier sont ceux du développeur.

`npm run verify` : 103 suites, 1 326 tests réussis, 0 échec
(`/Users/utilisateur/dev_ai/vtt-nav-preuves/p05/t10/verify-testeur.log`).
