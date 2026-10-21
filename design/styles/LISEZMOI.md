# Styles « décalés » pour les écrans hors navigation

> **Archive.** Le 21 octobre 2026, Émilien a choisi le **style 3, affiche
> des années 70** (`docs/06-decisions-design.md`). Les maquettes de
> référence sont désormais dans [`../v1/`](../v1/), et seules les valeurs du
> style 3 restent dans [`../tokens.md`](../tokens.md) (préfixe `hn.`). Les
> valeurs des styles 1, 2, 4 et 5 n'existent plus que dans leurs fichiers
> HTML ci-dessous. La suite de ce document est la proposition d'origine,
> laissée telle quelle.

> 21 octobre 2026. Proposition du designer, **à juger par Émilien**.
> Rien n'est validé. Suite de `docs/06-decisions-design.md` : la direction B
> reste celle du suivi et de l'écran verrouillé ; ici, on cherche le style
> des autres écrans.

## Comment regarder

- Cinq styles, chacun sur les deux mêmes écrans : « Mes itinéraires »
  (équivalent de `../40-mes-itineraires.html`) et « Infos de l'itinéraire »
  (équivalent de `../20-infos-itineraire.html`). Même contenu, même
  disposition générale, seul le style change.
- Fichiers HTML autonomes, 390 × 844 points, sans aucune ressource en ligne.
  Les captures iront dans `design/styles/captures/`, au même nom.
- Les valeurs (couleurs, contrastes, bords, polices) sont dans
  [`../tokens.md`](../tokens.md), section « Hors navigation : styles à
  l'essai ».
- Pour comparer vite : ouvrir les cinq « itinéraires » côte à côte, puis les
  cinq « infos ».

| N° | Style | Mes itinéraires | Infos |
|---|---|---|---|
| 1 | Cartoon épuré | `1-cartoon-epure-itineraires.html` | `1-cartoon-epure-infos.html` |
| 2 | Carnet de terrain dessiné | `2-carnet-de-terrain-itineraires.html` | `2-carnet-de-terrain-infos.html` |
| 3 | Affiche des années 70 | `3-affiche-annees-70-itineraires.html` | `3-affiche-annees-70-infos.html` |
| 4 | Néo-brutalisme coloré | `4-neo-brutalisme-itineraires.html` | `4-neo-brutalisme-infos.html` |
| 5 | Sérigraphie trois encres | `5-serigraphie-itineraires.html` | `5-serigraphie-infos.html` |

## Ce qui ne change dans aucun style

- **La carte.** La carte de l'écran « Infos » est la vraie carte MapLibre,
  avec son style (essai 3). Seul son cadre prend le style. Changer la carte
  voudrait dire un deuxième style de carte à faire et à tester.
- **L'itinéraire en magenta et les couleurs du terrain** (route, piste,
  sentier) : ce sont celles de la carte et de l'écran de suivi. Une seule
  légende à apprendre.
- **Les menus et boîtes de dialogue natifs** (menu d'une ligne, confirmation
  de suppression, feuille de partage) : sur iOS, le menu natif (`UIMenu`) ne
  se décore pas. Ils restent ceux du système, d'où le menu neutre sur les dix
  maquettes.
- **Les conventions** : trois onglets en bas, retour en haut à gauche,
  « ⋮ » pour les actions, titre en grand en haut de la liste.
- **La lisibilité** : texte à 7:1 de contraste au moins, 13 points au
  minimum, cibles de 48 points au moins.
- **Les noms d'itinéraires dans la liste restent en police du système**
  dans les cinq styles : ils sont longs et variables, et les polices de
  caractère (ronde, manuscrite, Futura) sont plus larges ; elles les
  couperaient.
- **Les vignettes de la liste sont des dessins du tracé**, générés à partir
  de sa géométrie (SVG, format d'image vectorielle), pas des morceaux de
  carte. Elles peuvent donc prendre le style.

## Style 1 : cartoon épuré (la piste d'Émilien)

**En une phrase** : des formes simples et arrondies, cernées d'un trait
d'encre épais de 3, des aplats de couleurs franches (ciel, herbe, soleil),
un bandeau de paysage dessiné en haut de la liste.

- **Pourquoi il sort du lot** : les apps de sport et de carte sont toutes en
  photos, dégradés et cartes grises. Un dessin cerné, comme une bande
  dessinée claire, se reconnaît d'un coup d'œil et donne un ton joyeux
  (le VTT, c'est de la boue et du plaisir, pas une feuille de calcul).
- **Risques**
  - Lisibilité : bonne. Contours épais et texte presque noir (16:1).
  - Sérieux perçu : risque d'un air « enfantin » ou « jeu ». À tenir par la
    retenue : peu d'illustrations, jamais de dessin sur les chiffres.
  - Vieillissement : faible si l'on reste sobre ; le dessin cerné est un
    classique de la bande dessinée, pas une mode d'une saison.
  - Effort de dessin : moyen. Il faut une petite règle de dessin (épaisseur
    du trait, rayons, palette) pour que chaque nouvelle illustration
    (écran vide, zone en téléchargement, arrivée) reste cohérente.
- **Avec la direction B** : très bonne cohabitation. B est déjà noir sur
  blanc, avec des filets noirs épais et du jaune. Le bouton jaune
  « Démarrer le suivi » mène au panneau blanc qui passe au jaune à
  l'approche d'une direction : même langage. Rien à changer dans B.
- **Développement**
  - Police : Nunito (licence libre OFL), 2 graisses, à embarquer avec
    `expo-font` (environ 130 Ko par graisse). Sur iOS, la police ronde du
    système (SF Pro Rounded) pourrait servir à la place, à éprouver.
  - Illustrations : bandeau, vignettes et profil en SVG avec
    `react-native-svg` (déjà courant). Les vignettes : deux tracés
    superposés (encre puis magenta).
  - Animations, facultatives : bouton qui s'écrase un peu quand on le touche,
    nuage qui dérive. Elles se coupent si le téléphone demande de réduire
    les animations. L'animation d'arrivée de la V2 (vététiste boueux sur le
    podium) tombe naturellement dans ce style.
  - Faisable en React Native : oui, sans difficulté.

## Style 2 : carnet de terrain dessiné

**En une phrase** : un carnet de naturaliste sur papier quadrillé, titres
écrits à la main, vignettes collées au ruban adhésif, profil hachuré au
crayon, cadres tracés à main levée.

- **Pourquoi il sort du lot** : il raconte la préparation d'une sortie comme
  on la ferait au crayon sur une carte papier. Chaleureux, artisanal, à
  l'opposé du tableau de bord lisse.
- **Risques**
  - Lisibilité : la plus faible des cinq. L'écriture manuscrite se lit moins
    vite (réservée aux titres) ; le quadrillage ajoute du bruit au soleil.
  - Sérieux perçu : bon. Évoque l'explorateur et la précision du relevé.
  - Vieillissement : moyen. L'imitation de matières réelles (papier,
    scotch), qu'on appelle « skeuomorphisme », a déjà connu une mode puis
    un rejet vers 2013.
  - Effort de dessin : élevé. Chaque cadre et chaque bouton doit avoir l'air
    tracé à la main, sans être identique aux autres.
- **Avec la direction B** : rupture nette. On passe du papier crème et de
  l'écriture à la main au blanc pur et aux gros chiffres. Elle peut se
  raconter (« le carnet pour préparer, le panneau pour rouler »), mais les
  deux mondes ne se ressemblent pas.
- **Développement**
  - Police : Patrick Hand (OFL), une graisse, à embarquer ; vérifier les
    accents (é, ô, É). Les maquettes utilisent Noteworthy, présente sur iOS
    et macOS seulement.
  - Illustrations : React Native ne sait pas faire les coins irréguliers
    des maquettes (rayons elliptiques). Chaque cadre devient un tracé SVG
    calculé à la taille de l'élément, avec un léger tremblé généré. C'est le
    plus gros travail des cinq.
  - Hachures (motifs SVG) et photos inclinées : faisables.
  - Animations : un trait qui se dessine (soulignement, cercle autour de
    l'onglet actif), faisable avec `react-native-reanimated`.
  - Faisable en React Native : oui, mais coûteux.

## Style 3 : affiche des années 70

**En une phrase** : une affiche de rando des années 70, crème et brun, un
soleil rayé posé sur des bandes moutarde, orange et rouille, des titres en
capitales géométriques, la carte dans une fenêtre en arche.

- **Pourquoi il sort du lot** : chaud, nostalgique, assumé. Il rappelle les
  affiches de voyage et le plein air d'avant les écrans.
- **Risques**
  - Lisibilité : bonne (brun sur crème, 12:1). Le fond crème est un peu
    moins lumineux que le blanc au soleil ; la barre d'onglets brune est
    sombre.
  - Sérieux perçu : bon, « vintage de qualité ».
  - Vieillissement : un style rétro vieillit peu, mais le retour des années
    70 a été très utilisé dans le plein air depuis 2020 : risque de
    « déjà vu ». Garder des bandes génériques pour ne rappeler aucune marque.
  - Effort de dessin : faible à moyen (bandes, soleil, arche : formes
    géométriques).
- **Avec la direction B** : rupture de palette. On passe du crème et du brun
  au noir et blanc. Le magenta de l'itinéraire jure un peu avec la palette
  chaude.
- **Développement**
  - Police : Jost (OFL, proche de Futura), 2 graisses, à embarquer pour
    avoir le même rendu sur Android (Futura n'existe que sur iOS).
  - Illustrations : SVG simples ; profil rempli de bandes par une découpe
    SVG (`clipPath`). L'arche : un grand rayon d'angle en haut ; les trois
    anneaux autour, des vues imbriquées avec bord.
  - Animations : aucune nécessaire. Éventuellement le soleil qui se lève à
    l'ouverture.
  - Faisable en React Native : oui, sans difficulté.

## Style 4 : néo-brutalisme coloré

**En une phrase** : des blocs aux angles vifs, bords noirs de 3, ombres
dures décalées sans flou, aplats citron, cyan, rose et jaune sur fond lilas,
titres en capitales très grasses.

- **Pourquoi il sort du lot** : brut, franc, presque provocant. Il assume
  ses boîtes au lieu de les cacher, à l'opposé des cartes douces et des
  ombres floues.
- **Risques**
  - Lisibilité : excellente (noir sur aplats clairs, 9,9:1 au moins ; bords
    visibles au soleil).
  - Sérieux perçu : « appli de start-up », énergique ; il peut sembler
    agressif ou laid à certains.
  - Vieillissement : **élevé**. C'est une mode du web très marquée
    (2021-2024) ; dans trois ans, il datera l'app.
  - Effort de dessin : faible. Pas d'illustration, que des règles.
- **Avec la direction B** : la plus proche. B a déjà le noir épais, le
  blanc et le jaune. Revers : il est si proche qu'il sort moins du lot
  que les autres, et B paraît sa version sans couleur.
- **Développement**
  - Police : celle du système en graisse 800 à 900, chiffres clés en chasse
    fixe du système. Rien à embarquer.
  - Ombres dures : propriété `boxShadow` de React Native (disponible depuis
    la 0.76, nous sommes en 0.88), ou une vue noire décalée derrière.
  - Animation : à l'appui, le bouton glisse sur son ombre (déplacement de 4).
    Trivial.
  - Faisable en React Native : oui, le plus simple des cinq.

## Style 5 : sérigraphie trois encres

**En une phrase** : une affiche imprimée à la main en trois encres (bleu
nuit, magenta, jaune) sur papier, avec des trames de points (« halftone »,
aplats faits de petits points) et des encres légèrement décalées sur les
titres.

- **Pourquoi il sort du lot** : il rappelle les affiches de festival et les
  fanzines, une texture que personne n'utilise dans le sport. Et ses deux
  encres vives sont **exactement** le magenta de l'itinéraire et le jaune
  du panneau de suivi.
- **Risques**
  - Lisibilité : texte bon (bleu nuit, 10:1), mais les trames et le
    décalage des encres ajoutent du bruit. Le décalage est réservé aux
    grands titres et au profil, jamais au texte courant.
  - Sérieux perçu : « artistique », moins « outil » ; peut plaire ou
    dérouter.
  - Vieillissement : moyen (la risographie, impression proche de la
    sérigraphie, est à la mode dans l'illustration depuis 2018).
  - Effort de dessin : moyen. Les trames et décalages sont des règles
    réutilisables, pas des dessins à la main.
- **Avec la direction B** : bonne. Mêmes couleurs fortes (magenta, jaune) ;
  seule la texture et le bleu nuit à la place du noir changent.
- **Développement**
  - Police : grotesque étroite du système, Avenir Next Condensed sur iOS,
    `sans-serif-condensed` (Roboto Condensed) sur Android. Rien à embarquer,
    mais les deux rendus diffèrent ; Barlow Condensed (OFL) à embarquer si
    l'on veut le même partout.
  - Trames : motifs SVG (`Pattern` de `react-native-svg`).
  - Décalage des encres : ombre de texte sans flou (`textShadow`), à
    éprouver sur Android, qui dessine mal une ombre au rayon 0 ; sinon le
    titre est écrit deux fois, superposé.
  - Superposition des encres (mode de fusion `multiply`) : propriété
    `mixBlendMode` de React Native (depuis la 0.77), ou couleurs de
    superposition calculées à l'avance.
  - Faisable en React Native : oui, avec deux points à éprouver.

## Comparaison rapide

| | 1 Cartoon | 2 Carnet | 3 Années 70 | 4 Brutalisme | 5 Sérigraphie |
|---|---|---|---|---|---|
| Sort du lot | fort | fort | moyen à fort | moyen | fort |
| Lisibilité au soleil | bonne | la plus faible | bonne | excellente | bonne |
| Risque de vieillir | faible | moyen | moyen | élevé | moyen |
| Effort de dessin | moyen | élevé | faible à moyen | faible | moyen |
| Lien avec B | très bon | rupture | rupture | très proche | bon |
| Polices à embarquer | 1 | 1 | 1 | 0 | 0 (1 en option) |

## Recommandation : le style 1, cartoon épuré

- Il répond à la piste d'Émilien et il est lisible au soleil : contours
  épais, texte presque noir.
- C'est le style qui s'accorde le mieux avec la direction B, sans rien
  changer à celle-ci.
- Il accueille déjà l'animation d'arrivée prévue en V2 : un vététiste
  boueux sur un podium est un personnage de cartoon.
- Il vieillit peu, à condition de rester épuré : une illustration par
  écran au plus, et jamais sur les chiffres.

Deuxième choix : le **style 5** (sérigraphie), si le cartoon paraît trop
enfantin. Il partage ses couleurs avec B et ne demande aucune police.
Je déconseille le style 4 (il vieillira vite) et le style 2 (le plus
coûteux et le moins lisible).

Après le choix, il restera à décliner le style sur la création (10, 11), le
circuit balisé (12) et les zones (41). Sur ces écrans, la carte occupe
presque tout ; seuls les feuilles du bas, les boutons et les pastilles
prennent le style.

## Questions pour Émilien (je ne les tranche pas)

1. **Quel style ?** Un seul, ou deux à pousser plus loin (par exemple
   1 et 5) avant de choisir ?
2. **Le ton de l'app** : RutaPulse doit-elle d'abord faire sourire (cartoon,
   sérigraphie) ou d'abord inspirer confiance (carnet, années 70) ? Cela
   dépend de ce que tu veux que tes proches ressentent en l'ouvrant.
3. **Un personnage récurrent ?** Le vététiste de l'animation d'arrivée (V2)
   doit-il apparaître ailleurs : liste vide, zone en téléchargement,
   erreur ? Avec le style 1, c'est naturel, mais c'est du dessin en plus.
4. **L'écran « Arrivé »** (le résumé à la fin du suivi) : dans le style des
   écrans hors navigation (moment de fête), ou dans la direction B (fin du
   suivi) ?
5. **L'icône de l'app** et le nom affiché : doivent-ils suivre le style
   choisi ? C'est la première chose qu'on voit sur l'écran d'accueil du
   téléphone.
6. **Le temps de dessin** : le style choisi demande des illustrations
   (bandeau, écrans vides). En v1, un minimum (un bandeau, une vignette), ou
   un jeu complet ?
