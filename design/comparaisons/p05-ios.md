# Phase 5, passe iOS : l'app comparée aux maquettes 10, 11 et 20

> 2 novembre 2026. Designer. Critère C15, seconde moitié. Suite de
> [p05-t8.md](p05-t8.md) (passe Android et « Décisions pour T9 »).
>
> Je compare les captures en version finale (release) du simulateur
> iPhone 17 (iOS 26.5), prises **après les corrections de T9** :
> - `docs/phases/captures/p05-ios-*.png` (12 fichiers à cette passe ; les captures de contrôle de T10 sont venues après) ;
>
> aux maquettes `design/v1/10`, `v1/11` et `v1/20` (les mêmes que pour
> T8), à `tokens.md`, et à leur pendant Android :
> - `docs/phases/captures/p05-android-*.png` (T7, **avant** T9) ;
> - `docs/phases/preuves/p05/t9/*.png` et `t9b/*.png` (Android **après**
>   T9 : c'est la vraie référence pour le chevron, l'arche et le profil).
>
> Hors périmètre, comme en T8 : « Enregistrer », nom et sous-titre
> (phase 6) ; « Difficulté » (5b) ; « Démarrer le suivi » (8) ;
> « Couches » (7) ; barre « Itinéraires » et « ⋮ » d'Infos (6).

## Comment j'ai mesuré

- Capture de 1 206 × 2 622 pixels, écran de 402 points de large :
  1 point = 3 pixels. Positions en points depuis le haut à gauche, à 3
  près. Android est en dp (même unité, écran de 411).
- L'iPhone 17 fait 402 de large : à la taille de texte normale, le résumé
  est en mode **normal** (seuil du mode compact : 390).
- Échelle du texte mesurée sur les captures (largeur du titre, hauteur des
  chiffres) : environ 1,24 en « xxl », environ 3,6 à la plus grande taille
  d'accessibilité (AX5 dans la suite).
- J'ai lu le code quand une capture ne suffisait pas : `RouteSheets.tsx`,
  `RouteInfoScreen.tsx`, `RouteInfoMap.tsx`, `DraftScreen.tsx`,
  `core/draft/draft.ts`, `fr.ts`.
- Gravité, comme en T8 :
  - **bloquant** : gêne l'usage ou trahit une décision validée. À corriger
    dans cette phase ;
  - **à corriger** : petit écart. Dans cette phase si possible, sinon à la
    phase indiquée ;
  - **plus tard** : avec la phase indiquée ;
  - **acceptable** : une différence vue, mais pas un écart.

## Résumé

| Écran | Bloquants | À corriger | Plus tard |
|---|---|---|---|
| 10, création (résumé, point choisi, glisser) | 0 | 1 (E1) | 1 (P1, déjà connu) |
| 11, tracé à la main (bulle, note) | 0 | 0 | 1 (P2, déjà connu) |
| 20, Infos | 0 | 1 (E2) | 1 (E3) + 5 (P3 à P7, déjà connus) |
| **Total** | **0** | **2** | **9** (dont 1 nouveau) |

Verdict :
- **Aucun bloquant.** À la taille de texte normale, l'app rend sur iOS
  comme sur Android après T9 : chevron, D+, point choisi, bulle et note
  « À la main », arche, cases, profil, bande en tirets, légende.
- **Aucun écart propre à iOS à la taille normale.** Les contrôles iOS
  demandés en T8 (coins de l'arche, Jost, point de 40 pendant le glisser)
  sont tenus.
- **E1 est nouveau, mais pas propre à iOS** : le « D » de « Distance » est
  rogné dans le résumé. Il vient de T9, et se voit aussi dans les captures
  Android de T9. Ma consigne B1 l'a causé.
- **E2 et E3 ne sont vus que sur iOS**, parce que seul iOS a été capturé
  avec un texte agrandi. Leur cause est dans le code commun : Android avec
  un grand texte est très probablement touché aussi (non capturé).
- **Point 1 du testeur** (point agrandi et bulle après le glisser) :
  conforme, identique à Android. Voir plus bas.
- **Point 2 du testeur** (texte AX5) : à reporter, avec une règle à
  décider maintenant. Voir E3.

---

## Écran 10 : création

### E1. À corriger : le « D » de « Distance » est rogné

- **Captures** : toutes les captures de création iOS, par exemple
  `p05-ios-creation-resume-dplus`. Aussi sur Android après T9 :
  `preuves/p05/t9b/03-resume-normal-411dp`, `t9b/04-creation-note-a-la-main`.
- **Position** : feuille du bas, légende « Distance », à x 20, de y 664 à
  677 (Android : x 20, y 721). Le bas à gauche du « D » manque : on lit
  « Ɔistance ». Les autres légendes sont entières.
- **Attendu** (maquette 10, et captures Android de T7) : « Distance »
  entier, `texte.legende` en `hn.brun-2`.
- **Cause** : depuis T9, la ligne des chiffres est un `Pressable` à coins
  arrondis de 18 (`hn.rayon-case`), qui coupe ce qui dépasse
  (`overflow: 'hidden'`, pour l'ondulation d'Android). Les chiffres
  commencent à 3 de son bord gauche (`paddingLeft: 3`), et la légende est
  collée à son bas. Le coin arrondi passe donc dans le « D ». Ma consigne
  B1 donnait le rayon, pas la marge intérieure.
- **Jugement** : à corriger, **dans cette phase**. C'est l'écran le plus
  vu de la création, et la légende de la première info. Une lettre coupée
  fait croire à un défaut. La correction est petite et sans risque.
- **Correction** :
  - dans le `Pressable` du résumé, une marge intérieure de 6 à gauche et à
    droite et de 4 en haut et en bas (`paddingHorizontal: 6`,
    `paddingVertical: 4`) ;
  - la même marge en négatif autour (`marginHorizontal: -6`,
    `marginVertical: -4`) : chiffres, légendes et chevron ne bougent pas
    d'un point à l'écran ;
  - effet : le pied du « D » est à 9 du bord et à 8 du bas, hors du coin
    arrondi. Calcul : un point est hors du coin si
    (18 − 9)² + (18 − 8)² < 18², soit 181 < 324. Le fond crème clair de
    l'appui déborde de 6 autour des chiffres : il se lit mieux comme une
    zone touchée ;
  - même règle en mode compact (rien ne change) et quand le résumé n'est
    pas touchable (la boîte reste la même, comme demandé en B1) ;
  - contrôle : une capture du résumé sur chaque plateforme, au repos et
    pendant un appui. « Distance » entier ; le chevron n'est pas rogné non
    plus.

### P1. Plus tard, inchangé : l'ombre du point choisi se voit peu

- **Captures** : `p05-ios-point-choisi-agrandi`, `p05-ios-glisser-pendant`.
- **Position** : point 2 vers (209, 342), rond de 39 (40 attendu, bord
  lissé), halo de 56. Pendant le glisser : vers (230, 373), même taille.
- Même rendu que sur Android : ombre à peine visible, halo bien visible.
  Même décision qu'en T8 (phase 10, essai au soleil).

### Point 1 du testeur : après un glisser, le point reste agrandi et la bulle « Maintenez le point, puis glissez-le » reste affichée

**Décision : conforme à la spec et à T6, et identique à Android. Pas un
écart.**

- **Captures** : `p05-ios-glisser-relache`, `p05-ios-glisser-apres-3s` ;
  pendant Android : `p05-android-glisser-relache-0s3`,
  `p05-android-glisser-apres-3s`. Sur les quatre : point 2 de 40 avec son
  halo, bulle « Maintenez le point, puis glissez-le », « Supprimer »
  actif (rouge).
- **Pourquoi c'est voulu** :
  - en phase 4, le pilotage a décidé que **le point glissé devient le
    point choisi** (résultats p04, C4 ; ma recommandation de p04-t7,
    question 2). « Supprimer » vise alors le point qu'on vient de bouger ;
  - en T6 (C14), le point choisi a pris l'aspect de
    `marqueur.point-deplace` (rond de 40, halo), comme je l'avais demandé
    en p04-t7 (A1). Il le garde donc après le relâchement, tant qu'il
    reste choisi. T8 l'a constaté sur Android : « gardé pendant et après
    le glisser » ;
  - la bulle « Maintenez le point, puis glissez-le » est celle d'un point
    choisi (`route.hintDrag`, affichée dès qu'un point est choisi,
    `DraftScreen.tsx`). Elle dit quoi faire de ce point. Ce n'est pas un
    glisser resté bloqué : la bulle du geste (« Point 2 : relâchez pour
    le poser ») a bien disparu au relâchement ;
  - le choix se vide comme avant : toucher de nouveau le point,
    « Supprimer », ou « Annuler » qui le fait disparaître.
- **Pas de différence entre les plateformes** : la logique est dans le
  code commun (`DraftScreen.tsx`, `core/draft/draft.ts`).
- **Ce que j'ai précisé** : `tokens.md` disait « pendant qu'on le glisse »
  pour `marqueur.point-deplace`, plus étroit que la décision. La ligne dit
  maintenant : aspect du point choisi, pendant le glisser et après, tant
  qu'il reste choisi. C'est ce qui a trompé la lecture.

### Ce qui est conforme (écran 10)

- **Chevron du résumé (B1)** : rond de 47 (48 attendu, bord lissé), de
  x 339 à 386, centré vers y 654, au milieu de la hauteur des chiffres.
  Collé à droite, à 16 du bord de l'écran. Chevron gris à 40 % quand le
  résumé n'est pas touchable : non capturé sur iOS (voir « Non capturé »).
- **D+ dans le résumé** : « 553 m », « 26 m », « 3 min » ; légendes
  « Distance », « Montée (D+) », « Durée estimée », mot pour mot. Chiffres
  en 28, graisse 800, unités en 17. Colonnes à x 20, 111 et 205 ; écart
  de 16, comme décidé pour le mode normal.
- **Pendant le glisser** (`p05-ios-glisser-pendant`) : le tracé et le
  résumé restent ceux d'avant le geste (« 1,0 km », « 35 m »), comme la
  spec (C6) et l'ADR 0017 le demandent. Bulle « Point 2 : relâchez pour
  le poser », mot pour mot, avec l'espace insécable avant les deux-points.
  Point de 40 avec halo pendant le geste, sans plantage : le contrôle iOS
  no 5 de T8 est tenu.
- **Après le relâchement** (`p05-ios-glisser-relache`) : chiffres
  recalculés (« 511 m », « 26 m », « 3 min »), sans grisé.
  Remarque : la capture « pendant » montre le point vers (230, 373), et la
  capture « relâché » vers (209, 342). Le doigt a continué après la
  capture. Rien d'anormal.
- **« Supprimer »** : gris à 40 % sans point choisi
  (`p05-ios-creation-resume-dplus`), rouge avec un point choisi.
- **Jost** : « Nouvel itinéraire » et « PROCHAIN TRONÇON » (avec sa
  cédille) entiers : le contrôle iOS no 3 de T8 est tenu.

---

## Écran 11 : tracé à la main

### P2. Plus tard, inchangé : la pastille du crayon est centrée en hauteur

- **Capture** : `p05-ios-a-la-main-bulle`.
- **Position** : carte d'aide de y 140 à 226 ; pastille centrée vers
  y 183, à côté de la 2e ligne. Même écart que sur Android, même décision
  qu'en T8.

### Ce qui est conforme (écran 11)

- **Carte d'aide** : de x 17 à x 326. Elle laisse 13 avant le bouton
  « Ma position » (x 339), comme Android (12). Haut à y 140 : barre à 127,
  plus 12 attendus (139). Texte de 15, « **À la main** : chaque touche
  ajoute un point, relié au précédent en ligne droite. » mot pour mot, sur
  3 lignes. La bulle sombre se cache tant qu'elle est là.
- **Note de longueur** (`p05-ios-a-la-main-note`) : sur la ligne de
  « PROCHAIN TRONÇON », collée à droite (fin à x 385, 17 du bord). Trait en
  tirets magenta de 21 (22 attendu), puis « À la main : 465 m » en 13,
  graisse 700, `hn.brun`. Comme Android.
- **Tracé à la main** : tirets magenta sur liseré blanc.
- **Acceptable, mais à décider** : dans cette capture, le point 2 reste
  choisi après l'ajout d'un point à la main. « Supprimer » vise donc le
  point 2, pas le point qu'on vient d'ajouter. C'est la logique commune de
  la phase 4 (`core/draft/draft.ts`), la même sur Android. Ce n'est pas un
  écart à la maquette 11, qui montre l'écran sans point choisi. C'est une
  question de comportement : voir « Questions pour le Product Owner ».

---

## Écran 20 : Infos

### E2. À corriger : en « xxl », l'attribution de l'arche touche le départ

- **Capture** : `p05-ios-infos-xxl-defile` (taille de texte « xxl »,
  environ 1,24).
- **Position** : boîte « © OpenStreetMap » et « i » de x 208 à 350 et de
  y 247 à 267 (à la taille normale : x 227 à 350, y 250 à 267). Le rond de
  départ, vers (210, 240), de y 233 à 248, pose son bas sur le coin haut
  gauche de la boîte, à 1 ou 2 près.
- **Attendu** : décision 1 de T9 (p05-t8). La marge du bas de 32 est
  calculée pour une attribution de 17 de haut : un rond posé au bas de la
  boîte de cadrage finit juste au-dessus d'elle, jamais dessous.
- **Cause** : le texte de l'attribution grandit avec la taille du système.
  La boîte s'élargit vers la gauche et monte. Le calcul de T9 ne tient
  plus dès 1,1 environ.
- **Jugement** : à corriger, **dans cette phase si possible**. « xxl » est
  une taille courante, pas une taille d'accessibilité. Ici le rond n'est
  que frôlé ; à 1,35 (« xxxl »), il passe à moitié sous la boîte.
- **Correction** :
  - `maxFontSizeMultiplier={1}` sur le texte de l'attribution courte et
    sur le « i » de l'arche ;
  - la feuille des attributions complètes, ouverte par « i », suit la
    taille du système, elle : celui qui ne lit pas 11 y trouve tout ;
  - même règle pour l'attribution de la carte de la création, qui porte
    le même jeton ;
  - inscrit dans `tokens.md` (`texte.attribution`), le 2 novembre 2026 ;
  - contrôle : `p05-ios-infos-xxl` refaite, boîte à la même place qu'à la
    taille normale.

### E3. Plus tard : à la plus grande taille de texte (AX5), l'écran Infos casse

C'est le point 2 du testeur.

- **Captures** : `p05-ios-infos-texte-agrandi-avant`,
  `p05-ios-infos-texte-agrandi-apres-glissement-depuis-carte`. Taille
  « accessibility-extra-extra-extra-large », échelle d'environ 3,6.
- **Ce qui est vu** :
  - **titre** « Nouvel itinéraire » : environ 80 de haut dans une bande
    fixe de 56 (`header`, `height: 56`). Il déborde, et l'arche, dessinée
    après, le couvre à partir de y 118. On lit « Nouvel iti » à moitié ;
  - **attribution** : boîte de x 39 à 350 et de y 205 à 267. Elle couvre
    toute la moitié basse de l'arche, avec le départ et une partie du
    tracé ;
  - **cases** : deux colonnes de 179 gardées. Chaque mot trop long est
    coupé en plein milieu : « 97 / 6 m », « 5 mi / n », « Distan / ce »,
    « Durée / estimé / e ». Une case fait environ 420 de haut ;
  - **« Modifier »** : bouton de hauteur fixe ; le texte en Jost est coupé
    en bas. Le crayon, lui, ne grandit pas ;
  - **défilement** : il marche, et partir de la carte fait défiler la page
    (la carte n'a pas de geste) : bon point. Mais il faut plusieurs écrans
    pour voir les quatre chiffres.
- **À la taille « xxl »** (`p05-ios-infos-xxl-defile`) : tout tient sur un
  écran, sans mot coupé. Les cases grandissent (77 de haut), la légende
  tient sur deux lignes (la 1re finit à x 380 sur 386). Seul E2 se voit.
  Le contrôle iOS no 7 de T8 (texte agrandi à 120 %) est donc tenu pour
  Infos.
- **Hors critères de la spec** : aucun critère de la phase 5 ne parle de la
  taille du texte. Et la cause n'est pas propre à Infos : bandes et boutons
  de hauteur fixe, grilles à deux colonnes, aucune limite de grossissement
  (seul le guidage a une limite, à 120 %, dans `tokens.md`). La création
  (phase 4) n'a pas été capturée en AX5 ; son résumé sur une ligne
  (`numberOfLines={1}`) y serait coupé en « … ».

**Décision : je recommande de reporter E3, et de ne rien corriger en
partie dans cette phase (sauf E2).**

- Pourquoi reporter :
  - c'est un sujet de toute l'app, pas de l'écran Infos. Corriger Infos
    seul donnerait deux règles dans l'app, et la création resterait
    cassée ;
  - la bonne correction est une règle de design commune, puis son
    application et son contrôle sur chaque écran, sur les deux plateformes.
    C'est une tâche à part entière, pas une retouche ;
  - la phase 5 a déjà eu 3 allers-retours en T9.
- Pourquoi ne pas l'oublier : l'app vise le grand public. Les tailles
  d'accessibilité servent surtout à des personnes qui voient mal ; pour
  elles, l'écran Infos est aujourd'hui illisible. Apple demande, dans ses
  règles de design, que le texte suive ces tailles et que la mise en page
  s'adapte. À faire **avant la première diffusion publique**.
- **Règle que je propose** (à inscrire dans `tokens.md` quand la tâche est
  lancée, pas avant) :
  - **plafonds de grossissement** (`maxFontSizeMultiplier`) : titres et
    boutons en Jost, 1,5 ; chiffres clés, 2 ; corps, légendes et textes
    secondaires, 2,5 ; attribution, 1 (déjà décidé, E2) ; guidage, 1,2
    (règle existante) ;
  - **hauteurs minimales, jamais fixes** : bande de titre et boutons
    passent de `height` à `minHeight` (56). Ils grandissent avec le texte ;
  - **une colonne au-delà de 1,6** : les cases d'Infos passent en pleine
    largeur, l'une sous l'autre. Un mot n'est alors jamais coupé ;
  - **résumé de la création** : au-delà de 1,6, chiffres sur deux lignes
    (distance et D+, puis durée), chevron centré sur la hauteur ;
  - **contrôle** : captures de chaque écran à 1, 1,35 et au plus grand,
    sur les deux plateformes.
- **Phase** : à décider par le Product Owner (voir les questions). Ma
  recommandation : une tâche au début de la phase 6, qui reprend déjà
  l'écran Infos (P3, P4, P6) et crée « Mes itinéraires ». Les nouveaux
  écrans suivent la règle dès le départ.

### P3 à P7. Plus tard, inchangés

Même rendu sur iOS que sur Android après T9 :
- **P3** : haut de l'arche en quart de cercle, pas en ellipse.
- **P4** : « Nouvel itinéraire » au-dessus de l'arche (titre à y 90, arche
  à y 118).
- **P5** : « Modifier » sur toute la largeur, de x 16 à 386, de y 773 à
  827.
- **P6** : « PROFIL ET TERRAIN » en 13, `hn.brun-2`.
- **P7** : une fine couture dans la bande de terrain, vers x 142, dans la
  part « Route ».

### Ce qui est conforme (écran 20)

Capture `p05-ios-infos-a-la-main`, itinéraire mixte de 976 m.
- **Coins de l'arche** (contrôle iOS no 1 de T8) : la carte MapLibre est
  bien coupée par les coins arrondis, en haut comme en bas. Fenêtre de
  x 39 à 363 et de y 130 à 274 (324 × 144). Bord brun et trois anneaux.
- **Cadrage (C2 et décision 1 de T9)** : tracé de x 131 à 267 et de y 151
  à 243, soit 42 % de la largeur et 64 % de la hauteur (Android avant T9 :
  22 % et 45 %). Il touche la marge du haut (20) et celle du bas (32) :
  c'est la hauteur qui limite, comme prévu. Ronds de départ et d'arrivée
  entiers, de 16.
- **Pas de noms de lieux dans l'arche (C3)**.
- **Attribution** à la taille normale : de x 227 à 350, de y 250 à 267, à
  13 du bord droit et 6 du bas de la fenêtre (Android : 12 et 5).
- **Cases** : 179 × 67, écart de 11, rayon 18, bande de couleur à gauche.
  « 976 m », « 5 min », « 26 m », « 35 m » ; « Descente (D−) » avec le vrai
  signe moins. « Distance » entier ici (retrait de 20).
- **Profil (C7)** : il occupe le tiers du bas pour 37 m d'écart ; « de 203
  à 240 m » à droite, fin à x 386. Axe brun, km de 13.
- **Bande de terrain (C5)** : 12 de haut ; la part « À la main » en tirets
  magenta sur blanc.
- **Légende (C4, C5)** : « Route 21 % », « Piste 31 % », « Sentier 0 % »,
  puis « À la main 48 % » sur la 2e ligne, avec le trait en tirets. Texte
  en `hn.brun`.
- **Pas de « Difficulté », pas de « Démarrer le suivi »** (C11, C7).
- **« Modifier »** : bas à y 827, soit 34 (zone de la barre d'accueil) plus
  12 au-dessus du bas de l'écran.

---

## Les contrôles iOS demandés en T8

| No | Contrôle | Résultat |
|---|---|---|
| 1 | Carte coupée par les coins de l'arche | **Tenu** |
| 2 | Retour d'Infos par glissement depuis le bord gauche, sans « Abandonner ? » | **Non capturé.** La capture « après glissement depuis carte » montre un défilement, pas un retour |
| 3 | Jost entier (« Nouvel itinéraire », « PROFIL ET TERRAIN ») | **Tenu** |
| 4 | Chevron et retour à l'appui (fond crème clair, pas d'ondulation) | Chevron **tenu** ; appui **non capturé** |
| 5 | Point de 40 avec halo pendant le glisser d'un point choisi | **Tenu**, sans plantage |
| 6 | Feuille des attributions, au format natif d'iOS | **Non capturé** |
| 7 | Texte agrandi à 120 % : résumé et légende | Infos **tenu** en « xxl », sauf E2 ; résumé **non capturé** |
| 8 | B1 et C1 à C7 rendus de même sur iOS | B1, C2, C3, C4, C5, C7 **tenus**. C1 non visible (chiffres sous 1 000). C6 non capturé |

## Non capturé sur iOS

Je les note sans rien supposer de leur rendu :
- **« Altitudes indisponibles »** (C6, C10) : pas de capture iOS. Pendant
  Android : `preuves/p05/t9/11-infos-altitudes-indisponibles`.
- **Résumé en mode compact** : pas de capture iOS. L'iPhone 17 n'y passe
  pas à la taille normale (402 de large). Il y passe en « xxl » :
  402 ÷ 1,24 = 324, sous 390. Une capture de la **création en « xxl »**
  donne donc à la fois le mode compact et le contrôle no 7 du résumé.
- **Résumé pendant un appui, et non touchable** (chevron à 40 %).
- **D+ inconnu** (« — » dans le résumé, hors de la zone).
- **Retour par glissement depuis le bord**, et **feuille des
  attributions** (contrôles 2 et 6).
- **Itinéraire de 40 km** dans Infos, et **milliers** (C1 : « 1 035 m »).

## Remarque sur les captures

La capture `p05-ios-infos-xxl-avant` montrait l'état AX5, pas « xxl » (doublon de
`p05-ios-infos-texte-agrandi-apres-glissement-depuis-carte`). Elle est retirée.
La vraie capture « xxl », faite après T10, est `p05-ios-infos-xxl`.

## Questions pour le Product Owner

Je ne les tranche pas : elles portent sur ce que l'app doit faire, ou sur
quand le faire.

1. **Grandes tailles de texte (E3).** Quand rendre l'app lisible aux
   tailles d'accessibilité ? Ma recommandation : une tâche au début de la
   phase 6, pour toute l'app, avec la règle proposée en E3 ; au plus tard
   avant la première diffusion publique. L'autre choix : corriger l'écran
   Infos dans la phase 5, au prix d'un aller-retour de plus et d'une app
   à deux règles.
2. **Point choisi après l'ajout d'un point.** Aujourd'hui, si un point est
   choisi et qu'on touche la carte pour ajouter un point, le premier reste
   choisi, et « Supprimer » le vise lui (`p05-ios-a-la-main-note`). Ma
   recommandation : l'ajout d'un point vide le choix ; « Supprimer » se
   grise, et « Annuler » retire le point ajouté. C'est la même idée que la
   décision de la phase 4 : « Supprimer » vise ce qu'on vient de
   manipuler, ou rien. L'autre choix : garder le comportement actuel. Ce
   n'est pas un sujet de la phase 5 : à traiter au prochain passage sur la
   création.
