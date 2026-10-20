# Jetons de design de RutaPulse

> Proposition du designer, 21 octobre 2026. À valider par Émilien.
> Un jeton (« design token ») est une valeur nommée, définie une seule fois
> ici et réutilisée partout : couleurs, tailles, espacements.
> Les maquettes HTML de `design/` recopient ces valeurs dans leur bloc
> `:root` (variables CSS), car chaque fichier doit s'ouvrir seul. **En cas
> d'écart, ce fichier fait foi.**

## Unité

Toutes les tailles sont en **points**. Un point vaut 1 `dp` (pixel
indépendant de la densité) sur Android, 1 `pt` sur iOS, 1 unité de style en
React Native, et 1 `px` dans les maquettes. Sur la carte, MapLibre compte
aussi ses épaisseurs de trait dans cette unité.

## Les conditions d'usage, et ce qu'elles imposent

| Condition | Conséquence |
|---|---|
| Plein soleil : l'écran reflète le ciel, les couleurs pâles disparaissent | Texte noir sur fond clair. Contraste du texte d'au moins 7:1 partout, 12:1 sur les écrans vus en roulant. Pas de gris clair pour une info utile. |
| Téléphone sur le guidon, à environ 65 cm des yeux au lieu de 30 cm en main | Les textes lus en roulant font au moins 20 points. L'info principale (distance avant la prochaine direction) fait 72 points. |
| Coup d'œil d'une seconde, avec les vibrations | Une seule info dominante. Chiffres en gras, à largeur fixe (`tabular-nums`, chiffres tabulaires) pour qu'ils ne sautent pas quand ils changent. |
| Gants | Cibles tactiles de 64 points en roulant, 48 à l'arrêt. 16 points entre deux cibles en roulant. Aucun geste à deux doigts obligatoire. |

## Couleurs

### Interface

Contraste mesuré sur fond blanc (`#FFFFFF`), calculé selon la formule WCAG
(règles d'accessibilité du web).

| Jeton | Valeur | Contraste | Usage |
|---|---|---|---|
| `couleur.fond` | `#FFFFFF` | — | Fond des écrans et des panneaux |
| `couleur.surface` | `#F2F2F2` | — | Cartes et zones groupées dans les listes |
| `couleur.texte` | `#111111` | 18,9:1 | Tout texte principal |
| `couleur.texte-2` | `#4A4A4A` | 8,9:1 | Texte secondaire. Rien de plus clair pour du texte. |
| `couleur.separateur` | `#D0D0D0` | décor | Filets entre lignes de liste |
| `couleur.contour-flottant` | `#111111` à 35 % d'opacité | décor | Bord de 1 point des boutons posés sur la carte : l'ombre seule ne se voit plus au soleil |
| `couleur.action` | `#0A47A8` | 8,1:1 | Bouton principal (fond), liens, onglet actif |
| `couleur.sur-action` | `#FFFFFF` | 8,1:1 sur `action` | Texte d'un bouton principal |
| `couleur.danger` | `#B3261E` | 6,5:1 | Supprimer, Terminer le suivi |
| `couleur.succes` | `#146C2E` | 6,5:1 | Zone prête, téléchargement fini |
| `couleur.imminent` | `#FFD400` | 13,2:1 avec `texte` | Fond du panneau de guidage à moins de 100 m d'une direction |

### Guidage (écran de suivi)

| Jeton | Valeur | Usage |
|---|---|---|
| `guidage.fond` | `couleur.fond` | Panneau de la prochaine direction, en temps normal |
| `guidage.fond-imminent` | `couleur.imminent` | Même panneau, à moins de 100 m de la direction |
| `guidage.texte` | `couleur.texte` | Flèche, distance, consigne |

### Carte : nos tracés

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
| `carte.position` | `#1A73E8`, bord blanc | — | Ma position. Bleu : convention des deux plateformes. |
| `carte.depart` | `#146C2E` | — | Pastille du départ |
| `carte.arrivee` | `#111111` | — | Pastille de l'arrivée (drapeau) |
| `carte.point` | fond `#FFFFFF`, bord `#C2007A`, chiffre `#111111` | — | Points de passage numérotés |

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

### Terrain (infos de l'itinéraire)

Mêmes teintes que la carte, pour qu'on n'ait qu'une légende à apprendre.

| Jeton | Valeur | Usage |
|---|---|---|
| `terrain.route` | `#5A5A5A` | Part de route |
| `terrain.piste` | `#7A4A1E` | Part de piste |
| `terrain.sentier` | `#C62828` | Part de sentier |
| `terrain.inconnu` | hachures `#BDBDBD` | Difficulté inconnue |

## Typographie

Police **du système** : SF Pro sur iOS, Roboto sur Android. Pas de police
à télécharger, rendu net, et elle suit la taille de texte choisie dans les
réglages du téléphone.

| Jeton | Taille | Graisse | Usage |
|---|---|---|---|
| `texte.guidage-distance` | 72 | 800 | « 200 » : distance avant la prochaine direction |
| `texte.guidage-unite` | 40 | 800 | « m », « km » à côté de la distance. Plus petit, pour que « 1,2 km » tienne sur la ligne avec la flèche |
| `texte.guidage-consigne` | 28 | 700 | « Tournez à gauche » |
| `texte.guidage-restant` | 36 | 800 | Distance restante (valeur) |
| `texte.guidage-etiquette` | 20 | 600 | « Reste », libellés lus en roulant (minimum en roulant) |
| `texte.chiffre-cle` | 28 | 700 | Distance, D+, durée, à l'arrêt |
| `texte.chiffre-cle-unite` | 17 | 700 | Unité à côté d'un chiffre clé (« km », « m », « h ») |
| `texte.titre-ecran` | 28 | 700 | Titre d'un écran |
| `texte.titre-section` | 20 | 700 | Titre d'un bloc |
| `texte.corps` | 17 | 400 | Texte courant |
| `texte.bouton` | 17 | 600 | Libellé de bouton |
| `texte.secondaire` | 15 | 400 | Ligne d'explication, en `texte-2` |
| `texte.legende` | 13 | 500 | Unités sous un chiffre, axes du profil. Minimum hors carte. |
| `texte.attribution` | 11 | 400 | « © OpenStreetMap… » seulement (imposé par les licences) |

- Interligne : 1,2 pour les chiffres et titres, 1,4 pour le corps.
- Chiffres : toujours `fontVariant: ['tabular-nums']`.
- Nombres en français : virgule décimale (« 12,4 km »), espace fine avant
  l'unité. L'essai 1 a vu « 1.5 » sur Android : forcer le format français
  dans le code, ne pas dépendre de la langue du téléphone.
- Les tailles de guidage ne suivent **pas** la taille de texte du système
  au-delà de 120 % (elles sont déjà très grandes, et l'écran déborderait).

## Espacements

Échelle de 4 en 4 : `esp.1` = 4, `esp.2` = 8, `esp.3` = 12, `esp.4` = 16,
`esp.6` = 24, `esp.8` = 32, `esp.12` = 48.

- Marge latérale des écrans : 16.
- Écart entre deux cibles tactiles : 8 à l'arrêt, 16 en roulant.

## Rayons d'angle

| Jeton | Valeur | Usage |
|---|---|---|
| `rayon.petit` | 8 | Pastilles, vignettes |
| `rayon.moyen` | 12 | Cartes, panneaux posés sur la carte |
| `rayon.feuille` | 16 | Haut des feuilles du bas (« bottom sheet », panneau qui monte du bas) |
| `rayon.bouton` | 28 | Boutons principaux de 56 et boutons ronds sur la carte |
| `rayon.plein` | 999 | Pastilles rondes, boutons ronds |

## Cibles tactiles

| Jeton | Valeur | Usage |
|---|---|---|
| `cible.arret` | 48 | Minimum à l'arrêt (Android : 48 dp, iOS : 44 pt ; on prend le plus grand) |
| `cible.velo` | 64 | Minimum sur l'écran de suivi |
| `cible.bouton-principal` | hauteur 56 | « Démarrer le suivi », « Enregistrer »… |
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

Une seule : `ombre.flottant` = 0 2 8 noir à 25 %, toujours avec
`couleur.contour-flottant`. Au soleil, une ombre ne suffit pas à détacher
un bouton de la carte.

## Mode sombre en v1 : non, je le déconseille

- **Au soleil, le clair se lit mieux.** Un fond noir reflète le ciel et le
  visage, et le texte blanc perd son contraste. Les compteurs de vélo GPS
  sont clairs le jour pour cette raison.
- **Une deuxième carte à faire et à tester.** Un mode sombre utile demande un
  style MapLibre sombre complet (fond, pistes, sentiers, courbes, relief),
  à régler et à valider sur les deux plateformes.
- **Usage de nuit rare** pour la v1, à confirmer par Émilien.
- **À faire quand même** : forcer le thème clair (`userInterfaceStyle:
  "light"` dans la configuration Expo). Sans cela, un téléphone réglé en
  mode sombre afficherait une app à moitié sombre (menus et feuilles du
  système en noir, nos écrans en blanc).
- **Contradiction à trancher** : l'ADR 0006 prévoit un « style de carte
  sombre pendant le suivi » pour économiser la batterie. C'est justement
  l'écran lu au soleil. Le gain réel n'est pas mesuré (l'essai 2 sur
  simulateur ne mesure pas la batterie). Question posée à Émilien dans
  `LISEZMOI.md`.
