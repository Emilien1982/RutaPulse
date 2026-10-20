# Design de RutaPulse : proposition pour la v1

> 21 octobre 2026. Proposition du designer (étape 3d), **à juger par
> Émilien**. Rien n'est validé.

## Comment regarder

- Les captures PNG sont dans `design/captures/`, une par écran, au même nom
  que le fichier HTML.
- Chaque maquette est un fichier HTML autonome (sans police, image ni lien
  en ligne), au format d'un téléphone : 390 × 844 points. Il s'ouvre dans un
  navigateur, même hors ligne.
- Les valeurs (couleurs, tailles, espacements, épaisseurs des tracés) sont
  définies dans [`tokens.md`](tokens.md). Les HTML les recopient ; en cas
  d'écart, `tokens.md` fait foi.
- La carte des maquettes est un dessin simplifié en SVG (format d'image
  vectorielle), qui reprend les couleurs du style de l'essai 3. Ce n'est pas
  la vraie carte.
- Les maquettes montrent une seule version, neutre. Chaque plateforme
  utilise ensuite ses composants natifs (tableau « Conventions » plus bas).

## Les écrans

| Fichier | Écran | Fonction du cadrage |
|---|---|---|
| `01-direction-a-sobre.html` | Direction A : suivi sur le vélo | 7 |
| `02-direction-b-contraste.html` | Direction B : suivi sur le vélo | 7 |
| `10-creation-itineraire.html` | Création : on glisse un point, l'itinéraire se recalcule pendant le geste ; circuits balisés affichés | 2, 9 |
| `11-creation-trace-a-la-main.html` | Création : deux tronçons tracés à la main, en tirets | 2 |
| `12-circuit-balise.html` | Carte : un circuit balisé touché, « En faire un itinéraire » | 9 |
| `20-infos-itineraire.html` | Infos : distance, durée, D+ et D−, profil d'altitude, terrain, difficulté | 3 |
| `30-suivi-velo.html` | Suivi, direction B complète : direction à 50 m, panneau jaune | 7 |
| `31-verrouille-android.html` | Téléphone verrouillé, Android : la notification unique | 8 |
| `32-verrouille-ios.html` | Téléphone verrouillé, iOS : la Live Activity (bandeau en direct) | 8 |
| `40-mes-itineraires.html` | Mes itinéraires, menu d'une ligne ouvert (renommer, exporter en GPX, format d'échange de traces GPS, supprimer), import GPX | 4, 5 |
| `41-zones.html` | Zones hors ligne : prête, en téléchargement, à télécharger | 6 |

Pas dessinés, car ils découlent des écrans ci-dessus : la carte d'accueil
(l'écran 12 sans la feuille, avec un bouton « Nouvel itinéraire »), le
menu des couches, les boîtes de confirmation, la saisie du nom, les
demandes de permission du système.

## Les deux directions, sur l'écran de suivi

### A — Sobre, carte dominante (`01`)

La carte remplit l'écran ; la prochaine direction tient dans une petite
carte sombre posée en haut, comme dans une app de navigation routière.

- **Forces** : beaucoup de contexte autour de soi, utile en forêt où la
  consigne n'a souvent pas de nom de chemin (« Tournez à gauche. ») ;
  aspect familier (Google Maps, Komoot) ; peu de cadres.
- **Faiblesses** : distance en 40 points et consigne en 22, trop petites à
  65 cm sur un chemin qui secoue ; le cadre sombre reflète le ciel au soleil
  et son texte blanc perd du contraste ; c'est la carte, détaillée et pâle,
  qui domine, alors qu'elle se lit mal au soleil ; bouton d'arrêt de 56
  points seulement.

### B — Contrastée, gros chiffres (`02`, puis `30`)

Un panneau blanc en haut donne la prochaine direction en très gros
caractères noirs ; la carte, simplifiée, occupe le milieu ; la distance
restante est en bas.

- **Forces** : distance lisible d'un coup d'œil (72 points) ; noir sur
  blanc (contraste de 18,9:1) ; trois zones fixes, l'œil sait où regarder ;
  le panneau peut passer au jaune à l'approche d'une direction ; boutons de
  64 points.
- **Faiblesses** : la carte ne garde que 52 % de la hauteur, on voit moins
  loin devant ; aspect plus « outil » que beau ; les grands aplats blancs
  consomment plus sur un écran OLED (écran dont chaque point éclaire
  lui-même) qu'un fond noir, sans que l'écart soit mesuré.

### Recommandation : B

Le suivi se lit en roulant, d'un coup d'œil, souvent au soleil : la taille
et le contraste priment. B garde de A une carte assez grande pour voir une
fourche, car en forêt c'est elle qui lève le doute. Les écrans 10 à 41 sont
dessinés dans la direction B : noir sur blanc, chiffres clés en 28 points,
cibles de 48 à 64 points, bords marqués.

## Les choix importants

Suivi sur le vélo
- **Distance en 72 points, unité en 40** : « 1,2 km » tient sur une ligne à côté de la flèche.
- **Panneau jaune sous 100 m** : le changement se voit du coin de l'œil, sans lire.
- **Carte orientée dans le sens de la marche, zoom automatique à l'approche d'une direction** : gauche et droite se lisent directement, et personne ne pince l'écran avec des gants.
- **Boussole pour remettre le nord en haut** : convention des deux plateformes quand la carte tourne.
- **Deux boutons seulement, de 64 points (boussole, Terminer)** : moins d'éléments, moins de touches par erreur avec des gants ou un cahot.
- **« Terminer » demande une confirmation** : arrêter le suivi par erreur au milieu d'une sortie serait pénible.
- **En suivi, relief et courbes à 50 %, sentiers plus épais** : à une fourche, c'est le sentier qu'on cherche, pas le relief.
- **Partie déjà roulée en gris** : on voit d'un coup ce qui reste.

Carte et tracés
- **Itinéraire en magenta, avec un liseré blanc** : c'est la seule couleur absente du fond de carte (pistes brunes, sentiers rouges, circuits et eau bleus).
- **Itinéraire plus épais que tout le reste (7 en création, 10 en suivi)** : il se distingue aussi par la forme, pour les daltoniens et au soleil.
- **Tronçon tracé à la main en tirets** : on sait qu'il n'est pas calculé par les chemins.
- **Position en flèche bleue** : convention des deux plateformes.
- **Attribution visible en petit sur chaque carte** : exigée par les licences OSM et OpenMapTiles.
- **Hors zone : carte grisée et bord en tirets** (non dessiné) : l'essai 3 montre qu'au-delà du bord il ne reste que le relief, l'utilisateur doit comprendre pourquoi.

Création d'itinéraire
- **Recalcul pendant le geste, sans bouton « Calculer »** : le cadrage demande le direct, et Valhalla calcule en quelques dizaines de millisecondes (mesuré sur émulateur).
- **Le point glissé est dessiné au-dessus du doigt** : sinon le doigt le cache.
- **Ajouter un point : toucher la carte (il s'ajoute à la fin) ; en insérer un : glisser le tracé** : convention des apps de carte (Google Maps, Komoot).
- **Sélecteur à deux segments « Par les chemins / À la main » pour le tronçon suivant** : composant natif des deux plateformes, et le mode en cours reste visible.
- **Tracé à la main par touches (lignes droites), pas au doigt glissé** : plus précis avec des gants, la carte reste déplaçable, et chaque point se déplace ou s'annule comme les autres.
- **Résumé (distance, D+, durée) toujours visible en bas** : on voit l'effet de chaque point sans changer d'écran.
- **Création en plein écran, sans barre d'onglets** : plus de carte, et pas de sortie par erreur au milieu d'un tracé.

Infos, listes, zones
- **Profil d'altitude et bande de terrain sur le même axe** : on voit où sont les montées et sur quel terrain.
- **Couleurs de terrain = couleurs de la carte** : une seule légende à apprendre.
- **Difficulté donnée en part connue et part inconnue** : elle n'est connue que sur 1 à 4 % des voies en France (ADR 0005) ; le dire évite de faire croire à un parcours facile.
- **Trois onglets : Carte, Itinéraires, Zones** : peu d'écrans, et c'est la convention des deux plateformes.
- **Actions d'un itinéraire dans le menu natif de la ligne** : la liste reste lisible, et chaque plateforme garde ses gestes.

Téléphone verrouillé
- **Android : titre = consigne courte (« À gauche dans 200 m »), texte = distance restante** : le système impose la mise en page, et seul le titre est en gras.
- **iOS : la Live Activity reprend le panneau de guidage, sur fond blanc** : même lecture sur l'écran verrouillé que dans l'app, et lisible au soleil.

Général
- **Thème clair seulement, forcé** (détail dans `tokens.md`) : meilleur au soleil, et un téléphone en mode sombre n'affichera pas une app à moitié sombre.
- **Police du système, chiffres à largeur fixe** : rien à télécharger, et les chiffres ne sautent pas quand ils changent.

## Conventions des plateformes

| Élément | Android | iOS |
|---|---|---|
| Onglets | Barre de navigation Material 3 (système de design de Google) | Tab bar (barre d'onglets) |
| Retour | Flèche dans la barre du haut, geste ou bouton retour du système | « ‹ Itinéraires », glisser depuis le bord gauche |
| Actions d'une ligne | Icône ⋮ puis menu déroulant | Icône ••• ou appui long, menu contextuel ; glisser à gauche pour supprimer |
| Feuille du bas | Feuille modale Material | Feuille avec poignée et hauteurs fixes (« detents ») |
| Sélecteur à deux segments | Segmented buttons (boutons à segments) | Segmented control (même chose) |
| Confirmer « Terminer », « Supprimer » | Boîte de dialogue Material | Alerte du système |
| Exporter un GPX | Feuille de partage Android | Feuille de partage iOS |
| Importer un GPX | Sélecteur de fichiers du système | Sélecteur de fichiers du système |
| Téléphone verrouillé | Notification du service de premier plan | Live Activity |

## À vérifier par le développement (faisabilité, pas produit)

- `expo-location/next` : la notification de service accepte-t-elle un titre
  **et** un texte, et notre icône ? Sinon tout tient dans une seule ligne.
- Android 14 : l'utilisateur peut balayer une notification de service. Le
  suivi doit continuer, et la notification revenir à la mise à jour
  suivante.
- Live Activity (`expo-widgets`) : fond blanc (`activityBackgroundTint`),
  flèche en symbole SF (icônes d'Apple), fréquence de mise à jour permise.
- MapLibre : glisser un point dessiné au-dessus du doigt (geste à nous,
  avec `getCoordinateFromView`) et glisser le tracé pour insérer un point.
- MapLibre : caméra qui suit le cap, zoom automatique, et style de suivi
  (relief et courbes à 50 %) par changement de propriétés des couches.
- Altitude d'un tronçon tracé à la main : sans calcul par les chemins, son
  D+ et son terrain viennent-ils des tuiles d'altitude ? Sinon, l'afficher
  « inconnu ».
- Fonction 9 : remettre les voies d'un circuit dans l'ordre avant le
  calcul (constat de l'essai 3).
- Écran de suivi : limiter l'agrandissement par la taille de texte du
  système à 120 % (`maxFontSizeMultiplier`), sinon le panneau déborde.
- Thème clair forcé : `userInterfaceStyle: "light"` dans la configuration
  Expo.

## Questions pour Émilien (je ne les tranche pas)

1. **Carte du suivi : claire ou sombre ?** L'ADR 0006 prévoit une carte
   sombre pendant le suivi, pour la batterie. Au soleil, le clair se lit
   mieux, et le gain de batterie n'est pas mesuré. Je recommande le clair,
   puis une mesure de batterie lors d'une vraie sortie.
2. **Luminosité** : pendant le suivi, l'app doit-elle pousser la luminosité
   au maximum ? Plus lisible au soleil, mais plus de batterie.
3. **Infos du suivi** : seulement la distance restante (cadrage), ou aussi
   le D+ restant, l'heure d'arrivée, la vitesse ? Chaque ajout réduit la
   taille des chiffres.
4. **Hors de l'itinéraire** : l'alerte est prévue « plus tard ». En v1, que
   montre le panneau quand on s'écarte ? Rien de spécial (la dernière
   consigne reste), ou « Rejoignez l'itinéraire : 80 m », sans son ?
5. **Arrivée** : le suivi s'arrête-t-il seul, ou un écran « Arrivé »
   propose-t-il de terminer ?
6. **Boucles** : faut-il un bouton « Revenir au départ » qui ferme la boucle
   d'un geste ? La plupart des sorties VTT sont des boucles.
7. **Circuit balisé** : dans quel sens le parcourir, et à partir de quel
   point (le plus proche de moi, ou le début du circuit dans OSM) ? Et pour
   un circuit en plusieurs morceaux (un sur dix en Lorraine) : relier les
   morceaux par le calcul, ou refuser ?
8. **Tracé à la main** : par touches, en lignes droites (ma proposition),
   ou au doigt glissé ?
9. **Nom d'un nouvel itinéraire** : un nom par défaut (date, lieu de
   départ, nom du circuit), ou une question à l'enregistrement ?
10. **Zones** : proposer la mise à jour quand le catalogue a une carte plus
    récente ? Télécharger seulement en Wi-Fi, ou aussi en données mobiles
    (environ 100 Mo par zone) ? Que dire à un proche dont la zone manque ?
11. **GPX importé hors des zones téléchargées** : refusé, ou gardé avec des
    infos incomplètes (sans terrain ni recalcul) ?
12. **Sorties de nuit** : tes proches en font-elles ? Si oui, un suivi en
    sombre passe-t-il en v1 ou en V2 ?
13. **Attribution de l'IGN sur la carte** : question déjà ouverte par
    l'essai 3, qui touche aussi la ligne d'attribution des maquettes.

## Hors périmètre, volontairement absent

Guidage par la voix et économiseur d'écran (V2) ; alerte d'écart, boucle
automatique, enregistrement des sorties (plus tard). Aucun de ces éléments
n'apparaît dans les maquettes.
