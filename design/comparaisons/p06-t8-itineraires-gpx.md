# Phase 6, T8 : Mes itinéraires et GPX comparés aux maquettes 10, 20 et 40

> 4 novembre 2026. Designer. Critère C16 (et C5, C8, C12 pour ce qui se
> voit).
>
> Je compare les captures release (version finale, sans menu de
> développement) du testeur (T7, release de 423cdee) aux états 1 à 8 et à la
> note de `design/v1/40-mes-itineraires.html`, à la barre du haut de
> `design/v1/10-creation-itineraire.html` et à l'écran Infos de
> `design/v1/20-infos-itineraire.html`. iOS : iPhone 17 (iOS 26.5).
> Android : Pixel 6, Android 14.
>
> Pas des écarts : les noms et les chiffres. Les itinéraires sont ceux du
> testeur (« Boucle de Haye », « Trace du testeur », « Balade a Paris »,
> « Boucle des Vosges »), pas ceux de la maquette. La zone « Vosges »
> supprimée est une fausse zone du testeur. Le système Android de
> l'émulateur est en anglais (« Sharing 1 file ») : ce n'est pas un texte à
> nous.

## Comment j'ai mesuré

- Positions en points (iOS, 402 de large, 1 point = 3 pixels) ou en dp
  (pixels indépendants de la densité, Android, 411 de large, 1 dp =
  2,625 pixels), depuis le haut à gauche, à 3 près. La maquette est
  dessinée sur 390 de large : je compare les marges et les tailles.
- Code lu quand la capture ne suffit pas (lecture seule) :
  `ScreenFrame.tsx`, `RoutesScreen.tsx`, `RoutesEmpty.tsx`, `RouteItem.tsx`,
  `RoutePreview.tsx`, `Button.tsx`, `openActionMenu.ts`, `useGpxImport.tsx`,
  `fr.ts`, `theme/colors.ts`.
- Gravité :
  - **bloquant** : contredit la maquette validée ou une décision d'Émilien,
    ou gêne l'usage. À corriger dans cette phase ;
  - **mineur** : petit écart. Dans la tâche de corrections si elle passe sur
    le fichier, sinon en phase 10 (finitions) ;
  - **à noter pour plus tard** : avec la phase indiquée.

## Captures

Dossier commun : `/Users/utilisateur/dev_ai/vtt-nav-preuves/p06/t7/`.

| Captures | Maquette, état |
|---|---|
| `ios/c14/01-liste-vide.png`, `android/c14/01-liste-vide.png`, `*/c14/21-liste-vide-apres-suppression.png` | 40, état 2 |
| `*/c14/02-creation-enregistrer-inactif.png`, `*/c14/03-creation-enregistrer-actif.png` | 10 ; 40, 8b A et B |
| `*/c14/04-infos-apres-enregistrer.png`, `*/c14/11-infos-titre-nom.png`, `*/c14/14-infos-apres-modification.png` | 20 ; 40, 8a |
| `*/c14/05-liste-un-itineraire.png`, `*/c14/10-liste-renomme.png`, `*/c14/15-liste-apres-modification.png`, `*/c14/18-liste-avec-gpx.png` | 40, état 1 |
| `*/c14/07-menu.png`, `android/c16-menu-actions.png` | 40, état 3 |
| `*/c14/08-renommer.png`, `*/c14/09-renommer-nom-vide.png` | 40, état 4 et variante A |
| `*/c14/12-modifier-avant.png`, `*/c14/13-modifier-apres-glissement.png` | 40, 8b C |
| `*/c14/17-infos-gpx-importe.png` | 40, 6b |
| `*/c14/19-confirmation-suppression.png`, `*/c14/20-confirmation-suppression-2.png` | 40, état 5 |
| `*/c16/refus-fichier-vide.png`, `refus-illisible.png`, `refus-sans-trace.png`, `refus-trop-gros.png` | 40, 6a et ses quatre textes |
| `android/c16/lecture-du-fichier.png` | 40, 6a « Lecture en cours » |
| `*/c16/feuille-hors-zone-en-ligne.png`, `android/c16/feuille-hors-zone-mode-avion.png` | 40, 6c variante A |
| `*/c16/infos-gpx-hors-zone.png` | 40, 6d |
| `*/c16/liste-remplie-zone-supprimee.png` | 40, 7a |
| `*/c16/infos-zone-supprimee.png` | 40, 7b |
| `ios/controle5-feuille-de-partage.png`, `android/controle5-feuille-de-partage.png` | 40, note « Export » |

(`*` = `ios` et `android`.)

## Résumé

| Gravité | Nombre | Écarts |
|---|---|---|
| **Bloquant** | **4** | B1 à B4 |
| Mineur | 11 | M1 à M11 |
| À noter pour plus tard | 6 | N1 à N6 |

**Verdict sur C16 : pas encore tenu.** Les écrans suivent la maquette 40
dans leur contenu : textes mot pour mot, lignes de la liste, problème à la
place de l'origine, refus, feuille hors zone, zone supprimée, confirmation
de suppression. Quatre écarts gênent l'usage ou contredisent un choix
validé : le titre de la liste caché sur iOS, le bouton inactif pâli,
« Modifier » qui ne montre pas le tracé, l'ordre du menu Android.

---

## Écarts bloquants

### B1. iOS : « Importer un GPX » cache la fin du titre « MES ITINÉRAIRES »

- **Écran** : liste (états 1, 2, 3, 5, 6a, 7a). **Plateforme** : iOS.
- **Captures** : `ios/c14/01-liste-vide.png`, `05`, `07`, `10`, `15`,
  `18`, `21` ; `ios/c16/liste-remplie-zone-supprimee.png`.
- **Maquette 40** : bouton de y 51 à 99, titre à y 110 : 11 d'écart, rien
  ne se touche.
- **App** : bouton de x 204 à 385, y 70 à 116. Titre de x 17 à 246,
  y 107 à 131. Le bouton recouvre « ES » de « ITINÉRAIRES » (x 204 à 246,
  y 107 à 116). Sur Android, pas de chevauchement (bouton jusqu'à y 103,
  titre à y 107), mais 4 d'écart au lieu de 11.
- **Cause** : le bouton suit la zone sûre (`top: insets.top + 7`,
  `RoutesScreen.tsx`), le titre non (`top: 101`, `ScreenFrame.tsx`). Sur
  l'iPhone 17, la zone sûre fait 62.
- **Gravité** : bloquant. Le titre de l'onglet est coupé sur tous les
  iPhone à îlot, et l'écran a l'air cassé.
- **Correction** : dans `ScreenFrame`, titre à
  `Math.max(101, insets.top + 66)` quand l'écran a un bouton en haut à
  droite (7 + 48 du bouton, 11 d'écart comme la maquette) ; le titre reste
  au-dessus des rayures (iPhone 17 : titre de 128 à 159, rayures à 164).

### B2. « Renommer » inactif est pâli, pas en tirets

- **Écran** : feuille « Renommer », nom vide (état 4, variante A).
  **Plateformes** : les deux.
- **Captures** : `ios/c14/09-renommer-nom-vide.png` (bouton x 207 à 383,
  y 459 à 515) ; `android/c14/09-renommer-nom-vide.png` (x 212 à 392,
  y 834 à 889).
- **Maquette 40** : bouton inactif en crème clair, bord en tirets
  `hn.brun-2`, texte `hn.brun-2` (`.btn-pri.inactif`). La note le dit en
  toutes lettres : « Bouton inactif en tirets brun-2, pas en transparence :
  au soleil, un bouton pâli ne se lit plus ».
- **App** : bouton brun à 50 % d'opacité, texte crème sur fond brun-gris.
  Le contraste tombe vers 2:1. Cause : `Button.tsx`,
  `disabled: { opacity: 0.5 }`.
- **Gravité** : bloquant. Contredit un choix écrit de la maquette validée,
  et le texte ne se lit plus au soleil.
- **Correction** : dans `ui/Button`, l'état inactif devient fond
  `hn.creme-clair`, bord de 2,5 en tirets `hn.brun-2`, texte `hn.brun-2`,
  sans opacité, comme « Enregistrer » inactif de la création (déjà juste,
  `*/c14/02`). Sur Android, changer `borderStyle` à chaud ne se redessine
  pas toujours (voir M10) : donner une `key` différente aux deux états.

### B3. « Modifier » ouvre la création sur toute la zone : le tracé est invisible

- **Écran** : création en mode « Modifier » (40, 8b C ; 10).
  **Plateformes** : les deux.
- **Captures** : `ios/c14/12-modifier-avant.png`,
  `android/c14/12-modifier-avant.png`, puis `*/c14/13-modifier-apres-glissement.png`.
- **Maquette 10 et 40 (8b C)** : on rouvre l'itinéraire pour le changer.
  On doit voir son tracé et ses points, assez grands pour les toucher.
- **App** : la carte montre toute la zone Nancy (Toul, Nancy, Lunéville).
  Les 323 m de l'itinéraire tiennent sous un seul marqueur (iOS : arrivée
  vers x 75, y 384 ; Android : départ vers x 77, y 405). On ne voit ni le
  tracé ni l'autre point.
- **Gravité** : bloquant. Il faut zoomer à la main pour trouver ce qu'on
  veut modifier, avec des gants. Un petit itinéraire est introuvable.
- **Correction** : à l'ouverture en mode « Modifier », cadrer la caméra sur
  l'emprise du tracé, avec une marge de 48 et en tenant compte de la barre
  du haut et du panneau du bas, comme l'arche de l'écran Infos ; zoom au
  plus 17 pour un tout petit tracé.

### B4. Android : le menu « ⋮ » met « Supprimer » en premier

- **Écran** : menu des actions (état 3). **Plateforme** : Android.
- **Captures** : `android/c14/07-menu.png`, `android/c16-menu-actions.png`.
- **Maquette 40** : « Renommer », « Exporter en GPX », « Supprimer », dans
  cet ordre, l'action destructive en dernier.
- **App** : boîte native à trois boutons empilés : « SUPPRIMER » en haut
  (y 465), « EXPORTER EN GPX » (y 520), « RENOMMER » en bas (y 573).
  L'ordre est inversé. Android empile les boutons d'une boîte dans l'ordre
  positif, négatif, neutre : le 3e bouton passé à `Alert.alert` monte en
  haut (`openActionMenu.ts`).
- **Gravité** : bloquant. Contredit l'ordre de la maquette. L'action la plus
  fréquente est en bas, la destructive à la place où l'œil et le doigt
  arrivent d'abord. La confirmation évite la perte, mais le geste est raté.
- **Correction** : sur Android seulement, passer les boutons dans l'ordre
  « Supprimer », « Exporter en GPX », « Renommer » : la boîte les affiche
  alors « Renommer » en haut, « Supprimer » en bas. Ajouter un test sur
  l'ordre passé à `Alert.alert`. Le menu ancré viendra plus tard (N1).

---

## Écarts mineurs

### M1. Le nom et la ligne du dessous sont au-dessus de l'arche, pas dessous

- **Écran** : Infos (20 ; 40, 6b, 6d, 7b, 8a). **Plateformes** : les deux.
- **Captures** : `*/c14/04`, `11`, `14`, `17` ; `*/c16/infos-gpx-hors-zone.png`,
  `*/c16/infos-zone-supprimee.png`. iOS `04` : nom à y 127, arche de
  y 166 à 335.
- **Maquette 20 et 40** : arche à y 120, nom et sous-titre sous l'arche
  (y 292). L'écart P4 de `p05-t8.md` prévoyait de revenir à la maquette en
  phase 6.
- **App** : barre « ‹ Itinéraires » et « ⋮ », puis le nom (Jost 22), la
  ligne « Zone Nancy · créé le 4 nov. 2026 », puis l'arche.
- **Jugement** : mineur. Toutes les infos sont là, dans un ordre clair. Le
  nom en haut se lit comme le titre de la page, ce que font la plupart des
  applications. Le déplacer coûte une reprise de mise en page sans gain
  d'usage.
- **Correction** : aucune dans l'app. Je mets les maquettes 20 et 40 (6b,
  6c, 6d, 7b, 8a) à jour : nom et sous-titre au-dessus de l'arche. Le
  pilotage dit si Émilien doit revoir ce point.

### M2. La feuille « GPX hors de vos zones » s'ouvre sur la liste, pas sur l'écran Infos

- **Écran** : import hors zone (40, 6c). **Plateformes** : les deux.
- **Captures** : `ios/c16/feuille-hors-zone-en-ligne.png`,
  `android/c16/feuille-hors-zone-en-ligne.png`,
  `android/c16/feuille-hors-zone-mode-avion.png`.
- **Maquette 40, 6c** : « La feuille s'ouvre une seule fois, sur l'écran
  Infos du GPX qui vient d'être importé. »
- **App** : la feuille s'ouvre sur la liste ; derrière elle, la nouvelle
  ligne « Balade a Paris » avec « Hors de vos zones ». « Fermer » ou
  « Plus tard » ouvrent ensuite l'écran Infos (6d) ; « Voir les zones » et
  « Télécharger » ouvrent l'onglet Zones (`useGpxImport.tsx`). La réponse 5
  d'Émilien (« après un import réussi, l'écran Infos s'ouvre ») reste
  tenue.
- **Jugement** : mineur. Le parcours garde tout : la feuille une fois, puis
  l'écran Infos avec sa carte « Hors de vos zones ». La ligne visible
  derrière la feuille montre même ce qui vient d'arriver. Les textes et les
  boutons sont ceux de la variante A, mot pour mot.
- **Correction** : aucune dans l'app. Je corrige la phrase de 6c dans la
  maquette 40 : « La feuille s'ouvre une seule fois, sur la liste, juste
  après l'import. "Fermer" ou "Plus tard" ouvrent l'écran Infos du GPX
  (6d). »

### M3. Un grand soleil rayé flotte au-dessus du vététiste de la liste vide

- **Écran** : liste vide (40, état 2 ; 50). **Plateformes** : les deux.
- **Captures** : `ios/c14/01-liste-vide.png` (soleil de x 137 à 264,
  y 304 à 367) ; `android/c14/01-liste-vide.png` (y 303 à 367) ; `*/c14/21`.
- **Maquette 40, état 2, et 50** : le vététiste, son vélo, l'herbe. Pas de
  soleil : le seul soleil de l'écran est celui du bandeau.
- **App** : un demi-soleil moutarde de rayon 90 à trois rayures crème
  (`RoutesEmpty.tsx`), posé 35 au-dessus de la tête du vététiste, sans
  horizon sous lui.
- **Jugement** : mineur. Deux soleils l'un sous l'autre se répètent ; celui
  du milieu ne repose sur rien et tire l'œil loin du texte et du bouton.
- **Correction** : retirer le soleil (le `G` découpé par `sky` dans
  `RoutesEmpty.tsx`) et remonter la scène de la même hauteur, comme la
  maquette.

### M4. Le fond du médaillon est le gris de la carte, pas le sable

- **Écran** : liste (états 1, 3, 7a). **Plateformes** : les deux.
- **Captures** : `ios/c14/05-liste-un-itineraire.png` (médaillon x 25 à 89,
  y 228 à 292), `*/c14/18-liste-avec-gpx.png`,
  `*/c16/liste-remplie-zone-supprimee.png`.
- **Maquette 40** : médaillon de 64, bord brun de 3, anneau moutarde de 3,
  fond `hn.sable` (`#F7DDA6`). `tokens.md` : `hn.sable` sert au « fond des
  médaillons ».
- **App** : taille, bord et anneau moutarde justes. Le fond intérieur est
  `carte.fond` (`#EEEBE4`, gris clair), la couleur de `RoutePreview`. Le
  médaillon a l'air d'une carte vide plus que d'un badge. Les taches de
  forêt de la maquette manquent aussi (sans tuiles, c'est normal).
- **Jugement** : mineur. Le tracé se lit dans les deux cas.
- **Correction** : un paramètre `background` à `RoutePreview`, que
  `RouteItem` passe à `colors.sand` ; l'arche sans zone garde
  `carte.fond`.

### M5. « Importer un GPX » porte un « + », pas l'icône de fichier

- **Écran** : liste. **Plateformes** : les deux.
- **Captures** : `ios/c14/01-liste-vide.png` (« + » vers x 227, y 93),
  `android/c14/01-liste-vide.png`.
- **Maquette 40** : une feuille de papier au coin plié, avec un « + »
  dedans.
- **App** : un « + » seul (`PlusIcon`). Sur la liste vide, « Importer un
  GPX » et « Créer un itinéraire » ont alors la même icône pour deux gestes
  différents.
- **Jugement** : mineur. Le texte suffit, mais l'icône de fichier dit
  « fichier » avant même la lecture.
- **Correction** : une icône `ImportFileIcon` dans `ui/icons`, dessinée
  d'après la maquette (chemins `M14 3H6v18h12V7z`, `M14 3v4h4`,
  `M12 11v6M9 14h6`, trait 2,3), à la place de `PlusIcon` dans
  `RoutesScreen.tsx`.

### M6. Le message « Donnez un nom à l'itinéraire. » n'a pas son icône

- **Écran** : feuille « Renommer », nom vide. **Plateformes** : les deux.
- **Captures** : `ios/c14/09-renommer-nom-vide.png` (message à x 20,
  y 435) ; `android/c14/09-renommer-nom-vide.png` (y 809).
- **Maquette 40, variante A** : un rond `hn.danger` de 16 avec « ! »,
  devant le texte.
- **App** : texte `hn.danger` gras, juste, sans icône. Bord du champ en
  `hn.danger`, compteur « 0 / 60 » : justes.
- **Jugement** : mineur. La couleur porte seule le sens de l'erreur ;
  l'icône l'appuie pour qui voit mal le rouge.
- **Correction** : l'icône de la maquette (rond et « ! », 16, `hn.danger`)
  devant le message, écart de 5.

### M7. Les cartes « ce qui manque » n'ont pas leur icône

- **Écran** : Infos hors zone (6d) et zone supprimée (7b).
  **Plateformes** : les deux.
- **Captures** : `*/c16/infos-gpx-hors-zone.png` (iOS : carte de y 432 à
  570), `*/c16/infos-zone-supprimee.png` (iOS : y 532 à 712).
- **Maquette 40** : rond en tirets avec « ! » de 24 à gauche du texte, le
  même signe que sur la ligne de la liste.
- **App** : texte seul. Sur la liste, l'icône est là (7a, juste).
- **Jugement** : mineur. Le lien entre la ligne de la liste et la carte de
  l'écran Infos se perd.
- **Correction** : l'icône de la ligne, en 24, à gauche du texte, écart
  de 10, alignée sur la première ligne.

### M8. La carte « Hors de vos zones » ne dit pas où trouver la zone

- **Écran** : Infos d'un GPX hors zone (6d). **Plateformes** : les deux.
- **Captures** : `ios/c16/infos-gpx-hors-zone.png` (texte de y 455 à 480),
  `android/c16/infos-gpx-hors-zone.png`.
- **Maquette 40, 6d et note** : « Hors de vos zones : D+, profil, terrain
  et difficulté indisponibles. » puis « Ce tracé est dans la zone {zone}. »
  ou la phrase « aucune zone ».
- **App** : la première phrase seule (`routes.noticeOutsideText`).
- **Jugement** : mineur. La feuille l'a dit une fois ; la carte devait le
  garder à chaque ouverture.
- **Correction** : avec le catalogue en mémoire, ajouter la seconde phrase.
  Textes : « Ce tracé est dans la zone {zone}. » et « Ce tracé n'est dans
  aucune zone de RutaPulse pour l'instant. » (déjà dans `fr.ts`,
  `routes.outsideNone`). Sans catalogue, rien de plus.

### M9. « pas en service » : un mot interne dans deux textes

- **Écran** : liste et Infos d'un itinéraire dont la zone est prête mais
  pas en service (cas `notInService` de l'ADR 0019). **Plateformes** : les
  deux.
- **Captures** : aucune. Le cas demande deux zones installées ; une seule
  est publiée. Textes lus dans `fr.ts` (l. 201, 223 à 225, 241).
- **Maquette 40** : ne dessine pas ce cas ; l'ADR 0019 dit « comme
  `deleted`, autre phrase ».
- **App** : liste « Zone {zone} pas en service » ; Infos « La zone {zone}
  n'est pas en service : carte, profil, terrain et difficulté sont
  indisponibles pour l'instant. » ; boîte « Zone absente » : « La zone de
  cet itinéraire n'est pas en service : il ne peut pas être modifié. »
- **Jugement** : mineur (cas impossible aujourd'hui). Mais « en service »
  est le nom d'un objet du code. Les deux phrases ne suivent pas non plus
  le modèle de la zone supprimée (« Zone {zone} supprimée : … »).
- **Correction** : textes prêts à copier, sur le modèle de la zone
  supprimée :
  - `routes.problemNotInService` : `Zone {zone} inactive`
  - `routes.noticeNotInService` : `Zone {zone} inactive :`
  - `routes.noticeNotInServiceText` : ` carte, profil, terrain et
    difficulté indisponibles. RutaPulse n'utilise qu'une zone à la fois pour
    l'instant.`
  - `route.zoneAbsentText` : `La carte de cet itinéraire n'est pas
    disponible : il ne peut pas être modifié.`

### M10. Android : « Importer un GPX » reste en tirets après la lecture

- **Écran** : liste, pendant la feuille hors zone. **Plateforme** :
  Android.
- **Captures** : `android/c16/feuille-hors-zone-en-ligne.png`,
  `android/c16/feuille-hors-zone-mode-avion.png` (bouton x 219 à 394,
  y 56 à 103).
- **Maquette 40, 6a** : tirets et « Lecture du fichier… » pendant la
  lecture seulement ; ensuite, le bouton normal.
- **App** : le texte et l'icône sont revenus à « + Importer un GPX », mais
  le bord reste en tirets. Le bouton a l'air inactif alors qu'il marche.
  `android/c16/liste-remplie-zone-supprimee.png`, plus tard, le montre de
  nouveau plein. React Native sur Android ne redessine pas toujours un
  `borderStyle` qui change.
- **Jugement** : mineur. Visible seulement derrière le voile de la feuille.
- **Correction** : `key={busy ? 'busy' : 'idle'}` sur le `Pressable` de
  `RoutesScreen.tsx`, pour qu'Android le recrée à chaque changement.
  `android/c16/lecture-du-fichier.png` montre que l'état « lecture » est
  juste.

### M11. Android : le fichier exporté s'appelle « Itinéraire du 4 nov..gpx »

- **Écran** : feuille de partage. **Plateforme** : Android (iOS montre le
  nom sans extension).
- **Capture** : `android/controle5-feuille-de-partage.png` (nom à y 606).
- **Maquette 40, note « Export »** : `{nom}.gpx`. Le nom par défaut finit
  par le point de « nov. » : on obtient deux points.
- **Jugement** : mineur. Le fichier marche, mais le nom a l'air fautif dans
  Fichiers ou dans un e-mail.
- **Correction** : retirer un point final du nom avant d'ajouter `.gpx`
  (« Itinéraire du 4 nov.gpx »), avec un test. Je complète la note de la
  maquette 40.

---

## À noter pour plus tard

### N1. Android : boîte à trois boutons au lieu d'un menu ancré au « ⋮ »

- **Captures** : `android/c14/07-menu.png`, `android/c16-menu-actions.png`.
- **Maquette 40, état 3** : menu natif sous le « ⋮ », avec des icônes,
  « Supprimer » en rouge du système.
- **App** : boîte de dialogue centrée, en capitales, sans « Annuler » (on
  la ferme en touchant dehors ou par le retour : `cancelable: true`), sans
  rouge, avec un vide d'environ 60 dp entre le titre et les boutons. iOS :
  feuille d'actions native avec « Annuler » et « Supprimer » en rouge,
  conforme aux habitudes d'iOS.
- **Jugement** : acceptable en v1. L'ADR 0019 a choisi de ne pas ajouter de
  module ; une boîte native reste un geste connu sur Android. B4 règle
  l'ordre.
- **Plus tard** : phase 10, un menu ancré natif (`PopupMenu` d'Android),
  après un essai jetable du module.

### N2. Android : les boîtes de dialogue ont l'ancien style

- **Captures** : `android/c14/19-confirmation-suppression.png`,
  `android/c16/refus-*.png`, `android/c14/07-menu.png`.
- **Maquette 40** : boîte Material 3 (coins de 28, boutons en minuscules).
- **App** : coins carrés, boutons en capitales. Les textes sont justes,
  mot pour mot. Toute l'app est concernée, pas seulement cette phase.
- **Plus tard** : phase 10, le thème Material 3 d'Android par la
  configuration d'Expo (pas dans `mobile/android/`, qui est généré).

### N3. « Voir les zones » prend toute la largeur de la carte, sans icône

- **Captures** : `*/c16/infos-gpx-hors-zone.png`,
  `*/c16/infos-zone-supprimee.png`.
- **Maquette 40** : bouton de 48, décalé de 34 sous le texte, avec la
  flèche de téléchargement.
- **Jugement** : je garde l'app. Le bouton de 56 sur toute la largeur se
  touche mieux avec des gants. L'icône manque ; elle pourrait revenir avec
  M7.
- **Plus tard** : je mets la maquette 40 à jour. Icône en phase 10.

### N4. La croix du champ « Renommer » est un trait seul

- **Captures** : `*/c14/08-renommer.png`.
- **Maquette 40** : rond plein `hn.brun-2` de 22 avec une croix crème.
- **App** : croix brune de 24, cible de 48. Bien lisible.
- **Plus tard** : phase 10, ou rien. Les deux se comprennent.

### N5. Les boutons inactifs du panneau de création sont pâlis eux aussi

- **Captures** : `*/c14/02-creation-enregistrer-inactif.png`,
  `*/c14/12-modifier-avant.png` (« Annuler », « Supprimer » en bas).
- **Règle** : la même que B2 (tirets, pas de transparence).
- **Plus tard** : si ces boutons passent par `ui/Button`, B2 les corrige
  aussi ; sinon, phase 10. Ce composant vient de la phase 5.

### N6. Sans fond de carte, un bout de tracé peut toucher la courbe de l'arche

- **Capture** : `ios/c16/infos-zone-supprimee.png` : départ vers x 63,
  y 234, tout contre le bord arrondi en haut à gauche.
- **App** : `RoutePreview` garde une marge droite de 24, mais l'arche coupe
  les coins du haut.
- **Plus tard** : phase 10, une marge plus grande en haut (environ 40)
  quand l'aperçu est dans l'arche.

---

## Ce qui est conforme

- **« Enregistrer »** (`*/c14/02`, `03`, `12`, `13`) : inactif en tirets
  `hn.brun-2` sur crème clair, actif en moutarde bord brun, 48 de haut.
  Titre « Nouvel itinéraire », puis le nom en mode « Modifier » (« Boucle
  de Haye »). Inactif tant que rien n'a changé.
- **Infos après « Enregistrer »** (`*/c14/04`) : titre « Itinéraire du
  4 nov. », ligne « Zone Nancy · créé le 4 nov. 2026 », « ‹ Itinéraires » et
  « ⋮ » en haut, « Modifier » en bas. Pas de message en plus. Après
  modification : « modifié le 4 nov. ».
- **GPX importé** (`*/c14/17`) : nom lu dans le fichier, « Zone Nancy · GPX
  importé le 4 nov. 2026 », pas de « Modifier ».
- **Liste** (`*/c14/05`, `15`, `18`) : lignes de 94 (maquette 96), marges
  de 12, écart de 10, nom en 17 graisse 600, distance en gras, ligne
  « Zone Nancy · créé le 4 nov. » en 13 `hn.brun-2`, « ⋮ » de 48. Le plus
  récent en haut. « Itinéraire du 4 nov. (2) » pour le deuxième du jour
  (réponse 2 d'Émilien).
- **Lignes à problème** (`*/c16/liste-remplie-zone-supprimee.png`) :
  « Hors de vos zones » et « Zone Vosges supprimée » en brun gras avec le
  rond en tirets ; « D+ — » quand le D+ manque.
- **Renommer** (`*/c14/08`, `09`) : feuille posée sur le clavier (iOS),
  titre, étiquette, compteur « 20 / 60 », nom tout sélectionné (Android
  `08`, surligné), boutons de 56 « Annuler » et « Renommer ».
- **Suppression** (`*/c14/19`, `20`) : textes mot pour mot ; sur iOS,
  « Supprimer » en rouge du système.
- **Refus** (`*/c16/refus-*.png`) : « Import impossible », un bouton « OK »,
  les quatre phrases mot pour mot ; « 22 Mo » arrondi.
- **Lecture en cours** (`android/c16/lecture-du-fichier.png`) : bord en
  tirets `hn.brun-2`, icône de lecture, « Lecture du fichier… ».
- **Feuille hors zone, variante A** : illustration de l'écran 52, titre et
  texte mot pour mot, un seul bouton « Fermer ». En mode avion, Android
  montre aussi la variante A : le catalogue est en mémoire, la phrase
  « aucune zone » est donc juste.
- **Infos zone supprimée** (`*/c16/infos-zone-supprimee.png`) : tracé seul
  sur `carte.fond`, chiffres gardés, « Chiffres du dernier calcul, le
  4 nov. », texte de la carte mot pour mot, « Modifier » caché.
- **Infos hors zone** : distance et durée seules, carte moutarde pâle, texte
  brun (9,9:1).
- **Partage** : feuille du système, sans texte à nous.
- **Écarts anciens réglés** : `p05-t8.md` P6 (« PROFIL ET TERRAIN » en 16,
  brun) et C7 (échelle du profil : un tracé presque plat reste bas, `04`).
  P5 (« Modifier » sur toute la largeur) reste accepté jusqu'à la phase 8.

## Pas vu en capture

- iOS, « Lecture du fichier… » : `ios/c16/lecture-du-fichier.png` montre la
  liste sans l'état de lecture. Même composant que sur Android.
- Feuille hors zone avec « Télécharger {zone} · {taille} » (variante 6c
  principale) et variante B « sans réseau » : une seule zone est publiée,
  et le catalogue était en mémoire.
- Renommer à 60 caractères (variante B), « Abandonner les changements ? »
  (8b D), cas `leaves` (tracé qui sort de la zone), cas `notInService`.
- Android, clavier de la feuille « Renommer » : absent des captures
  (réglage de l'émulateur). Sur iOS, la feuille est bien posée sur le
  clavier.

## Les écarts bloquants, en bref

1. **B1** (iOS) : « Importer un GPX » cache la fin du titre. Titre à
   `Math.max(101, insets.top + 66)` dans `ScreenFrame`.
2. **B2** (les deux) : « Renommer » inactif pâli. État inactif de
   `ui/Button` en tirets `hn.brun-2` sur crème clair, sans opacité.
3. **B3** (les deux) : « Modifier » ne montre pas le tracé. Cadrer la
   caméra sur l'emprise du tracé à l'ouverture.
4. **B4** (Android) : menu « ⋮ » à l'envers. Passer les boutons dans
   l'ordre inverse à `Alert.alert` sur Android.

## Questions pour le Product Owner

Aucune. Tous les écarts relèvent du design. Deux corrections portent sur la
maquette 40, pas sur l'app (M1 : nom au-dessus de l'arche ; M2 : feuille
hors zone sur la liste). Elles ne changent pas ce que fait l'app ; le
pilotage dit si Émilien doit les revoir avant la fusion.

---

## Vérification des corrections (9 novembre 2026)

> Designer. Captures release (version finale) de 9ffb1d4, iPhone 17 (iOS
> 26.5) et Pixel 6 (Android 14), prises après les corrections. Dossier :
> `/Users/utilisateur/dev_ai/vtt-nav-preuves/p06/t8-verif/` (noté `v/`
> ci-dessous). Parcours Maestro p06-itineraires rejoué sans échec sur les
> deux (`v/android/c14-maestro.log`, `v/ios/c14-maestro.log`).
> B3 : capture Android release de la correction dans
> `/Users/utilisateur/dev_ai/vtt-nav-preuves/p06/b3/` (noté `b3/`).
> Mesures comme plus haut (points iOS, dp Android).

### Bilan

| Écart | Gravité | État | Capture |
|---|---|---|---|
| B1 | bloquant | **corrigé** | `v/ios/shots/B1-M4-M5-liste-remplie.png`, `v/android/shots/B1-M4-M5-liste-remplie.png` |
| B2 | bloquant | **corrigé** | `v/ios/shots/B2-2-nom-vide-M6.png`, `v/android/shots/B2-4-nom-vide-redessin.png`, `v/android/shots/B2-3-nom-rempli-actif.png` |
| B3 | bloquant | **corrigé sur Android ; à voir sur iOS** | `b3/B3-court-modifier.png` ; avant correction : `v/ios/shots/B3-modifier-long-49km.png`, `v/ios/shots/B3-modifier-petit.png`, `v/android/shots/B3-modifier-petit-564m.png`, `v/android/shots/B3-modifier-long-49km.png` |
| B4 | bloquant | **corrigé** | `v/android/shots/B4-menu.png` |
| M1 | mineur | **réglé par la maquette 40** (l'app fait foi) | `v/ios/shots/infos-petit.png`, `v/android/shots/infos-long.png` |
| M2 | mineur | **réglé par la maquette 40** (l'app fait foi) | `v/ios/shots/M10-feuille-hors-zone.png`, `v/android/shots/M10-feuille-hors-zone-bouton-normal.png` |
| M3 | mineur | **corrigé** | `v/ios/shots/M3-M5-liste-vide.png`, `v/android/shots/M3-M5-liste-vide.png` |
| M4 | mineur | **corrigé** | `v/ios/shots/B1-M4-M5-liste-remplie.png`, `v/android/shots/B1-M4-M5-liste-remplie.png` |
| M5 | mineur | **corrigé** | mêmes captures, et `*/shots/M3-M5-liste-vide.png` |
| M6 | mineur | **corrigé** | `v/ios/shots/B2-2-nom-vide-M6.png`, `v/android/shots/B2-4-nom-vide-redessin.png` |
| M7 | mineur | **corrigé** | `v/ios/shots/M7-M8-infos-gpx-hors-zone.png`, `v/android/shots/M7-M8-infos-gpx-hors-zone.png` |
| M8 | mineur | **corrigé pour la phrase « aucune zone »** ; phrase « dans la zone {zone} » pas vue | mêmes captures |
| M9 | mineur | **textes corrigés, pas vus à l'écran** | aucune (lu dans `fr.ts`) |
| M10 | mineur | **corrigé** | `v/android/shots/M10-feuille-hors-zone-bouton-normal.png` |
| M11 | mineur | **corrigé** | `v/android/shots/M11-feuille-de-partage-nom-finissant-par-point.png` |
| N1 à N6 | à noter | inchangés, comme prévu | — |
| N7 | à noter | **nouveau** | `v/android/shots/B2-3-nom-rempli-actif.png` |

**Écarts restants** : aucun bloquant sur Android. Un bloquant à confirmer
sur iOS (B3). Aucun mineur ouvert dans l'app ; M8 et M9 restent à voir à
l'écran quand une deuxième zone sera publiée. Une note nouvelle (N7).

**Verdict sur C16 : tenu sur Android ; tenu sur iOS dès qu'une capture
release montre B3 corrigé.** La correction de B3 est dans le code commun
(`DraftScreen`, `ZoneBaseMap`), mais il faut la preuve sur iOS : MapLibre
y charge la carte par un autre chemin.

### Détail

**B1, corrigé.** iOS : bouton de x 202 à 386, y 70 à 116 ; lettres du
titre (accent compris) de y 131 à 158 : 15 d'écart, rien ne se touche.
Android : bouton y 56 à 103, lettres du titre y 121 à 145 : 18 d'écart.
Le titre reste au-dessus des rayures sur les deux.

**B2, corrigé.** « Renommer » inactif : fond crème clair, bord en tirets
`hn.brun-2`, texte `hn.brun-2`, sans transparence, sur les deux. iOS :
x 208 à 383, y 460 à 515. Android : x 212 à 392, y 498 à 553. Le passage
inactif → actif → inactif se redessine bien sur Android (`B2-3`, bouton
brun plein ; `B2-4`, de nouveau en tirets).

**B3, corrigé sur Android, à voir sur iOS.** `b3/B3-court-modifier.png`
(Android, release, itinéraire de 564 m) : la création s'ouvre sur le
tracé, pas sur toute la zone. Départ à x 48, y 172 (48 du bord gauche,
58 sous la barre) ; point le plus à droite à x 368 (43 du bord) ; point
le plus bas à y 587, 78 au-dessus du panneau. Les deux points et tout le
tracé se voient et se touchent ; le bouton « position » (x 347 à 395,
y 178 à 225) ne couvre rien. Les captures `v/*/shots/B3-*` sont d'avant la
correction (toute la zone Nancy). Reste à prouver : iOS, et un long tracé
(49 km) sur les deux.

**B4, corrigé.** Android : « RENOMMER » (y 466), « EXPORTER EN GPX »
(y 520), « SUPPRIMER » (y 574), dans l'ordre de la maquette. iOS reste
juste (`v/ios/shots/menu.png` : Renommer, Exporter en GPX, Supprimer en
rouge, Annuler).

**M1 et M2, réglés par la maquette.** Décision du pilotage : on garde
l'app. La maquette 40 est mise à jour (voir plus bas). La maquette 20
montre encore le nom sous l'arche (`.arche` à 120, `.contenu` à 292) :
elle n'est pas changée ici. Elle décrit l'écran Infos de la phase 5 ; à
mettre d'accord avec la 40 si le pilotage le demande.

**M3, corrigé.** Plus de soleil au-dessus du vététiste, sur les deux. La
scène est remontée. Le vététiste est environ 1,4 fois plus grand qu'avant
(herbe de 184 de large en T7, 254 maintenant sur iOS, 256 sur Android).
**Ce n'est pas un écart** : la maquette 40 (état 2) dessine une herbe de
262 de large. L'ancienne scène était trop petite ; la nouvelle est à la
taille de la maquette, à 8 près. Le bloc « scène, titre, texte, bouton »
est 16 à 44 plus haut que dans la maquette (titre à y 397 contre 430,
bouton à y 526 contre 570) : il y a plus de vide en bas, rien ne gêne.
Rien à corriger.

**M4, corrigé.** Fond des médaillons en `hn.sable` sur les deux. Anneau
moutarde et bord brun justes.

**M5, corrigé.** « Importer un GPX » porte l'icône de fichier au coin plié
avec « + », sur les deux. Sur la liste vide, elle se distingue du « + »
de « Créer un itinéraire ».

**M6, corrigé.** Rond `hn.danger` avec « ! » devant « Donnez un nom à
l'itinéraire. », sur les deux (iOS x 19 à 35, y 435 ; Android x 19 à 35,
y 474).

**M7, corrigé.** Rond en tirets avec « ! » à gauche du texte de la carte
« Hors de vos zones », aligné sur la première ligne, sur les deux.

**M8, corrigé en partie vue.** La carte dit « Hors de vos zones : D+,
profil, terrain et difficulté indisponibles. Ce tracé n'est dans aucune
zone de RutaPulse pour l'instant. » sur les deux. La phrase « Ce tracé est
dans la zone {zone}. » est dans `fr.ts` (`routes.noticeOutsideFound`)
mais n'est pas vue : une seule zone est publiée. À voir avec la deuxième
zone ; pas un blocage.

**M9, textes corrigés, pas vus.** `fr.ts` porte les textes demandés :
`routes.problemNotInService` « Zone {zone} inactive »,
`routes.noticeNotInService` « Zone {zone} inactive : »,
`routes.noticeNotInServiceText` et `route.zoneAbsentText`, mot pour mot.
Le cas ne se simule pas avec une seule zone publiée.

**M10, corrigé.** Android : derrière la feuille hors zone, « Importer un
GPX » a de nouveau un bord plein (x 217 à 395, y 56 à 103).

**M11, corrigé.** Android : « Balade du 4 nov.gpx » (y 606), un seul
point.

### Nouvel écart

#### N7. Android : un fond gris carré reste sur la ligne touchée

- **Capture** : `v/android/shots/B2-3-nom-rempli-actif.png` : sur la ligne
  « Itinéraire du 4 nov. », derrière le voile, un rectangle plus clair à
  angles droits, de x 36 à 347, y 219 à 301, à l'intérieur de la carte
  arrondie. Absent de `B2-4` et de `B4-menu`, prises juste après ou avant.
- **Lecture** : l'effet d'appui d'Android (ripple, l'onde qui suit le
  doigt) finit de s'effacer ; il est carré et ne suit pas les coins de 24
  de la ligne.
- **Gravité** : à noter pour plus tard (phase 10). Vu une seule fois,
  derrière le voile, pendant moins d'une seconde.
- **Correction** : couper l'effet d'appui aux coins de la ligne
  (`borderRadius: 24` et `overflow: 'hidden'` sur le conteneur de la
  ligne, ou `android_ripple` avec `foreground` sur le `Pressable` de la
  carte entière).

### Ce qui reste comme prévu

- **N1** (Android : boîte à trois boutons) et **N2** (ancien style des
  boîtes Android) : `v/android/shots/B4-menu.png`. Phase 10.
- **N3** (« Voir les zones » pleine largeur, sans icône) : je garde
  l'app. La maquette 40 dessine encore le bouton étroit avec la flèche :
  sa mise à jour n'est pas faite dans ce passage (le pilotage n'a demandé
  que M1 et M2). À faire avec la prochaine reprise de la maquette 40.
- **N5** (boutons inactifs pâlis dans le panneau de création) : toujours
  pâlis, `« Annuler »` et `« Supprimer »` dans `b3/B3-court-modifier.png`.
  Ces boutons ne passent pas par `ui/Button`. Phase 10.
- **N4, N6** : inchangés.
- La note « Export » de la maquette 40 ne dit pas encore qu'un point
  final du nom est retiré avant `.gpx` (M11). Même reprise que N3.

### Mise à jour de la maquette 40 (M1, M2)

Fichier : `design/v1/40-mes-itineraires.html`. Note en tête du fichier :
« Mis à jour en T8 de la phase 6, l'app fait foi ».

- **M1**, écrans 6b, 6d, 7b, 8a : le nom (22) et la ligne du dessous (15)
  sont dans un bloc `.i-tete` à y 106, juste sous la barre
  « ‹ Itinéraires ». L'arche descend de y 120 à y 174. Le contenu
  commence à y 338 : les cases de chiffres restent à y 350, comme avant,
  et « Modifier » (8a) reste à y 744. Les noms trop longs se coupent par
  « … ».
- **M2**, écran 6c : la feuille s'ouvre sur la liste (bandeau, « Importer
  un GPX » au bord plein, titre, le nouveau GPX en haut avec « Hors de vos
  zones », puis l'itinéraire précédent), sous un voile brun. La phrase du
  cartouche dit : « La feuille s'ouvre une seule fois, sur la liste, juste
  après l'import […]. "Fermer" ou "Plus tard" ouvrent ensuite l'écran
  Infos du GPX (6d). » Le texte sous les variantes et le cartouche 6d le
  redisent ; « Voir les zones » et « Télécharger » ouvrent l'onglet Zones.
- Note de la maquette, « Choix, en une ligne » : les deux choix sont
  ajoutés, avec leur raison.
- La capture pleine page `design/v1/captures/40-mes-itineraires.png` n'est
  **pas** refaite : je n'ai pas d'accès au terminal dans ce passage. À
  refaire par la session de phase.
