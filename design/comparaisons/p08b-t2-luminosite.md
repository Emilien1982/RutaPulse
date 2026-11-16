# Phase 8b, T2 (luminosité) : roue dentée, panneau 31b et Réglages comparés aux maquettes

> 16 novembre 2026, designer. Captures release de
> `docs/phases/preuves/p08b/t2/`, comparées à `design/30-suivi-velo.html`
> (section « Roue dentée et panneau des réglages »), à
> `design/31b-suivi-reglages.html`, à `design/v1/80-reglages.html` et à
> `design/tokens.md` (`suivi.bouton-reglages`, `suivi.panneau`,
> `suivi.segments`, `suivi.panneau-titre`).
> Hors comparaison, comme prévu : la flèche de cap et le halo du point (T3),
> le trait de liaison (T4), la rubrique « À PROPOS » de l'écran 80 (phase 10).
> Positions en points (pt) de l'écran capturé. Échelle des captures :
> iOS × 3 (iPhone 17, 402 × 874 pt), Android × 2,625 (Pixel, 411 × 914 dp).
> La maquette fait 390 × 844 : je compare les écarts relatifs (au panneau du
> haut, au bord droit, au haut du panneau 31b).

## Bilan

- **Conforme dans l'ensemble** :
  - la roue dentée : taille, place sous la boussole, même axe, écart de 24 entre les deux dessins, fond blanc fermé et fond noir ouvert ;
  - le panneau 31b : bord du haut noir de 3, rayon 28, poignée, titre, étiquette, segments de 64, explication, « Fermer » de 64, sans voile ;
  - « © OpenStreetMap » et « i » remontés au-dessus du panneau ;
  - « Reste », « D+ restant » et « Terminer » masqués tant que le panneau est ouvert ;
  - la rubrique « Pendant le suivi » de l'écran Réglages, « Automatique » et « Maximum », sur les deux plateformes.
- **1 écart bloquant** : la position touche le bord du panneau ouvert (iOS), au lieu d'être bien au-dessus. Un petit écran la cacherait.
- **2 écarts mineurs**, dont le point signalé par le testeur.
- **1 capture manquante**, non bloquante.

## Bloquant

### B1. Panneau ouvert : le point de position est au ras du panneau, pas au-dessus
- **Captures** :
  - iOS : `ios-06b-panneau-ouvert-en-route.png`, `ios-08-panneau-automatique.png` ;
  - Android, pour comparer : `android-06-panneau-ouvert.png`, `android-12-panneau-ouvert-deja-jaune.png`.
- **Ce qu'on voit** :
  - iOS : centre du point à y 479 pt (`ios-06b`) et 474 pt (`ios-08`), x 201 ; haut du panneau à y 490. Le point (rond de 30) touche le bord du panneau ; sur `ios-06b`, son bas est coupé d'environ 4 pt ;
  - Android : centre du point à y 508 dp, haut du panneau à 538. Le point est visible, mais à 15 dp seulement du bord.
- **Ce qu'attend la maquette** : 31b, « La carte garde la position visible au-dessus du panneau ». Dans la maquette, le centre du point est à 53 au-dessus du haut du panneau (399 contre 452), aux deux tiers de la partie visible de la carte. La flèche et le halo de T3 doivent aussi y tenir.
- **Pourquoi bloquant** : le calcul place le point à mi-chemin d'une marge presque nulle. Sur un écran plus petit (iPhone SE, 667 de haut), les marges du haut et du bas dépassent la hauteur de la carte : le point passerait probablement sous le panneau. C'est la règle écrite du panneau qui tombe.
- **Cause (lue dans le code, pour aider)** : `TrackingMap.tsx`, effet de la caméra. Panneau ouvert, le bandeau du bas disparaît et la carte descend jusqu'en bas de l'écran (600 pt sur iOS). La marge du haut reste à 33 % de toute la carte (198 pt), et la marge du bas vaut le panneau (384 pt). Il reste 18 pt : le point tombe à 274 + 198 + 9 = 481 pt, ce qu'on mesure.
- **Correction proposée** : panneau ouvert, calculer la marge du haut sur la partie visible de la carte, pas sur toute la carte : marge du haut = 33 % de (hauteur de la carte − hauteur du panneau) ; marge du bas = hauteur du panneau. Résultat attendu : centre du point à environ 72 pt au-dessus du panneau sur iOS (y ≈ 418), et 93 dp sur Android (y ≈ 445). Même principe pour le cadrage d'ensemble (`fitBounds`, avant le premier point) : les marges de 80 en haut et en bas doivent laisser au cadre au moins la moitié de la partie visible ; panneau ouvert, prendre par exemple 40 en haut et (panneau + 40) en bas. À contrôler sur capture iOS et Android, panneau ouvert, en route.

## Mineur

### M1. « Recherche du GPS », panneau ouvert : un marqueur coupé par le panneau (point signalé par le testeur)
- **Capture** : `ios-06-panneau-ouvert.png`, bas de la carte, x ≈ 229 pt, y ≈ 485 pt (bord du panneau à 490).
- **Ce qu'on voit** : un rond noir à bord blanc, coupé en deux par le panneau. Le rond vert du départ est aussi coupé, en haut à gauche de la carte (x ≈ 60 pt, y ≈ 276 pt, sous le panneau de guidage).
- **Mon jugement** :
  - ce rond noir **n'est pas le point de position** : avant le premier point, il n'y a pas de position, et le point est bleu (ou gris si perdu). C'est le marqueur de l'arrivée (`carte.arrivee`, `#111111`) : sur `ios-05b` et `ios-08`, le même rond noir finit le tracé magenta ;
  - un marqueur à moitié caché sous une feuille du bas n'est pas une faute en soi : la feuille est posée sur la carte ;
  - mais ici, le cadrage voulu (le tracé entre le départ et l'arrivée) ne tient pas dans la partie visible : départ et arrivée sont tous deux coupés. Même cause que B1 : marges de 80 + 384 en bas et de 80 en haut, sur 600 pt de carte, il reste 56 pt pour le cadre ;
  - c'est un état court (quelques secondes, au départ, à l'arrêt) et rien n'est trompeur : **mineur**.
- **Ce qu'attend la maquette** : écran 7 de 30, la carte montre le départ ; 31b, ce qui doit être vu reste au-dessus du panneau.
- **Correction proposée** : aucune en plus. La correction de B1 sur le cadrage d'ensemble règle ce cas. À vérifier sur une capture `ios-06` refaite.

### M2. Segments : fin liseré clair entre le bord et le segment choisi, aux bouts arrondis (à confirmer à 100 %)
- **Captures** :
  - `android-02-reglages-auto.png`, bout gauche d'« Automatique » (x ≈ 32 pt, y 431 à 477) ;
  - `android-06-panneau-ouvert.png` et `android-12-…`, bout droit de « Maximum » (x ≈ 393, y 656 à 719) ;
  - `ios-02-reglages-auto.png`, coin haut gauche d'« Automatique » (x 32 à 55, y ≈ 432) ; `ios-03-reglages-max.png`, coin haut droit de « Maximum ».
- **Ce qu'on voit** : entre le bord brun (ou noir) et le fond du segment choisi, un trait clair d'environ 1 pt suit l'arrondi, ou une petite encoche au coin. On le voit à peine à la taille réelle ; à confirmer en agrandissant les captures.
- **Ce qu'attend la maquette** : `suivi.segments` et v1/80 : le fond du segment choisi touche le bord sans jour.
- **Correction proposée** : dans `Segmented.tsx`, dessiner le bord dans une vue posée par-dessus les segments (position absolue, `pointerEvents="none"`, même rayon), et laisser le groupe sans bord, avec `overflow: 'hidden'` et le rayon extérieur. Le fond choisi est alors coupé par le même arrondi que le bord, sans jour.

## Acceptable

- **A1. Dessin de la roue dentée** (`android-05b`, `ios-05b`, et l'onglet « Réglages ») : roue pleine à trou rond, forme Material « settings », au lieu du dessin simplifié de la maquette (deux cercles, l'un en pointillés). C'est la forme prévue par `design/LISEZMOI.md` (« Material settings », « SF Symbol gearshape »), et c'est la même sur l'onglet, la ligne « Se change aussi pendant le suivi. » et le bouton du suivi. Dessin visible d'environ 22 dans une boîte de 26 : conforme.
- **A2. Hauteur du panneau 31b** : 384 pt sur iOS (haut à 490), 376 dp sur Android (haut à 538), contre 392 dans la maquette (haut à 452). Le panneau prend la hauteur de son contenu, posé en bas : sur un écran plus haut, son haut descend. « Fermer » est à 273 du haut du panneau sur Android (264 dans la maquette). Rien à corriger.
- **A3. Roue et boussole 12 pt plus bas sur iOS** que dans la maquette : le panneau de guidage finit à 274 (zone sûre de 62 en haut, au lieu de 47). L'écart relatif est exact : boussole 22 sous le panneau, 24 entre la boussole et la roue (24 dans la maquette), centre à 48 du bord droit. Même chose sur Android (21 et 24).
- **A4. Espace avant « : »** dans « Maximum : plus lisible… » : `fr.ts` met une espace fine insécable (U+202F) ; la maquette, une espace normale. C'est correct en typographie française, et la ligne ne se coupe pas avant les deux-points. Un peu serré sur iOS (≈ 4 pt).
- **A5. Segments Android sans coche** : les « segmented buttons » de Material 3 mettent une coche dans le segment choisi. Notre sélecteur est le même que celui de l'écran 10, fond plein pour le choix : il se lit mieux au soleil qu'une coche. Gardé.
- **A6. La roue dentée posée sur le tracé** (`ios-05b`, y ≈ 400 pt) : bouton flottant sur la carte, comme la boussole. Le point de position, lui, reste au tiers du bas, loin de la roue.

## Conformes

- **Roue fermée** (`android-05b`, `ios-05b`) : rond de 47 environ (48 avec le bord), fond blanc, bord fin, ombre ; dessin de y 370 à 417 dp sur Android (368 à 416 attendu), sous la boussole, centre à 48 du bord droit, sur le même axe que la boussole.
- **Roue ouverte** (`android-06`, `ios-06b`, `ios-08`, `android-12`) : fond et bord noirs, roue blanche (`suivi.bouton-reglages-ouvert`).
- **Panneau 31b, deux plateformes** :
  - fond blanc, bord du haut noir de 3, rayon 28, ombre, sans voile sur la carte ;
  - poignée de 36 × 5, gris foncé ;
  - « Réglages du suivi » (24, très gras), « Luminosité de l'écran » (20, gras) ;
  - segments : 16 des bords, 63 à 64 de haut, bord noir de 3, rayon 32, choisi noir à texte blanc, soleil devant « Maximum » ;
  - explication en 20 sur deux lignes, « Maximum » en gras ;
  - « Fermer » : 64 de haut, bord de 2, 20 gras, 16 des bords.
- **Guidage visible au-dessus du panneau** : distance, consigne et panneau jaune restent en place (`android-12` : 100 m en jaune, panneau ouvert).
- **Attribution** : « © OpenStreetMap » et « i » remontés juste au-dessus du panneau (y 520 dp sur Android, 472 pt sur iOS), lisibles, sans chevaucher le point.
- **« Reste », « D+ restant » et « Terminer »** masqués panneau ouvert, comme dans 31b.
- **Réglages, rubrique « Pendant le suivi »** (`android-02`, `android-03`, `ios-02`, `ios-03`) :
  - titre de rubrique en Jost, carte crème clair à bord brun ;
  - « Luminosité de l'écran » (17, demi-gras) ;
  - segments de 48, bord brun, choisi brun à texte crème, soleil devant « Maximum » ;
  - explication en 15, « Maximum » en gras ;
  - renvoi « Se change aussi pendant le suivi. » avec la roue dentée ;
  - mêmes mots que le panneau 31b.

## Hors T2, à regarder plus tard

- `android-02`, `android-03` : l'interrupteur « Télécharger en Wi-Fi seulement » est sur « non » (observation 2 du testeur, réglage resté d'un essai). À l'état « non », sa piste jaune pâle et son rond blanc se voient mal sur le crème clair. À comparer à v1/80 quand on touchera à l'interrupteur.

## Capture manquante (non bloquante)

1. **Panneau 31b avec le texte du téléphone agrandi** (120 %, la limite `maxFontSizeMultiplier`), sur un écran de 667 de haut (iPhone SE) : le panneau grandit, et il faut voir qu'il laisse encore le point de position au-dessus (B1 corrigé).

## Question pour le Product Owner (relayée par le pilotage)

1. **Panneau ouvert pendant « Recherche du GPS », refermé au premier point** (observation 1 du testeur, `ios-07`) : si ce premier point est déjà à 100 m ou moins d'une direction, le panneau passe au jaune et le panneau des réglages se ferme seul. C'est la règle écrite, mais pour l'utilisateur, il vient de l'ouvrir. **Ma recommandation** : ne pas compter le passage de « Recherche du GPS » au premier point comme un passage au jaune ; le panneau reste ouvert, comme quand on l'ouvre alors que c'est déjà jaune. Autre choix : garder la règle telle quelle (cas rare, au départ, à l'arrêt).
