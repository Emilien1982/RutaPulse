# Preuves de T4 (phase 10a) : test de l'APK signé, critère C5

Le 17 novembre 2026, sur l'émulateur `emulator-5584` (Pixel 6, Android 14,
arm64, réglé en anglais). Rien n'a été reconstruit : APK testé
`mobile/apk/RutaPulse-1.0.0-1.apk`. Le téléphone réel n'a pas été touché.
Texte rendu par le testeur, écrit par la session de phase, qui a regardé
`06-barre-etat-mode-avion.png` et `09-maestro-02-itineraire-calcule.png`.

Verdict du testeur : C5 tenu, aucun défaut.

| Fichier | Ce qu'il prouve |
|---|---|
| `sha256.txt` | SHA-256 de l'APK : `7cc80be3…2b4e`, comme dans le registre du guide |
| `apksigner-verify.txt` | Certificat `CN=RutaPulse`, SHA-256 `43fcead7…b9af` : la vraie clé |
| `install.txt` | `uninstall` : Success, puis `install` : Success |
| `dumpsys.txt`, `dumpsys-final.txt` | versionCode 1, versionName 1.0.0, dates d'installation |
| `01-premier-lancement.png` | Premier lancement : écran crème « Pas encore de carte » |
| `02-reglages.png`, `03-wifi-desactive.png` | « Télécharger en Wi-Fi seulement » : activé, puis désactivé (l'émulateur n'a pas de Wi-Fi) |
| `04-zones.png`, `05-telechargement.png` | Zone Nancy, 111 Mo, puis « Prête sans réseau » |
| `c4-android-en-dialogue-position.png` | C4 : dialogue Android de position, en anglais (réserve acceptée) |
| `avion-etat-avant.txt`, `06-barre-etat-mode-avion.png` | Mode avion activé (valeur 1, icône avion dans la barre d'état) |
| `07-carte-avant-parcours.png`, `08-maestro-01-carte-mode-avion.png` | La carte s'affiche en mode avion |
| `maestro-sortie.txt`, `maestro-commands.json` | Parcours `mobile/e2e/p10a-fumee-apk.yaml` : 23 étapes sur 23 réussies, code 0 |
| `09-maestro-02-itineraire-calcule.png` | Itinéraire calculé en mode avion : 338 m, D+ 21 m, 2 min |
| `10-liste-itineraires.png`, `11-maestro-03-liste.png` | L'itinéraire enregistré apparaît dans la liste |
| `12-menu-itineraire.png`, `c4-android-en-alerte-app.png`, `13-apres-garder.png` | C4 : alerte de suppression de l'app, en français, non validée (GARDER) |
| `avion-etat-apres-parcours.txt`, `avion-etat-final.txt`, `14-mode-avion-coupe.png` | Mode avion encore à 1 après le parcours, puis remis à 0 |

## Limites

- La signature installée n'est pas comparée à l'empreinte : `dumpsys` ne
  donne qu'un condensé interne. `apksigner` sur le fichier le prouve.
- Le mode avion est activé et coupé par `adb`, pas par le parcours.
- Les captures Maestro ont été copiées depuis `~/.maestro/tests/`.
- État laissé : APK installé, zone Nancy téléchargée, « Wi-Fi seulement »
  désactivé, un itinéraire enregistré, permission de position accordée
  « pendant l'utilisation », mode avion coupé.
