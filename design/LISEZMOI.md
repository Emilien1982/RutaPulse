# Design de RutaPulse : maquettes de la v1

> 21 octobre 2026. Les deux directions sont validées par Émilien
> (`docs/06-decisions-design.md`) : **direction B** pour la navigation,
> **style années 70** (style 3) pour tout le reste. Les maquettes de
> référence pour le développement sont celles du tableau « Les écrans de la
> v1 » ci-dessous. Les points marqués « à valider » attendent encore Émilien.
> Mis à jour le même jour avec ses décisions « Écrans années 70 »
> (`docs/06-decisions-design.md`) : icône A, arrivée aux chiffres réels, plus
> de « Demander une zone », retouches de B, écran « Réglages » et panneau des
> réglages du suivi.

## Comment regarder

- Chaque maquette est un fichier HTML autonome (sans police, image ni lien
  en ligne), au format d'un téléphone : 390 × 844 points. Il s'ouvre dans un
  navigateur, même hors ligne.
- Captures PNG : `design/captures/` pour les écrans de navigation,
  `design/v1/captures/` pour les écrans hors navigation, au même nom que le
  fichier HTML. **À refaire** après les retouches du 21 octobre : 30, 31, 32,
  v1/40, v1/41, v1/50, v1/51, v1/60, v1/70 et la planche ; à créer : 31b et
  v1/80.
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
| `30-suivi-velo.html` | Suivi, direction B : direction à 50 m, panneau jaune ; « Terminer » en rouge foncé ; roue dentée sous la boussole | 7 ; décisions 6 et 7 (écrans 70) |
| `31b-suivi-reglages.html` | Suivi, direction B : panneau des réglages du suivi ouvert par la roue dentée, luminosité « Maximum » choisie | 7 ; décision 2, décision 6 (écrans 70) |
| `31-verrouille-android.html` | Téléphone verrouillé, Android : la notification unique, petite icône A sur un rond rouille | 8 ; décision 7 (écrans 70) |
| `32-verrouille-ios.html` | Téléphone verrouillé, iOS : la Live Activity (bandeau en direct), icône A | 8 ; décision 7 (écrans 70) |
| `v1/40-mes-itineraires.html` | Mes itinéraires, menu natif d'une ligne ouvert, import GPX | 4, 5 |
| `v1/41-zones.html` | Zones : prête, en attente du Wi-Fi, à télécharger ; bandeau « Pas de Wi-Fi » avec l'interrupteur « Wi-Fi seulement » | 6 ; décision 10, décision 5 (écrans 70) |
| `v1/50-liste-vide.html` | Mes itinéraires vide, avec le vététiste | 4 ; décision 3 |
| `v1/51-telechargement.html` | Onglet Carte pendant le téléchargement de la première zone : le vététiste roule sur la barre de progression | 6 ; décision 3 |
| `v1/52-erreur.html` | Création : point touché hors de la zone, calcul impossible, trois sorties | 2, 6 ; décisions 3, 10 |
| `v1/60-arrivee.html` | Arrivée : résumé aux chiffres réels (distance parcourue, D+, durée), suivi arrêté, podium fixe, un seul bouton « Fermer » | décisions 4, 5 (questions) ; décisions 2 à 4 (écrans 70) |
| `v1/70-icone.html` | Icône : A, le soleil rayé, choisie ; B et C pour mémoire ; iOS, Android adaptative, 48 points | décision 5 (style) ; décision 1 (écrans 70) |
| `v1/80-reglages.html` | Réglages, 4e onglet : Wi-Fi seulement, luminosité pendant le suivi, licences et attributions, version | décisions 2, 10, 13 ; décision 6 (écrans 70) |

Les onglets de `v1/40`, `v1/41`, `v1/50` et `v1/51` ont reçu le 4e onglet
« Réglages » ; rien d'autre n'y change.

Pas dessinés, car ils découlent des écrans ci-dessus : la carte d'accueil
(l'écran 12 sans la feuille, avec un bouton « Nouvel itinéraire ») ; la
carte vide au tout premier lancement (l'écran 51 sans barre, avec
« Choisir une zone ») ; le menu des couches ; les boîtes de confirmation ; la
saisie du nom ; les demandes de permission du système ; le message d'un GPX
importé hors des zones (décision 11 : même feuille que l'écran 52, avec
« Télécharger la zone ») ; la liste « Licences et attributions » (une liste
de textes, ouverte depuis l'écran 80).

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
- **Plus de bouton « Ma zone n'est pas là : la demander »** : décision 5 (écrans 70), la demande arrive en V2, automatique. Sur l'écran 52, un point hors de toute zone du catalogue garde les sorties « relier à la main » et « retirer le point ».
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
- **Arrivée : « Distance parcourue », « Montée (D+) », « Durée », chiffres réels** : décision 2 (écrans 70) ; « parcourue » dit que ce n'est pas le chiffre prévu, sans phrase de plus. La maquette montre 25,6 km, 433 m et 1 h 52, contre 25,1 km, 421 m et 1 h 35 prévus (écran 40).
- **Arrivée : un seul bouton, « Fermer »** : décision 3 (écrans 70), pas de « Continuer le suivi ».

### Réglages

- **Accès par un 4e onglet « Réglages », pas par une roue dentée dans l'en-tête de la Carte** : les deux plateformes prévoient 3 à 5 destinations dans la barre du bas (Material 3 « navigation bar », iOS « tab bar ») ; un onglet est trouvé du premier coup, au même endroit sur Android et iOS, et c'est une grande cible (97 de large, 49 de haut au moins) pour les gants. La Carte n'a pas d'en-tête (carte plein écran) : un bouton de plus s'y ajouterait aux boutons de la carte, et se confondrait avec la roue dentée du suivi, qui n'ouvre pas le même écran. Limite connue : Material range plutôt les réglages dans un menu de la barre du haut, mais nos onglets n'ont pas de barre du haut, et en créer une serait inventer.
- **Pictogramme roue dentée pour l'onglet et pour le bouton du suivi** : c'est la forme de « réglages » sur les deux plateformes (Material « settings », SF Symbol « gearshape »).
- **Trois groupes : Téléchargements, Pendant le suivi, À propos** : on trouve un réglage par ce qu'on fait, et « À propos » finit la liste, comme dans les réglages des deux systèmes.
- **Un seul réglage « Wi-Fi seulement », à deux endroits (écran 80 et bandeau de l'écran 41)** : changer l'un change l'autre ; le bandeau reste le raccourci de la décision 10.
- **Luminosité en sélecteur à deux segments (« Automatique » / « Maximum »), pas en interrupteur** : les deux choix se lisent sans deviner ce que veut dire « désactivé » ; même composant qu'à l'écran 10.
- **Version en texte, non touchable ; « Licences et attributions » avec l'IGN cité dans la ligne** : décision 13, et il faut pouvoir lire la version pour signaler un problème.

### Suivi sur le vélo (direction B)

- **Distance en 72 points, unité en 40** : « 1,2 km » tient sur une ligne à côté de la flèche.
- **Panneau jaune sous 100 m** : le changement se voit du coin de l'œil, sans lire.
- **Carte orientée dans le sens de la marche, zoom automatique à l'approche d'une direction ; boussole pour remettre le nord en haut** : gauche et droite se lisent directement, sans pincer l'écran avec des gants.
- **Deux grands boutons de 64 points (boussole, Terminer), « Terminer » confirmé** : moins de touches par erreur.
- **« Terminer » en `#8A1C12` (9,3:1 sur blanc, au lieu de 6,5:1)** : retouche validée ; B passe la règle des 7:1 et le rouge est le même dans toute l'app.
- **Roue dentée de 48 sous la boussole, zone de toucher de 64, 16 entre les deux zones** : plus petite que la boussole pour rester discrète, mais touchable avec des gants ; empilée à droite comme les boutons de carte des deux plateformes, et loin de « Terminer ».
- **Panneau des réglages du suivi non bloquant, guidage visible au-dessus (31b)** : on ne perd jamais la prochaine direction ; pas de voile, la carte garde la position visible au-dessus du panneau.
- **Le choix s'applique tout de suite, sans « Valider »** : un geste de moins, et on voit l'effet sur l'écran même.
- **Panneau en blanc et noir, segments et « Fermer » de 64, textes de 20 et plus** : c'est un écran de navigation (décision 7 : pas de rayures sur le suivi).
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

### Ajustements de la direction B (décision 7 des écrans 70)

1. **Rouge de « Terminer » : `#B3261E` → `#8A1C12`** : **appliqué** (30).
2. **Icône de l'app dans la notification (31) et la Live Activity (32)** :
   **appliqué**. Android : silhouette blanche de A sur un rond `hn.rouille`
   (couleur d'accent). iOS : icône A en couleur, 20 points.
3. **Rayures sur le panneau « Reste »** : **refusé**, pas de rayures sur
   l'écran de suivi.

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
| Panneau des réglages du suivi (31b) | « Standard bottom sheet » Material 3, sans voile | Feuille à hauteur moyenne, fond non assombri (`largestUndimmedDetent`) |
| Écran Réglages (80) | Liste Material, lignes sans chevron | Liste groupée, chevron « › » sur les lignes qui ouvrent un écran |
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

Nouveau avec les décisions « Écrans années 70 » :
- **Luminosité au maximum** (`expo-brightness`, à éprouver sur appareil) :
  Android, luminosité de la fenêtre de l'app seulement, rendue au système en
  « Automatique » ; iOS, luminosité de tout l'écran : la remettre à sa valeur
  d'avant à la fin du suivi, et quand l'app passe en arrière-plan.
- **Chiffres réels de l'arrivée** sans enregistrer la trace : cumuler la
  distance et le D+ pendant le suivi. L'altitude du GPS est bruitée et gonfle
  le D+ : prendre plutôt l'altitude du relief (Mapterhorn) aux positions
  reçues, ou lisser avec un seuil. Durée : du « Démarrer le suivi » à
  l'arrivée.
- **Petite icône de la notification** : image vectorielle blanche et couleur
  `#B5452A` ; vérifier que `expo-location/next` accepte les deux pour la
  notification de service.
- **Panneau non bloquant (31b)** : la carte doit rester touchable et le
  guidage continuer à se mettre à jour pendant que le panneau est ouvert ;
  retour d'Android = fermer le panneau.
- **Roue dentée du suivi** : dessin de 48, `hitSlop` de 8 pour une zone de 64.

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

Les 7 questions précédentes sont tranchées (`docs/06-decisions-design.md`,
« Écrans années 70 : décisions »). Nouvelles questions :

1. **Durée réelle de l'arrivée** : j'ai compté du « Démarrer le suivi » à
   l'arrivée, pauses comprises. Ou veux-tu le temps en mouvement seulement ?
2. **Luminosité changée pendant le suivi (31b)** : je l'ai dessinée comme le
   même réglage que l'écran 80 (le choix reste pour les sorties suivantes).
   Ou doit-elle valoir pour la sortie en cours seulement ?
3. **Panneau des réglages du suivi ouvert à l'approche d'une direction** :
   doit-il se fermer seul quand la prochaine direction passe sous 100 m, pour
   rendre toute la carte ? Aujourd'hui il reste ouvert jusqu'à « Fermer ».
4. **« Terminer » avant l'arrivée** : affiche-t-on aussi un résumé aux
   chiffres réels (sans « ARRIVÉE ! »), ou revient-on simplement à l'écran
   d'avant ?

## Hors périmètre, volontairement absent

Guidage par la voix et économiseur d'écran (V2) ; animation de l'arrivée
(V2) ; demande de zone automatique (V2) ; mode sombre (V2, à reconsidérer) ; alerte d'écart, boucle
automatique, enregistrement des sorties (plus tard). Aucun de ces éléments
n'apparaît dans les maquettes.
