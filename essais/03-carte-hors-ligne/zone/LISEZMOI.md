# Fabrication du paquet carte (essai 3)

Ces scripts fabriquent le paquet « carte » d'une zone : fond de carte,
relief, courbes de niveau et circuits VTT balisés. Ils sont faits pour être
repris par l'app. Zone test : Nancy (longitudes 5.84 à 6.52, latitudes
48.47 à 48.92).

## Lancer

```bash
# Optionnel : réutiliser des fichiers déjà sur le Mac (sinon téléchargés)
export LORRAINE_PBF=/chemin/lorraine.osm.pbf
export HGT_DIR=/chemin/dossier/avec/N48E005.hgt-et-N48E006.hgt
essais/03-carte-hors-ligne/zone/fabriquer-carte.sh
```

Résultat dans `sortie/` (ignoré par git) : `mesures.txt` (durées et tailles
exactes en octets) et le paquet `sortie/nancy-carte/` : `carte.pmtiles`,
`relief.pmtiles`, `courbes.pmtiles`, `circuits.geojson`, `carte.json`.

## Étapes

| Étape | Outil | Résultat |
|---|---|---|
| Carte | Planetiler 0.10.2 (image Docker, Java limité à 4 Go), profil OpenMapTiles, zoom 0 à 14 | `carte.pmtiles` |
| Relief | `pmtiles extract` sur `planet.pmtiles` de Mapterhorn, zoom 0 à 12 (WebP, format d'image compressée, « terrarium » : altitude codée dans la couleur, tuiles de 512 px) | `relief.pmtiles` |
| Courbes | fichiers HGT (grille d'altitudes) du SRTM (mission de relevé d'altitudes de la NASA, une valeur tous les 30 m) -> `gdal_contour` tous les 10 m (GDAL, bibliothèque de traitement de données géographiques, image Docker 3.10.3) -> `tippecanoe`, zoom 11 à 14, couche `contour`, attributs `ele` et `major` (1 tous les 50 m) | `courbes.pmtiles` |
| Circuits | `extraire-circuits.py` : relations `route=mtb` | `circuits.geojson` |

Choix des courbes : les fichiers HGT sont ceux que Valhalla utilise déjà pour
le dénivelé (mêmes altitudes dans l'itinéraire et sur la carte) et ne
demandent aucun décodage de tuiles. Pas de lissage. Le relief Mapterhorn
(IGN, Institut national de l'information géographique et forestière, à 1 m ou 5 m sur Nancy) serait plus précis : piste à étudier.

## Circuits : définition

Un morceau est un groupe de voies reliées par des nœuds communs. Un circuit
est continu s'il a un seul morceau, discontinu sinon. `max_gap_m` est la plus
courte distance entre un morceau et le plus proche, prise au pire morceau.
Elle est calculée à partir de presque tous les nœuds (ceux qui n'appartiennent
qu'à une seule voie du morceau), dans un rayon de 50 km. Si un morceau n'a
aucun voisin dans ce rayon, `max_gap_m` vaut `null` (écart de plus de 50 km).

### Vérification sur la relation 11656724 (R1 de l'essai 1)

Résultat : 1 morceau (100 voies, 1 composante connexe), 22 455 m. C'est
cohérent avec `references.json` de l'essai 1 (« composantes connexes : 1 »).
Les « sauts » de R1 viennent de l'ordre des membres de la relation : une seule
paire de voies consécutives n'a pas de nœud commun. Ce n'est pas une coupure
du tracé. La définition « morceau » ne voit donc pas un défaut d'ordre.

Décompte Lorraine : 314 circuits, 282 continus, 32 discontinus, 14 avec un
écart de plus de 100 m (dont 1 sans voisin à moins de 50 km).

## Annexes de Planetiler

Planetiler télécharge trois fichiers avant de travailler (1,38 Go en tout) :
les polygones d'eau, Natural Earth et les axes de lacs. Il refuse de
démarrer sans eux, même avec `--exclude-layers=water,water_name,waterway`.
Ils sont donc nécessaires, mais ne sont téléchargés qu'une fois (dossier
`sortie/travail/planetiler/sources`).

## Outils installés pour cet essai

| Outil | Version | Installation |
|---|---|---|
| pmtiles (go-pmtiles) | 1.31.2 | `brew install pmtiles` |
| tippecanoe | 2.79.0 | `brew install tippecanoe` |
| Planetiler | 0.10.2 | image Docker `ghcr.io/onthegomap/planetiler:0.10.2` |
| GDAL | 3.10.3 | image Docker `ghcr.io/osgeo/gdal:alpine-small-3.10.3` |

Déjà présents : osmium 1.19.1, Docker 29.4.1, Python 3.14.7.
