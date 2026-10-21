# Décisions de design (v1)

> 21 octobre 2026. Réponses d'Émilien à la proposition du designer
> (`design/LISEZMOI.md`). Ce fichier fait foi pour le développement.

## Direction visuelle

- **Écrans de navigation** (suivi sur le vélo, écran verrouillé) :
  **direction B, contrastée**, validée.
- **Écrans hors navigation** (création, infos, mes itinéraires, zones,
  circuits, arrivée) : **style 3, « affiche des années 70 »**, choisi par
  Émilien le 21 octobre 2026 parmi 5 styles décalés
  (`design/styles/`).

## Style hors navigation : décisions

| # | Question | Décision |
|---|---|---|
| 1 | Quel style | Style 3, affiche des années 70. |
| 2 | Ton de l'app | Sourire dans le décor ; les chiffres restent sobres et très lisibles, pour la confiance. |
| 3 | Personnage récurrent | Oui, le vététiste : liste vide, téléchargement, erreur. |
| 4 | Écran « Arrivé » | Dans le style années 70 : c'est un moment de fête. |
| 5 | Icône de l'app | Elle suit le style. |
| 6 | Illustrations en v1 | Le minimum : bandeau, vignettes et 3 états vides. Le jeu complet en V2, avec l'animation d'arrivée. |

## Réponses aux 13 questions

| # | Question | Décision |
|---|---|---|
| 1 | Carte du suivi claire ou sombre | Claire. |
| 2 | Luminosité pendant le suivi | Par défaut, elle suit la lumière ambiante (réglage automatique du téléphone). Un réglage de l'app permet de la forcer au maximum. |
| 3 | Infos pendant le suivi | Distance restante et D+ restant. |
| 4 | Écart avec l'itinéraire | Afficher la distance jusqu'à l'itinéraire, sans alerte. |
| 5 | Arrivée | Écran « Arrivé » avec un résumé, et arrêt du suivi. **V2** : animation simple d'un vététiste couvert de boue qui monte sur un podium et brandit un trophée. |
| 6 | Revenir au départ | Oui : un bouton ajoute le départ comme dernier point. |
| 7 | Circuit balisé | On garde le sens du circuit. Le départ est le point du circuit le plus proche de l'utilisateur. Un circuit en plusieurs morceaux n'est pas transformable en v1. |
| 8 | Tracé à la main | Par touches. **Exigence** : la carte doit se zoomer assez pour poser les points confortablement (au moins jusqu'au zoom 18, en agrandissant les tuiles du zoom 14). |
| 9 | Nom par défaut | La date **et** la commune de départ (ou la plus proche), par exemple « Ludres, 21 oct. ». Si la commune est trop complexe à trouver hors ligne, la date seule en v1 et la commune en V2. |
| 10 | Zones | Mise à jour à la main ; Wi-Fi seulement par défaut. Si une zone manque, l'app propose de la demander. Si l'app propose un téléchargement sans Wi-Fi disponible, elle affiche un raccourci vers le réglage « Wi-Fi seulement ». |
| 11 | GPX hors des zones | Import accepté, avec un message qui propose la zone. |
| 12 | Mode sombre pour la nuit | Pas en v1 : peu de vététistes roulent la nuit, et un écran clair les rend plus visibles. **À reconsidérer en V2.** |
| 13 | Citer l'IGN | Oui, dans les attributions. |
