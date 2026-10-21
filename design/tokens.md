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

## Hors navigation : styles à l'essai (non validés)

> Ajouté le 21 octobre 2026. Cinq styles « décalés » pour les écrans hors
> navigation (`design/styles/`). **Aucun n'est validé.** Quand Émilien en
> choisit un, ses valeurs remplacent ici celles de l'interface pour ces
> écrans ; les autres sont supprimées.
>
> **Ne changent dans aucun style** : tout l'écran de suivi et l'écran
> verrouillé (direction B), les jetons `carte.*`, `terrain.*`, `trace.*`,
> `marqueur.*`, les cibles tactiles, les tailles de texte minimales, le
> menu natif des lignes, les boîtes de dialogue du système, `couleur.danger`.
> Contraste du texte : 7:1 au moins dans chaque style (mesuré ci-dessous
> sur le fond principal).

### Style 1 : cartoon épuré

| Jeton | Valeur | Contraste | Usage |
|---|---|---|---|
| `s1.fond` | `#FFF8EC` | — | Fond des écrans |
| `s1.carte` | `#FFFFFF` | — | Cartes de la liste, boutons secondaires |
| `s1.encre` | `#1E1B2E` | 16:1 | Texte et tous les contours |
| `s1.encre-2` | `#4A4560` | 8,6:1 | Texte secondaire |
| `s1.ciel` / `s1.ciel-pale` | `#BDE5FF` / `#E3F4FF` | encre 12,7:1 | Bandeau, fond du profil |
| `s1.herbe` / `s1.herbe-claire` | `#7FCB5E` / `#B9E7A0` | décor | Collines, profil |
| `s1.soleil` / `s1.soleil-bord` | `#FFD23F` / `#E8A900` | encre 11,7:1 | Bouton principal, onglet actif, bouton ouvert |
| `s1.case-1` à `4` | `#BDE5FF` `#FFE79A` `#C9EDB4` `#FFD6C9` | encre 12:1 au moins | Les quatre chiffres clés |
| `s1.trait` | 3 | — | Contour de tout élément (cartes, boutons, vignettes, profil) |
| Rayons | cartes 20, cases 18, vignettes 16, boutons 24 à 28 | — | Tout est arrondi |
| Police titres et chiffres | Nunito 800 (à embarquer) | — | Système pour noms, corps et menus |

### Style 2 : carnet de terrain dessiné

| Jeton | Valeur | Contraste | Usage |
|---|---|---|---|
| `s2.papier` | `#F6F0E1` | — | Fond |
| `s2.quadrillage` | `#E4DAC3`, pas de 22 | décor | Quadrillage du papier |
| `s2.encre` | `#1F2A44` | 12,5:1 | Texte, contours, bouton principal (fond) |
| `s2.encre-2` | `#4F4636` | 8,2:1 | Texte secondaire |
| `s2.crayon` | `#8C7B5A` | décor | Filets dessinés entre les lignes |
| `s2.crayon-rouge` | `#B3261E` | décor | Soulignés, cercle autour de l'élément actif |
| `s2.scotch` | `#ECCE78` à 78 % | décor | Ruban adhésif des vignettes |
| `s2.case` | `#FFFDF6` à 82 % | — | Fond des cases, pour les détacher du quadrillage |
| Bords | 2, rayons irréguliers (4 à 16, différents à chaque coin) | — | Effet « tracé à main levée » |
| Police titres | Patrick Hand (à embarquer) | — | Titres d'écran et de bloc seulement |

### Style 3 : affiche des années 70

| Jeton | Valeur | Contraste | Usage |
|---|---|---|---|
| `s3.creme` / `s3.creme-clair` | `#F4E4C1` / `#FBF1DA` | — | Fond / cartes et cases |
| `s3.brun` | `#3A1F0F` | 12,1:1 | Texte, contours, barre d'onglets, bouton principal |
| `s3.brun-2` | `#5A3A28` | 8,1:1 | Texte secondaire |
| `s3.moutarde` | `#F0A830` | brun 7,5:1 | Soleil, onglet actif, bande |
| `s3.orange` / `s3.rouille` | `#E2652B` / `#B5452A` | décor, jamais sous du texte | Bandes |
| `s3.petrole` / `s3.olive` | `#2D6A66` / `#A9B56A` | décor | Rivière et forêts des vignettes, bande d'une case |
| Bords | 2,5 à 3 ; rayons 18 à 28, vignettes rondes, carte en arche | — | |
| Police titres et chiffres | Jost 700 (à embarquer ; Futura dans les maquettes) | — | Système pour noms et corps |

### Style 4 : néo-brutalisme coloré

| Jeton | Valeur | Contraste | Usage |
|---|---|---|---|
| `s4.fond` | `#D9CCFF` (lilas) | — | Fond |
| `s4.blanc` | `#FFFFFF` | — | Cartes, bande du profil |
| `s4.noir` | `#111111` | 12,6:1 sur lilas | Texte, bords, ombres |
| `s4.texte-2` | `#2E2E2E` | 9,1:1 | Texte secondaire |
| `s4.citron` `s4.cyan` `s4.rose` `s4.jaune` | `#C8F560` `#7FE3F0` `#FF9ECD` `#FFD400` | noir 9,9:1 au moins | Aplats des cases, vignettes, boutons |
| `s4.bord` | 3, noir, angles vifs | — | Tout élément |
| `s4.ombre` | décalage 4 × 4 (3 × 3 pour les cases), sans flou, noir | — | Tout élément touchable |
| Police | Système 800 à 900 ; chiffres clés en chasse fixe du système | — | Rien à embarquer |

### Style 5 : sérigraphie trois encres

| Jeton | Valeur | Contraste | Usage |
|---|---|---|---|
| `s5.papier` | `#F3EEE3` | — | Fond |
| `s5.bleu` | `#24336B` | 10,3:1 | Seule encre du texte ; bords, bouton principal |
| `s5.bleu-2` | `#3A4470` | 8,1:1 | Texte secondaire |
| `s5.magenta` | `#C2007A` (= `carte.itineraire`) | décor, jamais du texte | Trames, décalage des titres, ombre du bouton |
| `s5.jaune` | `#FFD400` (= `couleur.imminent`) | bleu 8,3:1 | Trame de l'en-tête, surlignage des chiffres |
| `s5.trame` | points de 1,2 à 2,3, pas de 4,5 à 7 | décor | Aplats tramés |
| `s5.decalage` | 2 à 2,5 vers la droite et le bas, magenta | décor | Titres et profil : encre « mal calée » |
| Bords | 2 à 4, rayon 4 | — | |
| Police titres | Grotesque étroite du système : Avenir Next Condensed (iOS), `sans-serif-condensed` (Android) | — | Rien à embarquer |

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
