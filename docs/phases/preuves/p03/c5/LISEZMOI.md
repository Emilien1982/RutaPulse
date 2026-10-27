# Rejouer la comparaison C5 (phase 3)

But : vérifier que les 5 parcours de référence, calculés dans l'app, donnent
les mêmes tracés que Valhalla 3.9.1 sur le Mac.

## Ce que contient ce dossier

- `requetes/requete-R1.json` à `R5.json` : la requête exacte envoyée au
  moteur par l'app (sortie de `buildRouteRequest`). Elle est identique,
  octet pour octet, dans les 3 passages iOS et les 3 passages Android.
- `app-ios/R1.json` à `R5.json`, `app-android/R1.json` à `R5.json` : les
  coordonnées `[lon, lat]` décodées par l'app, 1er passage en version
  finale (release), le 27 octobre 2026.
- `rejouer-sur-mac.sh` : recalcule les réponses du Mac (`../mac-R*.json`)
  avec Docker.
- `comparer.py` : compare l'app et le Mac.

## Commandes, depuis `docs/phases/preuves/p03/`

1. Comparer avec les réponses du Mac déjà gardées :
   `python3 -I c5/comparer.py`
2. Recalculer d'abord les réponses du Mac (Docker et le paquet de la zone
   Nancy v3 nécessaires ; empreinte SHA-256 de `valhalla_tiles.tar` :
   `7fa29249411c75fd0cc651b4f0e06baf9dbd80109eea7df51b8116b7ceb07a44`) :
   `sh c5/rejouer-sur-mac.sh <dossier de la zone v3>`, puis l'étape 1.

« Identique » veut dire : même nombre de points, mêmes coordonnées à
1e-6 près, même distance (`trip.summary.length`). Dernière ligne attendue :
`TOUS IDENTIQUES`.
