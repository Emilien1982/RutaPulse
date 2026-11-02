# Phase 5b, T7 (partie 1) : l'écran Zones comparé à la maquette 41

> 3 novembre 2026. Designer. Critères C9 et C15.
>
> Je compare les captures en version finale (release), sans menu de
> développement, aux écrans 2 à 4 et aux variantes A à C de
> `design/v1/41-zones.html`, avec sa note (textes exacts, réponses
> d'Émilien du 2 novembre). Captures dans
> `/Users/utilisateur/dev_ai/vtt-nav-preuves/p05b/t6/` (voir son
> `LISEZMOI.md`) :
> - mise à jour disponible : `p05b-ios-01-zones-maj-disponible`,
>   `p05b-android-01-zones-maj-disponible` ;
> - en cours : `p05b-ios-05-maj-en-cours`, `p05b-android-05-maj-en-cours` ;
> - « Wi-Fi seulement » en attente (écran 4) :
>   `p05b-android-04-wifi-seulement-attente` ;
> - hors réseau après relance : `p05b-android-08-coupure-relance-hors-reseau` ;
> - reprise après relance : `p05b-ios-09-reprise-apres-relance`,
>   `p05b-android-09-reprise-apres-relance` ;
> - après annulation : `p05b-ios-12-apres-annulation`,
>   `p05b-android-12-apres-annulation`.
>
> Hors périmètre de cette partie : la ligne « Difficulté » de l'écran Infos
> (maquette 20), jugée plus tard avec d'autres captures.
>
> Pas des écarts : les chiffres. La zone réelle est « Nancy » v3 (carte du
> 22 oct., 111 Mo) ; la mise à jour est la v4 (carte du 1 nov., 111 Mo). La
> maquette montre « Nancy et forêt de Haye », 106 et 108 Mo, 18 oct. et
> 2 nov. Pas de Metz ni de Gérardmer : le catalogue public n'a que Nancy.

## Comment j'ai mesuré

- iPhone 17 : capture de 1 206 × 2 622 pixels, 402 × 874 points, 1 point
  = 3 pixels. Android (`emulator-5554`) : 1 080 × 2 400 pixels, 411 dp
  (pixels indépendants de la densité) de large, 1 dp = 2,625 pixels.
  Positions en points (iOS) ou en dp (Android) depuis le haut à gauche, à
  3 près. La maquette est dessinée sur 390 de large : je compare les marges
  et les tailles, pas les positions absolues en x.
- J'ai lu le code quand une capture ne suffisait pas : `ZoneUpdate.tsx`,
  `ZoneCard.tsx`, `ZonesView.tsx`, `ZonesScreen.tsx`, `ProgressBar.tsx`,
  `fr.ts`, et la liste des tests `ZonesViewUpdate.test.tsx` et
  `testeurUpdateScreenT4.test.tsx`.
- Gravité (même règle que `p05-t8.md`) :
  - **bloquant** : gêne l'usage ou trahit une décision validée. À corriger
    dans cette phase ;
  - **à corriger** : petit écart. Dans cette phase si possible, sinon à la
    phase indiquée ;
  - **plus tard** : avec la phase indiquée.

## Résumé

| Écran | Bloquants | À corriger | Plus tard |
|---|---|---|---|
| 2, mise à jour disponible | 0 | 1 (C1, Android) | 0 |
| 3, en cours, reprise, hors réseau | 0 | C1 (Android) | 3 (P1 à P3) |
| 4, « Wi-Fi seulement » en attente | 0 | C1 (Android) | P1, P2 |
| Après annulation | 0 | 0 | P3 |
| **Total (écarts distincts)** | **0** | **1** | **3** |

Plus deux écarts anciens, déjà listés en phase 2 et revus ici (N4 et N6,
voir « Rappels »). Et cinq états que les captures ne montrent pas (voir
« Ce que les captures ne montrent pas »).

Verdict :
- **C9 est tenu pour ce que montrent les captures.** La partie « mise à
  jour » est dans la carte de la zone, sous le trait, comme la maquette.
  Le haut de la carte (« Prête sans réseau », carte du 22 oct.) ne bouge
  pas pendant toute la mise à jour. Rien ne part seul : `-01` montre le
  bouton, et il n'y a pas de `v4/` avant le toucher (`etat-initial.txt`).
  Tous les textes visibles sont mot pour mot ceux de la note.
- **Aucun bloquant.** Le seul écart à corriger (C1) est le trait plein au
  lieu des tirets sur Android : il sépare bien, il n'est juste pas dans le
  style.
- **C15 n'est pas complet** : il manque les captures des variantes A, B et
  C et de l'écran 4 sur iOS. Je propose comment les obtenir à la fin.

---

## Écran 2 : mise à jour disponible

### C1. À corriger : sur Android, le trait est plein, pas en tirets

- **Captures** : toutes les captures Android. `-01`, `-05`, `-08`, `-09` :
  trait à y 336, de x 31 à 388. `-04` : trait de la carte à y 457, et
  trait du bandeau « Pas de Wi-Fi » à y 270.
- **Maquette 41** : trait en tirets de 2, `hn.brun` à 55 %, le même dans
  la carte et dans le bandeau. Note : « sous un trait en tirets (même trait
  que le bandeau) ».
- **App** : `borderTopWidth: 2` et `borderStyle: 'dashed'` sur un seul côté
  (`ZoneUpdate.tsx`, `styles.part` ; `ZonesView.tsx`, `styles.alertSwitch`).
  Sur Android, React Native dessine alors un trait plein. Sur iOS, les
  tirets sont justes (`p05b-ios-01`, `-05`, `-09`, `-12`, y 336).
- **Jugement** : à corriger. Le trait plein ne gêne pas l'usage : il sépare
  bien la version en service de la mise à jour, dans le même cadre. Mais
  les deux plateformes ne se ressemblent plus. En phase 2 (N3, `p02-t7.md`),
  j'avais écrit : « À faire si le tiret sur un seul côté se dessine bien sur
  iOS ». C'est prouvé par ces captures : la condition est remplie.
- **Correction** :
  - un composant `ui/DashedRule` : une ligne `react-native-svg` (déjà
    installé) sur toute la largeur, épaisseur 2, tirets 6 / 4,
    `hn.brun` à 55 %. Même famille que `DashedStroke` ;
  - l'utiliser à deux endroits : en haut de la partie « mise à jour »
    (à la place de la bordure, mêmes marges : 10 au-dessus, 8 en dessous)
    et dans le bandeau « Pas de Wi-Fi » (à la place de la bordure) ;
  - contrôle : `-01` et `-04` refaites sur Android, et `-01` sur iOS pour
    voir que rien n'a bougé.
- **Phase** : 5b si le développeur repasse sur `ZoneUpdate.tsx`, sinon 10
  (finitions).

### Ce qui est conforme (écran 2)

- **Place de la partie « mise à jour »** : dans la carte Nancy, sous le
  trait, après « Prête sans réseau ». Carte de 210 de haut sur iOS et 209
  sur Android : la maquette en fait 209.
- **Textes** : « Mise à jour disponible » en 15, graisse 700, `hn.brun` ;
  « 111 Mo · carte du 1 nov. » en 15, `hn.brun-2` (format de
  `zones.meta`). Mot pour mot.
- **Bouton « Mettre à jour »** : moutarde, bord brun, flèche de
  « Télécharger », Jost. 48 de haut, 166 de large sur iOS (de x 31 à 197),
  sous le texte, à gauche, comme la maquette.
- **Marges** : texte à 31 du bord de l'écran sur iOS (13 + bord 2,5 + 16),
  comme la maquette (12 + 2,5 + 16).
- **Pas de bandeau « Pas de Wi-Fi »** sur `p05b-android-01`, alors que
  l'émulateur est en 3G : juste. Le bandeau n'apparaît que si un
  téléchargement attend (note de l'écran 1).
- **Pas de pastille sur l'onglet Zones** : réponse d'Émilien, tenue.

---

## Écran 3 : en cours, reprise, hors réseau

### P1. Plus tard : l'icône pause est 2 à 3 dp trop haute

- **Captures** : `p05b-android-08` (vers x 37, y 403) et `p05b-android-04`
  (vers x 37, y 524).
- **Maquette 41** : icône de 16 centrée en hauteur sur la ligne
  « En attente du réseau · … ».
- **App** : la ligne centre l'icône et le texte, mais le texte porte sa
  propre marge du haut de 5 (`styles.progress`). Le texte descend donc de
  2,5 par rapport à l'icône. Même chose dans `ZoneCard.tsx` (premier
  téléchargement), depuis la phase 2.
- **Jugement** : mineur. On lit la ligne sans peine.
- **Correction** : dans `ZoneUpdate.tsx` et `ZoneCard.tsx`, mettre la marge
  de 5 sur la ligne (`styles.line`) et l'enlever du texte quand il est dans
  une ligne avec icône.
- **Phase** : 10, ou au prochain passage sur la carte de zone.

### P2. Plus tard : la barre vide a un trait brun à gauche

- **Captures** : `p05b-android-05`, `-04`, `-08`, `-09` (vers x 32 à 35,
  y 380) ; `p05b-ios-05` (vers x 31 à 35, y 381). À 0 Mo, le bord gauche de
  la barre paraît deux fois plus épais.
- **Maquette 41** (écran 4) : barre vide sans trait (`.barre i.vide` :
  largeur 0, pas de bord droit).
- **App** : `ProgressBar.tsx` dessine le remplissage avec un bord droit de
  2, même à 0 %.
- **Jugement** : mineur. Mais à 0 Mo, ce trait peut faire croire que le
  téléchargement a commencé.
- **Correction** : pas de bord droit quand le pourcentage vaut 0. Une
  ligne dans `ProgressBar.tsx`. Elle sert aussi au premier téléchargement.
- **Phase** : 10, ou au prochain passage sur la carte de zone.

### P3. Plus tard : « Lecture du catalogue… » est décalé de 4 vers la gauche

- **Captures** : `p05b-ios-09` (x 12, y 511), `p05b-android-09` (x 12,
  y 510), `p05b-android-12` (x 12, y 398). Même décalage pour le titre et
  la phrase du bloc « Le catalogue des zones est injoignable. »
  (`p05b-android-08`, x 12, y 515 et 587).
- **Maquette 41** : tout texte hors des cartes commence à 16 (surtitres,
  explication), soit 4 de plus que le bord des cartes.
- **App** : `styles.message` et `styles.error` de `ZonesView.tsx` n'ont pas
  la marge de côté de 4 (`spacing.s1`) qu'ont les surtitres et
  l'explication. Écart de la phase 2, pas de cette phase.
- **Jugement** : mineur. Mais l'œil le voit, juste entre « DISPONIBLES » et
  l'explication, alignés eux à 16.
- **Correction** : `marginHorizontal: spacing.s1` sur le message de
  chargement, et sur le titre et la phrase du bloc d'erreur. Le bouton
  « Réessayer » garde toute la largeur des cartes.
- **Phase** : 10.

### Ce qui est conforme (écran 3)

- **Haut de la carte inchangé** : « Nancy », « 111 Mo · carte du
  22 oct. », « Prête sans réseau » en vert, menu « ⋮ » : sur les deux
  plateformes, à chaque état.
- **Titre** : « Mise à jour : carte du 1 nov. » mot pour mot, avec l'espace
  insécable avant les deux-points (`fr.ts`). Il laisse 44 à droite pour la
  croix.
- **Croix** : centre vers (359, 356) sur iOS ; attendu (358, 357) d'après la
  maquette (`top: -6`, `right: -6`, cible de 48). Nom accessible
  « Annuler la mise à jour de {nom} » (code).
- **Barre** : sur toute la largeur, de x 31 à 377 sur iOS. 12 de haut, bord
  brun de 2, fond sable, remplissage moutarde. Seule la ligne du titre
  laisse la place de la croix (leçon N2 de la phase 2) : tenu.
- **Progression** : « 0 Mo sur 111 » (`-05`), « 47 Mo sur 111 »
  (`p05b-ios-09`), en 15, graisse 600, `hn.brun`.
- **Phrase** : « La zone reste utilisable pendant la mise à jour. » mot
  pour mot, en `hn.brun-2`.
- **Hors réseau** (`p05b-android-08`) : pause et « En attente du réseau ·
  0 Mo sur 111 », mot pour mot. La partie « mise à jour » reste visible
  alors que le catalogue est injoignable : juste. La note dit qu'une mise à
  jour déjà demandée continue, et cet état vient du téléphone, pas du
  catalogue.
- **Reprise** (`-09`) : pas d'état dessiné à part, comme le veut la note.
  iOS reprend à « 47 Mo sur 111 », les fichiers déjà contrôlés comptés.
  Android reprend à « 0 Mo sur 111 » : juste, `v4/` ne contenait que
  `.plan.json` (`android-dossiers-avant-annulation.txt`).

---

## Écran 4 : mise à jour demandée sans Wi-Fi (Android seulement)

Écarts : C1 (trait plein dans le bandeau et dans la carte), P1 (icône
pause), P2 (barre vide). Rien de propre à cet écran.

### Ce qui est conforme (écran 4)

- **Ordre** : bandeau « Pas de Wi-Fi » en tête, puis « SUR LE TÉLÉPHONE »,
  puis la carte. Comme la maquette.
- **Bandeau** : « **Pas de Wi-Fi :** les téléchargements attendent le
  Wi-Fi. » sur deux lignes, icône Wi-Fi barrée, interrupteur « Télécharger
  en Wi-Fi seulement » activé. Mot pour mot.
- **Carte** : « En attente du Wi-Fi · 0 Mo sur 111 », barre vide, phrase
  « La zone reste utilisable… », croix. Mot pour mot.

---

## Après annulation

### Ce qui est conforme

- **iOS** (`p05b-ios-12`) : la carte revient à « Mise à jour disponible »,
  avec le bouton. Pas de confirmation. C'est la note et la réponse
  d'Émilien.
- **Android** (`p05b-android-12`) : la partie « mise à jour » a disparu, et
  « Lecture du catalogue… » s'affiche. Pas un écart : l'app venait d'être
  relancée, avec le débit de l'émulateur limité (`network speed gsm`). Sans
  catalogue, la carte reste comme à l'écran 1 : c'est la règle de la note.
  Le retour à « Mise à jour disponible » sur Android n'est donc pas vu.
  Seul écart visible : P3.

---

## Rappels : écarts de la phase 2, revus ici

Pas des écarts de cette phase. Je les cite pour qu'on ne les compte pas
deux fois.

- **N4, interrupteur Android** (`p05b-android-04`, bandeau, x 350 à 382,
  y 299) : interrupteur natif d'aspect Material 2, sans coche. Toujours
  ouvert. Phase 10.
- **N6, section « DISPONIBLES » vide** (`p05b-ios-01`, `-05`, `-12` ;
  `p05b-android-01`, `-04`, `-05`) : le surtitre et la place libre
  (« 16,5 Go libres », « 8,4 Go libres ») sans rien dessous, puis l'explication. Toujours ouvert : il manque la
  ligne « Toutes les zones sont sur le téléphone. ». Phase 10.

---

## Ce que les captures ne montrent pas

| État | Plateforme | Ce qu'il faut voir | Comment l'obtenir (proposition) |
|---|---|---|---|
| Variante A, échec | les deux | Ligne rouge « Échec de la mise à jour · {n} Mo sur 111 », « La zone reste utilisable avec la carte du 22 oct. » (un seul point final), « Réessayer » de 56 à gauche, la croix ne chevauche pas le titre | Un catalogue de test sur un serveur local, avec une empreinte fausse pour un fichier de la v4. Sinon : les tests `ZonesViewUpdate.test.tsx` (textes) et la capture de B (même mise en page, sans barre) |
| Variante B, place insuffisante | les deux | « Place insuffisante : il faut 161 Mo libres. » en rouge (111 + 50), puis la phrase et « Réessayer » | Android : remplir le disque de l'émulateur (`adb shell fallocate`) jusqu'à moins de 161 Mo libres, puis « Mettre à jour ». Le catalogue public n'est pas touché |
| Variante C, finie | les deux | Plus de partie « mise à jour » ; « 111 Mo · carte du 1 nov. » ; total de « SUR LE TÉLÉPHONE » et place libre à jour | Laisser finir la v4. Il le faut de toute façon pour la partie 2 (difficulté) et pour C11 |
| Écran 4 | iOS | Bandeau, interrupteur iOS, « En attente du Wi-Fi » | Pas possible sur le simulateur (toujours en Wi-Fi). Accepter la capture Android plus les tests ; à revoir sur un vrai iPhone (essai terrain, phase 10) |
| Barre qui avance | Android | Remplissage moutarde entre 0 et 100 % | Une capture `-05` prise plus tard, débit plein |
| Retour à « Mise à jour disponible » après annulation | Android | Comme `p05b-ios-12` | Refaire `-12` en attendant que « Mettre à jour » soit visible |

Pas vus non plus, couverts par les tests seulement : « En attente de son
tour » (`queued`), le titre « Mise à jour » sans date (même date de carte),
l'annonce « Zone {nom} mise à jour. » au lecteur d'écran. Ils n'ont pas de
mise en page propre : je ne demande pas de capture.

**Ma recommandation** : B et C sont nécessaires pour fermer C15 (C pour les
deux plateformes, B au moins sur Android). A peut se contenter de B plus
les tests, si le serveur local coûte trop. L'écran 4 iOS attend un vrai
iPhone.

## Questions pour le Product Owner

Aucune. Les écarts relèvent du design. Les décisions de produit (date de
la carte, pas de pastille, pas de « Ignorer », pas de confirmation) sont
tenues par l'app.
