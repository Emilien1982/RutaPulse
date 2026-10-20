# Essai 1-bis, partie 2 : diagnostics

Sorties de `diagnostic-r4.py` et `diagnostic-allers-retours.py` (relancer les scripts pour les chiffres complets).

## R4 près de Clairlieu : pourquoi les pistes de la référence sont évitées

- La trace de référence (map_snap) fait 37,8 km sur 40,9 km de GPX. 15,3 km sont à plus de 25 m de l'itinéraire calculé (2 km, réglage de l'essai 1).
- Ces 15,3 km : 12,2 km de pistes et chemins (path compacted 5,1 km, track compacted 4,1 km, path dirt 1,2 km, track dirt 1,0 km, track gravel 0,6 km), 3,2 km de routes (dont 1,5 km d'avenue Paul-Muller, `secondary`).
- Tags réels des plus longues voies évitées : `highway=track,tracktype=grade2` (way 112162210, 1,9 km ; way 120788894 « Chemin de Fraise », 0,9 km), `highway=path,man_made=cutline` (8 des 25 plus longues : laies de ligne), `highway=track,tracktype=grade3,motor_vehicle=no`, `highway=path` sans autre tag. Aucun tag d'accès au vélo, aucun `bicycle=no`.
- Ce n'est pas un problème d'accès ni de surface : toutes ces voies sont dans le graphe vélo (la trace de référence s'y accroche avec le coût vélo), `tracktype=grade2` donne `compacted` et un `path` sans tag donne aussi `compacted` (facteur de vitesse VTT 1,0).
- Test local (itinéraire direct entre les deux bouts de chaque tronçon évité de plus de 400 m, 15 tronçons) : 4 tronçons sont suivis à 90-100 % (3,0 km), donc ces pistes ne sont pas écartées par le coût. Pour les autres, Valhalla trouve un chemin moins cher : p. ex. la piste de 1 862 m (D+ 25 m) est remplacée par un `path` parallèle de 1 409 m (D+ 16 m) ; autre cas, 978 m de `path` remplacés par 623 m de piste et de chemin.
- Conclusion : Valhalla ne pénalise pas les pistes pour une raison de donnée ; il minimise un coût (temps pondéré) entre les points et prend le chemin le plus court ou le moins pentu, alors que la randonnée de 2014 fait des détours. Écart de coût dans le code (`bicyclecost.cc`, use_roads 0) : `track` 1,5, `path` 1,2, route résidentielle 2,0, route de service 3,0 ; une piste coûte 25 % de plus qu'un chemin, d'où 12,5 % de pistes calculées contre 23,8 % dans la référence (R4), et 62 % de sentiers contre 46 %.

## Leviers lua essayés

- `5-lua-surface` non construit : la prémisse est fausse. Sur les itinéraires mesurés, `path` sans tag a la surface `compacted` ; environ 1 % de la longueur des pistes et chemins a la surface `path` (la pire).
- `5-lua-piste` : les `highway=track` ouverts au vélo reçoivent `use=path` (coût 1,2 au lieu de 1,5). `6-lua-mtb` : en plus, les `path` et pistes `mtb:scale` 0 à 2 ou membres d'une relation `route=mtb` (2 relations, 244 voies marquées `mtb_route=yes` par `marquer-mtb.py`) reçoivent la voie cyclable « séparée » (coût 1,0).
- Résultat : piste + sentier ne bouge pas (79,6 % -> 79,7 / 79,6 % en 2 km ; 80,3 % -> 81,1 / 80,7 % en 5 points). Les pistes passent de 43,9 % à 48,0 % (2 km), mais les laies passent de 19,7 % à 30,3 / 29,8 % (référence : 19,6 %). Aucun gain net sur le critère de la règle, et plus de laies : pas de combinaison retenue.

## Allers-retours élevés du cas 5 points

La mesure compte les deux passages de chaque portion repassée (une portion parcourue deux fois en sens inverse compte donc double). Tous les passages repérés sont en sens inverse (écart de cap 179 à 180 degrés).

- R4 (28,9 km, 5 points) : 8,67 km repérés = 4,33 km parcourus deux fois. Exemple : de (48,66817 ; 6,14928) à (48,65390 ; 6,15227), 2,1 km au km 1,05 puis, en sens inverse, au km 27,8 : le départ P1 et l'arrivée P5 sont à 22 m l'un de l'autre (boucle), et l'aller P1 vers P2 et le retour P4 vers P5 empruntent le même couloir. Autre exemple : 2,07 km de cul-de-sac aller-retour entre les km 11,6 et 13,8 autour de P3 (48,6445 ; 6,1063, le chemin passe à 227 m).
- R5 (15,7 km, 5 points) : 7,68 km repérés = 3,84 km parcourus deux fois. P1 et P5 sont à 36 m, P3 et P4 à 467 m, et P1 vers P3 fait 6,9 km par le chemin le moins cher alors que la référence en fait 22. L'itinéraire va de P1 à P3 (km 6,9) et revient presque par le même chemin vers P5. Exemple : 1,11 km entre (48,80221 ; 6,06751) et (48,79813 ; 6,07105), parcouru au km 7,14 puis au km 8,40, avec P3 à 1 m du fond.
- Cause : en 5 points, la référence est une boucle dont le départ et l'arrivée coïncident et dont les points à 25, 50 et 75 % sont proches en ligne droite ; le plus court chemin de P1 à P3 et celui de P3 à P5 se recouvrent alors, et le tracé calculé repasse en sens inverse (R5 : 3,84 km parcourus deux fois, soit près de la moitié du tracé en comptant les deux sens). Ce n'est pas un demi-tour de manœuvre (0 ou 1) : le tracé revient par le même chemin sans manœuvre de demi-tour déclarée entre les points, et un point de passage au fond d'une impasse n'en déclare pas plus.
