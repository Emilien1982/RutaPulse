# Phase 10a, T5 (C2, C3) : icône A et écran de démarrage comparés aux maquettes

> 17 novembre 2026, designer. Fichiers PNG de `mobile/assets/images/` et
> captures release de `docs/phases/preuves/p10a/t2-test/`, `t2/` et `t4/`
> (iOS : simulateur iPhone 17 ; Android : `emulator-5584`, lanceur Pixel),
> comparés à `design/v1/70-icone.html`, `design/v1/71-demarrage.html`,
> `design/tokens.md` (« Icône », « Écran de démarrage ») et
> `design/v1/icone/LISEZMOI.md`.
> Positions en points (pt) ou dp de l'écran capturé. Échelle des captures :
> iOS × 3 (402 × 874 pt), Android × 2,625 (411 × 914 dp).
> Gravité : **bloquant** si l'écart contredit la spec (C2, C3) ou se voit mal
> sur le vélo ; **mineur** sinon ; **accepté** si rien n'est à faire.
> Les couleurs sont jugées à l'œil sur les captures : je n'ai pas d'outil de
> mesure des pixels dans cette session.

## Bilan

- **Aucun écart bloquant.** C2 et C3 sont tenus.
- **Anneau rose saumon du dock Android : ce n'est pas un défaut de nos
  fichiers.** C'est la marque des **apps suggérées** du lanceur Pixel. Rien
  à corriger, ni en 10a ni en 10b (écart A1).
- **3 écarts mineurs** (M1 à M3), tous pour 10b ou plus tard.
- **2 captures manquantes** (icône à thème Android, icône iOS en mode
  sombre ou teinté), non bloquantes.
- Pas de question pour le Product Owner.

## Fichiers PNG de l'app

### Conforme

- **`icon.png`** (iOS, et secours des vieux Android) : carré plein, fond crème,
  recadré sur les 72 du centre. L'horizon tombe à y 626 sur 1024, soit
  (62 − 18) / 72 : la valeur attendue. Soleil coupé de ses deux filets crème,
  bandes orange et rouille, sol brun, chemin crème. Pas de coins arrondis
  dans le fichier (iOS les fait).
- **`android-icon-foreground.png`** : le dessin seul dans le carré de 108,
  transparent au-dessus de l'horizon. Horizon à y 588 sur 1024 (62 / 108).
  Soleil en trois morceaux, comme le LISEZMOI le prévoit.
- **`android-icon-background.png`** : crème uni.
- **`android-icon-monochrome.png`** : soleil en trois morceaux et barre
  d'horizon à bouts ronds, de x 256 à 768 (27 à 81 sur 108), y 626 à 683
  (66 à 72). Tout tient dans la zone sûre.
- **`splash-icon.png`** : le disque de 72 dans l'anneau brun, transparent
  autour. Conforme à `demarrage.svg`.
- **Plus aucune image d'Expo** dans `mobile/assets/images/` (ni `favicon`, ni
  logos React) ; `assets/expo.icon/` n'existe plus ; `app.json` n'a plus de
  `#E6F4FE`. `ic_launcher.xml` déclare bien les trois couches (fond, dessin,
  monochrome).

## Icône sur l'écran d'accueil

### Conforme

- **iOS** (`c2-ios-accueil`, x 90 à 277, y 857 à 1045 px) : icône A entière,
  arrondie par le système, nom « RutaPulse » dessous. C'est la vignette iOS
  de la planche 70. Le léger reflet clair du bord vient d'iOS 26 (effet
  « verre »), comme pour les autres apps.
- **Android, tiroir d'apps** (`c2-android-tiroir`, `c2-android-icone-zoom`) :
  icône ronde, soleil entier, nom « RutaPulse ». Le haut du soleil est à 28 %
  du haut du rond, comme sur la planche 70 (20 / 72). Le chemin et les
  bandes vont jusqu'au bord du masque, sans liseré de fond : c'est voulu.
- **Android, dock**, une fois l'anneau mis à part (voir A1) : même dessin et
  même recadrage que dans le tiroir.

### Écarts

#### A1. Android, dock : l'icône est dans un anneau rose saumon (accepté : comportement du lanceur)

- **Captures** : `c2-android-dock-zoom` ; `c2-android-accueil`, 4ᵉ place du
  dock (x 840 à 998, y 1891 à 2049 px, soit environ 60 dp) ; même chose dans
  `t2/android-accueil` (prise à 2 h 42, avant le testeur).
- **Ce qu'on voit** : un rond saumon pâle de la taille des autres icônes du
  dock. Notre icône est dedans, réduite à environ 80 % (environ 48 dp). Les
  trois autres icônes du dock (Téléphone, Messages, Chrome) n'ont pas
  d'anneau. Dans le tiroir, notre icône n'en a pas non plus.
- **Ce qu'attend la maquette** : v1/70, vignette « 48 points » sur fond
  sombre : le rond de l'icône, sans rien autour.
- **Cause, à mon avis** : la 4ᵉ place du dock du lanceur Pixel est libre. Le
  lanceur y met une **app suggérée** (fonction « Suggestions d'apps » depuis
  Android 11). Il marque une app suggérée par un anneau teinté, pris dans la
  couleur dominante de son icône, et réduit l'icône dedans. Ici, le saumon
  est notre orange éclairci. Une fois l'app épinglée, l'anneau disparaît.
  Sources : guides sur les suggestions du dock Pixel (anneau « de la couleur
  dominante de l'icône ») et code de Launcher3, classe `PredictedAppIcon`
  (« icône avec un anneau autour », dessiné seulement si l'icône n'est pas
  épinglée). Liens en fin de document.
- **Pourquoi ce n'est pas nos fichiers** :
  - un fond d'icône adaptative en défaut se verrait en crème, pas en saumon,
    et partout, y compris dans le tiroir ;
  - une couche de dessin trop petite laisserait voir du fond crème autour du
    soleil ; ici, le dessin remplit son rond intérieur jusqu'au bord, avec le
    même recadrage que dans le tiroir ;
  - une icône à thème serait d'une seule couleur ; ici, nos couleurs sont là,
    et les autres apps ne sont pas en thème ;
  - l'anneau ne touche que l'icône posée à la place des suggestions.
- **Est-ce que ça gêne** : peu. On reconnaît le soleil. L'icône est un peu
  plus petite et le saumon sort de notre palette, mais c'est le signe normal
  d'une suggestion sur un Pixel. Cela n'existe pas sur d'autres lanceurs
  (Samsung One UI, par exemple).
- **Correction proposée** : **rien dans nos fichiers**, ni en 10a ni en 10b.
  Ajouter une ligne au guide d'installation ou à la fiche d'essai : « Pour
  mettre RutaPulse dans le dock, glisse-la depuis le tiroir d'apps. Si elle
  y est déjà avec un anneau de couleur, c'est une suggestion du téléphone :
  appui long, puis "Épingler" ». Pour lever le doute sur l'émulateur :
  épingler l'app au dock, ou la glisser sur l'écran d'accueil, puis refaire
  la capture. L'anneau doit disparaître.

## Écran de démarrage

### Conforme

- **Fond crème** `#F4E4C1` sur les deux plateformes. Aucun bleu d'Expo.
  Côté iOS, la couleur est déclarée en sRGB (`SplashScreenBackground`) ;
  côté Android, `splashscreen_background` vaut `#F4E4C1`, et
  `values-night` est vide : le démarrage reste crème si le téléphone est en
  thème sombre.
- **Image** : le rond de l'icône dans l'anneau brun, centré, **176** de
  diamètre, anneau d'environ 8 :
  - iOS (`c3-ios-d4`) : 528 px, soit 176 pt ; centre à 50 % de la hauteur ;
  - Android (`c3-android-b2`, `t2/android-demarrage-1`) : 462 px, soit
    176 dp ; centre à 50 % ; rien n'est coupé par le rond de 192 dp.
- **Barre d'état** foncée sur le crème pendant le démarrage, sur les deux.
- **Pas de flash blanc, gris ou noir** :
  - Android, sans zone installée (`c3-android-b1` à `-b3`, `-1`, `-2`,
    `t2/android-apres-lancement`, `t4/01-premier-lancement` avec l'APK de la
    vraie clé) : fond crème, puis fondu vers « Pas encore de carte », sur
    le même crème. Aucun saut de fond. Un fondu se voit aussi sur Android
    (`c3-android-b3`, `-1`), mieux que ce que prévoyait le LISEZMOI.
  - iOS, avec la zone Nancy (`c3-ios-d2` à `-d5`, `c3-ios-5`) : crème, rond,
    puis fondu de la carte. Pas de flash.
- **Pas de texte** sur l'écran de démarrage.

### Écarts

#### M1. iOS : couleurs du rond plus vives pendant l'animation d'ouverture (mineur, plus tard)

- **Captures** : plus vives dans `c3-ios-d2`, `c3-ios-d3` et
  `t2/ios-demarrage-1`, toutes prises **pendant** l'agrandissement de la
  fenêtre (coins arrondis, fond d'écran visible autour). Dans `c3-ios-d4`
  (plein écran, juste après), les couleurs sont proches du PNG.
- **Ce qu'on voit**, à l'œil : pendant l'animation, le soleil tire vers un
  jaune orangé vif (proche de `#FBA500` au lieu de `#F0A830`) et la bande
  orange vers `#F25C00` (au lieu de `#E2652B`). Le crème du fond change à
  peine. Dans `-d4`, soleil et bandes reprennent leurs teintes.
- **Ce qu'attend la maquette** : v1/71, les couleurs de l'icône A.
- **Cause probable (non prouvée)** : pendant l'ouverture, iOS ne dessine pas
  notre écran. Il montre une **image de l'écran de démarrage qu'il a gardée
  en cache**, dans le format de couleurs de l'écran (P3, plus large que le
  sRGB). Notre PNG n'a pas de profil de couleur (sortie de `rsvg-convert`) :
  s'il est lu comme du P3, ses couleurs sortent plus vives. Le fond, lui, est
  déclaré en sRGB, et change donc peu. Une capture de simulateur peut aussi
  exagérer l'effet.
- **Pourquoi mineur** : cela dure le temps de l'animation (moins d'une
  demi-seconde), c'est le même dessin, et c'est sur le simulateur. Rien ne
  trompe le cycliste.
- **Correction proposée** : rien en 10a (pas d'iPhone). Plus tard :
  1. regarder sur un vrai iPhone ;
  2. si l'écart s'y voit, marquer `splash-icon.png` (et `icon.png`) d'un
     profil sRGB explicite, par exemple
     `sips --matchTo "/System/Library/ColorSync/Profiles/sRGB Profile.icc"`,
     puis comparer deux lancements ;
  3. mesurer les pixels (soleil, bande orange, fond) dans `-d3` et `-d4`
     avant et après.

#### M2. iOS : sous le démarrage, la carte est déjà dessinée ; le fondu passe du crème au gris-beige hors zone (mineur, maquette à ajuster)

- **Captures** : `c3-ios-d5` (fondu en cours), `c3-ios-5`.
- **Ce qu'on voit** : quand le rond s'efface, l'onglet Carte est déjà là
  avec la zone Nancy : le haut et le bas de l'écran, hors de la zone, sont
  sous le voile gris-beige (`hn.voile-hors-zone`), pas crème. Le passage se
  fait par le fondu de 300 ms : pas de saut brusque, mais le fond change de
  teinte.
- **Ce qu'attend la maquette** : v1/71, écran 3 : « le fond reste le
  même » (fond crème avant la carte). C'est vrai sans zone (Android, plus
  haut), pas quand la carte est prête avant la fin du démarrage.
- **Pourquoi mineur** : le fondu adoucit le passage ; la carte est ce que le
  cycliste veut voir. C3 dit « sans saut **visible** » : il n'y en a pas.
- **Correction proposée** : rien dans le code. J'ajusterai la planche 71
  (écran 3 : « avec une zone installée, la carte peut déjà être dessinée ; le
  fondu fait la transition ») et le jeton `demarrage.fond` dans `tokens.md`,
  à la prochaine retouche des maquettes. Sur le téléphone Android d'Émilien,
  avec la zone Nancy, ce sera le même cas : à regarder pendant l'essai.

#### M3. iOS : le dialogue de position s'ouvre pendant le fondu (mineur, rien à faire)

- **Capture** : `c3-ios-fondu-vers-carte-dialogue` : le rond du démarrage se
  voit encore, pâle, derrière le dialogue « Autoriser « RutaPulse » à
  utiliser votre position ? » (x 330 à 820, y 1030 à 1550 px).
- **Ce qu'attend la maquette** : rien n'est dessiné pour ce cas.
- **Pourquoi mineur** : au premier lancement seulement, pendant 300 ms ;
  le dialogue reste lisible.
- **Correction proposée** : aucune. Si le pilotage veut un premier
  lancement plus propre, demander la position après la fin du fondu (un
  délai de 300 ms) ; je ne le recommande pas, cela ne vaut pas le code.

## Captures manquantes (non bloquantes)

1. **Icône à thème Android** (Android 13 et plus, « Icônes à thème » activé) :
   le PNG monochrome est conforme, mais personne ne l'a vu rendu par le
   lanceur. Attendu : soleil coupé de deux filets et barre d'horizon, d'une
   seule couleur, sur le fond teinté du système (planche 71, vignette
   « Icône à thème »).
2. **Icône iOS en mode sombre, transparent ou teinté** (iOS 26) : avec un
   seul PNG, iOS fabrique lui-même ces versions. À regarder quand un iPhone
   sera là ; pas d'enjeu sur le vélo.

## Hors T5, à regarder plus tard

- `mobile/android/app/src/main/res/values/colors.xml` garde
  `colorPrimary` = `#023c69`, le bleu par défaut d'Expo. Il ne touche ni
  l'icône ni le démarrage. Il peut colorer des éléments natifs d'Android
  (boutons de certaines boîtes de dialogue, curseur). À vérifier en 10b sur
  une alerte de l'app ; si du bleu s'y voit, le passer en `hn.brun`.
- `design/v1/icone/LISEZMOI.md` dit « le fondu est géré sur iOS seulement ».
  Les captures Android montrent un fondu aussi. Je corrigerai la phrase à la
  prochaine retouche.
- Le simulateur iOS garde deux apps d'essai à l'icône d'Expo (« vtt-nav
  essai 1 », « Essai 2 ») : restes de T1, sans effet sur l'app. Elles
  peuvent être supprimées du simulateur.

## Ce qu'Émilien peut regarder sur son téléphone

1. **Écran d'accueil et tiroir** : l'icône montre le soleil entier, sous le
   nom « RutaPulse », quelle que soit la forme des icônes de son téléphone.
2. **Dock** : s'il y voit RutaPulse dans un anneau de couleur, c'est une
   suggestion du téléphone (A1). Appui long, puis « Épingler » : l'anneau
   doit partir.
3. **Icônes à thème**, si son téléphone en a (Réglages, « Fond d'écran et
   style ») : RutaPulse doit montrer le soleil rayé et la barre d'horizon,
   d'une seule couleur.
4. **Lancement à froid** (app fermée depuis la liste des apps récentes) :
   fond crème et rond, puis l'app, sans flash blanc ni noir. Une fois avec
   la zone Nancy installée (passage vers la carte, M2), et une fois le
   téléphone en **thème sombre** : le démarrage doit rester crème.
5. **Au soleil** : l'icône se trouve-t-elle vite parmi les autres ?

## Écarts bloquants

Aucun.

## Sources (anneau du dock, A1)

- [Gadget Hacks : suggestions d'apps dans le dock d'un Pixel](https://pixel.next.gadgethacks.com/how-to/add-predictive-app-shortcuts-your-pixels-home-screen-dock-0315270)
- [9to5Google : suggestions d'apps dans le dock, Android 11](https://9to5google.com/2020/06/01/android-11-pixel-launcher-app-suggestions-dock/)
- [Code de Launcher3 (copie de /e/OS, Trebuchet) : `PredictedAppIcon`](https://gitlab.e.foundation/e/os/android_packages_apps_Trebuchet/-/commit/8e0484bf69859521e7392967553f80a373186b46)
