# Preuves de la tâche T2 (phase 10a) : icône, démarrage, français

Constructions Release du 17 novembre 2026 : iOS pour le simulateur
iPhone 17, Android en APK arm64-v8a sur `emulator-5584`.

| Fichier | Ce qu'il montre |
|---|---|
| `android-accueil.png` | Écran d'accueil de l'émulateur : l'icône A (soleil rayé) dans le rond du lanceur, en bas à droite. Pas d'étiquette : le dock n'en affiche pas. |
| `android-demarrage-1.png` | Écran de démarrage Android : fond crème, rond brun avec le soleil, centré. |
| `android-apres-lancement.png` | Premier écran de l'app, onglet Carte, même fond crème : pas de saut de couleur. |
| `ios-demarrage-1.png` | (simulateur en français, fr-FR) Écran de démarrage iOS : même fond crème et même rond. |
| `ios-apres-lancement.png` | (simulateur en français, fr-FR ; refaite le 17 nov. avec la dernière construction) Dialogue de position en français (« Autoriser « RutaPulse » à utiliser votre position ? », boutons en français) sur la carte. |
| `ios-accueil.png` | (simulateur en français ; ancienne construction) Écran d'accueil iOS avec le même dialogue au-dessus : l'icône de RutaPulse n'est visible qu'en partie (derrière le dialogue). Non concluant pour l'icône iOS. |

Langue : l'émulateur Android est en anglais (date « Tue, Nov 17 »), l'app s'affiche en français. Aucune capture iOS sur simulateur en anglais : à faire par le testeur en T4.

Limites : pas de vidéo ; l'icône iOS en entier et le nom « RutaPulse »
sous l'icône iOS ne sont pas prouvés ; le fondu de 300 ms n'est pas
mesuré. Voir `../t2-c4/` : `Info.plist.extrait.txt` vient du `.app` Release iOS (`.derived-ios/`). Plus de `locales`, donc plus de `fr.lproj` ni de `values-b+fr`.
