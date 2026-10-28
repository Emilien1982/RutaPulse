# T8 — Tests déjà commités adaptés

> Phase 4, tâche T8. Table fournie par le testeur dans son compte rendu, et
> recopiée ici par la session de phase : le garde-fou du testeur ne lui permet
> d'écrire que des fichiers de test. Seul l'attendu change, avec un
> commentaire en anglais qui cite `design/comparaisons/p04-t7.md`.

Raisons :
- **A4** (décision du pilotage) : tant qu'il n'y a pas d'itinéraire, le
  résumé affiche « — » au lieu de « 0 m » et « 1 min ».
- **M3** : une espace insécable avant « ? » (U+202F) et avant « : »
  (U+00A0).

| Fichier (sous `mobile/src/features/`) | Test | Avant | Après | Raison |
|---|---|---|---|---|
| `map/DraftScreen.test.tsx`, l. 183 | opening › shows the top bar, the hint, the summary and the tools | `0 m` et `1 min` | `—` et `—` | A4 |
| `map/DraftScreen.test.tsx`, l. 756 | leaving › blocks the way out from 2 points and asks in a native dialog | `Abandonner cet itinéraire ?` (espace simple) | même titre avec U+202F | M3 |
| `map/DraftScreenSpec.test.tsx`, l. 274 | C1 › from 2 points, the way out (cross and Android back) is blocked and a native dialog asks | même titre (espace simple) | même titre avec U+202F | M3 |
| `map/DraftScreenSpec.test.tsx`, l. 520 | C4: deleting › removing points one by one down to nothing | `0 m` et `1 min` | `—` et `—` | A4 |
| `map/DraftScreenSpec.test.tsx`, l. 638 | C10: the summary › is the sum of the legs and follows every action | `0 m` et `1 min` à l'ouverture | `—` et `—` | A4 |
| `zones/zonesT4Testeur.test.tsx`, l. 275 | T4 C5, delete with confirmation › asks first, names the zone, and "Garder" deletes nothing | `Supprimer la zone Nancy ?` (espace simple) | même titre avec U+202F | M3 |

## Totaux

- **Avant**, avec le code de T8 et sans les tests du testeur : 79 suites,
  876 tests, 6 en échec (ceux de la table).
- **Après** : 80 suites, 893 tests, 0 en échec.
- Aucun test retiré. Il y a 17 tests en plus, dans le nouveau fichier
  `map/DraftScreenT8Spec.test.tsx`. Le test du tiret de
  `map/DraftScreenT8.test.tsx` (fichier nouveau en T8) est renforcé : il
  échoue quand on retire la correction (`hasDigit`).
