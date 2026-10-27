# Comparaison C5 : app (release) contre Mac, 27 octobre 2026

Les 5 références sont calculées dans l'app en version finale (release), sur
iPhone 17 (simulateur iOS) et sur `emulator-5554` (Android, AVD
`Pixel_6_API_34_arm64`), avec la zone Nancy v3. Le Mac rejoue la requête
exacte envoyée au moteur de l'app (`banc/requete-Rn.json`) avec Valhalla
3.9.1 (image Docker `ghcr.io/valhalla/valhalla:3.9.1`), sur le même paquet.

- Empreinte SHA-256 de `valhalla_tiles.tar` (zone v3) :
  `7fa29249411c75fd0cc651b4f0e06baf9dbd80109eea7df51b8116b7ceb07a44`.
  Identique sur le Mac (copie), dans l'app iOS et dans l'app Android.
- Les requêtes des 3 passages iOS et des 3 passages Android sont
  identiques octet pour octet (`cmp`).
- Identique = même nombre de points, mêmes valeurs à 1e-6 près
  (écart maximal mesuré : 0.0) et même `trip.summary.length`.
- Résultat des 6 passages (3 iOS, 3 Android) : tous identiques à la
  réponse du Mac.

| Référence | Points app iOS | Points app Android | Points Mac | Distance iOS / Android / Mac (km) | Identique |
|---|---|---|---|---|---|
| R1 | 904 | 904 | 904 | 20.532 / 20.532 / 20.532 | oui |
| R2 | 1343 | 1343 | 1343 | 35.172 / 35.172 / 35.172 | oui |
| R3 | 579 | 579 | 579 | 26.981 / 26.981 / 26.981 | oui |
| R4 | 1560 | 1560 | 1560 | 42.123 / 42.123 / 42.123 | oui |
| R5 | 1241 | 1241 | 1241 | 40.353 / 40.353 / 40.353 | oui |

Script (hors dépôt) : `python3 -I compare.py <dossier> ios-1 android-1`
(décodage des polylines à 6 décimales de `mac-Rn.json`, comparaison aux
`Rn.json` de l'app). Dernière ligne de sa sortie : `ALL IDENTICAL`.
