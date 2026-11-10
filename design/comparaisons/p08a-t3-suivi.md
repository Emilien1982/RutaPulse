# Phase 8a, fin de T3 : écran de suivi comparé à la maquette 30

> 10 novembre 2026, designer. Captures release de
> `docs/phases/preuves/p08a/t3/`, comparées à `design/30-suivi-velo.html`
> (écrans 1 à 8) et à `design/v1/20-infos-itineraire.html` (bouton).
> Hors comparaison, comme prévu : roue dentée et flèche de cap (8b), écran
> de fin provisoire (T4 fera v1/60).
> Positions en points (pt) de la maquette (écran de 390 × 844). Échelle des
> captures : iOS × 3,09, Android × 2,77.

## Bilan

- **Conforme dans l'ensemble** :
  - le panneau du haut (72, 40, 28, jaune sous 100 m, structure fixe) ;
  - le bandeau du bas à deux colonnes « Reste » et « D+ restant » ;
  - « Terminer » flottant à droite, avec la boîte de confirmation native ;
  - la carte orientée dans le sens de la marche, et la partie roulée en gris ;
  - les pointillés de l'écart et du départ ;
  - le bouton « Démarrer le suivi » sur l'écran Infos ;
  - les formats des nombres (« 2,0 km », « 20 m », « 12 km », « 459 m »).
- **2 écarts bloquants** : l'attribution est cachée par « Terminer » ; le pictogramme de l'écart est trompeur.
- **4 écarts à corriger**, dont un trou de la maquette.
- **3 captures manquantes**.

## Bloquant

### B1. « Terminer » cache la fin de l'attribution, « © IGN » compris
- **Captures** : toutes les captures du suivi, iOS et Android (par exemple `ios-normal.png`, `android-normal.png`).
- **Ce qu'on voit** :
  - en bas à gauche de la carte (y ≈ 712 à 726 pt sur iOS), la ligne « © OpenStreetMap © OpenMapTiles © Mapterhorn © IGN » passe sous « Terminer » ;
  - sur iOS, « Mapterhorn © IGN » est presque illisible ; sur Android, « © IGN » est coupé.
- **Ce qu'attend la maquette** : l'attribution complète et lisible (décision 13 ; licences).
- **Faute de la maquette** : elle avait le même chevauchement. L'attribution va de y 702 à 717, sur x 8 à 300 environ. « Terminer » occupe y 644 à 708 et x 234 à 374.
- **Correction proposée** : attribution en version courte, « © OpenStreetMap » puis un bouton « i » (zone de toucher de 48), en bas à gauche de la carte. Le « i » ouvre la liste complète. C'est la règle de `tokens.md`, « Attribution », quand la place manque. « Terminer » ne bouge pas. Je reporte ce changement dans la maquette 30 dès que le pilotage l'accepte.

### B2. Pictogramme de l'écart : une flèche vers le bas
- **Captures** : `ios-ecart.png`, `android-ecart.png`, panneau du haut, à gauche (x 16 à 140, y 51 à 175).
- **Ce qu'on voit** : une flèche vers le bas, avec une boule en haut. Sur Android, le tracé est à droite de la position, mais la flèche montre le bas. Elle se lit comme une direction (« reculez »), alors qu'aucune direction n'est donnée.
- **Ce qu'attend la maquette** : symbole `p-ecart`, sans aucune flèche (planche en bas de l'écran 30) :
  - à gauche, un rond bleu `carte.position` ;
  - au milieu, des points noirs ;
  - à droite, une barre verticale magenta `carte.itineraire` avec un liseré blanc.
- **Correction proposée** : reprendre le dessin `p-ecart` de la maquette, dans un carré de 96 affiché en 124, sans flèche.

## À corriger

### C1. Pictogramme du départ : une forme d'haltère
- **Capture** : `android-depart-loin.png`, panneau du haut, à gauche.
- **Ce qu'on voit** : un gros rond noir en haut, une tige, un petit rond noir en bas. La forme ne dit rien, et elle ne ressemble pas au marqueur du départ visible sur la carte (rond vert).
- **Ce qu'attend la maquette** : `p-depart`, un disque vert `carte.depart` (rayon 34 sur 96) avec un triangle blanc. C'est le même signe que le marqueur.
- **Correction proposée** : reprendre `p-depart`.

### C2. Pictogramme de l'arrivée : drapeau plein, sans damier
- **Capture** : `ios-troncon-main.png`, panneau du haut, à gauche.
- **Ce qu'on voit** : un mât et un fanion noir découpé, qui se lit presque comme la lettre « P ».
- **Ce qu'attend la maquette** : `p-arrivee`, un mât et un drapeau à damier noir et blanc, bord noir de 5. C'est le même signe que le marqueur de l'arrivée sur la carte.
- **Correction proposée** : reprendre `p-arrivee`.

### C3. Pointillés ovales sur iOS
- **Capture** : `ios-ecart.png`, de la position (195, 358 pt) au tracé (205, 623 pt).
- **Ce qu'on voit** : des ovales étirés dans le sens du trait, comme une chaîne. Sur Android, les points sont bien ronds.
- **Ce qu'attend la maquette** : `trace.ecart`, des points ronds de 5, un tous les 10, avec un halo blanc.
- **Correction proposée** : sur iOS, un tiret de longueur quasi nulle avec des bouts ronds. Pour MapLibre : `line-dasharray` [0, 2] avec `line-cap: round`, ou un motif d'image (`line-pattern`) si iOS étire toujours les points. Contrôler à 100 % sur la capture.

### C4. « Signal GPS perdu » n'a pas de place quand la consigne fait deux lignes
- **Capture** : `ios-boite-terminer.png`, panneau du haut.
- **Ce qu'on voit** : le point de position est gris (`marqueur.position-perdue`), mais la ligne « Signal GPS perdu » manque. La consigne « Légèrement à droite sur la piste » prend deux lignes et remplit le panneau.
- **Ce qu'attend la maquette** : rien de clair. C'est un trou de la maquette. Pictogramme 124, consigne sur deux lignes et ligne du dessous font 51 + 124 + 8 + 67 + 30 = 280 pt, pour 259 pt disponibles.
- **Correction proposée** : quand une ligne du dessous est affichée (GPS perdu, raison), la consigne passe à une ligne en retirant le type de voie (« Légèrement à droite »). J'ajoute la règle à la note de la maquette 30 si le pilotage l'accepte.

## Acceptable

- **A1. Écart entre le pictogramme et la distance** (iOS, toutes les captures) : environ 40 pt au lieu de 12. La lecture reste bonne.
- **A2. Pas de halo de précision autour du point** : il vient en 8b avec la flèche de cap (même point bleu, maquette 90).
- **A3. Boîte de confirmation**, `android-boite-terminer.png` :
  - boîte Android de l'ancien style Material 2 (boutons « CONTINUER » « TERMINER » en capitales, petits coins arrondis), au lieu de Material 3 ;
  - sur iOS, alerte iOS 26 où « Continuer » n'est pas en gras ;
  - c'est le rendu natif du système, sans décoration, et les textes sont exacts.
- **A4. Partie roulée cachée par le passage de retour** (`ios-jaune.png`, sous la position) : sur une boucle, la fin du tracé repasse au départ, et le magenta, encore à rouler, est dessiné au-dessus du gris. C'est voulu.
- **A5. Petit bout magenta juste derrière le point** (`android-jaune.png`, sous la position, 2 à 4 pt) : la coupure entre le gris et le magenta tombe un peu après le point. Peu visible.
- **A6. Marqueur du départ sans triangle blanc sur la carte** (`ios-jaune.png`, `android-depart-loin.png`) : acceptable s'il est identique à celui de la création et de l'écran Infos (rond vert uni sur `ios-infos-bouton.png`). Une seule légende.
- **A7. Consigne sur une ligne sur Android, deux sur iOS** (« Tournez à gauche sur la piste ») : c'est la largeur des polices. La règle des deux lignes au plus est tenue.
- **A8. Écran de fin provisoire** (`android-fin-provisoire.png`) : T4 fera v1/60.

## Conformes

- **Bouton « Démarrer le suivi »** (`ios-infos-bouton.png`, `android-infos-bouton.png`) : bouton principal brun avec son disque moutarde, à droite de « Modifier ». Conforme à v1/20 et à v1/40 (nom au-dessus de l'arche).
- **Panneau jaune** à 100 m, 50 m et 20 m (`*-jaune.png`, `ios-boite-terminer.png`). La pastille du système (« Dynamic Island ») sur fond jaune ne gêne pas.
- **Départ loin** (`android-depart-loin.png`) :
  - « 12 km », « jusqu'au départ », « Le guidage commence au départ. » ;
  - nord en haut, point sans flèche ;
  - pointillés jusqu'au départ.
- **Écart** (`android-ecart.png`, `ios-ecart.png`) : panneau blanc, « jusqu'au tracé », « Le guidage reprend sur le tracé. » ; la caméra cadre la position et le point le plus proche.
- **Arrivée annoncée après la dernière direction** (`ios-troncon-main.png`) : « 1,1 km », « Arrivée », panneau blanc au-delà de 100 m ; le tronçon tracé à la main est en tirets.

## Captures manquantes (à fournir avant T7)

1. **Écran 3, « Suivez le tracé »**, dans un tronçon tracé à la main qui ne va pas jusqu'à l'arrivée. Il faut voir le pictogramme `p-suivre` et la ligne « Tronçon tracé à la main », avec le GPS actif. `ios-troncon-main.png` montre l'écran 5 avec « Signal GPS perdu », qui remplace la raison.
2. **Annonce d'un passage sans direction à venir** : « Suivez le tracé » dans 300 m, panneau blanc (ADR 0021).
3. **Écran 7, attente du GPS**, sur les deux plateformes ; **départ loin** sur iOS.
