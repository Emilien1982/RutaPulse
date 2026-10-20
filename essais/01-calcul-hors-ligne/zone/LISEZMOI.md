# Essai 1 : paquet de zone « Nancy » et itinéraires de référence

Spec : `docs/essais/01-calcul-hors-ligne-spec.md` (tâche T1).

## Outils requis

- macOS avec Homebrew, `osmium` (`brew install osmium-tool`), `python3`, `curl`.
- Docker lancé, avec l'image `ghcr.io/valhalla/valhalla:3.9.1`
  (`docker pull ghcr.io/valhalla/valhalla:3.9.1`). Même version de Valhalla
  que valhalla-mobile 0.6.4.
- Accès réseau pour le premier lancement : extrait Lorraine de Geofabrik,
  tuiles d'altitude (skadi), GPX de VisuGPX.

## Refaire le paquet

```bash
cd essais/01-calcul-hors-ligne/zone
./fabriquer-zone.sh        # télécharge, découpe, altitude, tuiles, archive
./verifier-zone.sh         # route de test avec valhalla_service (Docker)
python3 -I references/preparer-references.py   # écrit references/references.json
```

Le script `preparer-references.py` a besoin de l'extrait Lorraine et des
tuiles d'altitude : lancer `fabriquer-zone.sh` avant.

## Résultats

- `sortie/nancy/` : `valhalla_tiles.tar`, `elevation/` (fichiers HGT),
  `zone.json`. C'est le paquet à copier dans l'app.
- `sortie/mesures.txt` : temps de chaque étape et tailles.
- `sortie/travail/` : fichiers intermédiaires (extraits `.pbf`, config).
- `references/references.json` et `references/gpx/` : les 5 itinéraires.

Tout ce qui est dans `sortie/`, les `.pbf` et `references/gpx/` est ignoré
par git. Pour forcer un nouveau téléchargement de l'extrait Lorraine,
supprimer `sortie/travail/lorraine.osm.pbf`.

## Limites connues

- Les tuiles de fuseaux horaires ne sont pas fabriquées (inutile ici).
- Le dénivelé calculé dépend de la méthode : rééchantillonnage tous les
  30 m puis hystérésis de 5 m (voir l'en-tête de `preparer-references.py`).
