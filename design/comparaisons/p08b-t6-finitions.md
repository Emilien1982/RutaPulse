# Phase 8b, T6 (C16) : suivi, panneau 31b, Réglages et onglet Carte comparés aux maquettes

> 17 novembre 2026, designer. Captures release (iOS : iPhone 17 ; Android :
> emulator-5584) de `docs/phases/preuves/p08b/t5/`, `t4/` et `t3/`,
> comparées à `design/30-suivi-velo.html` (dont « Roue dentée et panneau des
> réglages » et « GPS perdu en route »), `design/31b-suivi-reglages.html`,
> `design/v1/80-reglages.html` (rubrique « Pendant le suivi »),
> `design/v1/90-carte.html` et `design/tokens.md`.
> Règles : spec `docs/phases/p08b-suivi-velo-finitions.md` (« Ce que tu verras
> à la fin », C16) ; ADR 0021, § 8 à § 11 et « Écarts acceptés pendant la
> phase 8b ».
> Positions en points (pt, ou dp sur Android) de l'écran capturé. Échelle des
> captures : iOS × 3 (402 × 874 pt), Android × 2,625 (411 × 914 dp). La
> maquette fait 390 × 844 : je compare les écarts relatifs (au panneau du
> haut, au bord droit, au haut du panneau 31b).
> Gravité : **bloquant** seulement si l'écart trompe le cycliste ou contredit
> la spec ; **mineur** sinon ; **accepté** quand la règle ou le pilotage l'a
> déjà admis.

## Bilan

- **Aucun écart bloquant.**
- **B1 de T2 est corrigé** : panneau 31b ouvert en roulant, le point de
  position est à 93 dp au-dessus du panneau sur Android (`android-suivi-2`,
  centre à y 445, haut du panneau à 538), exactement la valeur attendue.
- **6 écarts mineurs** (M1 à M6), dont la remarque du relecteur (M2) et le
  halo du point gris (M3).
- **5 écarts acceptés** (A1 à A5).
- **4 captures manquantes ou à expliquer**, non bloquantes.
- Pas de question pour le Product Owner.

## Maquette 30 : écran de suivi, roue dentée, point, trait de liaison

### Conforme

- **Roue dentée fermée** (`ios-maquette30-suivi-roue-guidage`,
  `ios-p8b-c14-02-suivi-roue-fermee`, `android-suivi-1-…`,
  `android-p8b-c14-02-suivi-roue-fermee`) : rond blanc de 48, bord fin, ombre,
  roue noire ; centre à 48 du bord droit (Android : x 363 dp sur 411), même
  axe que la boussole ; 24 entre le bas de la boussole et le haut de la roue
  (maquette : 24) ; présente dans tous les états vus (direction, jaune,
  « Recherche du GPS », départ loin, écart, arrivée).
- **Point de position avec flèche de cap** (rond bleu de 40, bord blanc,
  flèche blanche), placé au tiers du bas : Android 67 % de la hauteur de la
  carte (`android-suivi-1`, y 631 dp), iOS 65 % (`ios-maquette30-…`,
  y 594 pt) ; maquette 66 %. La flèche suit le cap du suivi.
- **Halo** : visible sur iOS (`ios-maquette30-suivi-ecart-halo`, anneau
  d'environ 48 pt autour du rond de 40), caché sous le rond quand la
  précision est bonne (voulu, `marqueur.position-halo`). Sur Android, la
  précision de `geo fix` est trop fine pour le voir (limite du testeur).
- **Écart au tracé** (`ios-maquette30-suivi-ecart-halo`, `t4/ios-ecart-recadrage-c23`) :
  points noirs à liseré blanc, environ un tous les 10, de la position au tracé ;
  panneau blanc « jusqu'au tracé ».
- **Départ loin** (`ios-suivi-1-en-route-fleche-halo-roue`) : pictogramme du
  départ, « 12 km », pointillés noirs jusqu'au marqueur vert.
- **Panneau « Arrivée »** (C12) : au-dessus de 30 m, le chiffre du haut égale
  « Reste » (`t4/ios-8c-…-150m`, `t4/android-6b-…-150m` : 150 m et 150 m) ;
  sous 30 m, « Arrivée » seul, sans chiffre, jaune
  (`t4/ios-9-arrivee-sous-30m`, `t4/android-7-arrivee-sous-30m`, « Reste
  20 m »). « Arrivée » prend la place de la distance, comme le titre de
  l'écran 7 : l'écran ne saute pas.
- **GPS perdu après la correction D1** (`t3/ios-suivi-3-gps-perdu-apres-d1`) :
  rond gris sans flèche, « Signal GPS perdu » en ligne du dessous ; retour du
  bleu et de la flèche ensuite. Pour le halo, voir M3.
- **Trait de liaison, rendu sur fond clair** (ADR § 10.3) : pointillés
  magenta de 3, sans liseré, bien visibles sur le fond de carte clair, les
  champs et les routes blanches (`t4/ios-8c`, `t4/android-6b`,
  `android-suivi-1`, `android-suivi-2`). Magenta sur blanc : 5,9:1. Ils ne
  se confondent ni avec l'écart (noir), ni avec les sentiers (rouges, tirets
  plus longs). Pas de point de liaison sur le tracé : la ligne du suivi reste
  continue.
- Attribution courte, « Terminer », « Reste » et « D+ restant » inchangés
  depuis la 8a.

### Écarts

#### M1. Android : le trait de liaison est en tirets, pas en points ronds (mineur)
- **Captures** : `t4/android-6b-arrivee-150m-liaison-visible` (x 204 à
  303 dp, y ≈ 729) ; `t4/android-4-infos-liaison` (x 166 à 176, y 237 à 259) ;
  `android-suivi-1` (x ≈ 328, y 381 à 472).
- **Ce qu'on voit** : chaque marque fait environ 7 × 2,7 dp, un petit tiret.
  Sur iOS, ce sont des points ronds de 3 (`t4/ios-8c`, `t4/ios-6`).
- **Ce qu'attend la maquette** : `trace.liaison`, « points ronds de 3, environ
  4,5 de vide ».
- **Pourquoi mineur** : le trait se lit, et sa couleur le distingue des
  sentiers. Mais un tiret magenta ressemble au tracé « à la main »
  (`trace.a-la-main`, tirets magenta), ce qu'on veut éviter.
- **Correction proposée** : obtenir des points ronds sur Android, sans
  changer iOS. Cause non cherchée ; pistes, dans l'ordre : vérifier que
  `line-cap: round` arrive bien jusqu'à la couche Android ; essayer un motif
  `[0, 2.5]` (longueur nulle, le bout rond fait le point) ; sinon, dessiner
  les points comme ceux de l'écart (des ronds posés le long du trait). À
  contrôler sur capture Android, écran Infos et suivi.

#### M2. Le trait de liaison d'un point intermédiaire finit dans le vide (remarque du relecteur ; mineur)
- **Captures** :
  - écran Infos (`PlainInfos`) : `t4/ios-6-infos-liaison` (bout libre à
    x 163, y 271 pt) ; `t4/android-4-infos-liaison` (bout libre à x 166,
    y 259 dp) ;
  - suivi : `android-suivi-1` (bout libre à x 326, y 381 dp, juste à gauche
    de la roue dentée), `t4/ios-8c` (x 290, y 680 pt), `t4/android-6b`
    (x 303, y 730 dp) ;
  - même cas au départ quand le point posé est hors chemin :
    `ios-p8b-c14-02-suivi-roue-fermee` (du marqueur vert à x 79, y 461 pt),
    `ios-maquette30-suivi-roue-guidage` (x 283, y 638 pt).
- **Ce qu'on voit** : le départ et l'arrivée ont leur marqueur, posé au bout
  du tracé. Le trait part du tracé et s'arrête dans un champ, sans rien au
  bout. Le point posé, que le trait doit montrer (spec, C11), n'est pas
  dessiné.
- **Ce qu'attend la maquette** : `trace.liaison`, « droit, **du centre du
  marqueur** au bout du tracé ». Dans la création, ce marqueur existe (point
  numéroté). Sur l'écran Infos et dans le suivi, il n'y a pas de marqueur
  intermédiaire (v1/20, 30) : le trait perd son bout.
- **Mon jugement** : rien de faux n'est affiché, et le guidage ne passe pas
  par là. Mais un trait magenta qui s'arrête dans un champ se lit comme un
  tracé inachevé, ou comme un chemin à prendre. **Mineur** : il ne trompe pas
  le guidage, et la spec ne demande pas de marqueur.
- **Correction proposée** : poser au bout libre de chaque trait (le point
  posé) un petit rond `marqueur.point-discret` : fond blanc, bord magenta de
  3, rond de 14 (MapLibre : `circle-radius` 4, `circle-stroke-width` 3), sans
  chiffre. Sur la petite carte de l'écran Infos (arche), le prendre à la
  taille des vignettes : rond de 10 (`circle-radius` 3, bord 2). Pas de
  rond si le point posé est un départ ou une arrivée déjà marqués au même
  endroit. Le rond est dessiné sous le tracé et sous les marqueurs, comme le
  trait. Même dessin dans le suivi : c'est le signe déjà connu de la
  création. Je mettrai `tokens.md` à jour (`trace.liaison` : « le suivi et
  l'écran Infos dessinent un point discret au point posé ») quand le
  pilotage aura choisi de faire la correction.

#### M3. GPS perdu (iOS) : le halo bleu reste autour du rond gris (mineur)
- **Capture** : `t3/ios-suivi-3-gps-perdu-apres-d1`, point à x 67, y 431 pt :
  rond gris d'environ 38 pt, anneau bleu clair d'environ 52 pt autour.
- **Ce qu'attend la maquette** : 30, « GPS perdu en route » : « le point
  devient gris, sans flèche (`marqueur.position-perdue`) ». Le jeton dit
  « même rond, fond `#8C8C8C` », sans halo. Et la note de v1/90 : « pas de
  halo si la précision est inconnue ». Après 10 s sans position, la
  précision n'est plus connue : le halo affiche celle d'une position
  ancienne.
- **Pourquoi mineur** : le gris et « Signal GPS perdu » disent bien la perte ;
  le halo est pâle. Mais le bleu dit « position fraîche » et contredit le
  gris.
- **Correction proposée** : dans `UserPuckLayers.tsx`, donner au halo le même
  filtre que la flèche quand le GPS est perdu (`['boolean', false]`). Au
  retour de la position, le halo revient avec elle. À contrôler sur la
  capture iOS refaite (GPS effacé 18 s).

#### M4. Le trait de liaison reste magenta une fois dépassé (mineur, peut attendre la phase 10)
- **Captures** : `t4/ios-8c-suivi-liaison-sous-trace-150m` (x 200 à 290,
  y ≈ 680 pt) ; `t4/android-6b-…` (x 204 à 303, y ≈ 729 dp).
- **Ce qu'on voit** : l'aller-retour vers le point 2 est roulé, donc gris
  (`carte.parcouru`) ; le trait de liaison qui en part reste magenta, sous la
  position.
- **Ce qu'attend la maquette** : `trace.liaison` dans le suivi est noté « à
  décider » dans `tokens.md`. Dans le suivi, le magenta veut dire « à venir ».
- **Mon jugement** : un trait magenta derrière soi peut faire croire qu'il
  reste un détour à faire. Le risque est faible : le panneau guide déjà vers
  la suite.
- **Correction proposée** : un trait de liaison dont le point posé est
  dépassé (avancement au-delà de la fin du tronçon qui y mène) prend
  `carte.parcouru` (`#8C8C8C` à 70 %), comme la partie roulée. Si cela coûte
  plus qu'une propriété par trait, le garder pour la phase 10.

## Maquette 31b : panneau « Réglages du suivi »

### Conforme

- **Panneau** (`ios-p8b-c14-03`, `-04`, `ios-suivi-2`, `android-p8b-c14-03`,
  `-04`, `android-suivi-2`) : fond blanc, bord du haut noir de 3, rayon 28,
  poignée, « Réglages du suivi » (24, très gras), « Luminosité de l'écran »,
  segments de 64 à bord noir de 3, choisi noir à texte blanc, soleil devant
  « Maximum », explication sur deux lignes, « Fermer » de 64. Pas de voile.
- **Roue dentée noire** tant que le panneau est ouvert, sur les deux
  plateformes.
- **Guidage visible et à jour** au-dessus du panneau ; panneau jaune
  « 100 m » avec le panneau 31b ouvert (`android-p8b-c14-03`, `-04`) : ouvert
  pendant le jaune, il reste ouvert (règle de 30 et § 8.6).
- **« Reste », « D+ restant » et « Terminer » masqués** ; attribution remontée
  au-dessus du panneau (iOS y ≈ 472 pt, Android y ≈ 520 dp).
- **Position au-dessus du panneau (B1 de T2, corrigé)** :
  - Android, en suivi normal (`android-suivi-2`, `android-p8b-c14-04`) : centre
    du point à y 445 dp, haut du panneau à 538 : 93 dp au-dessus, la valeur
    attendue ;
  - iOS, cadrage « départ loin » (`ios-suivi-2-panneau-31b-ouvert-en-route`) :
    point à y 317 pt, marqueur du départ à y 450, haut du panneau à 491 : les
    deux au-dessus, avec les pointillés entre eux.
- Choix « Automatique » puis « Maximum » : le segment choisi suit, sur les
  deux plateformes.

### Écarts

#### M5. iOS, « Recherche du GPS », panneau ouvert : l'itinéraire est réduit à deux ronds (mineur)
- **Captures** : `ios-p8b-c14-03-panneau-automatique`,
  `ios-p8b-c14-04-panneau-maximum` ; pour comparer, panneau fermé :
  `ios-p8b-c14-02-suivi-roue-fermee` (même itinéraire de 620 m, même minute).
- **Ce qu'on voit** :
  - panneau fermé : départ à (60, 402), arrivée à (228, 628), le tracé entre
    les deux ;
  - panneau ouvert : départ à (191, 375), arrivée à (203, 392), l'un sur
    l'autre ; le tracé n'est plus visible (un bout magenta de quelques points).
    La carte a dézoomé d'environ 3,8 niveaux.
- **Ce qu'attend la maquette** : écran 7 de 30, « la carte montre tout
  l'itinéraire » ; 31b, ce qui doit être vu reste au-dessus du panneau. Avec
  les marges de `fitPadding` (40 en haut, panneau + 40 en bas, 60 sur les
  côtés), la carte de 600 pt laisse un cadre de 282 × 136 pt : le dézoom
  attendu est d'environ 1,3 niveau, départ et arrivée à environ 70 × 90 pt
  l'un de l'autre.
- **Pourquoi mineur** : état court, au départ, à l'arrêt ; rien de faux. Le
  défaut M1 de T2 a changé de forme (avant : marqueurs coupés par le panneau ;
  maintenant : itinéraire trop petit). Sur Android, cet état n'a pas de
  capture (voir « Captures manquantes »). Le cadrage en roulant, panneau
  ouvert, est bon (ci-dessus).
- **Cause probable (non prouvée)** : sur iOS, `fitBounds` ajoute la marge
  restée du mouvement précédent (piste du § 11.2 de l'ADR). Panneau fermé,
  la marge était de 80 / 80 ; ajoutée à 40 / 424 sur 600 pt de haut, il ne
  reste rien pour le cadre, et MapLibre dézoome fort. Le cadrage « départ
  loin » (`bounds`) passe bien, lui : il suit un `fitBounds` déjà fait avec
  les mêmes marges.
- **Correction proposée** : pour le cadrage d'ensemble (`overview`), faire
  comme le § 11.2 le prévoit pour l'écart : `easeTo({ center, zoom:
  boundsZoom(…, fitPad), padding: fitPad, duration: 1000 })`, marge donnée
  en entier, au lieu de `fitBounds`. À contrôler sur `ios-p8b-c14-03` refaite,
  et sur la même capture Android.

## Maquette v1/80 : onglet Réglages, rubrique « Pendant le suivi »

### Conforme

- (`ios-p8b-c14-01`, `ios-p8b-c14-05`, `android-p8b-c14-01`,
  `android-p8b-c14-05`) : surtitre « PENDANT LE SUIVI » en Jost, carte crème
  clair à bord brun, « Luminosité de l'écran », segments de 48 à bord brun,
  choisi brun à texte crème, soleil devant « Maximum », explication avec
  « Maximum » en gras, renvoi « Se change aussi pendant le suivi. » avec la
  roue dentée. Mêmes mots que 31b.
- Le choix fait dans le panneau 31b se retrouve dans l'onglet (« Maximum »
  dans `-05` après le choix dans `-04`), sur les deux plateformes.
- Correction M2 de T2 (liseré aux bouts arrondis) : le bord est maintenant
  dessiné par-dessus, plus de jour aux bouts.

### Écarts

#### M6. iOS : un filet clair entre le segment choisi et le séparateur (mineur)
- **Capture** : `ios-p8b-c14-01-reglages-automatique`, x ≈ 200 pt, y 432 à
  477 (entre « Automatique » choisi et le trait de séparation).
- **Ce qu'on voit** : le fond brun d'« Automatique » s'arrête un peu avant le
  séparateur brun ; un filet crème d'environ 0,5 pt reste entre les deux. À
  peine visible à la taille réelle.
- **Ce qu'attend la maquette** : v1/80, le fond du choix touche le
  séparateur, sans jour.
- **Correction proposée** : dans `Segmented.tsx`, ne pas dessiner le
  séparateur (`borderLeftWidth: 0`) quand l'un des deux segments voisins est
  choisi : le fond choisi tient lieu de bord. Garder le séparateur entre deux
  segments non choisis.

## Maquette v1/90 : onglet Carte

### Conforme

- **Ouverture dans la zone** (`ios-carte-1`, `android-p8b-c14-06`) : carte
  centrée sur la position, bouton « suit ma position » (fond brun, viseur
  crème), rond bleu de 32 sans flèche à l'arrêt.
- **En roulant** (`ios-carte-2-trace-fleche-halo-suit`) : flèche blanche dans
  le rond, qui tourne (ici vers le sud) ; nord en haut, la carte ne tourne
  pas ; bouton toujours « suit ».
- **Halo** (`android-carte-2-trace-suit`) : anneau bleu pâle à bord bleu
  autour du rond, environ 64 dp de large ; caché sous le rond quand la
  précision est bonne (`ios-carte-1`, `ios-carte-2`), comme voulu.
- **Carte glissée** (`ios-carte-3-apres-glissement-repos`) : bouton au repos
  (crème clair, viseur brun), le point garde sa flèche.
- **Bouton** : rond de 48, à 16 du bord droit, haut à 60 (iOS 60 pt),
  bord brun, ombre ; trois états conformes à la planche (repos, suit,
  barré).
- **Hors zone à moins de 10 km** (`ios-carte-5-near-est-2km5`,
  `android-carte-5-near-est-2km5`, `ios-carte-6-near-sud-9km5`,
  `t3/ios-ouverture-coin`) : centre sur le bord le plus proche, voile au-delà,
  bord en tirets ; position à 48 du bord droit (est), à 33 au-dessus de
  « Nouvel itinéraire » (sud, x 201, y 656 pt) ; bouton au repos ; message
  « Vous êtes hors de la zone téléchargée » de 16 à 80 du bord droit, haut à
  60, environ 47 à 48 de haut, texte centré en hauteur. C'est l'écran 4 de
  la maquette.
- **Plus de 10 km** (`ios-carte-7-loin-15km-toute-la-zone`) : toute la zone,
  le message, bouton au repos.
- **Position refusée** (`ios-carte-8`, `android-carte-8`) : toute la zone,
  viseur barré, pas de message, pas de point.

### Écarts

Aucun écart propre à la maquette 90 en dehors des acceptés ci-dessous et de
la capture `android-carte-1` à expliquer.

## Acceptés

- **A1. Pointillés de l'écart pendant un recadrage (iOS)** : `t4/ios-ecart-recadrage-c21`,
  points un peu plus serrés pendant la seconde du mouvement, espacement
  normal à l'arrêt (`-c23`). Réserve déjà acceptée par le pilotage ; plus
  faible que le défaut de la 8a. Rien à faire.
- **A2. Hors zone, pas de carte sous le voile au-delà du paquet de la zone**
  (`ios-carte-6-near-sud-9km5`, à partir de y ≈ 427 pt ;
  `t3/ios-ouverture-coin`) : le point bleu est sur un fond uni gris-beige. La
  zone ne contient pas de tuiles au-delà de son bord : c'est honnête, et le
  message dit pourquoi. La maquette 90 (écran 4) dessinait du terrain sous le
  voile : je l'ajusterai à la prochaine retouche de la maquette (note sous
  l'écran 4 : « au-delà de quelques centaines de mètres du bord, la carte est
  vide sous le voile »).
- **A3. Plus de 10 km : point coupé sous la barre d'état**
  (`t3/ios-ouverture-loin`, x 198, y ≈ 10 pt) : comportement d'avant, gardé
  par la spec (« plus loin, rien ne change »).
- **A4. Taille du point sans cap et du point perdu dans le suivi : 40, pas
  30.** L'app dessine le rond de 40 du suivi, avec ou sans flèche, et en gris
  quand le GPS est perdu (`t3/ios-suivi-3-…`, environ 38 pt). C'est ce que
  disent la question (a) de l'ADR (« rond de 40 ») et `marqueur.position`
  (« 40 en suivi ; cap inconnu : même rond, sans flèche »). Les jetons plus
  anciens `marqueur.position-sans-cap` et `marqueur.position-perdue` disent
  encore « rond de 30 » : c'est `tokens.md` qui est en retard. Je le corrige
  (« rond de 40 en suivi ») à la prochaine mise à jour des jetons, avec M2.
- **A5. Roue dentée posée sur le tracé ou sur un marqueur**
  (`ios-maquette30-suivi-roue-guidage`, `android-p8b-c14-02`) : bouton
  flottant, comme la boussole ; déjà accepté en T2 (A6).

## Captures manquantes ou à expliquer (non bloquantes)

1. **`android-carte-1-position-fixe-halo-100m` ne montre ni point ni halo** :
   bouton « suit », carte centrée, mais rien au centre (x 206, y 410 dp). La
   même vue a son point dans `android-p8b-c14-06`. Probablement prise avant
   l'arrivée de la position d'essai. Au testeur de l'expliquer ou de la
   refaire : un rond avec un halo de 100 m (environ 63 dp de rayon au
   zoom 15) doit s'y voir.
2. **iOS, panneau 31b ouvert en suivi normal** (sur le tracé, mode
   « follow ») : seul le cadrage « départ loin » a une capture iOS. La
   correction de B1 est prouvée sur Android en suivi normal ; il faut la
   même capture sur iOS (point attendu vers y 418 pt, panneau à 491).
3. **Android, « Recherche du GPS », panneau ouvert** : pour savoir si M5 est
   propre à iOS.
4. **Panneau 31b avec le texte agrandi à 120 % sur un écran de 667 de haut**
   (déjà demandée en T2).

## Hors T6, à regarder plus tard

- `android-p8b-c14-01` et `-05` : l'interrupteur « Télécharger en Wi-Fi
  seulement » est encore à « non » sur l'émulateur ; à cet état, sa piste
  jaune pâle et son rond blanc se voient mal sur le crème clair (remarque
  déjà notée en T2). À reprendre quand on touchera à l'interrupteur.

## Écarts bloquants

Aucun.
