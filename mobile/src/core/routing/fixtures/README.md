# Sorties brutes du module natif `valhalla-route`

Relevées le 27 octobre 2026 (phase 3, tâche T2), avec valhalla-mobile 0.6.4,
par un appel temporaire (non commité) au module, dans l'app de développement.
Zone : Nancy v3. Réglage de l'ADR 0002 (`bicycle`, `mountain`, `use_roads: 0`).

- iOS : simulateur iPhone 17. Android : émulateur `Pixel_6_API_34_arm64`.
- Préfixe `ios-` ou `android-`. Le contenu est ce que JavaScript a reçu, sans
  modification (les fichiers d'erreur de rejet sont l'objet `{code, message,
str}` lu dans le `catch`).

| Fichier                  | Cas                                                        | Points                                                                                                                                 |
| ------------------------ | ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `*-success.json`         | Réponse complète de `route`                                | forêt de Haye (48.6612, 6.1015) vers (48.6846, 6.1408) : 5,918 km                                                                      |
| `*-171.json`             | Point hors des tuiles : `{"code":171,...}`                 | départ Haye, arrivée Paris (48.8566, 2.3522)                                                                                           |
| `*-442.json`             | Aucun chemin : `{"code":442,...}`                          | départ Haye, arrivée (48.6636, 6.124) avec `radius: 0`, `minimum_reachability: 1`, `search_cutoff: 40` sur l'arrivée (voir ci-dessous) |
| `*-not-open.json`        | `route` après `close()` : rejet `ERR_ENGINE_NOT_OPEN`      | départ et arrivée de `success`                                                                                                         |
| `*-zone-unreadable.json` | `open` sur un fichier absent : rejet `ERR_ZONE_UNREADABLE` | `.../zones/nancy/v3/absent.tar`                                                                                                        |

Le 442 n'apparaît pas avec la requête habituelle : par défaut Valhalla recale
un point sur une voie bien reliée (`minimum_reachability` 50) et trouve un
chemin. Avec ces trois options, le point tombe sur une petite voie isolée.
Le code 170 n'a pas été obtenu.

Différence de forme entre plateformes : le texte `message` d'un refus de
Valhalla est « No suitable edges near location » sur iOS et
« ValhallaError(code=171, No suitable edges near location) » sur Android
(le module renvoie le texte de l'exception, d'où il relit le code). Les
messages des rejets contiennent un préfixe d'Expo différent selon la
plateforme ; seul `code` est stable.

Chemins abrégés : dans les fichiers `*-zone-unreadable.json`, le début du
chemin local est remplacé par `<documents>`. Rien d'autre n'est changé dans
les relevés (codes, messages, réponses).
