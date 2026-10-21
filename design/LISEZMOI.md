# Design de RutaPulse : maquettes de la v1

> 21 octobre 2026. Les deux directions sont validées par Émilien
> (`docs/06-decisions-design.md`) : **direction B** pour la navigation,
> **style années 70** (style 3) pour tout le reste. Les maquettes de
> référence pour le développement sont celles du tableau « Les écrans de la
> v1 » ci-dessous. Les points marqués « à valider » attendent encore Émilien.

## Comment regarder

- Chaque maquette est un fichier HTML autonome (sans police, image ni lien
  en ligne), au format d'un téléphone : 390 × 844 points. Il s'ouvre dans un
  navigateur, même hors ligne.
- Captures PNG : `design/captures/` pour les écrans de navigation,
  `design/v1/captures/` pour les écrans hors navigation, au même nom que le
  fichier HTML.
- Les valeurs (couleurs, tailles, bords, polices, personnage, icône) sont
  dans [`tokens.md`](tokens.md). Les HTML les recopient ; en cas d'écart,
  `tokens.md` fait foi.
- La carte des maquettes est un dessin simplifié en SVG (format d'image
  vectorielle), qui reprend les couleurs du style de l'essai 3. Ce n'est pas
  la vraie carte.
- Les titres et boutons utilisent Futura dans les maquettes (présente sur
  iOS et macOS) ; l'app utilisera Jost, sa proche libre, embarquée. Sur un
  autre système, le navigateur prend une police de secours : les captures
  doivent se faire sur un Mac.
- Une seule version neutre par écran ; chaque plateforme utilise ensuite ses
  composants natifs (tableau « Conventions » plus bas).

## Les écrans de la v1

| Fichier | Écran | Fonction du cadrage, décision |
|---|---|---|
| `v1/10-creation-itineraire.html` | Création : on glisse un point, l'itinéraire se recalcule pendant le geste ; circuits affichés ; bouton « Boucler » | 2, 9 ; décision 6 |
| `v1/11-creation-trace-a-la-main.html` | Création : deux tronçons tracés à la main, en tirets | 2 ; décision 8 |
| `v1/12-circuit-balise.html` | Carte : un circuit balisé touché, son sens, le départ au point le plus proche, « En faire un itinéraire » | 9 ; décision 7 |
| `v1/20-infos-itineraire.html` | Infos : distance, durée, D+ et D−, profil, terrain, difficulté, carte en arche | 3 ; décision 13 |
| `30-suivi-velo.html` | Suivi, direction B : direction à 50 m, panneau jaune | 7 |
| `31-verrouille-android.html` | Téléphone verrouillé, Android : la notification unique | 8 |
| `32-verrouille-ios.html` | Téléphone verrouillé, iOS : la Live Activity (bandeau en direct) | 8 |
| `v1/40-mes-itineraires.html` | Mes itinéraires, menu natif d'une ligne ouvert, import GPX | 4, 5 |
| `v1/41-zones.html` | Zones : prête, en attente du Wi-Fi, à télécharger ; bandeau « Pas de Wi-Fi » avec l'interrupteur « Wi-Fi seulement » ; « Demander une zone » | 6 ; décision 10 |
| `v1/50-liste-vide.html` | Mes itinéraires vide, avec le vététiste | 4 ; décision 3 |
| `v1/51-telechargement.html` | Onglet Carte pendant le téléchargement de la première zone : le vététiste roule sur la barre de progression | 6 ; décision 3 |
| `v1/52-erreur.html` | Création : point touché hors de la zone, calcul impossible, trois sorties | 2, 6 ; décisions 3, 10 |
| `v1/60-arrivee.html` | Arrivée : résumé (distance, D+, durée), suivi arrêté, podium fixe | décisions 4, 5 (questions) |
| `v1/70-icone.html` | Icône : trois propositions, iOS, Android adaptative, 48 points | décision 5 (style) |

Pas dessinés, car ils découlent des écrans ci-dessus : la carte d'accueil
(l'écran 12 sans la feuille, avec un bouton « Nouvel itinéraire ») ; la
carte vide au tout premier lancement (l'écran 51 sans barre, avec
« Choisir une zone ») ; le menu des couches ; les boîtes de confirmation ; la
saisie du nom ; les demandes de permission du système ; le message d'un GPX
importé hors des zones (décision 11 : même feuille que l'écran 52, avec
« Télécharger la zone » ou « Demander une zone »).

### Historique (ne plus s'en servir pour développer)

- `01-direction-a-sobre.html`, `02-direction-b-contraste.html` : les deux
  directions comparées sur le suivi. B est retenue ; `30` en est la version
  complète.
- `10`, `11`, `12`, `20`, `40`, `41` à la racine de `design/` : premières
  versions, en direction B. **Remplacées par `v1/`.**
- `styles/` : les cinq styles essayés pour les écrans hors navigation. Le
  style 3 est retenu ; seuls ses jetons restent dans `tokens.md`.

## Les choix importants

### Style années 70 (hors navigation)

- **Chiffres en police du système, titres en Jost** : décision 2 (chiffres sobres) ; Futura et Jost ont un petit œil et des chiffres qui changent de largeur ; et les chiffres de la création sont ainsi ceux du suivi.
- **Jost réservé aux textes courts et grands (titres, boutons d'action)** : c'est la voix de l'affiche ; en petit, la police du système se lit mieux.
- **Un bord brun de 2,5 sur tout élément** : au soleil, un bord se voit, une ombre non.
- **Trois rayures moutarde, orange, rouille sous la barre du haut et au-dessus des onglets** : la signature du style, toujours au même endroit, jamais sur une information.
- **Carte, tracés et marqueurs identiques à ceux du suivi** : une seule légende à apprendre ; seuls la barre du haut, les boutons posés sur la carte et les feuilles du bas prennent le style.
- **Pas de texte en magenta ni en orange** : 4,7:1 et 4,4:1 sur le crème ; un petit trait magenta à côté d'un texte brun fait le lien avec la carte.
- **Rouge de suppression foncé (`#8A1C12`) et vert « prête » foncé (`#0F5223`)** : les couleurs d'origine n'atteignaient pas 7:1 sur le crème.
- **Menus et boîtes de dialogue natifs, non décorés** : sur iOS, le menu natif ne se décore pas, et chacun garde les gestes de sa plateforme.

### Création, circuit, infos

- **Outils sur trois cases égales, icône au-dessus du libellé (Annuler, Boucler, Supprimer)** : trois libellés tiennent sur la largeur en 15 points, et chaque case garde 56 de haut.
- **« Boucler » ajoute le départ comme dernier point** : décision 6, en un geste, au même endroit qu'« Annuler » ; grisé quand l'itinéraire finit déjà au départ, car il n'aurait rien à faire.
- **Circuit : chevrons blancs pour le sens, départ prévu affiché au point le plus proche** : décision 7, visible avant de toucher le bouton.
- **Attribution de la carte complète, avec l'IGN ; en version courte avec un bouton « i » sur les petites cartes** : décision 13 et licences ; convention de MapLibre.
- **Recalcul pendant le geste, point glissé au-dessus du doigt, tracé à la main par touches, sélecteur à deux segments, création en plein écran** : choix de la première version, inchangés.

### Listes, zones

- **Interrupteur « Télécharger en Wi-Fi seulement » dans le bandeau « Pas de Wi-Fi » lui-même** : c'est le raccourci de la décision 10, en un geste, sans changer d'écran.
- **Téléchargement commencé en Wi-Fi puis Wi-Fi perdu : « En attente du Wi-Fi », pas une erreur** : il reprend seul, l'utilisateur n'a rien à faire.
- **Pas de vignette pour les zones** : un dessin générique n'apprend rien, et la place sert au nom et au bouton « Télécharger ».
- **« Ma zone n'est pas là : la demander » en fin de liste, en cadre pointillé** : décision 10 ; le pointillé dit « une place vide à remplir ».
- **Vignettes d'itinéraires en médaillon rond, dessinées depuis le tracé** : reprises du style 3.

### Le vététiste et les états vides

- **Un pantin articulé (hanche, épaule, coude, genou, cou), pas un dessin figé** : chaque pose est une liste d'angles ; la V2 anime les mêmes groupes, sans rien redessiner.
- **Dessin en aplats, sans contour ni texte** : style affiche, et rien à traduire.
- **Un vététiste générique, casqué, de profil** : le casque et le profil évitent de lui donner un visage précis ; tout le monde peut s'y reconnaître.
- **La barre de progression est le chemin sur lequel il roule (51)** : on lit l'avancement d'un coup d'œil, et en v1 il suffit de décaler le dessin.
- **L'erreur hors zone propose trois sorties : télécharger la zone, relier à la main, retirer le point** : le tracé à la main ne demande pas de calcul, donc on n'est jamais bloqué.
- **L'arrivée montre la dernière image de l'animation V2 (podium, trophée, boue)** : la V2 n'aura qu'à animer jusqu'à cette pose.
- **Arrivée lue sur le guidon : chiffres de 36, bouton « Fermer » de 64** : on est encore sur le vélo, souvent avec des gants.
- **« Le suivi est arrêté. » écrit sous le résumé** : on sait que le GPS est coupé (décision 5).

### Suivi sur le vélo (direction B, inchangé)

- **Distance en 72 points, unité en 40** : « 1,2 km » tient sur une ligne à côté de la flèche.
- **Panneau jaune sous 100 m** : le changement se voit du coin de l'œil, sans lire.
- **Carte orientée dans le sens de la marche, zoom automatique à l'approche d'une direction ; boussole pour remettre le nord en haut** : gauche et droite se lisent directement, sans pincer l'écran avec des gants.
- **Deux boutons seulement, de 64 points (boussole, Terminer), « Terminer » confirmé** : moins de touches par erreur.
- **En suivi, relief et courbes à 50 %, sentiers plus épais, partie roulée en gris** : à une fourche, c'est le sentier qu'on cherche.
- **Distance restante et D+ restant ; écart à l'itinéraire affiché en distance, sans alerte** : décisions 3 et 4.

### Général

- **Thème clair seulement, forcé** : meilleur au soleil (décision 12), et un téléphone en mode sombre n'affichera pas une app à moitié sombre.

## Cohérence avec les écrans de navigation

Le passage se fait par « Démarrer le suivi » (écran 20) : on quitte le crème
et le brun pour le blanc, le noir et le jaune du suivi.

**Ce qui relie déjà les deux** (fait dans `v1/`, sans toucher à B) :
- la même carte, les mêmes tracés, les mêmes marqueurs, la même position ;
- les mêmes chiffres, en police du système, gras et tabulaires ;
- les mêmes formes : bords épais, boutons en pilule (rayon = demi-hauteur) ;
- le bouton « Démarrer le suivi » porte un disque moutarde : la couleur
  chaude la plus proche du jaune du panneau de guidage.

**Ce qui change, et c'est voulu** : on prépare au chaud, on roule au
contraste maximal. Le crème reflète un peu plus le ciel que le blanc ; le
suivi garde le blanc pur.

**Jugement** : le changement de fond se remarque, mais il ne choque pas,
car rien de ce qu'on regarde (carte, tracé, chiffres) ne change. À confirmer
sur les captures, côte à côte : `v1/20` puis `30`.

### Ajustements proposés pour la direction B (non appliqués, à valider)

Les fichiers 30 à 32 n'ont pas été modifiés.

1. **Rouge de « Terminer » : `#B3261E` → `#8A1C12`** (rouge du style 70).
   Contraste de 6,5:1 à 9,3:1 sur blanc : B passe enfin la règle des 7:1,
   et le rouge est le même dans toute l'app. Le bouton reste reconnaissable
   comme rouge. Je le recommande.
2. **Icône de l'app dans la notification (31) et la Live Activity (32)** :
   remplacer la pastille magenta provisoire par l'icône choisie (planche 70),
   et prendre `hn.rouille` comme couleur d'accent de la notification Android.
   À faire de toute façon dès que l'icône est choisie.
3. **Facultatif : les trois rayures (6 points au lieu de 9) en haut du
   panneau « Reste »**, à la place du filet noir de 3. Elles rappellent les
   écrans de préparation, loin du panneau de guidage pour ne pas brouiller
   son passage au jaune. À juger sur une capture : si elles attirent l'œil en
   roulant, on n'y touche pas. Je ne propose **rien** dans le panneau de
   guidage ni sur la carte du suivi.

Je déconseille de passer le fond du suivi au crème, ou le jaune du panneau
au moutarde : ils perdraient en lumière au soleil (le moutarde n'a que 9,3:1
avec le noir, contre 13,2:1 pour le jaune).

## Conventions des plateformes

| Élément | Android | iOS |
|---|---|---|
| Onglets | Barre de navigation Material 3 (système de design de Google), pastille sous l'icône active | Tab bar (barre d'onglets) |
| Retour | Flèche dans la barre du haut, geste ou bouton retour du système | « ‹ Itinéraires », glisser depuis le bord gauche |
| Actions d'une ligne | Icône ⋮ puis menu déroulant | Icône ••• ou appui long, menu contextuel ; glisser à gauche pour supprimer |
| Feuille du bas | Feuille modale Material | Feuille avec poignée et hauteurs fixes (« detents ») |
| Sélecteur à deux segments | Segmented buttons (boutons à segments) | Segmented control (même chose) |
| Interrupteur | Switch Material 3 | UISwitch ; couleur d'activation `hn.brun` |
| Barre de progression | Indicateur linéaire, dessiné à notre style | UIProgressView, dessinée à notre style |
| Confirmer « Terminer », « Supprimer » | Boîte de dialogue Material | Alerte du système |
| Exporter un GPX | Feuille de partage Android | Feuille de partage iOS |
| Importer un GPX | Sélecteur de fichiers du système | Sélecteur de fichiers du système |
| Téléphone verrouillé | Notification du service de premier plan | Live Activity |
| Icône de l'app | Icône adaptative : fond + dessin (108 dp), couche monochrome (Android 13) | Carré de 1024 px ; variantes sombre et teintée d'iOS 18 à prévoir |

## À vérifier par le développement (faisabilité, pas produit)

Nouveau avec `v1/` :
- **Jost** : embarquer la graisse 700 avec `expo-font`, vérifier les accents
  (É, è, ç, ô) et le rendu identique sur les deux plateformes.
- **Vététiste animable** : `react-native-svg` + `react-native-reanimated`,
  rotation d'un `<G>` autour d'une articulation (`transform` animé, ou
  `rotation` + `origin`). À éprouver sur Android avant la V2, sur l'écran 51
  (jambes et roues qui tournent).
- **Pas de Wi-Fi** : savoir si le téléphone est en Wi-Fi (`expo-network` ou
  `@react-native-community/netinfo`), mettre en pause et reprendre un
  téléchargement de 100 Mo sans tout recommencer.
- **Téléchargement en arrière-plan** : continue-t-il si l'on quitte l'app,
  ou si l'écran s'éteint ? Le texte de l'écran 51 en dépend.
- **Bord de la zone sur la carte** (52) : couche MapLibre tirée des limites
  du fichier de description de la zone ; voile gris au-delà.
- **Fenêtre en arche** (20) : grand rayon d'angle en haut et anneaux en vues
  imbriquées ; vérifier que la carte MapLibre se découpe bien dans
  l'arrondi (`overflow: hidden`) sur Android.
- **Icône** : couches de l'icône adaptative et couche monochrome dans
  `app.json` (`android.adaptiveIcon`), variantes iOS 18.

Toujours ouverts (première version) :
- `expo-location/next` : la notification de service accepte-t-elle un titre
  **et** un texte, et notre icône ?
- Android 14 : une notification de service balayée doit revenir à la mise à
  jour suivante, sans arrêter le suivi.
- Live Activity (`expo-widgets`) : fond blanc, flèche en symbole SF,
  fréquence de mise à jour permise.
- MapLibre : glisser un point dessiné au-dessus du doigt, glisser le tracé
  pour insérer un point ; zoom jusqu'au niveau 18 en agrandissant les tuiles
  du zoom 14 (décision 8).
- MapLibre : caméra qui suit le cap, zoom automatique, style de suivi par
  changement de propriétés des couches.
- Altitude d'un tronçon tracé à la main : sinon, l'afficher « inconnu ».
- Fonction 9 : remettre les voies d'un circuit dans l'ordre avant le calcul.
- Écran de suivi : `maxFontSizeMultiplier` à 1,2.
- Thème clair forcé : `userInterfaceStyle: "light"`.

## Questions pour Émilien (je ne les tranche pas)

1. **Icône** : laquelle des trois (planche 70) ? Ma préférence va à C, la
   roue-soleil, la plus reconnaissable en petit.
2. **Résumé de l'arrivée** : la distance et le D+ sont-ils ceux de
   l'itinéraire prévu, ou ceux réellement roulés (la v1 n'enregistre pas la
   trace) ? La durée compte-t-elle les pauses, du « Démarrer » à l'arrivée ?
3. **Arrivée détectée trop tôt** : sur une boucle, on repasse près du départ
   au début ou au milieu. Faut-il un bouton « Continuer le suivi » sur
   l'écran d'arrivée, au cas où ?
4. **Titre de l'arrivée** : « ARRIVÉE ! » (le nom, comme une banderole, qui
   va à tout le monde) au lieu de « Arrivé ». D'accord ?
5. **Demander une zone** : par quel moyen la demande t'arrive-t-elle
   (courriel prérempli, message, formulaire) ? Et que promet l'app à la
   personne (un délai, rien) ?
6. **Où vivent les réglages** (Wi-Fi seulement, luminosité au maximum de la
   décision 2) ? Il n'y a pas d'écran Réglages dans les trois onglets. Faut-il
   un quatrième onglet, une entrée dans l'onglet Zones, ou ailleurs ?
7. **Ajustements de B** (section « Cohérence ») : acceptes-tu le rouge
   foncé pour « Terminer » ? Veux-tu essayer les rayures sur le panneau
   « Reste » ?

## Hors périmètre, volontairement absent

Guidage par la voix et économiseur d'écran (V2) ; animation de l'arrivée
(V2) ; mode sombre (V2, à reconsidérer) ; alerte d'écart, boucle
automatique, enregistrement des sorties (plus tard). Aucun de ces éléments
n'apparaît dans les maquettes.
