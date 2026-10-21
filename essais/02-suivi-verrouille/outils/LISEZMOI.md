# Outils de l'essai 2 (sur le Mac)

Spec : `docs/essais/02-suivi-verrouille-spec.md`. Python 3 sans dépendance, bash,
Swift (pour l'OCR iOS : reconnaissance de texte dans une image, par le framework
Vision de macOS). Les dossiers `sortie/` et `journaux/` sont ignorés par git.

| Fichier | Rôle |
|---|---|
| `fabriquer-trace.py` | Lit R3.gpx, écrit dans `sortie/` la trace à 5 m/s (3 600 points) |
| `rejouer.sh android\|ios [premier] [nombre]` | Envoie un point par seconde à l'appareil |
| `observer-android.sh [durée_s]` | Relève chaque seconde les notifications de l'app |
| `observer-ios.sh [durée_s]` | Capture + OCR chaque seconde (`ocr.swift`, compilé dans `sortie/ocr`) |
| `analyser.py` | Calcule C1, C2, C3 et écrit un tableau Markdown |
| `tests/` | Journaux fabriqués (`fabriquer-tests.py` les régénère) pour éprouver `analyser.py` |

## Distance `d` (à reprendre à l'identique dans l'app)

`d` = somme des cordes entre les points successifs de la trace de 3 600 points
(ceux de `trace-app.json`, coordonnées arrondies à 6 décimales).

- Corde entre deux points : haversine, rayon terrestre R = 6 371 008,8 m.
  `a = sin²(Δφ/2) + cos φ1 · cos φ2 · sin²(Δλ/2)` puis `2 · R · asin(√a)`
  (φ = latitude, λ = longitude, en radians).
- `d` du point `i` = somme des cordes des points 0 à `i`. Point 0 : `d = 0`.
- Pour une position reçue : on la projette sur le segment le plus proche de la
  trace, avec une fraction `f` entre 0 et 1 le long du segment `[j, j+1]` ;
  `d = d[j] + f · (d[j+1] − d[j])`.
- Longueur totale en cordes : **17 928,262 m** (dernier point, `i` = 3 599).
  Les points sont espacés de 5 m le long du tracé d'origine, donc d'un peu moins
  en ligne droite dans les virages.

## Fichiers de `sortie/`

- **`trace-app.json`** (pour l'app) : `[[lat, lon], ...]`, 3 600 points.
- `trace-1h.json` : `{"speed_mps": 5, "points": [[lat, lon], ...], "d": [...]}`
  (`d` calculé comme ci-dessus).
- `trace-1h.tsv` : `i`, `d`, `lat`, `lon` (entrée de `rejouer.sh`).
- `trace-1h.gpx` : même trace en GPX (temps fictifs, 1 point par seconde).

## Journaux (`journaux/`)

Option `JOURNAL=<chemin>` sur `rejouer.sh` et les observateurs pour nommer le
journal (par défaut, les noms ci-dessous). À utiliser si deux essais tournent.

- `<plateforme>-rejeu.tsv` : `heure Mac (ms)`, `i`, `d`, `lat`, `lon`, `ok` ou
  `echec` (la commande d'envoi a réussi ou non). L'heure est prise juste avant
  l'envoi de la position.
- `android-observateur.tsv` : `heure Mac (ms)`, `nombre de notifications`, `texte`.
  Si adb échoue : `erreur` dans les deux dernières colonnes.
- `ios-observateur.tsv` : `heure Mac (ms)`, `texte lu` (lignes contenant
  « Indication n », séparées par ` | ` s'il y en a plusieurs sur la même capture).
  Une capture `captures-ios/<ms>.png` à chaque changement de texte.

## Journal de l'app (écrit par T2/T3, lu par `analyser.py`)

JSON Lines (format texte : un objet JSON par ligne). Toutes les heures `t` sont
en millisecondes depuis 1970, à l'heure de l'appareil.

| `type` | Champs |
|---|---|
| `position` | `t`, `tPos` (heure de la position), `lat`, `lon`, `d` (m), `k` |
| `notif` | `t`, `k`, `texte` |
| `liveactivity` | `t`, `k`, `texte`, `actives` (nombre de Live Activities actives ; une Live Activity est le bandeau en direct de l'écran verrouillé iOS) |
| `erreur` | `t`, et un message libre |

## Rejeu Android : position simulée (« mock »)

`emu geo fix` répond OK, mais la position GNSS (satellites) reste à Mountain
View sur l'émulateur 37.1.11. `rejouer.sh android` utilise donc un fournisseur
de test « gps » (`cmd location providers set-test-provider-location`, après
`appops set 0 MOCK_LOCATION allow`). Android marque ces positions « mock »
(simulées). `MODE=geofix ./rejouer.sh android` force l'ancienne méthode.
Vérifier : `adb -s emulator-5554 shell dumpsys location | grep "last location"`.

Deux rejeux Android en même temps se battent pour le même fournisseur et le
même journal : n'en lancer qu'un.

## Utilisation

```
export ANDROID_HOME=$HOME/Library/Android/sdk LANG=fr_FR.UTF-8
python3 fabriquer-trace.py
./observer-android.sh &          # ou ./observer-ios.sh &
./rejouer.sh android             # 1 h ; essai court : ./rejouer.sh android 0 20
./analyser.py --plateforme android --rejeu ../journaux/android-rejeu.tsv \
  --obs ../journaux/android-observateur.tsv --app <journal copié de l'app>.jsonl
```

## Ce que calcule `analyser.py`

- **C1** (avec `--app`) : fenêtre = de la première injection à la dernière + 1 s
  si `--rejeu` est donné ; `--debut` / `--fin` (heure Mac, ms) la restreignent,
  par exemple à la période d'écran verrouillé. Les trous de bord (début → 1re
  position, dernière position → fin) comptent : une app tuée à mi-parcours
  échoue. L'heure de l'app est ramenée à l'heure Mac avec l'écart médian
  « heure de l'app − heure d'injection » des positions retrouvées dans le
  rejeu (écart d'horloge plus latence d'envoi, 0,1 à 1 s). Sans rejeu, l'écart
  n'est pas estimé et la tolérance est celle de l'horloge de l'appareil.
- **C2** : le palier `k` est franchi au premier point de rejeu dont
  `d >= 200 * k` ; le premier palier est `floor(d du premier point / 200) + 1`.
  Délai = première heure où l'observateur voit « Indication k » moins l'heure
  d'injection de ce point. Résolution : 1 s. Un délai inférieur à −1 s (texte vu
  avant l'injection) est signalé à part, exclu des « < 5 s » et donne ÉCHEC.
  OK si au moins 20 changements vus, tous < 5 s, et aucun palier jamais vu
  (un palier franchi mais jamais vu = ÉCHEC). Exception : le tout dernier
  palier, s'il est franchi moins de 10 s avant la fin du rejeu, est exclu et
  signalé. La part « < 5 s » est calculée sur les paliers retenus.
- **C3** : Android, maximum du nombre de notifications de l'app dans les
  relevés. iOS, maximum de `actives` dans les événements `liveactivity`, et
  nombre de lignes « Indication » lues sur une même capture (≥ 2 : verdict
  « À VÉRIFIER », il faut regarder la capture). Les événements `notif` iOS sont
  seulement comptés à titre d'information.
