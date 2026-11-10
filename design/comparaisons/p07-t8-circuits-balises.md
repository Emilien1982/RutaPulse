# Phase 7, T8 : circuits balisés, création depuis un circuit, Dupliquer

> 10 novembre 2026. Designer. Critère C15 (et ce qui se voit de C4, C5,
> C9, C10, C12, C16).
>
> Je compare les captures release (version finale, sans menu de
> développement) du testeur (T7) aux maquettes `design/v1/12-circuit-balise.html`
> (écrans 1 à 8 et variantes), `design/v1/10-creation-itineraire.html`
> (barre et panneau de la création), `design/v1/20-infos-itineraire.html`
> (écran Infos) et `design/v1/40-mes-itineraires.html` (écrans 3, 6d, 9a à
> 9c), et aux valeurs de `design/tokens.md` et `design/style-carte.md`.
> Android : émulateur emulator-5584, release de 7faff23. iOS : iPhone 17
> (iOS 26.5), release de 313cd03.
>
> Pas des écarts : les noms et les chiffres. Le circuit est le vrai
> « Petite Suisse Lorraine à VTT » (34,9 km, D+ 459 m, 3 h 29) ; la
> maquette dit 35,0 km, 478 m, 2 h 54 à titre d'exemple. Sur iOS, le titre
> porte « (3) » : trois circuits du même nom étaient déjà enregistrés
> (règle C9, juste). Le bandeau « Vous êtes hors de la zone téléchargée »
> de certaines captures iOS vient de la position du simulateur.

## Comment j'ai mesuré

- Positions en points (iOS, 402 de large, 1 point = 3 pixels) ou en dp
  (pixels indépendants de la densité, Android, 411 de large, 1 dp =
  2,625 pixels), depuis le haut à gauche, à 3 près. Les maquettes sont
  dessinées sur 390 de large : je compare les marges et les tailles.
- Code lu quand la capture ne suffit pas (lecture seule) :
  `ActionMenuSheet.tsx`, `TrailSheet.tsx`, `TrailsLayer.tsx`,
  `core/trails/chevrons.ts`, `trailSummary.ts`, `routeName.ts`,
  `RouteSheets.tsx` (barre, bulle, « Enregistrer »), `DraftScreen.tsx`,
  `DraftMarkers.tsx`, `DraftToolbar.tsx`, `RouteInfoScreen.tsx`, `fr.ts`,
  `ui/theme/`.
- Gravité, comme en phase 6 :
  - **bloquant** : contredit la maquette validée ou une décision
    d'Émilien, ou gêne l'usage. À corriger dans la tâche de corrections ;
  - **mineur, maintenant** : petit écart, peu coûteux, à corriger dans la
    même tâche ;
  - **mineur, plus tard** : phase 10 (finitions), sauf mention.

## Captures

Dossiers : `/Users/utilisateur/dev_ai/vtt-nav-preuves/p07/t7/android/captures/`
(noté `A/`), `/Users/utilisateur/dev_ai/vtt-nav-preuves/p07/t7/ios/captures/`
(noté `I/`), `/Users/utilisateur/dev_ai/vtt-nav-preuves/p07/t6a-testeur/captures/`
(noté `T6/`) et `/Users/utilisateur/dev_ai/vtt-nav-preuves/p07/t6a-dupliquer/`
(noté `D/`).

| Captures | Maquette, écran |
|---|---|
| `A/maestro-p07-circuit-01-carte-z-proche.png`, `A/release-couche-circuits-appui-double-10.png`, `I/release-couche-circuits-*.png` | 12, écran 1 |
| `A/maestro-p07-circuit-02-feuille.png`, `A/c3-v6-01-feuille-circuit-en-faire-un-itineraire.png`, `I/p07-circuit-02-feuille.png`, `I/release-sombre-feuille-circuit.png` | 12, écran 2 |
| `A/release-couche-circuits-appui-double-11.png` | 12, variante A (position inconnue) |
| `A/c3-v5-01-feuille-circuit-zone-ancienne.png`, `A/c3-v5-02-onglet-zones-mise-a-jour-disponible.png` | 12, écran 5 |
| `A/maestro-p07-circuit-03-creation-ouverte.png`, `I/p07-circuit-03-creation-ouverte.png` | 12, écran 6 ; 10 |
| `A/maestro-p07-circuit-06-modifie.png`, `I/p07-circuit-06-modifie.png` | 12, écran 7 |
| `A/maestro-p07-circuit-04-infos.png`, `I/p07-circuit-04-infos.png` | 20 ; 40, 8a |
| `A/maestro-p07-circuit-05-liste-circuit-balise.png`, `A/maestro-p07-gpx-05-liste.png`, `I/p07-circuit-05-*`, `I/p07-gpx-05-liste.png` | 40, 9a |
| `I/p07-gpx-02-modifier-ouverture.png`, `A/maestro-p07-gpx-02-modifier-ouverture.png` | 40, 9b |
| `A/maestro-p07-dupliquer-02-menu.png`, `T6/a-feuille-ouverte.png`, `D/android-02-feuille-par-points.png`, `I/p07-dupliquer-02-menu.png` | 40, écran 3 (contrôle 6) |
| `A/maestro-p07-dupliquer-03-liste-copie-en-haut.png`, `I/p07-dupliquer-03-*` | 40, 9c |

## Résumé

| Gravité | Nombre | Écarts |
|---|---|---|
| **Bloquant** | **2** | B1, B2 |
| Mineur, maintenant | 8 | M1 à M8 |
| Mineur, plus tard | 6 | L1 à L6 |

**Verdict sur C15 : pas encore tenu, à deux corrections près.** La couche,
la feuille du circuit, la création posée sur le circuit, l'écran Infos, les
origines de la liste et « Dupliquer » suivent les maquettes 12 et 40 dans
leur contenu : textes mot pour mot, ordre, couleurs, points discrets au
zoom d'ouverture, chevrons du sens, départ au point le plus proche. Deux
écarts gênent la lecture de l'écran de création : le départ caché sous
l'arrivée sur iOS, et « Enregistrer » qui garde ses tirets sur Android.

**Contrôle 6 de l'ADR 0020 : j'accepte la feuille du menu Android**, avec
deux retouches peu coûteuses (M3). Voir « Les points demandés », 1.

---

## Écarts bloquants

### B1. iOS : dans la création d'une boucle, l'arrivée cache le départ

- **Écran** : création ouverte depuis un circuit (12, écran 6), et toute
  boucle. **Plateforme** : iOS.
- **Capture** : `I/p07-circuit-03-creation-ouverte.png` : le drapeau noir
  de l'arrivée (centre vers x 166, y 471) couvre entièrement le rond vert
  du départ. Android le fait juste : `A/maestro-p07-circuit-03-creation-ouverte.png`,
  départ vert au-dessus (x 169, y 502).
- **Maquette 12, règles** : « Boucle : départ et arrivée au même endroit ;
  le départ est dessiné au-dessus (l'essai montrait le drapeau par-dessus,
  ce qui cache où l'on part). »
- **Cause** (code) : `DraftMarkers` rend les points dans l'ordre, départ
  en premier, arrivée en dernier. Sur iOS, la dernière annotation passe
  au-dessus ; sur Android, c'est l'inverse.
- **Gravité** : bloquant. Contredit une règle écrite de la maquette
  validée. On ne voit plus d'où part l'itinéraire, alors que la feuille du
  circuit venait de le promettre (« Départ : le point du circuit le plus
  proche de vous »).
- **Correction** : quand le départ et l'arrivée sont au même endroit
  (moins de 48 points à l'écran, ou même position), rendre l'arrivée avant
  le départ sur iOS (ou donner au départ un ordre d'empilement plus haut
  sur les deux plateformes), puis le vérifier sur les deux simulateurs. Un
  test sur l'ordre rendu.

### B2. Android : « Enregistrer » actif garde le bord en tirets

- **Écran** : barre du haut de la création (10 ; 12, écrans 6 et 7).
  **Plateforme** : Android.
- **Captures** : `A/maestro-p07-circuit-03-creation-ouverte.png` et
  `A/maestro-p07-circuit-06-modifie.png` : bouton de x 274 à 399, y 53 à
  100, fond moutarde, mais bord brun **en tirets**. iOS est juste
  (`I/p07-circuit-03-creation-ouverte.png` : moutarde, bord plein).
- **Maquette 10 et 40 (8b)** : actif = moutarde, bord plein brun de 2,5 ;
  inactif = crème clair, tirets `hn.brun-2`. Les tirets veulent dire
  « inactif » dans toute l'app.
- **Cause** (code) : le même défaut qu'en phase 6 (M10, B2) : Android ne
  redessine pas un `borderStyle` qui change. Le `Pressable` de
  `RouteTopBar` (`RouteSheets.tsx`) passe de `saveOff` à `save` sans être
  recréé. `Button.tsx` et `RoutesScreen.tsx` ont déjà la parade, pas ce
  bouton.
- **Gravité** : bloquant. C'est l'action principale de l'écran ; elle a
  l'air à moitié inactive, à chaque création ouverte depuis un circuit
  (le bouton commence inactif le temps des chiffres, voir point 5).
- **Correction** : `key={onSave.enabled ? 'on' : 'off'}` sur ce
  `Pressable`, comme dans `Button.tsx`. Vérifier une capture Android après
  l'arrivée des chiffres.

---

## Écarts mineurs, à corriger maintenant

### M1. La bulle prend toute la largeur de l'écran

- **Écran** : création (12, écrans 6 et 8 ; 40, 9b). **Plateformes** : les
  deux.
- **Captures** : `A/maestro-p07-circuit-03-creation-ouverte.png` (bulle de
  x 0 à 411, y 126 à 184) ; `I/p07-circuit-03-creation-ouverte.png` (x 0 à
  402, y 139 à 195) ; `I/p07-gpx-02-modifier-ouverture.png`.
- **Maquette 12** : bulle centrée, 344 de large au plus, texte centré,
  coins de 20 bien visibles.
- **App** : sur deux lignes, la bulle touche les deux bords ; ses coins
  arrondis sont coupés par le bord de l'écran ; texte aligné à gauche.
  Cause : `bubble` (`RouteSheets.tsx`) n'a ni largeur maximale ni marge.
- **Correction** : `maxWidth: 344` et `marginHorizontal: 16` sur
  `bubble`, `textAlign: 'center'` sur `bubbleText`.

### M2. Écran Infos d'un circuit pas encore enregistré : « Nouvel itinéraire »

- **Écran** : Infos ouvert par « › » depuis la création ouverte d'un
  circuit. **Plateformes** : les deux. Pas de capture (code lu :
  `RouteInfoScreen.tsx`, titre = nom de l'itinéraire gardé, sinon
  `route.new`).
- **Maquette 12** : le titre de la création est le nom par défaut, le nom
  du circuit (réponse 2 d'Émilien). L'écran Infos de ce même itinéraire
  doit dire la même chose.
- **Jugement** : voir le point 4 plus bas. La barre dit « Petite Suisse
  Lorraine à VTT », l'écran suivant « Nouvel itinéraire » : on croit avoir
  changé d'itinéraire.
- **Correction** : l'écran Infos d'un brouillon prend le titre de la
  barre de création (le nom par défaut du circuit ; « Nouvel itinéraire »
  pour une création vierge, inchangé). Maquette 12 complétée.

### M3. Feuille du menu Android : pas de retour à l'appui, lignes de 48

- **Écran** : menu « ⋮ » (40, écran 3 ; variante 3 bis ajoutée).
  **Plateforme** : Android.
- **Captures** : `T6/a-feuille-ouverte.png`, `A/maestro-p07-dupliquer-02-menu.png` :
  feuille de y 575 à 915 ; lignes de 48 (centres à y 654, 702, 750, 798) ;
  « Annuler » de y 835 à 889.
- **App** : rien ne change sous le doigt (`Pressable` sans style
  d'appui ni `android_ripple`, `ActionMenuSheet.tsx`). Quatre lignes
  collées de 48, sans séparation.
- **Jugement** : avec des gants, on ne sait pas si l'appui a porté avant
  que la feuille se ferme. L'onde d'appui est la convention d'Android. Des
  lignes de 56 (taille d'une ligne de liste Material) laissent plus de
  marge entre deux actions voisines ; la feuille a la place.
- **Correction** : `android_ripple={{ color: colors.sand, foreground: true }}`
  (ou fond `colors.sand` quand `pressed`) sur chaque ligne, bornée à la
  ligne ; `minHeight: target.mainButton` (56) au lieu de `target.stop`.

### M4. Circuits invisibles à la vue de toute la zone ; chevrons en amas sous le zoom 10

- **Écran** : onglet Carte (12, écran 1 et 2). **Plateformes** : les deux.
- **Captures** : `A/release-couche-circuits-appui-double-10.png`,
  `I/release-couche-circuits-niveau-1-zone-entiere.png` (zoom 10 environ :
  circuits visibles mais l'écran ne montre que 30 km).
- **Maquette 12 et ancien `style-carte.md`** : « Visible dès le zoom 10
  (toute la zone à l'écran) ». C'était faux : toute la zone (50 km) tient
  à l'écran vers le zoom 8,7. L'intention, voir les circuits de la zone
  d'un coup d'œil, n'est donc pas tenue.
- **Correction** : voir les points 6 et 7. `circuit` : `minzoom` 8,
  épaisseur 1,5 au zoom 8 puis inchangée. `circuit-sens-0` : `minzoom` 10.
  `style-carte.md` et `tokens.md` sont à jour.

### M5. Texte « La mise à jour n'a pas abouti. Reprenez-la depuis l'onglet Zones. »

- **Écran** : feuille d'un circuit d'une zone ancienne, après l'échec de
  la mise à jour (12, variante E bis, ajoutée). **Plateformes** : les
  deux. Pas de capture (lu dans `fr.ts`).
- **Jugement** : voir le point 2. Les mots ne sont pas ceux de l'onglet
  Zones, où l'on va ensuite.
- **Correction** (textes prêts à copier) :
  - `trails.updateFailedTitle` : `La mise à jour a échoué.`
  - `trails.updateFailedText` : `Réessayez depuis l'onglet Zones.`

### M6. iOS : la caméra survole la position avant de se poser sur le circuit

- **Écran** : ouverture de la création depuis un circuit. **Plateforme** :
  iOS. Pas de capture fixe : vidéo du testeur (`ios/LISEZMOI.md`, mesure
  « faire35km-1 » : environ 0,4 s sur la position de l'utilisateur).
- **Jugement** : voir le point 10. L'écran doit s'ouvrir déjà cadré sur le
  circuit.
- **Correction** : caméra de départ = l'emprise du tracé, sans animation à
  l'ouverture (comme la correction B3 de la phase 6 pour « Modifier »).
  Si MapLibre sur iOS ne le permet pas sans un gros détour, le dire au
  pilotage et le reporter en phase 10 : ce n'est pas un blocage.

### M7. Le bouton « Recentrer » couvre le coin du circuit choisi

- **Écran** : feuille du circuit (12, écrans 2, 5 et variante A).
  **Plateformes** : les deux.
- **Captures** : `A/maestro-p07-circuit-02-feuille.png` : bouton de x 348
  à 395, y 61 à 108 ; le coin nord-est du circuit passe dessous (x 335 à
  366, y 91 à 110). `I/p07-circuit-02-feuille.png` : même coin collé au
  bouton (x 326 à 340, y 78 à 92). `A/release-couche-circuits-appui-double-11.png`
  (position inconnue) : le départ, en haut à droite (x 301 à 330, y 78 à
  107), est à 18 du bouton et sur le nom « Pont-à-Mousson ».
- **Maquette 12, écran 2** : le circuit est cadré sous le bouton, rien ne
  le couvre.
- **Correction** : marge du haut du cadrage = bas du bouton « Recentrer »
  + 16 (environ 124 sur iOS, 124 sur Android avec la barre d'état), au
  lieu de la marge actuelle. Maquette 12 précisée.

### M8. Boucle : l'arrivée cache aussi le départ dans l'arche et le médaillon

- **Écrans** : Infos (arche) et liste (médaillon). **Plateformes** : les
  deux.
- **Captures** : `A/maestro-p07-circuit-04-infos.png` (rond noir à x 195,
  y 270, pas de vert) ; `I/p07-circuit-04-infos.png` (x 190, y 282) ;
  `A/maestro-p07-circuit-05-liste-circuit-balise.png` (médaillon : point
  noir à x 53, y 273).
- **Maquette 40, 9a** : le médaillon d'une boucle montre le rond vert du
  départ.
- **Correction** : même règle que B1, dans `RoutePreview` et l'arche :
  dessiner le départ après l'arrivée. À faire avec B1.

---

## Écarts mineurs, plus tard

### L1. Habillage de la feuille du circuit

- **Captures** : `A/maestro-p07-circuit-02-feuille.png`,
  `I/p07-circuit-02-feuille.png`, `A/c3-v5-01-*`.
- **Maquette 12, écran 2** ; écarts de l'app : pas de poignée (et pas de
  glissement vers le bas) ; croix seule, sans le rond crème de 34 ; pas de
  petit trait bleu devant « CIRCUIT VTT BALISÉ » ; distance « 34,9 km »
  pas en gras ; bouton « En faire un itinéraire » sans le rond moutarde ;
  source alignée à gauche (centrée dans la maquette).
- **Jugement** : rien ne gêne. La croix, le toucher dehors et la touche
  Retour ferment la feuille. Le trait bleu du surtitre relierait la
  feuille au trait de la carte : c'est le plus utile des six.
- **Plus tard** : phase 10. Distance en gras et trait bleu d'abord.

### L2. Avis sans la carte moutarde pâle

- **Capture** : `A/c3-v5-01-feuille-circuit-zone-ancienne.png` (écran 5).
  Même code pour l'écran 4 et les variantes D, E, E bis, F
  (`TrailSheet.tsx`).
- **Maquette 12** : « Zone à mettre à jour. » et « Ce circuit ne peut pas
  devenir un itinéraire. » dans une carte moutarde pâle, bord brun, icône
  à gauche, comme « ce qui manque » de la maquette 40.
- **App** : texte courant, titre en gras. Lisible et juste, mais
  l'obstacle ne se distingue pas de l'explication.
- **Plus tard** : phase 10, en réutilisant la carte « ce qui manque » de
  l'écran Infos.

### L3. Feuille du menu Android sans icônes

- **Captures** : `T6/a-feuille-ouverte.png`.
- **Maquette 40, écran 3** : une icône de 22 devant chaque action.
- **Plus tard** : phase 10, avec l'essai du menu ancré natif (N1 de la
  phase 6). Les mots suffisent en v1.

### L4. Points plus foncés aux jonctions des voies d'un circuit

- **Captures** : `I/p07-gpx-02-modifier-ouverture.png` (points foncés
  vers x 130, y 245 et x 166, y 238 sur le trait bleu),
  `I/release-couche-circuits-niveau-1-zone-entiere.png`,
  `A/release-couche-circuits-appui-double-10.png`.
- **Cause** : chaque voie est un objet à 55 % avec des bouts ronds ; deux
  bouts qui se recouvrent font un point plus foncé. La maquette ne veut un
  trait plus foncé que là où **deux circuits** partagent un chemin.
- **Jugement** : un petit grain sur le trait, sans gêne pour lire.
- **Plus tard** : phase 10 : une seule ligne par circuit dans la source de
  la couche (la ligne ordonnée quand elle existe, sinon les voies
  fusionnées), ou une couleur pleine mélangée au fond au lieu d'une
  transparence. Noté dans `style-carte.md`.

### L5. « Enregistrer » et les outils en police du système

- Pour mémoire, pas de cette phase : « Enregistrer » est en police du
  système (Roboto, SF) et non en Jost comme la maquette 10 ; les outils
  inactifs restent pâlis (N5 de la phase 6). Phase 10.

### L6. Un `ref` qui commence déjà par « Circuit »

- Pas vu. Un `ref` OpenStreetMap comme « Circuit 3 » donnerait
  « Circuit Circuit 3 ». **Plus tard** : ne pas ajouter « Circuit » si le
  `ref` commence déjà par ce mot (sans tenir compte des majuscules), dans
  `mapLabel`, `trailTitle` et `routeName`.

---

## Les points demandés

1. **Contrôle 6, la feuille du menu Android : acceptée.** Elle n'est pas
   le menu ancré dessiné à l'écran 3, mais elle suit une convention
   connue d'Android (la feuille du bas avec une liste d'actions) et le
   style de « Renommer ». Ce qui compte y est : les quatre actions dans
   l'ordre de la maquette, « Supprimer » en dernier et en `hn.danger`, un
   « Annuler » de 56, le nom de l'itinéraire en titre, toute la largeur
   touchable, fermeture par « Annuler », le voile ou Retour (contrôle du
   testeur). Deux retouches avant la fusion : le retour à l'appui et les
   lignes de 56 (M3). Les icônes viendront en phase 10 (L3). La maquette
   40 a maintenant la variante 3 bis qui la décrit. Je ne demande pas
   `@expo/ui`.
2. **« La mise à jour n'a pas abouti. Reprenez-la depuis l'onglet
   Zones. »** Clair, mais « Reprenez-la » fait penser à une reprise là où
   elle s'est arrêtée, et l'onglet Zones dit « Échec de la mise à jour »
   et « Réessayer ». Je remplace par « La mise à jour a échoué. Réessayez
   depuis l'onglet Zones. » (M5, maquette 12, variante E bis).
3. **« Circuit sans nom » et « Circuit 3 »** : conformes à la maquette 12
   (variante B et note) : titre de la feuille « Circuit {ref} », sinon
   « Circuit sans nom » ; nom de l'itinéraire « Circuit {ref} », sinon
   « Circuit du {date} ». Je garde. « Circuit 3 » est un nom pauvre mais
   vrai : c'est ce que dit le balisage sur le terrain, et l'on peut
   renommer. Seul cas à surveiller : L6.
4. **Infos d'un circuit non enregistré titré « Nouvel itinéraire »** :
   pas correct face à la maquette 12. La barre de la création et l'écran
   Infos parlent du même itinéraire ; ils doivent avoir le même titre, le
   nom par défaut (M2). Maquette 12 complétée.
5. **« Enregistrer » attend le D+** : je garde l'app et je change la
   maquette 12. L'intention de la maquette était « aucun changement à
   faire pour enregistrer un circuit tel quel » ; elle est tenue. Attendre
   environ 1 s que les chiffres arrivent évite un itinéraire gardé avec
   « D+ — » dans la liste. À une condition : que l'état inactif se lise
   bien et que le passage à actif se voie, d'où B2 sur Android.
6. **Les chevrons** : l'app pose des points calculés sur 5 tranches de
   zoom, avec le caractère « > ». C'est mieux que « tous les 150 » (qui
   ne tenait pas sur iPhone) et je le garde. `style-carte.md` décrit
   maintenant ce qui doit être : le dessin, l'écart voulu à l'écran (50 à
   350 points), les 5 tranches, et **aucun chevron sous le zoom 10**
   (`minzoom` 10 sur `circuit-sens-0`) : à 2 500 m d'espacement, ils
   seraient à 12 points l'un de l'autre au zoom 8. `tokens.md`
   (`carte.sens-circuit`) suit.
7. **Circuits visibles seulement dès le zoom 10** : pas le bon choix. Le
   zoom 10 ne montre qu'environ 20 km de large ; la vue de toute la zone
   est au zoom 8,7, et c'est là qu'on cherche « où sont les circuits ».
   Je passe la couche à `minzoom` 8, plus fine (1,5 au zoom 8). Les noms
   restent dès le zoom 12, les chevrons dès le zoom 10 (M4). Réserve :
   dans une zone très riche en circuits (Vosges), le zoom 8 pourrait
   devenir chargé ; à revoir quand une telle zone sera publiée.
8. **`routes.noticeOutsideEdit` et `routes.noticeOutsideNoEdit`** : je
   suis l'ADR 0020, § 8, et j'aligne la maquette 40 sur l'app. Un bouton
   absent ne se cherche pas ; la carte « Hors de vos zones » dit ce qui
   manque et « Voir les zones » mène à la zone. Les deux phrases sont
   retirées de l'écran 6d et de la note.
9. **Annonce vocale « Copie créée : {nom}. »** : je garde. Elle suit le
   modèle « GPX importé : {nom}. », dit ce qui s'est passé et le nom à
   chercher en haut de la liste. Pas entendue dans les preuves (TalkBack
   et VoiceOver non lancés) : voir « Pas vu ».
10. **La caméra qui survole la position (iOS)** : l'effet attendu est
    d'ouvrir la création déjà cadrée sur le circuit, sans vol. Le vol de
    0,4 s montre un autre endroit et fait croire à une erreur (M6).

## Ce qui est conforme

- **Couche** (`A/maestro-p07-circuit-01-*`, `I/release-couche-*`) : trait
  bleu à 55 %, sous les noms de lieux et au-dessus des voies, nom le long
  du trait en bleu foncé gras avec halo blanc (« Lorraine à VTT » coupé au
  bord de l'écran : normal). Pas de bouton des couches.
- **Feuille du circuit** (`*/…-02-feuille.png`) : surtitre en capitales,
  nom en Jost 22, « 34,9 km · boucle », explication mot pour mot avec la
  phrase des variantes (réponse 4 d'Émilien), départ en gras, bouton brun
  de 56, « Tracé du circuit : OpenStreetMap ». Circuit choisi plein avec
  liseré blanc et chevrons ; départ au point le plus proche (rond vert).
  La feuille couvre la barre d'onglets.
- **Variante A** (`A/release-couche-circuits-appui-double-11.png`) :
  « Départ : le début du circuit, car votre position est inconnue. »,
  départ posé au début.
- **Écran 5** (`A/c3-v5-01-*`) : « environ 35 km », sans chevrons ni
  départ, « Zone à mettre à jour. » et le texte mot pour mot, « Mettre à
  jour · 111 Mo », « La zone reste utilisable pendant la mise à jour. »
  centré. L'onglet Zones montre bien la mise à jour (`A/c3-v5-02-*`).
- **Création** (`*/…-03-creation-ouverte.png`) : titre = nom du circuit,
  coupé par « … » ; bulle mot pour mot ; points discrets blancs bord
  magenta ; départ et arrivée en grand (sauf B1) ; tout le circuit cadré
  entre la bulle et le panneau ; chiffres 34,9 km, 459 m, 3 h 29.
- **Après un point ajouté** (`*/…-06-modifie.png`) : nouvelle arrivée
  (drapeau), tronçon recalculé, « Annuler » et « Boucler » actifs.
- **Infos après « Enregistrer »** (`*/…-04-infos.png`) : titre, « Zone
  Nancy · circuit balisé, le 9 nov. 2026 », arche, quatre cases, profil et
  terrain, « Modifier ».
- **Liste** (`*/…-05-liste-*`, `*/…gpx-05-liste.png`) : origines
  « circuit balisé, le 9 nov. » et « GPX modifié le 9 nov. », mot pour
  mot (40, 9a).
- **GPX « Modifier »** (`I/p07-gpx-02-*`) : titre = nom du GPX,
  « Enregistrer » inactif en tirets, bulle « Tracé du GPX posé. En
  enregistrant, vous remplacez l'original. » mot pour mot (40, 9b), sauf
  M1.
- **Dupliquer** (`*/…dupliquer-03-*`) : la copie « Original (copie) » en
  haut, l'original dessous inchangé, même origine, date du jour (40, 9c).
- **Menu iOS** (`I/p07-dupliquer-02-menu.png`) : feuille d'actions du
  système, nom en titre, Renommer, Dupliquer, Exporter en GPX, Supprimer
  en rouge du système, Annuler. Conforme aux habitudes d'iOS.
- **Mode sombre** (`I/release-sombre-feuille-circuit.png`) : l'app garde
  son style clair, comme partout ailleurs.

## Pas vu en capture

- Feuille « {n} circuits passent ici » (variante G), écran 4 (circuit
  refusé), aller simple (écran 3), variantes D, E, E bis, F, écran 8 (une
  partie du circuit hors zone), numéros des points au zoom proche
  (écran 7).
- Titres « Circuit {ref} » et « Circuit sans nom » (lus dans le code et
  dans `ios/LISEZMOI.md`).
- Écran Infos ouvert depuis la création d'un circuit (M2, lu dans le
  code).
- Annonces vocales (`trails.placedAnnounce`, `routes.duplicatedAnnounce`).

## Les écarts bloquants, en bref

1. **B1** (iOS) : l'arrivée cache le départ d'une boucle dans la
   création. Rendre le départ au-dessus, vérifier sur les deux.
2. **B2** (Android) : « Enregistrer » actif garde ses tirets. `key` sur le
   `Pressable` de `RouteTopBar`.

## Changements de maquette faits dans ce passage

- `design/style-carte.md`, « Circuits balisés » : couche visible dès le
  zoom 8 (épaisseur 1,5 au zoom 8) ; couches `circuit-choisi` décrites
  telles qu'elles sont ; nouvelle partie « Sens du circuit choisi
  (chevrons) » : caractère « > », 5 tranches, écart de 50 à 350 points,
  rien sous le zoom 10, JSON d'exemple ; note sur les points foncés aux
  jonctions (L4).
- `design/tokens.md` : `carte.sens-circuit` et `trace.circuit` mis
  d'accord avec `style-carte.md`.
- `design/v1/12-circuit-balise.html` : note de tête T8 ; écran 6 et
  règles : « Enregistrer » actif dès que les chiffres sont là ; écran
  Infos d'un brouillon = titre de la barre ; variante E bis et ses textes
  (mise à jour échouée) ; couche dès le zoom 8 ; chevrons et cadrage sous
  le bouton « Recentrer ».
- `design/v1/40-mes-itineraires.html` : note de tête T8 ; écran 3
  (cartouche) et nouvelle variante 3 bis (feuille du menu Android, avec
  retour à l'appui et lignes de 56) ; écran 6d et note : phrases
  `routes.noticeOutsideEdit` et `routes.noticeOutsideNoEdit` retirées.
- Les captures pleine page `design/v1/captures/12-circuit-balise.png` et
  `40-mes-itineraires.png` ne sont **pas** refaites : pas de terminal dans
  ce passage. À refaire par la session de phase.

## Questions pour le Product Owner

Aucune. Tous les écarts relèvent du design. Deux choix changent un détail
de maquette validée ; le pilotage dit si Émilien doit les revoir :
la couche des circuits visible dès la vue de toute la zone (zoom 8 au lieu
de 10, point 7), et « Enregistrer » qui attend environ 1 s les chiffres
d'un circuit (point 5).
