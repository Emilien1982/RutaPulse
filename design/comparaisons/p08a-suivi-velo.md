# Phase 8a, T7 : captures release du suivi comparées aux maquettes

> 16 novembre 2026, designer. Maquettes : `design/30-suivi-velo.html`
> (écrans 1 à 8, complétée en T1 et après la comparaison de T3),
> `design/v1/20-infos-itineraire.html` (bouton « Démarrer le suivi »),
> `design/v1/60-arrivee.html` (écrans 1 et 2).
> Captures : `docs/phases/preuves/p08a/t4-testeur/`, `t6-testeur/`
> (`android-p4-*`, `ios-p5-*`), `t3/` (prises de nouveau après les
> corrections de T3).
> Positions en points (pt) de la maquette. Échelle des captures : iOS × 3,09
> (1 206 px pour 390 pt), Android × 2,77 (1 080 px pour 390 pt).
> Hors comparaison, comme prévu : roue dentée et panneau 31b, luminosité,
> v1/80, v1/90, flèche de cap et halo du point de position (phase 8b).
> L'app iOS testée en T6 est celle du commit d00f67d ; d'après le testeur,
> l'interface n'a pas changé depuis.

## Bilan

- **Aucun écart bloquant.**
- **4 écarts mineurs** : 2 pictogrammes mal dessinés (écart au tracé, GPS),
  l'espacement des pointillés de l'écart, le fond de l'attribution.
- **Corrections de T3** : B1, B2 (sans flèche), C1 et C3 sont visibles. C2 et
  C4 sont faits dans le code, mais aucune capture ne les montre.
- **Arrivée, « Sortie terminée », bouton de l'écran Infos** : conformes.

## Écrans regardés

| Écran (maquette) | Captures |
|---|---|
| 30, écran 1 (direction à plus de 100 m) | `t6-testeur/ios-p5-direction-panneau-blanc-270m.png`, `ios-p5-c13a-05-retour-sur-le-trace.png`, `ios-p5-c8-03-retour-reste-250m.png`, `android-p4-c13a-03-direction-changee.png` |
| 30, écran 2 (panneau jaune) | `t6-testeur/ios-p5-panneau-jaune-50m-retour-6s.png`, `ios-p5-c13a-02-depart.png`, `android-p4-01-panneau-jaune-100m-boite-terminer.png`, `t3/ios-jaune.png` |
| 30, écran 3 (« Suivez le tracé ») | `t6-testeur/ios-p5-suivez-le-trace-troncon-main.png`, `t3/ios-suivez-le-trace.png` ; annonce : `t3/ios-annonce-suivez-le-trace.png` |
| 30, écran 4 (écart au tracé) | `t6-testeur/ios-p5-c13a-04-ecart.png`, `android-p4-c13a-04-ecart.png` |
| 30, écran 5 (arrivée en vue) | aucune capture |
| 30, écran 6 (« Terminer la sortie ? ») | `t6-testeur/ios-p5-c13b-02-boite.png`, `android-p4-01-panneau-jaune-100m-boite-terminer.png`, `t3/ios-boite-terminer.png` |
| 30, écran 7 (attente du GPS) | `t6-testeur/android-p4-02-suivi-depart-reste-34-9km.png` (Android seulement) |
| 30, écran 8 (départ loin) | `t3/ios-depart-loin.png` |
| v1/20 (bouton « Démarrer le suivi ») | `t6-testeur/ios-p5-c13a-01-infos.png`, `android-p4-c13a-01-infos.png`, `t4-testeur/ios-01-infos-622m-d31.png` |
| v1/60, écran 1 (« ARRIVÉE ! ») | `t6-testeur/ios-p5-c13a-06-arrivee.png`, `android-p4-c13a-06-arrivee.png` |
| v1/60, écran 2 (« SORTIE TERMINÉE ») | `t6-testeur/ios-p5-c13b-03-sortie-terminee.png`, `android-p4-c13b-03-sortie-terminee.png` |

## Bloquant

Aucun.

## Mineurs

### M1. Pictogramme de l'écart : un gros anneau noir et un seul point
- **Captures** : `ios-p5-c13a-04-ecart.png` (panneau du haut, à gauche,
  x 16 à 70, y 97 à 151) ; `android-p4-c13a-04-ecart.png` (x 16 à 69,
  y 82 à 135).
- **Ce qu'on voit** : le rond bleu est entouré d'un anneau noir d'environ
  10 pt d'épaisseur. Il se lit comme une cible noire, pas comme le point bleu
  de la carte. Entre le rond et la barre magenta, un seul point au lieu de
  trois.
- **Ce qu'attend la maquette** : `p-ecart`, dans le carré de 96 :
  - rond bleu `carte.position` (`#1A73E8`), centre (22, 48), rayon 15 ;
  - bord noir de **2** seulement ;
  - trois points noirs de 7, en x 40, 52 et 64, y 48 ;
  - barre magenta en x 76, avec un liseré blanc de 20.
- **Correction** (`mobile/src/features/map/tracking/Picto.tsx`, `GapDrawing`) :
  le rond plein hérite du trait de 13 posé sur le `<Svg>`. Lui donner
  `stroke="none"`. Dessiner les trois points comme trois ronds pleins de rayon
  3,5, en (40, 48), (52, 48) et (64, 48), sans trait, plutôt qu'avec
  `strokeDasharray="0 12"`.

### M2. Pictogramme de l'attente du GPS : pas celui de la maquette
- **Capture** : `android-p4-02-suivi-depart-reste-34-9km.png`, panneau du
  haut, à gauche (x 22 à 126, y 57 à 148).
- **Ce qu'on voit** : deux arcs noirs qui se touchent, séparés par un filet
  blanc, et un gros disque noir dessous. On croit voir une arche ou un
  symbole Wi-Fi abîmé. Le disque fait environ 29 de diamètre au lieu de 16,
  car il hérite du trait de 13.
- **Ce qu'attend la maquette** : `p-gps`, une mire de visée. C'est le
  signe « ma position » d'Android et d'iOS. Dans le carré de 96 :
  - un cercle de centre (48, 48) et de rayon 24, avec un trait de 9 ;
  - quatre traits de 9 à bouts ronds : `M48 8V20`, `M48 76V88`, `M8 48H20`,
    `M76 48H88` ;
  - un disque plein de centre (48, 48) et de rayon 8, sans trait.
- **Correction** (`Picto.tsx`, cas `gps`) : remplacer les deux arcs et le
  disque par ce dessin. Trait de 9, pas 13. Le disque central en
  `stroke="none"`.

### M3. Pointillés de l'écart trop espacés
- **Captures** :
  - `ios-p5-c13a-04-ecart.png` : de la position (154, 519) au tracé
    (225, 563), un point tous les **21 pt** environ ;
  - `android-p4-c13a-04-ecart.png` : de la position (67, 479) au tracé
    (316, 542), un point tous les **51 pt** environ. Cinq petits points sur
    250 pt ne forment presque plus une ligne.
- **Ce qu'attend la maquette** : `trace.ecart`, des points ronds de 5, **un
  tous les 10 pt**, avec un halo blanc de 9. La taille des points est juste.
- **Constat** : l'écart est juste sur `t3/ios-depart-loin.png` (environ
  11 pt). D'après le code (`TrackingMap.tsx`, `gapDots` avec
  `metersPerPoint(zoom)`), l'écart en mètres est calculé avec un zoom lu dans
  `onRegionDidChange`. Ce zoom paraît en retard quand la caméra recadre
  (`fitBounds`) pour montrer la position et le tracé.
- **Correction** : 10 pt à l'écran au zoom affiché, sur les deux plateformes.
  Il faut recalculer après chaque fin de mouvement de la caméra, cadrage
  compris. Contrôler sur une capture de l'écart : 25 points environ pour
  250 pt.

### M4. Fond de l'attribution crème au lieu de blanc
- **Captures** : toutes les captures du suivi, en bas à gauche de la carte
  (par exemple `ios-p5-c13a-04-ecart.png`, x 8 à 127, y 714 à 733).
- **Ce qu'on voit** : un fond crème, `rgba(251, 241, 218, 0.88)`
  (`mapColors.attributionBackground`, celui de l'écran Infos).
- **Ce qu'attend la maquette** : `suivi.attribution`, fond **blanc à 75 %**,
  `rgba(255, 255, 255, 0.75)`, texte `couleur.texte-2` (`#4A4A4A`). Le suivi
  est en direction B (noir, blanc, jaune) : le crème y est la seule touche
  du style des années 70.
- **Correction** : sur l'écran de suivi seulement, fond
  `rgba(255, 255, 255, 0.75)`. L'écran Infos garde le crème.

## Corrections de T3 : contrôle

| Écart de T3 | Visible ? | Preuve |
|---|---|---|
| B1, attribution sous « Terminer » | **Oui**. « © OpenStreetMap » puis « i », de x 8 à 127 ; « Terminer » commence à x 239 | toutes les captures du suivi |
| B2, flèche vers le bas dans l'écart | **Oui pour la flèche**, qui a disparu. Le dessin reste à finir : M1 | `ios-p5-c13a-04-ecart.png`, `android-p4-c13a-04-ecart.png` |
| C1, départ en haltère | **Oui** : disque vert et triangle blanc | `t3/ios-depart-loin.png` |
| C2, drapeau de l'arrivée | **Pas de capture** de l'écran 5. Le code (`FinishDrawing`) reprend `p-arrivee` trait pour trait | — |
| C3, pointillés ovales sur iOS | **Oui** : points ronds sur iOS. L'espacement reste à corriger : M3 | `t3/ios-depart-loin.png`, `ios-p5-c13a-04-ecart.png` |
| C4, « Signal GPS perdu » sans place | **Pas de capture**. Le code retire le type de voie et limite la consigne à une ligne quand une ligne du dessous s'affiche (`GuidancePanel.tsx`, `withoutWay`) | — |

## Conformes

- **Écran de suivi, structure** (iOS et Android) :
  - panneau de 262 pt, bord noir de 3, pictogramme de 124 ;
  - distance en 72 avec l'unité en 40, consigne en 28 ;
  - carte orientée dans le sens de la marche, partie roulée en gris ;
  - boussole de 64 à 16 pt du bord droit, en haut de la carte ;
  - « Terminer » de 140 × 64 à 16 pt du bord droit et 16 pt au-dessus du
    bandeau ;
  - bandeau du bas à deux colonnes, « Reste » et « D+ restant ».
- **Panneau jaune** à 100 m, 60 m, 50 m et 30 m. La consigne longue tient
  sur deux lignes dans le jaune (`android-p4-01`, `t3/ios-jaune.png`).
- **« Suivez le tracé »** dans un tronçon tracé à la main
  (`ios-p5-suivez-le-trace-troncon-main.png`) : pictogramme `p-suivre`,
  « 800 m », « Suivez le tracé », « Tronçon tracé à la main ». Tronçon en
  tirets magenta avec un liseré blanc. Annonce avant d'entrer dans le
  tronçon : « 850 m », panneau blanc (`t3/ios-annonce-suivez-le-trace.png`).
- **Écart** : panneau blanc, « jusqu'au tracé », « Le guidage reprend sur le
  tracé. ». La caméra montre la position et le tracé. Pas de rouge, pas
  d'alerte.
- **Départ loin** : « 4,3 km », « jusqu'au départ », « Le guidage commence
  au départ. ». Nord en haut, pointillés jusqu'au marqueur du départ.
- **Attente du GPS** (Android) : « Recherche du GPS… », « Restez à
  découvert quelques secondes. ». Tout l'itinéraire, nord en haut, pas de
  point de position. « Reste 34,9 km », « D+ restant 459 m ». Seul le
  pictogramme diffère : M2.
- **Boîte « Terminer la sortie ? »** : textes exacts sur les deux
  plateformes. Rendu natif : Material 2 sur Android, alerte iOS 26 sans
  « Continuer » en gras. Déjà accepté en T3 (A3).
- **Formats des nombres** : « 2,1 km », « 800 m » et « 850 m » (arrondi à
  50), « 270 m », « 110 m » et « 60 m » (arrondi à 10), « 33,7 km »,
  « 400 m ».
- **Bouton « Démarrer le suivi »** (v1/20) : bouton principal brun, disque
  moutarde, à droite de « Modifier », sur les deux plateformes. Sur
  `ios-p5-c13a-01-infos.png`, l'arche est vide. La carte n'était pas encore
  chargée : `t4-testeur/ios-01-infos-622m-d31.png` montre le même écran avec
  sa carte. Ce n'est pas un écart.
- **« ARRIVÉE ! » et « SORTIE TERMINÉE »** (v1/60, écrans 1 et 2) :
  - même illustration ;
  - titres en Jost, 44 et 32, sur une ligne ;
  - nom de l'itinéraire ;
  - carte à trois lignes de 56 pt avec leurs couleurs, chiffres en 36,
    unités en 20 ;
  - « Le suivi est arrêté. » et « Fermer » de 64 pt.
  Valeurs vues : « 720 m », « 46 m », « 2 min » ; « 33,9 km », « 485 m »,
  « 12 min » ; « 190 m », « 5 m », « 1 min » ; « 780 m », « 27 m »,
  « 1 min ». D+ inconnu : « — » (`ios-p5-defaut-arrivee-immediate-0m.png`).
  L'espace insécable fine dans « ARRIVÉE ! » est juste.

## Acceptables (non comptés)

- **A1. Plus d'espace entre le titre et le nom sur v1/60** : environ 52 pt
  entre leurs centres, au lieu de 41 dans la maquette. C'est la règle de
  `tokens.md` : un texte en Jost a une interligne d'au moins 1,45 fois sa
  taille, soit 64 pour 44. La maquette (1,15) est à aligner sur l'app. Je le
  ferai si le pilotage le demande.
- **A2. Marqueurs du départ et de l'arrivée sans leur symbole** : disque
  vert uni, disque noir uni. Ils sont identiques à ceux de l'écran Infos et
  de la création (A6 de T3).
- **A3. Point de position sans flèche ni halo** : phase 8b (A2 de T3).
- **A4. Petit bout magenta juste derrière le point** (`t3/ios-jaune.png`) :
  déjà noté en T3 (A5).

## Captures manquantes

1. **Attente du GPS sur iOS : pas indispensable.** C'est le même composant
   (`GuidancePanel`, état `waiting`) que sur Android. Les seules différences
   d'iOS (marge du haut, rendu SVG) se voient déjà sur les autres états du
   panneau. Si la tâche de corrections refait des captures, on peut essayer
   `xcrun simctl location <appareil> clear` avant « Démarrer le suivi ».
   C'est utile pour voir le pictogramme corrigé (M2).
2. **Écran 5, arrivée en vue** (drapeau `p-arrivee`, « Arrivée », blanc
   puis jaune), sur une plateforme. Une capture prouverait la correction C2
   de T3. Non bloquant : le dessin est repris trait pour trait dans le code.
3. **« Signal GPS perdu »** sur une consigne longue (correction C4 de T3).
   Non bloquant, pour la même raison.

## Verdict C15 pour la 8a

**Tenu sur le périmètre 8a.** Captures release sur les deux simulateurs,
comparées aux maquettes 30, v1/20 et v1/60. Aucun écart bloquant. Les
4 écarts mineurs (M1 à M4) sont de petites corrections de dessin et de
couleur. Ils peuvent passer dans la tâche de corrections de la 8a ou être
reportés en 8b sans gêner la lecture sur le vélo. M1 est le plus visible. Les
maquettes 31b, v1/80 et v1/90 seront comparées en 8b : C15 y sera contrôlé
de nouveau.
