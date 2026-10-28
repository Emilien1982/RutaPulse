# Sorties brutes de `height` et `traceAttributes`

Copiées sans modification de l'essai jetable de la phase 5, tâche T1
(28 octobre 2026), dossiers `ios/` et `android/` de
`docs/phases/preuves/p05/t1-essai/` (fichiers `a-<cas>.json`). valhalla-mobile
0.6.4, zone Nancy v3, version finale (release).

Chaque fichier est `{step, request, ms, response}` : `response` est ce que
JavaScript a reçu du module, `request` ce qui lui a été envoyé, `ms` les
durées de trois appels.

| Cas                       | Contenu                                                    |
| ------------------------- | ---------------------------------------------------------- |
| `*-AB-height-*`           | `height` avec `range`, trajet A-B (1,5 km), iOS et Android |
| `*-AB-trace-*`            | `trace_attributes` `walk_or_snap`, même trajet             |
| `ios-R4-*`                | Mêmes appels sur R4 (42 km), iOS seulement                 |
| `ios-hand-height-*`       | Ligne droite à la main : altitudes réussies                |
| `*-hand-trace-*`          | Même ligne : refus 444                                     |
| `*-err-height-no-shape`   | `height` sans forme : refus 312                            |
| `*-err-height-not-json`   | JSON invalide : refus -1                                   |
| `*-err-trace-empty-shape` | `trace_attributes`, forme vide : refus 114                 |
| `*-err-trace-one-point`   | `trace_attributes`, un point : refus 123                   |
| `*-err-trace-out-of-zone` | `trace_attributes` hors tuiles : refus 444                 |

Le texte `message` d'un refus diffère selon la plateforme ; seul `code` compte.

## Relevés de la tâche T2 (forme finale des requêtes)

Deux fichiers viennent de l'app release de la tâche T2 (28 octobre 2026),
iPhone 17, zone Nancy v3, valhalla-mobile 0.6.4. Ils sont tirés de
`t2-brut.json` (clés `rawTraceAB` et `rawHeightNull`) : la réponse brute du
module, rangée dans `response`.

| Fichier                      | Contenu                                                                               |
| ---------------------------- | ------------------------------------------------------------------------------------- |
| `ios-AB-trace-final.json`    | `trace_attributes` A-B avec le filtre final à 3 champs (`use`, `density`, `length`)   |
| `ios-height-range-null.json` | `height` avec `range`, trois points à (6 ; 47,5) hors des tuiles d'altitudes : `null` |
