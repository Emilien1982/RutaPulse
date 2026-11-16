# Fixtures du suivi (phase 8a, tâche T2)

Réponses **enregistrées** du moteur Valhalla 3.9.1 (Docker, sur le Mac) pour
les 4 itinéraires de référence de l'essai T1 (`essais/08-suivi-velo/`). Zone
Nancy v6 (`valhalla_tiles.tar`, empreinte `aee29641…`, release `zone-nancy-v6`).
Coût : `bicycle`, `mountain`, `use_roads: 0` ; langue `fr-FR`.

| Nom  | Itinéraire                                | Ligne (fichier `line-*.json`)             |
| ---- | ----------------------------------------- | ----------------------------------------- |
| `1`  | Itinéraire créé, 34 km, forêt de Haye     | forme de `route` (`1-route-reponse.json`) |
| `2`  | Circuit balisé 11656724, 21 km            | ligne ordonnée de `trails.geojson`        |
| `3`  | GPX simulé avec bruit GPS, 35 km          | `3-gpx-simule.gpx`                        |
| `3d` | Même circuit sans bruit (15712020), 35 km | ligne ordonnée de `trails.geojson`        |

## Fichiers

- `line-<n>.json` : la ligne, en polyligne à 6 décimales (sans perte pour ces
  fichiers).
- `trace-route-<n>.json` : réponse de `trace_route` (`map_snap`) à la ligne
  **éclaircie à un point tous les 20 m** (`spaceEvery`, ADR 0021 § 1.1). On
  n'a gardé que les champs lus par l'app : forme recalée, et pour chaque
  manœuvre `type`, `begin_shape_index`, `end_shape_index`, `length`,
  `roundabout_exit_count`. Les textes et noms de rue du moteur sont retirés.
- `trace-attributes-<n>.json` : réponse de `trace_attributes` (`map_snap`),
  même requête de forme, `filters` : `edge.use`, `edge.density`,
  `edge.begin_shape_index`, `shape` (contrôle M1 de l'ADR 0021).
- `reference-<n>.json` : liste de directions attendue (texte et position),
  écrite par `essais/08-suivi-velo/9-reference-directions.py`, une petite
  version indépendante en Python des règles de l'ADR (aucun code de l'app).

## Comment ils ont été faits

```
python3 -I essais/08-suivi-velo/7-forme-allegee.py <trails.geojson>   # Valhalla sur localhost:8002
python3 -I essais/08-suivi-velo/8-fixtures.py <trails.geojson>
python3 -I essais/08-suivi-velo/9-reference-directions.py
```

Le contrôle M1 a montré : avec un point tous les 20 m, `trace_route` donne les
mêmes directions qu'avec tous les points pour 1, 2 et 3d ; pour 3 (bruité), une
direction de plus (« Serrez à gauche pour rester sur Place Duroc »), qui était
absente avec tous les points ; le demi-tour fantôme reste. Pour 1 et 2, la
forme recalée de `trace_route` et celle de `trace_attributes` sont identiques,
point pour point. Pour 3 et 3d, elles ne le sont que sur le début : voir
`essais/08-suivi-velo/LISEZMOI.md`, section « T2, contrôle M1 ».
