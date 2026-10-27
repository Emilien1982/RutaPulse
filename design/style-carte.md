# Style de la carte (v1)

> 24 octobre 2026. Phase 2, tâche T0 (designer). Point de départ : le style de
> l'essai 3 (`essais/03-carte-hors-ligne/app/src/style.ts`, code jetable),
> corrigé : **les trottoirs ne sont plus dessinés comme des sentiers**.
> Destiné à être traduit tel quel en style MapLibre (le fichier JSON qui dit
> à MapLibre quoi dessiner, et comment).
> Les couleurs sont des **noms de jetons** de [`tokens.md`](tokens.md), qui
> fait foi pour leurs valeurs. Les maquettes `v1/90` et `v1/91` montrent le
> résultat attendu.

## La légende en quatre lignes

| Quoi | Dessin | Pourquoi on ne les confond pas |
|---|---|---|
| Route, rue | Blanc, bordé de gris (`carte.voie`, `carte.voie-bord`), large | Seul trait blanc à bord ; le plus large |
| Piste (`track`) | Trait brun plein (`carte.piste`), 2,5 au zoom 15 | Plein et sombre, sans bord |
| Sentier (`path`, `bridleway`) | Tirets rouges (`carte.sentier`), 2 au zoom 15 | Seul trait en tirets réguliers ; seul rouge |
| Courbe de niveau | Trait fin beige (`carte.courbe`), plus épais tous les 50 m | Pâle et très fin : on la lit comme un fond |

## Ce que dit le schéma OpenMapTiles (vérifié le 24 octobre 2026)

La carte est fabriquée par Planetiler 0.10.2, profil OpenMapTiles
(`zones/zonefactory/build.py`). Dans la couche `transportation` :

1. **La classe `path` regroupe sept valeurs de `highway`** : `pedestrian`,
   `path`, `footway`, `cycleway`, `steps`, `bridleway`, `corridor`. Elle
   reçoit aussi les quais (`public_transport=platform`).
   Source : `layers/transportation/transportation.yaml` et `mapping.yaml`
   du dépôt openmaptiles/openmaptiles.
2. **`subclass` reprend la valeur brute de `highway`** (ou `platform` pour
   un quai). Valeurs possibles pour la classe `path` : `pedestrian`, `path`,
   `footway`, `cycleway`, `steps`, `bridleway`, `corridor`, `platform`.
   Source : https://openmaptiles.org/schema/ (champ `subclass` : « Distinguish
   more specific classes of railway and path ») et le code de Planetiler,
   `Transportation.java` du dépôt openmaptiles/planetiler-openmaptiles :
   `coalesce(nullIfEmpty(publicTransport), highway)`.
3. **`sidewalk` et `crossing` n'existent pas comme sous-classes.** Un
   trottoir est tagué dans OpenStreetMap `highway=footway` + `footway=sidewalk`,
   un passage piéton `highway=footway` + `footway=crossing`. Le schéma ne lit
   pas le tag `footway=*` : **les deux arrivent en `subclass=footway`**, sans
   rien pour les distinguer d'un autre `footway`.
4. **Zoom d'apparition** (même fichier Java) : une piste ou un chemin de la
   classe `path` apparaît au zoom 13 s'il a un nom, une relation de
   randonnée ou un `sac_scale`, sinon au zoom 14 (au zoom 12 pour les
   grandes relations). Routes : `minor` et `service` au 13,
   `residential` au 12, `tertiary` au 11, `secondary` au 9.
5. **Attribut `surface`** : `paved` (revêtu) ou `unpaved` (non revêtu), à
   partir du zoom 12, déduit de `surface` ou `tracktype`. Absent si le tag
   manque.
6. La couche contient aussi des **polygones** (places piétonnes, quais) :
   chaque couche de lignes filtre le type de géométrie.

Non vérifié : je n'ai pas pu décoder une tuile de Nancy (pas d'outil de
lecture de tuiles dans ma session). Le code lu est celui de la branche
`main` de planetiler-openmaptiles ; Planetiler 0.10.2 embarque une version
proche. **À confirmer par le testeur** (T6) : compter les valeurs de
`subclass` pour `class=path` dans quelques tuiles de Nancy au zoom 14.

## Les trottoirs : ce que je fais

- **Tous les `footway` sortent des sentiers**, puisqu'on ne peut pas trier
  trottoirs et autres `footway`. Avec eux : `pedestrian` (rues et places
  piétonnes).
- **On les dessine quand même, mais à peine** : trait fin et plein, gris
  beige (`carte.pieton`), **à partir du zoom 16** seulement. Aux zooms 14 et
  15, les villages restent propres. De très près, on voit qu'un passage
  existe (parc, raccourci), sans le confondre avec un sentier.
- **Coût mesuré** : sur deux itinéraires « nature » de l'essai 1 (R4 :
  43,0 km, R5 : 40,4 km), les `footway` empruntés font 0,10 et 0,13 km
  (`essais/01-calcul-hors-ligne/analyse/resultats/1bis/4-nature-2km/mesures.json`).
  Un vrai sentier tagué `footway` en forêt devient discret : c'est rare, et
  l'itinéraire magenta reste dessiné par-dessus.
- **Escaliers (`steps`)** : à part. Pour un vététiste, c'est un obstacle à
  voir. Trait hachuré gris brun (`carte.escalier`) à partir du zoom 15.
- **`corridor` (couloir intérieur) et `platform` (quai)** : pas dessinés.
- **Pistes cyclables (`cycleway`)** : revêtues ou sans `surface`, dessinées
  comme une petite voie blanche ; `surface=unpaved`, comme une piste brune.
- **Chemin revêtu (`path` + `surface=paved`)**, souvent une voie verte ou
  une allée de parc : petite voie blanche, pas un sentier. Sinon les mêmes
  tirets rouges reviendraient en ville par les voies vertes.

## Sources du style

```json
"sources": {
  "carte":   { "type": "vector",     "url": "pmtiles://file://<zone>/map.pmtiles" },
  "relief":  { "type": "raster-dem", "url": "pmtiles://file://<zone>/terrain.pmtiles", "encoding": "terrarium", "tileSize": 512 },
  "courbes": { "type": "vector",     "url": "pmtiles://file://<zone>/contours.pmtiles" }
},
"glyphs": "file://<polices>/{fontstack}/{range}.pbf"
```

- Noms de fichiers : ceux du paquet de zone (ADR 0003). Couche des
  courbes : `contour`, attributs `ele` (altitude en mètres, entier) et
  `major` (1 tous les 50 m, sinon 0).
- Zoom maximal des fichiers : 14 pour `carte` et `courbes`, 12 pour
  `relief`. MapLibre l'a dans l'en-tête des PMTiles et agrandit au-delà.
- **Aucune URL réseau** dans le style. Pas d'attribution dans les sources :
  on l'écrit nous-mêmes sur la carte (voir « Attributions »).

## Règles communes

- **Unité** : le point (voir `tokens.md`, « Unité »).
- **Caméra** : zoom de 8 à 18. Rotation et inclinaison désactivées dans
  l'onglet Carte (le nord reste en haut, donc pas de boussole à afficher).
- **Épaisseurs** : `["interpolate", ["linear"], ["zoom"], z1, v1, z2, v2…]`.
  Les valeurs du zoom 15 sont celles de `tokens.md` (« Épaisseurs des tracés
  sur la carte »), qui fait foi.
- **Tirets** (`line-dasharray`) : MapLibre les compte **en multiples de
  l'épaisseur**. `[2.5, 2]` sur un trait de 2 donne 5 / 4 points, comme
  `trace.sentier`. Bouts carrés (`"line-cap": "butt"`) pour les tirets, sinon
  les bouts ronds bouchent les trous.
- **Filtre de géométrie**, dans toutes les couches de lignes de
  `transportation` (noté `LIGNE` dans les tableaux) :
  `["in", ["geometry-type"], ["literal", ["LineString", "MultiLineString"]]]`.
- **Tunnels** (`brunnel=tunnel`) : routes, pistes et sentiers à 40 %
  d'opacité, `"line-opacity": ["case", ["==", ["get", "brunnel"], "tunnel"], 0.4, 1]`.
  Eau et voies ferrées en tunnel : pas dessinées.
- Couleurs : dans le JSON plus bas, `"carte.piste"` veut dire « la valeur du
  jeton `carte.piste` ». Le code les lit dans le thème, jamais en dur.

## Les couches, dans l'ordre de dessin (du dessous au-dessus)

Source `carte` sauf mention. « z » = zoom. Une couche sans zoom maximal va
jusqu'au 18.

| # | id | Type | Couche de la source | Filtre | z min | Couleur |
|---|---|---|---|---|---|---|
| 1 | `fond` | background | — | — | — | `carte.fond` |
| 2 | `prairie` | fill | `landcover` | `class` ∈ grass, wetland | 10 | `carte.prairie` |
| 3 | `foret` | fill | `landcover` | `class` = wood | — | `carte.foret` |
| 4 | `bati` | fill | `landuse` | `class` ∈ residential, commercial, industrial, retail, garages, school, college, university, kindergarten, hospital | — | `carte.bati` |
| 5 | `eau` | fill | `water` | `class` ≠ swimming_pool ; `brunnel` ≠ tunnel | — | `carte.eau` |
| 6 | `riviere` | line | `waterway` | `class` ∈ river, canal ; `brunnel` ≠ tunnel | 8 | `carte.eau` |
| 7 | `ruisseau` | line | `waterway` | `class` ∈ stream, drain, ditch ; `brunnel` ≠ tunnel | 13 | `carte.eau-trait` |
| 8 | `ombrage` | hillshade | source `relief` | — | — | voir « Ombrage du relief » |
| 9 | `batiment` | fill | `building` | — | 14 | `carte.batiment` |
| 10 | `courbe` | line | source `courbes`, `contour` | `major` = 0 | 13 | `carte.courbe` |
| 11 | `courbe-maitresse` | line | source `courbes`, `contour` | `major` = 1 | 13 | `carte.courbe-maitresse` |
| 12 | `pieton` | line | `transportation` | LIGNE ; `class` = path ; `subclass` ∈ footway, pedestrian | 16 | `carte.pieton` |
| 13 | `escalier` | line | `transportation` | LIGNE ; `class` = path ; `subclass` = steps | 15 | `carte.escalier` |
| 14 | `rail` | line | `transportation` | LIGNE ; `class` = rail ; `brunnel` ≠ tunnel | 10 | `carte.rail` |
| 15 | `voie-s-bord` | line | `transportation` | LIGNE ; groupe S (plus bas) | 13 | `carte.voie-bord` |
| 16 | `voie-p-bord` | line | `transportation` | LIGNE ; groupe P | 12 | `carte.voie-bord` |
| 17 | `voie-m-bord` | line | `transportation` | LIGNE ; groupe M | 9 | `carte.voie-bord` |
| 18 | `voie-g-bord` | line | `transportation` | LIGNE ; groupe G | 8 | `carte.voie-bord` |
| 19 | `piste` | line | `transportation` | LIGNE ; `class` = track, **ou** `class` = path + `subclass` = cycleway + `surface` = unpaved | 12 | `carte.piste` |
| 20 | `sentier` | line | `transportation` | LIGNE ; `class` = path ; `subclass` ∈ path, bridleway ; `surface` ≠ paved | 12 | `carte.sentier` |
| 21 | `voie-s` | line | `transportation` | LIGNE ; groupe S | 13 | `carte.voie` |
| 22 | `voie-p` | line | `transportation` | LIGNE ; groupe P | 12 | `carte.voie` |
| 23 | `voie-m` | line | `transportation` | LIGNE ; groupe M | 9 | `carte.voie` |
| 24 | `voie-g` | line | `transportation` | LIGNE ; groupe G | 8 | `carte.voie` |
| — | *réservé* | | | Circuits (phase 7), puis itinéraire et marqueurs (phases 3 et 4) se glissent **ici** | | |
| 25 | `cote` | symbol | source `courbes`, `contour` | `major` = 1 | 13 | `carte.cote` |
| 26 | `nom-eau` | symbol | `waterway` | `class` ∈ river, canal | 13 | `carte.eau-texte` |
| 27 | `nom-voie` | symbol | `transportation_name` | LIGNE ; `subclass` ∉ footway, pedestrian, steps, corridor, platform | 15 | `carte.etiquette-2` |
| 28 | `lieu-hameau` | symbol | `place` | `class` ∈ hamlet, suburb, quarter, neighbourhood, isolated_dwelling | 13 | `carte.etiquette-2` |
| 29 | `lieu-village` | symbol | `place` | `class` = village | 11 | `carte.etiquette` |
| 30 | `lieu-ville` | symbol | `place` | `class` ∈ city, town | 8 | `carte.etiquette` |

La position GPS (point bleu) est dessinée par MapLibre au-dessus de tout.

**Groupes de voies** (bords et intérieurs) :

| Groupe | Filtre (en plus de LIGNE) |
|---|---|
| G, grandes routes | `class` ∈ motorway, trunk, primary |
| M, routes moyennes | `class` ∈ secondary, tertiary |
| P, rues et petites routes | `class` ∈ minor, busway |
| S, dessertes et voies douces revêtues | `class` = service, **ou** `class` = path + `subclass` = cycleway + `surface` ≠ unpaved, **ou** `class` = path + `subclass` ∈ path, bridleway + `surface` = paved |

Les bords se dessinent tous avant les pistes et sentiers, les intérieurs
blancs tous après. Ainsi, à un croisement, la route reste continue et le
bout du sentier disparaît sous le blanc.

Non dessinés : `class` ∈ transit, ferry, raceway, bus_guideway, toutes les
classes `*_construction` (voies en travaux) ; `subclass` ∈ corridor,
platform ; `landcover` farmland, rock, sand, ice ; couches `park`, `poi`,
`water_name`, `mountain_peak`, `aerodrome_label`, `boundary`.

## Épaisseurs par zoom (`line-width`)

Interpolation linéaire entre les points donnés. Avant le premier point, la
valeur du premier ; après le dernier, celle du dernier.

| Couche | z8 | z9 | z10 | z12 | z13 | z14 | z15 | z16 | z17 | z18 |
|---|---|---|---|---|---|---|---|---|---|---|
| `voie-g-bord` | 1,8 | | 2,5 | 4 | | 7 | 9,5 | 12 | | 20 |
| `voie-g` | 1 | | 1,5 | 2,5 | | 5 | 7 | 9 | | 16 |
| `voie-m-bord` | | 1,4 | | 3 | | 5,75 | 7,5 | 9,5 | | 16 |
| `voie-m` | | 0,8 | | 1,8 | | 4 | 5,5 | 7 | | 13 |
| `voie-p-bord` | | | | 1,4 | 2,5 | 4 | 5,5 | 7 | | 12,5 |
| `voie-p` | | | | 0,8 | 1,5 | 2,5 | 3,75 | 5 | | 10 |
| `voie-s-bord` | | | | | 1,5 | 2,5 | 3,5 | 4,5 | | 8 |
| `voie-s` | | | | | 0,75 | 1,5 | 2,25 | 3 | | 6 |
| `piste` | | | | 1,5 | | 2,2 | **2,5** | | 3,25 | 3,75 |
| `sentier` | | | | 1,2 | | 1,75 | **2** | | 2,6 | 3 |
| `pieton` | | | | | | | | 0,75 | | 1,5 |
| `escalier` | | | | | | | 3 | 3,5 | | 5 |
| `rail` | | | 0,6 | | | 1,2 | | 1,8 | | 2,5 |
| `riviere` | 0,8 | | | 1,5 | | 2,5 | | 4 | | 6 |
| `ruisseau` | | | | | 0,6 | | 1,2 | 1,5 | | 2,5 |
| `courbe` | | | | | 0,75 | | **1** | | 1,3 | 1,5 |
| `courbe-maitresse` | | | | | 1,3 | | **1,8** | | 2,35 | 2,7 |

En gras : les valeurs de `tokens.md`. La règle de `tokens.md` (environ × 0,6
au zoom 12 et × 1,3 au zoom 17) est tenue. Les courbes sont deux fois plus
épaisses que dans l'essai 3, trop fines au zoom 16 (constat de l'essai).

## Le JSON des couches

Prêt à recopier. Seules les couleurs sont à remplacer par la valeur du jeton.
`<LIGNE>` est le filtre de géométrie des « Règles communes ».

```json
[
  { "id": "fond", "type": "background", "paint": { "background-color": "carte.fond" } },

  { "id": "prairie", "type": "fill", "source": "carte", "source-layer": "landcover", "minzoom": 10,
    "filter": ["in", ["get", "class"], ["literal", ["grass", "wetland"]]],
    "paint": { "fill-color": "carte.prairie" } },
  { "id": "foret", "type": "fill", "source": "carte", "source-layer": "landcover",
    "filter": ["==", ["get", "class"], "wood"],
    "paint": { "fill-color": "carte.foret" } },
  { "id": "bati", "type": "fill", "source": "carte", "source-layer": "landuse",
    "filter": ["in", ["get", "class"], ["literal", ["residential", "commercial", "industrial", "retail", "garages", "school", "college", "university", "kindergarten", "hospital"]]],
    "paint": { "fill-color": "carte.bati" } },
  { "id": "eau", "type": "fill", "source": "carte", "source-layer": "water",
    "filter": ["all", ["!=", ["get", "class"], "swimming_pool"], ["!=", ["get", "brunnel"], "tunnel"]],
    "paint": { "fill-color": "carte.eau" } },
  { "id": "riviere", "type": "line", "source": "carte", "source-layer": "waterway", "minzoom": 8,
    "filter": ["all", ["in", ["get", "class"], ["literal", ["river", "canal"]]], ["!=", ["get", "brunnel"], "tunnel"]],
    "layout": { "line-cap": "round", "line-join": "round" },
    "paint": { "line-color": "carte.eau",
      "line-width": ["interpolate", ["linear"], ["zoom"], 8, 0.8, 12, 1.5, 14, 2.5, 16, 4, 18, 6] } },
  { "id": "ruisseau", "type": "line", "source": "carte", "source-layer": "waterway", "minzoom": 13,
    "filter": ["all", ["in", ["get", "class"], ["literal", ["stream", "drain", "ditch"]]], ["!=", ["get", "brunnel"], "tunnel"]],
    "layout": { "line-cap": "round", "line-join": "round" },
    "paint": { "line-color": "carte.eau-trait",
      "line-width": ["interpolate", ["linear"], ["zoom"], 13, 0.6, 15, 1.2, 16, 1.5, 18, 2.5] } },

  { "id": "ombrage", "type": "hillshade", "source": "relief",
    "paint": {
      "hillshade-exaggeration": ["interpolate", ["linear"], ["zoom"], 8, 0.5, 13, 0.45, 16, 0.35, 18, 0.3],
      "hillshade-illumination-direction": 315,
      "hillshade-illumination-anchor": "viewport",
      "hillshade-shadow-color": "carte.ombrage-ombre",
      "hillshade-accent-color": "carte.ombrage-ombre",
      "hillshade-highlight-color": "carte.ombrage-lumiere" } },

  { "id": "batiment", "type": "fill", "source": "carte", "source-layer": "building", "minzoom": 14,
    "paint": { "fill-color": "carte.batiment",
      "fill-opacity": ["interpolate", ["linear"], ["zoom"], 14, 0.5, 16, 1] } },

  { "id": "courbe", "type": "line", "source": "courbes", "source-layer": "contour", "minzoom": 13,
    "filter": ["==", ["get", "major"], 0],
    "layout": { "line-join": "round" },
    "paint": { "line-color": "carte.courbe",
      "line-width": ["interpolate", ["linear"], ["zoom"], 13, 0.75, 15, 1, 17, 1.3, 18, 1.5] } },
  { "id": "courbe-maitresse", "type": "line", "source": "courbes", "source-layer": "contour", "minzoom": 13,
    "filter": ["==", ["get", "major"], 1],
    "layout": { "line-join": "round" },
    "paint": { "line-color": "carte.courbe-maitresse",
      "line-width": ["interpolate", ["linear"], ["zoom"], 13, 1.3, 15, 1.8, 17, 2.35, 18, 2.7] } },

  { "id": "pieton", "type": "line", "source": "carte", "source-layer": "transportation", "minzoom": 16,
    "filter": ["all", <LIGNE>, ["==", ["get", "class"], "path"], ["in", ["get", "subclass"], ["literal", ["footway", "pedestrian"]]]],
    "layout": { "line-cap": "round", "line-join": "round" },
    "paint": { "line-color": "carte.pieton",
      "line-width": ["interpolate", ["linear"], ["zoom"], 16, 0.75, 18, 1.5] } },
  { "id": "escalier", "type": "line", "source": "carte", "source-layer": "transportation", "minzoom": 15,
    "filter": ["all", <LIGNE>, ["==", ["get", "class"], "path"], ["==", ["get", "subclass"], "steps"]],
    "layout": { "line-cap": "butt", "line-join": "round" },
    "paint": { "line-color": "carte.escalier", "line-dasharray": [0.3, 0.3],
      "line-width": ["interpolate", ["linear"], ["zoom"], 15, 3, 16, 3.5, 18, 5] } },
  { "id": "rail", "type": "line", "source": "carte", "source-layer": "transportation", "minzoom": 10,
    "filter": ["all", <LIGNE>, ["==", ["get", "class"], "rail"], ["!=", ["get", "brunnel"], "tunnel"]],
    "paint": { "line-color": "carte.rail",
      "line-width": ["interpolate", ["linear"], ["zoom"], 10, 0.6, 14, 1.2, 16, 1.8, 18, 2.5] } },

  { "id": "voie-s-bord", "type": "line", "source": "carte", "source-layer": "transportation", "minzoom": 13,
    "filter": <GROUPE_S>,
    "layout": { "line-cap": "round", "line-join": "round" },
    "paint": { "line-color": "carte.voie-bord", "line-opacity": <TUNNEL>,
      "line-width": ["interpolate", ["linear"], ["zoom"], 13, 1.5, 14, 2.5, 15, 3.5, 16, 4.5, 18, 8] } },
  { "id": "voie-p-bord", "type": "line", "source": "carte", "source-layer": "transportation", "minzoom": 12,
    "filter": <GROUPE_P>,
    "layout": { "line-cap": "round", "line-join": "round" },
    "paint": { "line-color": "carte.voie-bord", "line-opacity": <TUNNEL>,
      "line-width": ["interpolate", ["linear"], ["zoom"], 12, 1.4, 13, 2.5, 14, 4, 15, 5.5, 16, 7, 18, 12.5] } },
  { "id": "voie-m-bord", "type": "line", "source": "carte", "source-layer": "transportation", "minzoom": 9,
    "filter": <GROUPE_M>,
    "layout": { "line-cap": "round", "line-join": "round" },
    "paint": { "line-color": "carte.voie-bord", "line-opacity": <TUNNEL>,
      "line-width": ["interpolate", ["linear"], ["zoom"], 9, 1.4, 12, 3, 14, 5.75, 15, 7.5, 16, 9.5, 18, 16] } },
  { "id": "voie-g-bord", "type": "line", "source": "carte", "source-layer": "transportation", "minzoom": 8,
    "filter": <GROUPE_G>,
    "layout": { "line-cap": "round", "line-join": "round" },
    "paint": { "line-color": "carte.voie-bord", "line-opacity": <TUNNEL>,
      "line-width": ["interpolate", ["linear"], ["zoom"], 8, 1.8, 10, 2.5, 12, 4, 14, 7, 15, 9.5, 16, 12, 18, 20] } },

  { "id": "piste", "type": "line", "source": "carte", "source-layer": "transportation", "minzoom": 12,
    "filter": ["all", <LIGNE>, ["any",
      ["==", ["get", "class"], "track"],
      ["all", ["==", ["get", "class"], "path"], ["==", ["get", "subclass"], "cycleway"], ["==", ["get", "surface"], "unpaved"]]]],
    "layout": { "line-cap": "round", "line-join": "round" },
    "paint": { "line-color": "carte.piste", "line-opacity": <TUNNEL>,
      "line-width": ["interpolate", ["linear"], ["zoom"], 12, 1.5, 14, 2.2, 15, 2.5, 17, 3.25, 18, 3.75] } },
  { "id": "sentier", "type": "line", "source": "carte", "source-layer": "transportation", "minzoom": 12,
    "filter": ["all", <LIGNE>, ["==", ["get", "class"], "path"],
      ["in", ["get", "subclass"], ["literal", ["path", "bridleway"]]],
      ["!=", ["get", "surface"], "paved"]],
    "layout": { "line-cap": "butt", "line-join": "round" },
    "paint": { "line-color": "carte.sentier", "line-opacity": <TUNNEL>, "line-dasharray": [2.5, 2],
      "line-width": ["interpolate", ["linear"], ["zoom"], 12, 1.2, 14, 1.75, 15, 2, 17, 2.6, 18, 3] } },

  { "id": "voie-s", "type": "line", "source": "carte", "source-layer": "transportation", "minzoom": 13,
    "filter": <GROUPE_S>,
    "layout": { "line-cap": "round", "line-join": "round" },
    "paint": { "line-color": "carte.voie", "line-opacity": <TUNNEL>,
      "line-width": ["interpolate", ["linear"], ["zoom"], 13, 0.75, 14, 1.5, 15, 2.25, 16, 3, 18, 6] } },
  { "id": "voie-p", "type": "line", "source": "carte", "source-layer": "transportation", "minzoom": 12,
    "filter": <GROUPE_P>,
    "layout": { "line-cap": "round", "line-join": "round" },
    "paint": { "line-color": "carte.voie", "line-opacity": <TUNNEL>,
      "line-width": ["interpolate", ["linear"], ["zoom"], 12, 0.8, 13, 1.5, 14, 2.5, 15, 3.75, 16, 5, 18, 10] } },
  { "id": "voie-m", "type": "line", "source": "carte", "source-layer": "transportation", "minzoom": 9,
    "filter": <GROUPE_M>,
    "layout": { "line-cap": "round", "line-join": "round" },
    "paint": { "line-color": "carte.voie", "line-opacity": <TUNNEL>,
      "line-width": ["interpolate", ["linear"], ["zoom"], 9, 0.8, 12, 1.8, 14, 4, 15, 5.5, 16, 7, 18, 13] } },
  { "id": "voie-g", "type": "line", "source": "carte", "source-layer": "transportation", "minzoom": 8,
    "filter": <GROUPE_G>,
    "layout": { "line-cap": "round", "line-join": "round" },
    "paint": { "line-color": "carte.voie", "line-opacity": <TUNNEL>,
      "line-width": ["interpolate", ["linear"], ["zoom"], 8, 1, 10, 1.5, 12, 2.5, 14, 5, 15, 7, 16, 9, 18, 16] } },

  { "id": "cote", "type": "symbol", "source": "courbes", "source-layer": "contour", "minzoom": 13,
    "filter": ["==", ["get", "major"], 1],
    "layout": { "symbol-placement": "line", "symbol-spacing": 350, "text-max-angle": 25,
      "text-field": ["to-string", ["get", "ele"]], "text-font": ["NotoSans-Regular"],
      "text-size": ["interpolate", ["linear"], ["zoom"], 13, 12, 16, 13] },
    "paint": { "text-color": "carte.cote", "text-halo-color": "carte.etiquette-halo", "text-halo-width": 1.5 } },
  { "id": "nom-eau", "type": "symbol", "source": "carte", "source-layer": "waterway", "minzoom": 13,
    "filter": ["in", ["get", "class"], ["literal", ["river", "canal"]]],
    "layout": { "symbol-placement": "line", "symbol-spacing": 400, "text-max-angle": 30,
      "text-field": ["get", "name"], "text-font": ["NotoSans-Italic"],
      "text-size": ["interpolate", ["linear"], ["zoom"], 13, 12, 16, 14] },
    "paint": { "text-color": "carte.eau-texte", "text-halo-color": "carte.etiquette-halo", "text-halo-width": 1.5 } },
  { "id": "nom-voie", "type": "symbol", "source": "carte", "source-layer": "transportation_name", "minzoom": 15,
    "filter": ["all", <LIGNE>, ["!", ["in", ["get", "subclass"], ["literal", ["footway", "pedestrian", "steps", "corridor", "platform"]]]]],
    "layout": { "symbol-placement": "line", "symbol-spacing": 300, "text-max-angle": 30,
      "text-field": ["get", "name"], "text-font": ["NotoSans-Regular"],
      "text-size": ["interpolate", ["linear"], ["zoom"], 15, 12, 18, 14] },
    "paint": { "text-color": "carte.etiquette-2", "text-halo-color": "carte.etiquette-halo", "text-halo-width": 1.5 } },
  { "id": "lieu-hameau", "type": "symbol", "source": "carte", "source-layer": "place", "minzoom": 13,
    "filter": ["in", ["get", "class"], ["literal", ["hamlet", "suburb", "quarter", "neighbourhood", "isolated_dwelling"]]],
    "layout": { "text-field": ["get", "name"], "text-font": ["NotoSans-Regular"], "text-max-width": 8, "text-padding": 4,
      "text-size": ["interpolate", ["linear"], ["zoom"], 13, 12, 16, 14] },
    "paint": { "text-color": "carte.etiquette-2", "text-halo-color": "carte.etiquette-halo", "text-halo-width": 1.5 } },
  { "id": "lieu-village", "type": "symbol", "source": "carte", "source-layer": "place", "minzoom": 11,
    "filter": ["==", ["get", "class"], "village"],
    "layout": { "text-field": ["get", "name"], "text-font": ["NotoSans-Bold"], "text-max-width": 8, "text-padding": 4,
      "text-size": ["interpolate", ["linear"], ["zoom"], 11, 13, 14, 15, 16, 17] },
    "paint": { "text-color": "carte.etiquette", "text-halo-color": "carte.etiquette-halo", "text-halo-width": 2 } },
  { "id": "lieu-ville", "type": "symbol", "source": "carte", "source-layer": "place", "minzoom": 8,
    "filter": ["in", ["get", "class"], ["literal", ["city", "town"]]],
    "layout": { "text-field": ["get", "name"], "text-font": ["NotoSans-Bold"], "text-max-width": 8, "text-padding": 4,
      "text-size": ["interpolate", ["linear"], ["zoom"],
        8, ["match", ["get", "class"], "city", 13, 12],
        12, ["match", ["get", "class"], "city", 17, 15],
        14, ["match", ["get", "class"], "city", 20, 18]] },
    "paint": { "text-color": "carte.etiquette", "text-halo-color": "carte.etiquette-halo", "text-halo-width": 2 } }
]
```

Abréviations à remplacer :

```json
<LIGNE>     = ["in", ["geometry-type"], ["literal", ["LineString", "MultiLineString"]]]
<TUNNEL>    = ["case", ["==", ["get", "brunnel"], "tunnel"], 0.4, 1]
<GROUPE_G>  = ["all", <LIGNE>, ["in", ["get", "class"], ["literal", ["motorway", "trunk", "primary"]]]]
<GROUPE_M>  = ["all", <LIGNE>, ["in", ["get", "class"], ["literal", ["secondary", "tertiary"]]]]
<GROUPE_P>  = ["all", <LIGNE>, ["in", ["get", "class"], ["literal", ["minor", "busway"]]]]
<GROUPE_S>  = ["all", <LIGNE>, ["any",
                ["==", ["get", "class"], "service"],
                ["all", ["==", ["get", "class"], "path"], ["==", ["get", "subclass"], "cycleway"], ["!=", ["get", "surface"], "unpaved"]],
                ["all", ["==", ["get", "class"], "path"], ["in", ["get", "subclass"], ["literal", ["path", "bridleway"]]], ["==", ["get", "surface"], "paved"]]]]
```

Un attribut absent (`surface` non renseigné) vaut `null` : `["!=", null, "paved"]`
est vrai. Un sentier sans `surface` reste donc un sentier, une piste cyclable
sans `surface` reste une petite voie blanche.

## Bord de la zone et voile (ajouté le 26 octobre 2026, T7)

Aux petits zooms, une tuile couvre bien plus que la zone : la carte déborde
du carré téléchargé (jusqu'à Épinal pour Nancy), puis s'arrête net en
zoomant. On croirait avoir ces lieux hors ligne. Un voile couvre donc tout ce
qui est hors de la zone, comme sur l'écran 52.

- Source `bord-zone` : GeoJSON tiré du `bbox` de la zone (catalogue), avec
  deux objets : le contour (ligne fermée des quatre côtés) et le voile (un
  polygone qui couvre le monde, `[-180, -85]` à `[180, 85]`, percé d'un trou
  au carré de la zone ; le trou se décrit dans le sens inverse du tour
  extérieur).
- Deux couches, **au-dessus de toutes les autres, étiquettes comprises**
  (un nom de ville hors zone est voilé lui aussi). Le point bleu de MapLibre
  reste au-dessus.

| # | id | Type | Source | Filtre | Couleur |
|---|---|---|---|---|---|
| 31 | `voile-hors-zone` | fill | `bord-zone` | géométrie `Polygon` | `hn.voile-hors-zone` (`#CFC8BB`, `fill-opacity` 0,72) |
| 32 | `bord-zone` | line | `bord-zone` | géométrie `LineString` | `carte.bord-zone` : 2,5 ; tirets 9 / 6, soit `line-dasharray` `[3.6, 2.4]` ; bouts carrés |

Pas de zoom minimal ni maximal : visibles du zoom 8 au zoom 18.

## Étiquettes

- **Police : Noto Sans** (Regular, Bold, Italic), glyphes en fichiers
  locaux comme dans l'essai 3 (licence OFL, 736 Ko). Noms des dossiers :
  ceux de l'essai (`NotoSans-Regular`, `NotoSans-Bold`, `NotoSans-Italic`).
  Où ranger ces fichiers dans l'app : à l'`architecte` (T1) ou au
  `developpeur` (T5).
- Pourquoi pas la police du système : MapLibre dessine le texte de la carte
  avec ses propres glyphes (fichiers `.pbf`), pas avec la police du
  téléphone. Pourquoi pas Jost : petit œil, réservé aux titres courts
  (`tokens.md`). Noto Sans a un grand œil et tous les accents français.
- **Priorité en cas de chevauchement** : MapLibre place d'abord les couches
  du haut. Ordre voulu, du plus important au moins important : villes, villages,
  hameaux, noms de voies, noms de rivières, cotes.
- Contraste mesuré sur `carte.fond`, sans compter le halo blanc : noms de
  lieux 15,9:1, noms de voies et hameaux 7,4:1, cotes 8,5:1, rivières 7,9:1.
- Cote : la valeur seule (« 350 »), sans « m », comme sur les cartes IGN.
- Pas d'icônes (sommets, parkings, points d'eau) en v1 : il faudrait un jeu
  d'images (« sprite ») et la carte resterait plus chargée.

## Ombrage du relief

- Source `relief` (Mapterhorn, encodage terrarium, zoom 12 au plus).
- Lumière venue du nord-ouest (315°), **attachée à l'écran**
  (`viewport`) : la règle des cartographes. Avec une lumière venue du bas,
  l'œil inverse creux et bosses.
- Force (`hillshade-exaggeration`) : 0,5 au zoom 8, 0,45 au 13, 0,35 au
  16, 0,3 au 18. De près, la tuile du zoom 12 est très agrandie et floue :
  on l'atténue pour qu'elle ne brouille pas les sentiers.
- Ombre `carte.ombrage-ombre` (brun gris, plus chaud que le gris de
  l'essai, pour aller avec le fond beige), lumière `carte.ombrage-lumiere`.
- Défaut connu (essai 3) : légère couture entre tuiles sur iOS, de près. À
  regarder en T7, pas de remède dans le style.

## Attributions

Pas dans le style : un texte posé sur la carte, en bas à gauche, au-dessus
des rayures de la barre d'onglets (maquette `v1/90`). Texte, taille et
couleurs : `tokens.md`, « Attribution ». L'attribution et le logo de
MapLibre sont désactivés (`attribution={false}`, `logo={false}`, comme dans
l'essai).

## Variante « suivi » (phase 8, pour mémoire)

Même style, quelques propriétés changées (`tokens.md`) : `courbe`,
`courbe-maitresse`, `cote` et `ombrage` à 50 % ; `sentier` à 2,5 au zoom 15
(× 1,25 sur toute la courbe). Rien à faire en phase 2.

## À regarder sur les captures (T6, T7)

1. Zoom 14 et 15 sur Villers-lès-Nancy et Laxou : plus aucun tiret rouge le
   long des rues.
2. Zoom 16 : les trottoirs en trait gris fin, ne gênent pas les rues.
3. Zoom 13 : courbes visibles, cotes lisibles ; seuls les chemins nommés ou
   balisés apparaissent (choix du schéma, voir plus bas).
4. Zoom 18 : pistes et sentiers assez épais, tirets réguliers.
5. Forêt de Haye : forêt bien distincte des prés et des champs.
6. Une voie verte (bord de Meurthe ou de Moselle) : blanche, pas rouge.

## Hors du style, à décider ailleurs

- **Chemins des zooms 12 et 13** : le schéma n'y met que les chemins nommés
  ou balisés. Une option de Planetiler (`transportation_z13_paths`) les met
  tous au zoom 13, au prix de tuiles plus lourdes. Choix de la fabrique.
- **Chemins interdits** (`access=no`) et difficulté VTT (`mtb_scale`) : les
  attributs existent dans les tuiles, ce style ne s'en sert pas.
