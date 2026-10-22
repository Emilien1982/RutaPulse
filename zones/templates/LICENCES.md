# Licences et mentions obligatoires

Ce paquet de zone réunit des données venant de plusieurs sources libres.
Chacune impose une mention. L'application les affiche.

## Carte et circuits : OpenStreetMap (ODbL)

- Mention : « © les contributeurs d'OpenStreetMap ».
- Licence : Open Database License (ODbL, licence de base de données
  ouverte) 1.0, https://opendatacommons.org/licenses/odbl/1-0/
- Données concernées : les tuiles de calcul d'itinéraire
  (`valhalla_tiles.tar`), la carte (`map.pmtiles`) et les circuits balisés
  (`trails.geojson`).
- Droit d'usage : https://www.openstreetmap.org/copyright

## Schéma de la carte : OpenMapTiles

- Mention : « © OpenMapTiles ».
- La carte suit le schéma OpenMapTiles (licence CC-BY 4.0),
  https://openmaptiles.org/
- Elle est fabriquée avec Planetiler (licence Apache 2.0),
  https://github.com/onthegomap/planetiler

## Annexes de la carte : eau et frontières

- Polygones d'eau issus d'OpenStreetMap, https://osmdata.openstreetmap.de/
  (ODbL).
- Natural Earth, https://www.naturalearthdata.com/ (domaine public).

## Relief : Mapterhorn

- Fichier concerné : `terrain.pmtiles`.
- Mention : « © Mapterhorn », https://mapterhorn.com/attribution
- Sources d'altitude sur la France : IGN (Licence Ouverte 2.0) et Copernicus
  GLO-30. La liste complète des sources, avec leur licence, est sur la page
  d'attribution de Mapterhorn ci-dessus.
- Mention demandée pour Copernicus GLO-30 : « © DLR e.V. 2010-2014 and
  © Airbus Defence and Space GmbH 2014-2018 provided under COPERNICUS by the
  European Union and ESA; all rights reserved ».

## Altitude et courbes de niveau : SRTM (NASA)

- Fichiers concernés : les fichiers `.hgt` (altitude lue par le calcul
  d'itinéraire) et `contours.pmtiles` (courbes de niveau).
- Source : SRTM de la NASA, résolution 1 seconde d'arc (environ 30 m),
  distribuée par les « AWS Terrain Tiles »,
  https://registry.opendata.aws/terrain-tiles/

## Calcul d'itinéraire : Valhalla

- Les tuiles de calcul sont fabriquées avec Valhalla (licence MIT),
  https://github.com/valhalla/valhalla
