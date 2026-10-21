# Jetons de design de RutaPulse

> Valeurs de référence de la v1. Directions validées par Émilien le
> 21 octobre 2026 (`docs/06-decisions-design.md`) : **direction B** pour la
> navigation, **style années 70** pour tout le reste.
> Un jeton (« design token ») est une valeur nommée, définie une seule fois
> ici et réutilisée partout : couleurs, tailles, espacements.
> Les maquettes HTML de `design/` recopient ces valeurs dans leur bloc
> `:root` (variables CSS), car chaque fichier doit s'ouvrir seul. **En cas
> d'écart, ce fichier fait foi.**

## Deux familles d'écrans

| Famille | Écrans | Maquettes de référence | Jetons |
|---|---|---|---|
| **Navigation** (direction B) | Suivi sur le vélo, téléphone verrouillé | `30`, `31`, `32` | `couleur.*`, `guidage.*`, `texte.guidage-*` |
| **Hors navigation** (style années 70) | Création, circuit balisé, infos, mes itinéraires, zones, états vides, arrivée, icône | `v1/10` à `v1/70` | `hn.*`, `perso.*`, `icone.*` |
| **Communs** | Tous | — | `carte.*`, `terrain.*`, `trace.*`, `marqueur.*`, cibles, unités |

La carte, ses tracés et ses marqueurs sont **les mêmes** dans les deux
familles : on passe de la création au suivi sans réapprendre la légende.

## Unité

Toutes les tailles sont en **points**. Un point vaut 1 `dp` (pixel
indépendant de la densité) sur Android, 1 `pt` sur iOS, 1 unité de style en
React Native, et 1 `px` dans les maquettes. Sur la carte, MapLibre compte
aussi ses épaisseurs de trait dans cette unité.

## Les conditions d'usage, et ce qu'elles imposent

| Condition | Conséquence |
|---|---|
| Plein soleil : l'écran reflète le ciel, les couleurs pâles disparaissent | Texte foncé sur fond clair. Contraste du texte d'au moins 7:1 partout, 12:1 sur les écrans vus en roulant. Pas de gris clair pour une info utile. |
| Téléphone sur le guidon, à environ 65 cm des yeux au lieu de 30 cm en main | Les textes lus en roulant font au moins 20 points. L'info principale (distance avant la prochaine direction) fait 72 points. |
| Coup d'œil d'une seconde, avec les vibrations | Une seule info dominante. Chiffres en gras, à largeur fixe (`tabular-nums`, chiffres tabulaires) pour qu'ils ne sautent pas quand ils changent. |
| Gants | Cibles tactiles de 64 points en roulant, 48 à l'arrêt. 16 points entre deux cibles en roulant. Aucun geste à deux doigts obligatoire. |

## Couleurs : navigation (direction B)

Contraste mesuré sur fond blanc (`#FFFFFF`), formule WCAG (règles
d'accessibilité du web).

| Jeton | Valeur | Contraste | Usage |
|---|---|---|---|
| `couleur.fond` | `#FFFFFF` | — | Fond du panneau de guidage et du bas du suivi |
| `couleur.texte` | `#111111` | 18,9:1 | Tout texte du suivi |
| `couleur.texte-2` | `#4A4A4A` | 8,9:1 | Texte secondaire (« Reste ») |
| `couleur.contour-flottant` | `#111111` à 35 % d'opacité | décor | Bord de 1 point des boutons posés sur la carte du suivi |
| `couleur.danger` | `#B3261E` | 6,5:1 | « Terminer ». **Sous les 7:1** : voir la proposition d'ajustement dans `LISEZMOI.md` (`#8A1C12`, 9,3:1). |
| `couleur.imminent` | `#FFD400` | 13,2:1 avec `texte` | Fond du panneau de guidage à moins de 100 m d'une direction |

Retirés le 21 octobre 2026, car plus aucun écran ne les utilise (les écrans
10 à 41 passent au style années 70) : `couleur.surface`,
`couleur.separateur`, `couleur.action` (bleu), `couleur.sur-action`,
`couleur.succes`. Le vert reste celui du départ sur la carte
(`carte.depart`).

### Guidage (écran de suivi)

| Jeton | Valeur | Usage |
|---|---|---|
| `guidage.fond` | `couleur.fond` | Panneau de la prochaine direction, en temps normal |
| `guidage.fond-imminent` | `couleur.imminent` | Même panneau, à moins de 100 m de la direction |
| `guidage.texte` | `couleur.texte` | Flèche, distance, consigne |

## Couleurs : hors navigation (style années 70)

Contraste du texte mesuré sur `hn.creme` (fond des écrans) et sur
`hn.creme-clair` (cartes, cases, boutons secondaires). Formule WCAG.

| Jeton | Valeur | Contraste | Usage |
|---|---|---|---|
| `hn.creme` | `#F4E4C1` | — | Fond des écrans et des feuilles du bas |
| `hn.creme-clair` | `#FBF1DA` | — | Cartes de liste, cases, boutons secondaires, boutons posés sur la carte |
| `hn.sable` | `#F7DDA6` | — | Fond des médaillons, rail des barres de progression |
| `hn.brun` | `#3A1F0F` | 12,3:1 (crème), 13,5:1 (crème clair) | Texte, tous les bords, barre d'onglets, bouton principal (fond) |
| `hn.brun-2` | `#5A3A28` | 8,2:1 (crème), 9,0:1 (crème clair) | Texte secondaire. **Jamais sur `hn.moutarde-pale`** (6,6:1). |
| `hn.sur-brun` | `hn.creme` | 12,3:1 sur `hn.brun` | Texte et icônes sur fond brun (bouton principal, onglets) |
| `hn.moutarde` | `#F0A830` | `hn.brun` dessus : 7,5:1 | Soleil, onglet actif, « Enregistrer », « Télécharger », pastille du bouton principal, première bande |
| `hn.moutarde-pale` | `#F6CB7A` | `hn.brun` dessus : 9,9:1 | Bandeau d'alerte (pas de Wi-Fi), bas du profil, rayons de l'arrivée |
| `hn.orange` | `#E2652B` | décor, jamais sous du texte (4,4:1) | Deuxième bande |
| `hn.rouille` | `#B5452A` | décor, jamais sous du texte (4,4:1) | Troisième bande, maillot du vététiste |
| `hn.petrole` | `#2D6A66` | décor | Rivières des vignettes, cadre du vélo, bande de la case D− |
| `hn.olive` | `#A9B56A` | décor | Forêts des vignettes, sol des illustrations |
| `hn.danger` | `#8A1C12` | 7,5:1 (crème), 8,3:1 (crème clair) | « Supprimer » dans nos écrans. Les menus natifs gardent le rouge du système. |
| `hn.succes` | `#0F5223` | 7,5:1 (crème), 8,3:1 (crème clair) | « Prête sans réseau » |
| `hn.ombre` | 0 2 8, `hn.brun` à 30 % | décor | Boutons et bulles posés sur la carte, toujours avec un bord brun |
| `hn.voile-hors-zone` | `#CFC8BB` à 72 % | décor | Carte au-delà du bord de la zone téléchargée (52) |

Règles :
- **Pas de magenta en texte** (4,7:1 sur crème) : un petit trait magenta à
  côté d'un texte brun fait le lien avec la carte (écran 11).
- Les couleurs de la carte (`carte.*`) ne changent pas sur fond crème.

### La signature : les trois rayures

`hn.rayures` : trois bandes de 3 points, `hn.moutarde`, `hn.orange`,
`hn.rouille`, de haut en bas (9 points en tout).

| Où | Comment |
|---|---|
| Sous la barre du haut des écrans de création (10, 11, 52) | Pleine largeur |
| Au-dessus de la barre d'onglets (40, 41, 50, 51) | Pleine largeur |
| Bandeau des onglets | Soleil rayé (rond `hn.moutarde` coupé de deux filets crème) posé sur quatre bandes de 9 (les trois + `hn.brun`), 200 points de haut |
| Cases de chiffres (20) et lignes du résumé (60) | Bande de 9 à gauche : moutarde, orange, rouille, pétrole |
| Profil d'altitude (20) | Rempli de quatre bandes : rouille, orange, moutarde, moutarde pâle |
| Fenêtre de carte en arche (20) | Trois anneaux : 5 moutarde, 4 orange, 3 rouille |

## Carte : nos tracés (communs)

Le style de carte actuel (essai 3) a déjà : pistes brunes, sentiers en
tirets rouges, circuits bleus, eau bleue, routes blanches. Nos tracés
doivent se distinguer de tout cela, par la couleur **et** par l'épaisseur.

| Jeton | Valeur | Contraste | Usage |
|---|---|---|---|
| `carte.itineraire` | `#C2007A` (magenta) | 5,9:1 sur blanc, 5,1:1 sur le fond de carte | L'itinéraire. Seule couleur de la carte qui n'existe nulle part ailleurs. |
| `carte.itineraire-lisere` | `#FFFFFF` | — | Liseré (« casing », bord clair) de l'itinéraire, pour le détacher des forêts et des pistes |
| `carte.parcouru` | `#8C8C8C` à 70 % | — | Partie de l'itinéraire déjà roulée, pendant le suivi |
| `carte.circuit` | `#2F6BFF` à 55 % | — | Circuits VTT balisés (couche) |
| `carte.circuit-choisi` | `#2F6BFF` à 100 % | — | Circuit touché, avant d'en faire un itinéraire |
| `carte.sens-circuit` | chevrons `#FFFFFF` de 7 × 8, tous les 150 points environ | — | Sens du circuit choisi (décision 7), dessinés sur son tracé |
| `carte.position` | `#1A73E8`, bord blanc | — | Ma position. Bleu : convention des deux plateformes. |
| `carte.depart` | `#146C2E` | — | Pastille du départ |
| `carte.arrivee` | `#111111` | — | Pastille de l'arrivée (drapeau) |
| `carte.point` | fond `#FFFFFF`, bord `#C2007A`, chiffre `#111111` | — | Points de passage numérotés |
| `carte.point-refuse` | fond `#FFFFFF`, bord en tirets `hn.brun`, « ! » | — | Point touché hors de la zone, en attente d'un choix (52) |
| `carte.bord-zone` | `hn.brun`, 2,5, tirets 9 / 6 | — | Bord de la zone téléchargée (52) |

### Carte : fond (reprise du style de l'essai 3)

| Jeton | Valeur | Usage |
|---|---|---|
| `carte.fond` | `#EEEBE4` | Terrain |
| `carte.foret` | `#D3E4C0` | Bois |
| `carte.eau` | `#A8CCDD` | Rivières, lacs |
| `carte.bati` | `#E3DCD0` | Villages |
| `carte.voie` / `carte.voie-bord` | `#FFFFFF` / `#BFB7AA` | Routes et rues |
| `carte.piste` | `#7A4A1E` | Pistes (`highway=track`), 6,2:1 sur le fond |
| `carte.sentier` | `#C62828` | Sentiers, en tirets, 4,7:1 sur le fond |
| `carte.courbe` / `carte.courbe-maitresse` | `#C9B293` / `#B89C78` | Courbes de niveau, tous les 10 m / 50 m |

À corriger dans le style (constat de l'essai 3) : filtrer les trottoirs
(`subclass=footway`) hors de la couche des sentiers, sinon les villages se
couvrent de tirets rouges.

### Attribution

« © OpenStreetMap © OpenMapTiles © Mapterhorn © IGN » (décision 13), en 11
points, `hn.brun-2` sur `hn.creme-clair` à 88 %. Sur une petite carte (arche
de l'écran 20) ou quand la place manque (52) : « © OpenStreetMap » suivi d'un
bouton « i » qui ouvre la liste complète (convention de MapLibre). Zone de
toucher de 48 autour du « i ».

### Terrain (infos de l'itinéraire)

Mêmes teintes que la carte, pour qu'on n'ait qu'une légende à apprendre.

| Jeton | Valeur | Usage |
|---|---|---|
| `terrain.route` | `#5A5A5A` | Part de route |
| `terrain.piste` | `#7A4A1E` | Part de piste |
| `terrain.sentier` | `#C62828` | Part de sentier |
| `terrain.inconnu` | hachures `#BDBDBD` | Difficulté inconnue |

## Typographie

### Deux polices

| Police | Où | Pourquoi |
|---|---|---|
| **Police du système** (SF Pro sur iOS, Roboto sur Android) | Tout l'écran de suivi ; hors navigation : corps, listes, noms d'itinéraires, **tous les chiffres**, onglets, segments, outils, menus | Grand œil (hauteur des minuscules), chiffres tabulaires, suit la taille de texte du téléphone. Les chiffres sont les mêmes de la création au suivi. |
| **Jost 700** (licence libre OFL, à embarquer avec `expo-font`, environ 130 Ko) | Hors navigation seulement : titres d'écran (en capitales), surtitres de bloc (en capitales espacées), nom de l'itinéraire en titre, libellés des boutons d'action (« Démarrer le suivi », « Enregistrer », « Télécharger ») | La voix « affiche des années 70 ». Les maquettes utilisent Futura (iOS et macOS seulement), dont Jost est un proche libre. Son petit œil le réserve aux textes courts et grands. |

Une seule graisse de Jost suffit en v1 (700).

### Tailles

| Jeton | Taille | Graisse | Police | Usage |
|---|---|---|---|---|
| `texte.guidage-distance` | 72 | 800 | système | « 200 » : distance avant la prochaine direction |
| `texte.guidage-unite` | 40 | 800 | système | « m », « km » à côté de la distance |
| `texte.guidage-consigne` | 28 | 700 | système | « Tournez à gauche » |
| `texte.guidage-restant` | 36 | 800 | système | Distance restante (valeur) ; chiffres de l'écran « Arrivée » |
| `texte.guidage-etiquette` | 20 | 600 | système | « Reste », libellés lus en roulant (minimum en roulant) |
| `texte.titre-fete` | 44 | 700 | Jost, capitales, espacement 2 | « ARRIVÉE ! » |
| `texte.titre-ecran` | 26 | 700 | Jost, capitales, espacement 0,5 | « MES ITINÉRAIRES », « ZONES HORS LIGNE » |
| `texte.titre-etat` | 24 | 700 | Jost | Titre d'un état vide (50, 51) |
| `texte.titre-nom` | 22 | 700 | Jost | Nom de l'itinéraire ou du circuit en tête d'écran ou de feuille ; titre d'une erreur |
| `texte.titre-barre` | 18 | 700 | Jost | Titre de la barre du haut (« Nouvel itinéraire ») |
| `texte.chiffre-cle` | 28 | 800 | système | Distance, D+, durée, à l'arrêt |
| `texte.chiffre-cle-unite` | 17 | 700 | système | Unité à côté d'un chiffre clé (« km », « m », « h ») |
| `texte.bouton-action` | 17 (20 sur l'écran « Arrivée ») | 700 | Jost | Libellé d'un bouton principal ou secondaire |
| `texte.bouton` | 17 | 600 | système | Segments, interrupteurs, liens soulignés |
| `texte.outil` | 15 | 600 | système | Libellé sous l'icône d'un outil (Annuler, Boucler, Supprimer) |
| `texte.surtitre` | 13 à 16 | 700 | Jost, capitales, espacement 1 à 1,2 | « PROCHAIN TRONÇON », « PROFIL ET TERRAIN », « DISPONIBLES » |
| `texte.corps` | 17 | 400 | système | Texte courant |
| `texte.secondaire` | 15 | 400 | système | Ligne d'explication, en `hn.brun-2` |
| `texte.legende` | 13 | 500 | système | Unités sous un chiffre, axes du profil. Minimum hors carte. |
| `texte.attribution` | 11 | 400 | système | Attributions de la carte seulement (imposé par les licences) |

- Interligne : 1,2 pour les chiffres et titres, 1,4 pour le corps.
- Chiffres : toujours `fontVariant: ['tabular-nums']`, toujours en police du
  système (décision 2 : « les chiffres restent sobres et très lisibles »).
- Nombres en français : virgule décimale (« 12,4 km »), espace fine avant
  l'unité. L'essai 1 a vu « 1.5 » sur Android : forcer le format français
  dans le code, ne pas dépendre de la langue du téléphone.
- Les tailles de guidage ne suivent **pas** la taille de texte du système
  au-delà de 120 % (elles sont déjà très grandes, et l'écran déborderait).
- Les noms d'itinéraires dans les listes restent en police du système : ils
  sont longs et variables, et Jost est plus large.

## Espacements

Échelle de 4 en 4 : `esp.1` = 4, `esp.2` = 8, `esp.3` = 12, `esp.4` = 16,
`esp.6` = 24, `esp.8` = 32, `esp.12` = 48.

- Marge latérale des écrans : 16 ; listes de cartes : 12.
- Écart entre deux cartes de liste : 8 à 10.
- Écart entre deux cibles tactiles : 8 à l'arrêt, 16 en roulant.

## Bords et rayons

### Navigation (direction B)

| Jeton | Valeur | Usage |
|---|---|---|
| `bord.guidage` | 3, `couleur.texte` | Bas du panneau de guidage, haut du panneau « Reste » |
| `rayon.bouton-velo` | 32 | Boutons de 64 du suivi |
| `rayon.plein` | 999 | Boutons ronds |

### Hors navigation (style années 70)

Tout élément a un bord brun : il détache l'élément au soleil, mieux qu'une
ombre.

| Jeton | Valeur | Usage |
|---|---|---|
| `hn.bord` | 2,5, `hn.brun` | Cartes, cases, boutons, segments, boutons posés sur la carte, bandeau d'alerte |
| `hn.bord-fort` | 3, `hn.brun` | Médaillons, arche, bord des feuilles du bas |
| `hn.rayon-bouton` | 24 (hauteur 48), 28 (hauteur 56), 32 (hauteur 64) | Boutons en pilule |
| `hn.rayon-carte` | 22 à 24 | Lignes de liste, cartes de zone, résumé de l'arrivée |
| `hn.rayon-case` | 18 | Cases de chiffres, outils, carte d'aide |
| `hn.rayon-feuille` | 28 | Haut des feuilles du bas (« bottom sheet », panneau qui monte du bas) |
| `hn.medaillon` | rond de 64, bord 3, anneau intérieur moutarde de 3 | Vignettes de la liste d'itinéraires |
| `hn.arche` | rayon 164 / 96 en haut, 18 en bas | Fenêtre de carte de l'écran « Infos » |

## Cibles tactiles

| Jeton | Valeur | Usage |
|---|---|---|
| `cible.arret` | 48 | Minimum à l'arrêt (Android : 48 dp, iOS : 44 pt ; on prend le plus grand) |
| `cible.velo` | 64 | Minimum sur l'écran de suivi, et bouton « Fermer » de l'écran « Arrivée » (lu sur le guidon) |
| `cible.bouton-principal` | hauteur 56 | « Démarrer le suivi », « En faire un itinéraire »… |
| `cible.outil` | hauteur 56, largeur ⅓ de la feuille | Annuler, Boucler, Supprimer |
| `cible.marqueur` | 48 | Zone de toucher d'un point de passage (dessin : 28) |

## Épaisseurs des tracés sur la carte

Valeurs au zoom 15. MapLibre interpole : environ × 0,6 au zoom 12, × 1,3
au zoom 17 (`line-width` en `interpolate` sur le zoom).

| Jeton | Création | Suivi | Détail |
|---|---|---|---|
| `trace.itineraire` | 7 | 10 | Trait plein, bouts et angles arrondis |
| `trace.itineraire-lisere` | 2 de chaque côté | 3 de chaque côté | Dessiné dessous, donc trait total de 11 et 16 |
| `trace.a-la-main` | 7 | 10 | Même couleur, en tirets 2 × l'épaisseur / 1 × l'épaisseur : on voit que ce tronçon n'est pas calculé |
| `trace.parcouru` | — | 8 | Sans liseré |
| `trace.circuit` | 6 | 6 | Sous l'itinéraire |
| `trace.circuit-choisi` | 8, liseré 2 | — | |
| `trace.piste` | 2,5 | 2,5 | |
| `trace.sentier` | 2, tirets 5 / 4 | 2,5, tirets 5 / 4 | Plus épais en suivi : c'est à une fourche qu'on en a besoin |
| `trace.courbe` / maîtresse | 1 / 1,8 | 50 % d'opacité | En suivi, le relief et les courbes s'effacent à moitié |

## Marqueurs sur la carte

| Jeton | Valeur |
|---|---|
| `marqueur.position` | Flèche de cap de 32 à l'arrêt, 40 en suivi, bord blanc de 3 |
| `marqueur.point` | Rond de 28, bord de 3, chiffre de 15 en gras |
| `marqueur.point-deplace` | Rond de 40 avec un halo, pendant qu'on le glisse |
| `marqueur.depart-arrivee` | Rond de 32 |

## Ombres

- Navigation : `ombre.flottant` = 0 2 8 noir à 25 %, toujours avec
  `couleur.contour-flottant`.
- Hors navigation : `hn.ombre` (plus haut), toujours avec `hn.bord`.
- Au soleil, une ombre seule ne suffit pas à détacher un bouton de la carte.

## Personnage : le vététiste

Décisions 3 et 6 : il apparaît sur la liste vide (50), le téléchargement
(51), l'erreur (52) et l'arrivée (60). En V2, il est animé sur le podium.
Il est dessiné pour être **animé sans être redessiné**.

### Règle de dessin

- Vu de profil, tourné vers la droite. Aplats sans contour, comme une
  affiche ; seul le vélo a des traits.
- Membres : traits ronds (`stroke-linecap: round`). Cuisse 36 de long, 10
  d'épaisseur ; tibia 36, épaisseur 8 ; bras 20, épaisseur 7 ; avant-bras 18,
  épaisseur 6. Buste : rectangle de 18 × 44, arrondi de 9. Tête : rond de 12
  de rayon. Hauteur debout : environ 145.
- Pas de texte dans les illustrations (traduction, lecture à 48 points). Un
  « ? » est un dessin, pas une lettre.
- Une illustration par écran au plus, jamais sur des chiffres.

### Couleurs

| Jeton | Valeur | Partie |
|---|---|---|
| `perso.peau` / `perso.peau-ombre` | `#D9956A` / `#B97A52` | Visage, bras, jambes ; côté caché en ombre |
| `perso.maillot` / `perso.maillot-ombre` | `hn.rouille` / `#8E3520` | Maillot, manches |
| `perso.bande` | `hn.moutarde` | Bande du maillot |
| `perso.casque` / `perso.visiere` | `hn.moutarde` / `hn.orange` | Casque |
| `perso.cuissard` | `hn.brun` (côté visible), `hn.brun-2` (caché) | Cuissard, gants, chaussures |
| `perso.cadre` | `hn.petrole`, trait 6 | Cadre du vélo |
| `perso.pneu` | `hn.brun`, trait 6, rayon 27 ; rayons `hn.brun-2`, trait 2 | Roues |
| `perso.boue` | `#7A4A1E` (= `terrain.piste`) | Éclaboussures (60, et V2) |

### Squelette (pour l'animation)

Chaque membre est un groupe SVG (`<G>` de `react-native-svg`) qui tourne
autour de son articulation. Une pose est une liste d'angles ; une animation
fait varier ces angles (`react-native-reanimated`).

| Groupe | Origine | Articulation des enfants |
|---|---|---|
| `vetetiste` | hanche (0, 0) | — |
| `buste` | hanche | épaule (0, −34), cou (0, −40) |
| `tete` | cou | — |
| `bras`, `bras-loin` | épaule | coude (0, 20) → `avant-bras` |
| `jambe`, `jambe-loin` | hanche | genou (0, 36) → `tibia` |
| `velo` | pédalier (0, 0) | roues (−42, −2) et (62, −2) ; `manivelle` (longueur 13) ; selle à (−12, −53) ; guidon à (43, −57) |

Deux couches : `perso-loin` (jambe et bras du côté caché) se dessine **avant**
le vélo, `perso-pres` **après**. Assis sur le vélo, la hanche est en
(−10, −56) par rapport au pédalier.

### Poses de la v1

| Pose | Écran | Angles principaux (degrés, sens horaire) |
|---|---|---|
| Carte vierge | 50 | buste 3 ; bras −37 / avant-bras −70 ; tête 15 |
| Roule | 51 | buste 55 ; bras −85,8 / −55 ; jambe −29,6 / 31,7 ; jambe cachée −56 / 102,9 ; manivelle 60 |
| Se gratte le casque | 52 | buste 0 ; bras −126,5 / −80,2 ; tête −6 |
| Podium | 60 | buste 0 ; bras −130 / −10 (trophée) ; bras caché 150 / 20 ; tête −10 |

Debout : jambe −6 / 8, jambe cachée 8 / −4 ; le sol est à 77 sous la hanche.

## Icône

Planche : `v1/70-icone.html`. Trois propositions (A soleil rayé, B arche,
C roue-soleil), à choisir par Émilien.

| Jeton | Valeur |
|---|---|
| `icone.canevas` | 108 × 108 (couches Android) ; partie visible : cercle de 72 au centre ; zone sûre : cercle de 66 |
| `icone.ios` | Carré plein de 1024 px, sans transparence, recadré sur les 72 du centre ; iOS arrondit lui-même les coins |
| `icone.fond` | `hn.creme` (A, C) ou `hn.brun` (B) |
| `icone.monochrome` | Android 13 et plus (icônes à thème) : une couche d'une seule couleur, le contour du dessin principal (roue pour C, soleil pour A, arche pour B) |
| `icone.notification` | Android : petite icône blanche (silhouette du même dessin), teinte d'accent `hn.rouille` |

## Mode sombre en v1 : non (décision 12)

- **Au soleil, le clair se lit mieux.** Un fond noir reflète le ciel et le
  visage, et le texte blanc perd son contraste.
- **Une deuxième carte à faire et à tester** : un style MapLibre sombre
  complet, sur les deux plateformes.
- **À faire quand même** : forcer le thème clair (`userInterfaceStyle:
  "light"` dans la configuration Expo). Sans cela, un téléphone réglé en
  mode sombre afficherait une app à moitié sombre (menus et feuilles du
  système en noir, nos écrans en crème).
- À reconsidérer en V2.
