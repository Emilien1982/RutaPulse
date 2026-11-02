# ADR 0005 — Sources des infos d'itinéraire : altitude, type de voie, difficulté

- Statut : Accepté le 2026-10-19
- Date : 2026-10-19
- Détail des recherches : [docs/04-architecture-annexe-recherches.md](../04-architecture-annexe-recherches.md), risques 3 et 4

ADR veut dire « Architecture Decision Record » (fiche de décision
d'architecture).

## Contexte

- La v1 affiche : distance, dénivelé positif et négatif, profil d'altitude,
  part de route, de piste et de sentier, difficulté quand elle est connue,
  durée estimée (cadrage, fonction 3).
- Tout doit marcher sans réseau.
- Mesures en France (taginfo, statistiques des étiquettes OpenStreetMap, au
  18 octobre 2026) : la surface est indiquée sur 16 % des pistes et 29 % des
  sentiers ; la difficulté VTT (`mtb:scale`) sur 1,4 % des pistes et 4 % des
  sentiers.

## Décision

- **Distance et durée** : celles renvoyées par Valhalla (moteur de calcul
  d'itinéraire, voir ADR 0002), avec le profil vélo `mountain` (vitesse
  de base 16 km/h). La prise en compte de la pente dans la durée n'est pas
  décrite par la documentation : à vérifier pendant l'essai 1.
- **Profil d'altitude** : demandé à Valhalla avec `elevation_interval: 30`
  (une altitude tous les 30 m). Les altitudes viennent des tuiles HGT (grilles
  d'altitudes) du paquet de zone. **Mis à jour le 2026-10-28** : profil
  par `height` sur chaque tronçon, dénivelé sur le profil joint (ADR 0017).
- **Dénivelé** : calculé par notre code TypeScript (JavaScript typé) à
  partir du profil, avec un lissage, car Valhalla ne le fournit pas. La
  méthode est validée contre une référence externe pendant l'essai 1.
- **Source d'altitude** : d'abord les tuiles standard de Valhalla. Si
  l'écart de dénivelé dépasse 10 % sur les itinéraires de test, passer au
  RGE ALTI 5 m de l'IGN (Institut national de l'information géographique,
  modèle du terrain nu mesuré au laser, licence ouverte), converti en HGT.
- **Type de voie** : le champ `use` de Valhalla, obtenu par
  `trace_attributes` (fonction de Valhalla qui détaille les voies
  traversées), regroupé en trois classes : route, piste, sentier. La
  règle de regroupement est écrite en TypeScript et testée.
- **Difficulté** : `sac_scale` (difficulté de randonnée) vient de Valhalla.
  `mtb:scale` vient de la table « identifiant de voie → difficulté » du
  paquet de zone (ADR 0003), consultée avec l'identifiant de voie que
  renvoie Valhalla. Sans donnée, l'app affiche « inconnue ».
- **GPX** (format standard d'échange de traces GPS) : lecture avec
  `@tmcw/togeojson` (licence BSD-2) ; écriture par notre propre code, car le
  format est simple. Un itinéraire importé est recalé sur les voies avec
  `trace_attributes` pour obtenir ses infos.

## Alternatives rejetées

- **Copernicus GLO-30** comme altitude : modèle de surface qui inclut la
  hauteur des arbres. Fausse le dénivelé en forêt.
- **Service d'altitude en ligne de l'IGN** : ne marche pas hors ligne.
- **Lire la difficulté dans les tuiles de carte** : la carte ne contient que
  ce qui est affiché à un zoom donné. Pas fiable pour un calcul.
- **Modifier Valhalla pour qu'il garde `mtb:scale`** : demande de maintenir
  une version modifiée du moteur.

## Conséquences

- Positif : toutes les infos viennent du téléphone, sans réseau.
- Négatif : la difficulté sera le plus souvent « inconnue ». C'est conforme
  au cadrage, mais à dire aux utilisateurs.
- Négatif : la durée de Valhalla n'est pas calibrée pour le VTT en terrain
  technique. À ajuster plus tard avec des sorties réelles.

## Sources

- Valhalla, `elevation_interval` et profil vélo : https://valhalla.github.io/valhalla/api/route/api-reference/
- Valhalla, `trace_attributes` : https://valhalla.github.io/valhalla/api/map-matching/
- taginfo France : https://taginfo.geofabrik.de/europe/france/api/4/key/stats?key=mtb:scale
- Copernicus DEM : https://registry.opendata.aws/copernicus-dem/
- RGE ALTI 5 m : https://gee-community-catalog.org/projects/france5m/
- togeojson : https://registry.npmjs.org/-/v1/search?text=%40tmcw%2Ftogeojson&size=2
