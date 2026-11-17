# Preuves du testeur, tâche T2 (phase 10a) : icône, démarrage, français

Tests du 17 novembre 2026. iOS : simulateur iPhone 17
(`DAF21CEF-2D81-4ABE-9CEC-689BCF1A295D`), construction Release. Android :
émulateur `emulator-5584` (réglé en anglais), APK release (`arm64-v8a`).
Texte rendu par le testeur, écrit par la session de phase, qui a regardé
`c2-ios-accueil.png` et `c2-android-dock-zoom.png`.

| Fichier | Langue de l'appareil | Ce qu'il montre |
|---|---|---|
| `c2-ios-accueil.png` | fr-FR | Icône A entière et nom « RutaPulse » sur l'écran d'accueil iOS |
| `c2-android-tiroir.png` | en | Icône A ronde et nom « RutaPulse » dans le tiroir d'apps Android |
| `c2-android-icone-zoom.png` | en | Zoom sur l'icône Android du tiroir (fond clair, pas d'anneau) |
| `c2-android-accueil.png` | en | Écran d'accueil Android, icône dans le dock |
| `c2-android-dock-zoom.png` | en | Zoom : sur fond sombre, anneau rose saumon autour de l'icône (examiné en T5) |
| `c3-ios-d2.jpg`, `c3-ios-d3.jpg`, `c3-ios-d4.jpg`, `c3-ios-d5.jpg` | fr-FR | Lancement à froid iOS : fond crème, rond brun, puis fondu vers la carte sans flash |
| `c3-ios-fondu-vers-carte-dialogue.png`, `c3-ios-5.png` | fr-FR | Fondu vers la carte, avec le dialogue de position |
| `c3-android-b1.png`, `c3-android-b2.png`, `c3-android-b3.png`, `c3-android-1.png`, `c3-android-2.png` | en | Lancement à froid Android : fond crème, rond brun, fondu vers l'onglet Carte |
| `c4-ios-en-dialogue-position.png` | en-US | Dialogue de position : titre et boutons en anglais (dessinés par le système) ; le texte de l'app est en français |
| `c4-ios-fr-dialogue-position.png` | fr-FR | Même dialogue, entièrement en français |
| `c4-ios-en-menu-itineraire.png` | en-US | Menu d'un itinéraire, entièrement en français (textes de l'app) |
| `c4-ios-en-itineraires.png` | en-US | Onglet Itinéraires en français |
| `c4-ios-en-accueil.png` | en-US | Écran d'accueil du simulateur en anglais |
| `c4-android-en-selecteur-fichiers.png` | en | Sélecteur de fichiers Android en anglais (réserve décidée par le pilotage) |
| `ios-en-itineraires.yaml`, `tap-autoriser.yaml` | — | Parcours Maestro utilisés |

Limites : pas de vidéo (pas de `ffmpeg`), suites de captures. Non obtenus :
dialogue de position et alerte de l'app sur Android (aucune zone installée
sur l'émulateur), alerte de suppression sur iOS. Fondu de 300 ms non mesuré.
