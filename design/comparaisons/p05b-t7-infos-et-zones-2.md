# Phase 5b, T7 (partie 2) : l'écran Infos (maquette 20) et la fin de l'écran Zones (maquette 41)

> 3 novembre 2026. Designer. Critère C15 (et C7, C8 pour ce qui se voit).
>
> Suite de `p05b-t7-zones.md` (partie 1). Je compare les captures release
> (version finale, sans menu de développement) regardées par le testeur :
> iOS sur iPhone 17, Android sur l'émulateur Android 14. Je regarde aussi si
> les corrections de T8 (commit 76a549b) règlent les écarts de la partie 1.
>
> Pas des écarts : les chiffres et les noms. La zone réelle est « Nancy »
> (111 Mo). Dans ces captures, la mise à jour proposée est la carte du
> 2 nov. (v5), plus la carte du 1 nov. (v4) de la partie 1. Les itinéraires
> sont ceux du testeur, pas la « Boucle du Bois de la Côte » de la maquette.
> L'écran Infos montré est celui ouvert depuis la création (titre « Nouvel
> itinéraire », un seul bouton « Modifier ») : la ligne « Difficulté » est la
> même que depuis « Mes itinéraires ».

## Comment j'ai mesuré

- Même méthode que la partie 1 : positions en points (iOS, 402 de large) ou
  en dp (pixels indépendants de la densité, Android, 411 de large), depuis
  le haut à gauche, à 3 près.
- Code lu quand la capture ne suffit pas : `RouteInfoScreen.tsx`
  (`DifficultyLine`), `typography.ts`, `fr.ts`, `ZoneUpdate.tsx`,
  `ZonesView.tsx`, `ProgressBar.tsx`, `zoneRow.ts` (`formatFreeSpace`).
- Gravité :
  - **bloquant** : gêne l'usage ou trahit une décision validée. À corriger
    dans cette phase ;
  - **non bloquant** : petit écart, avec la phase où le faire.

## Résumé

| Capture | Maquette, état | Bloquants | Non bloquants |
|---|---|---|---|
| iOS et Android `-60` | 20, plusieurs niveaux | 0 | D1, D2 |
| iOS et Android `-02` (C13) | 20, un niveau ; un niveau et « inconnue » | 0 | D1 |
| Android `-41` (mode avion) | 20, un niveau et « inconnue » | 0 | D1 |
| iOS `-26` (zone v3, sans table) | 20, aucune donnée | 0 | D3 |
| iOS et Android `-01` T8, iOS `-01` (t6-2c) | 41, écran 2 | 0 | 0 |
| Android `-04` | 41, écran 4 | 0 | P1 (reste de la partie 1) |
| Android `-28` | 41, variante A | 0 | 0 |
| Android `-21` | 41, variante B | 0 | Z1 |
| iOS `-30`, Android `-17` | 41, variante C | 0 | N6 (ancien) |
| **Total (écarts distincts)** | | **0** | **4 nouveaux (D1, D2, D3, Z1)** |

**Verdict sur C15 : tenu.** Toutes les captures demandées en partie 1 sont
là : B sur Android, C sur les deux plateformes, A en plus sur Android.
Aucun écart bloquant. La ligne « Difficulté » suit la maquette 20 : place,
taille, graisse, couleurs, ordre des niveaux, texte de la note. L'écran
Zones suit la maquette 41 dans tous les états vus, et T8 a réglé l'écart C1
(trait plein sur Android).

Restent hors capture, acceptés : écran 4 et variantes A et B sur iOS (même
composant que sur Android, et le simulateur iOS est toujours en Wi-Fi). À
revoir sur un vrai iPhone lors de l'essai terrain (phase 10).

---

## Écran Infos, maquette 20 : la ligne « Difficulté »

### Captures et état comparé

| Capture | État |
|---|---|
| `/Users/utilisateur/dev_ai/vtt-nav-preuves/p05b/t6-2b/p05b-ios-60-infos-r6-plusieurs-niveaux-release.png` | 5 niveaux connus et « inconnue » (6 parts) |
| `/Users/utilisateur/dev_ai/vtt-nav-preuves/p05b/t6-2b/p05b-android-60-infos-r6-plusieurs-niveaux-release.png` | même itinéraire, Android |
| `/Users/utilisateur/dev_ai/vtt-nav-preuves/p05b/t6-2c/p05b-ios-02-c13-ios-final.png` | un seul niveau, S2 sur 100 %, pas d'« inconnue » |
| `/Users/utilisateur/dev_ai/vtt-nav-preuves/p05b/t6-2c/p05b-android-02-c13-android-final.png` | S2 sur 9 % et « inconnue » sur 91 % |
| `/Users/utilisateur/dev_ai/vtt-nav-preuves/p05b/t6-2a/p05b-android-41-infos-difficulte-mode-avion.png` | même ligne, en mode avion |
| `/Users/utilisateur/dev_ai/vtt-nav-preuves/p05b/t6-2a/p05b-ios-26-c11-infos-sur-v3-v5-prete.png` | zone v3 sans table : aucune donnée |

### Ce qui est conforme

- **Place** : sous la légende « Route · Piste · Sentier », marge de 6,
  à 16 du bord gauche (iOS `-60` : x 16, y 655). Comme la maquette.
- **Taille et interligne** : 15, interligne 21 (maquette : 15 × 1,35 =
  20,25). Mesuré sur iOS `-60` : 4 lignes espacées de 21.
- **Graisse et couleurs** : « Difficulté » en gras, niveaux connus en
  `hn.brun`, partie « inconnue sur … %, la carte la donne rarement. » en
  `hn.brun-2` (code `DifficultyLine`, `styles.secondaryColor` ; l'écart de
  teinte se devine sur les captures).
- **Textes** : mot pour mot ceux de la maquette et de la spec. Mots de
  l'échelle justes : S1 (facile), S2 (moyen), S3 (difficile), S5 (extrême),
  S6 (non roulable). Séparateur « ; ». Point final quand il n'y a pas
  d'« inconnue » (iOS `-02` : « S2 (moyen) sur 100 %. »).
- **Ordre** : du plus fréquent au moins fréquent, puis « inconnue »
  (`-60` : 18, 13, 8, 2, 1, puis 58 ; total 100). C7 tenu.
- **Pourcentage** : espace fine insécable avant « % », comme la légende du
  terrain juste au-dessus. Le rendu plus large sur Android vient de la
  police Roboto, pas d'un écart.
- **Mode avion** (Android `-41`) : même ligne que `-02` en réseau. Rien ne
  dépend du réseau.
- **Zone sans table** (iOS `-26`) : « Difficulté inconnue, la carte la
  donne rarement. », sans erreur. C8 tenu pour ce qui se voit.
- **Lecture en plein soleil** : la ligne garde le contraste du texte
  principal (brun sur crème, plus de 12:1) ; seule la partie « inconnue »
  passe en brun-2 (7,5:1 au moins). Suffisant pour une info lue à l'arrêt.

### D1. Non bloquant : un niveau peut être coupé en fin de ligne

- **Captures** : iOS `-60`, ligne 2 à 3 : « S6 » en fin de ligne 2,
  « (non roulable) » en ligne 3 ; ligne 1 à 2 : « sur » en fin de ligne,
  « 13 % » à la ligne suivante. Android `-60` : « S6 (non » puis
  « roulable) ». Android `-02` et `-41` : « la » puis « carte la donne
  rarement. » (sans gêne).
- **Maquette 20** : exemple court, sur une ligne et demie, sans coupure dans
  un niveau.
- **Jugement** : non bloquant. On lit la phrase. Mais le couple « niveau,
  part » est l'info à saisir d'un coup d'œil ; le couper oblige à recoller
  deux bouts.
- **Correction** : dans `fr.ts` seulement, des espaces insécables
  (` `) :
  - dans les 7 mots de niveau : « S6 (non roulable) »,
    « S4 (très difficile) », « S0 (très facile) », et
    entre « Sn » et la parenthèse pour les autres ;
  - dans `info.difficultyShare`, `info.difficultyShareLow`,
    `info.difficultyUnknownShare` et `info.difficultyUnknownShareLow`,
    entre « sur » et le nombre (« sur {n} % »,
    « sur moins de 1 % »).
  - La coupure se fait alors seulement après « ; ». Les tests qui comparent
    le texte exact sont à mettre à jour avec.
- **Phase** : 5b si le développeur repasse sur `fr.ts`, sinon 10.

### D2. Non bloquant : les deux-points de « Difficulté : » sont en gras

- **Captures** : iOS et Android `-60`, `-02`, `-41`, début de la ligne.
- **Maquette 20** : `<b>Difficulté</b> :` ; les deux-points sont en
  graisse normale.
- **App** : `info.difficultyLabel` vaut « Difficulté : » et est rendu
  en entier en gras.
- **Jugement** : non bloquant, à peine visible. À aligner sur le bandeau
  « **Pas de Wi-Fi :** » de l'écran Zones, qui met lui aussi les
  deux-points en gras : les deux font pareil. **Je garde l'app telle
  quelle** et je tiens la maquette pour imprécise sur ce point.
- **Correction** : aucune dans l'app. Je mettrai la maquette 20 à jour
  (deux-points en gras) au prochain passage sur ce fichier.

### D3. Non bloquant : sans donnée, la ligne n'a plus de libellé en gras

- **Capture** : iOS `-26`, x 16, y 655 : « Difficulté inconnue, la carte la
  donne rarement. » tout en graisse normale, en brun.
- **Maquette 20** : ne dessine pas ce cas. La spec (C7) en fixe le texte.
- **App** : `DifficultyLine`, branche « aucun niveau connu » : une seule
  `Text`, sans partie en gras.
- **Jugement** : non bloquant. Mais d'un itinéraire à l'autre, l'œil cherche
  « Difficulté » en gras, comme les autres cas. Ici le mot se fond dans la
  phrase.
- **Correction** : garder le texte exact de C7, et mettre « Difficulté » en
  gras (brun), le reste « inconnue, la carte la donne rarement. » en
  `hn.brun-2`, comme la part « inconnue » des autres cas. Deux clés dans
  `fr.ts` (par exemple `info.difficultyUnknownLabel` = « Difficulté » et
  `info.difficultyUnknownRest` = « inconnue, la carte la donne
  rarement. »), avec une espace normale entre les deux.
- **Phase** : 10 (finitions), ou 5b si D1 est fait.

### Pas vu en capture (couvert par les tests)

- « moins de 1 % » (part connue ou « inconnue ») : pas de mise en page
  propre, le test de C7 suffit.
- « Difficulté indisponible » (table illisible) : texte de repli hors
  maquette, pas de capture demandée.

### Hors périmètre, à noter

- iOS `-26` : un fin trait vertical sépare deux morceaux de piste dans la
  bande de terrain (vers x 175, y 580). Android `-02` et `-41`, iOS `-02` :
  sur un itinéraire presque plat, le profil reste collé en bas avec un grand
  vide au-dessus. Ces deux points viennent des phases 2 et 3, pas de celle-ci.
  Je les reprendrai dans la revue de l'écran Infos de la phase 10.

---

## Écran Zones, maquette 41 : états restants et contrôle de T8

### Captures et état comparé

| Capture | État de la maquette 41 |
|---|---|
| `/Users/utilisateur/dev_ai/vtt-nav-preuves/p05b/t6-2a/p05b-ios-01-zones-maj-disponible-T8.png` | écran 2, après T8 |
| `/Users/utilisateur/dev_ai/vtt-nav-preuves/p05b/t6-2a/p05b-android-01-zones-maj-disponible-T8.png` | écran 2, après T8 |
| `/Users/utilisateur/dev_ai/vtt-nav-preuves/p05b/t6-2c/p05b-ios-01-zones-v3-installee-maj-proposee.png` | écran 2 (départ du parcours C13) |
| `/Users/utilisateur/dev_ai/vtt-nav-preuves/p05b/t6-2a/p05b-android-04-wifi-seulement-attente.png` | écran 4, « Wi-Fi seulement » en attente |
| `/Users/utilisateur/dev_ai/vtt-nav-preuves/p05b/t6-2a/p05b-android-28-zones-apres-stagnation.png` | variante A, échec |
| `/Users/utilisateur/dev_ai/vtt-nav-preuves/p05b/t6-2c/p05b-android-21-b-place-insuffisante.png` | variante B, place insuffisante |
| `/Users/utilisateur/dev_ai/vtt-nav-preuves/p05b/t6-2a/p05b-ios-30-c11-zones-variante-c-v5.png` | variante C, finie |
| `/Users/utilisateur/dev_ai/vtt-nav-preuves/p05b/t6-2c/p05b-android-17-c11-zones-variante-c-v5.png` | variante C, finie |

### Écran 2, après T8 : conforme

- **Trait en tirets sur les deux plateformes** : iOS de x 31 à 377, y 337 ;
  Android de x 31 à 386, y 336. Tirets réguliers, brun à 55 %. Sur iOS,
  rien n'a bougé par rapport à la partie 1 : carte de 209 de haut, texte à
  31 du bord, bouton de 48 sous le texte.
- **Textes** : « Mise à jour disponible », « 111 Mo · carte du 2 nov. »,
  « Mettre à jour ». Mot pour mot. La capture iOS `-01` de t6-2c est
  identique à celle de t6-2a, à la place libre près.

### Écran 4 (Android `-04`) : conforme, sauf P1

- **Tirets** dans le bandeau « Pas de Wi-Fi » (y 270) et dans la carte
  (y 457) : le même trait, comme la maquette. C1 réglé.
- **Barre vide** : plus de trait brun à gauche à 0 Mo (x 31 à 35, y 503).
  P2 réglé.
- **Croix** : centre vers (368, 477). Attendu d'après la maquette : 30 du
  bord droit de la carte (398), soit 368, à la hauteur du titre. Juste.
- **Reste P1** : l'icône pause (vers x 38, y 523) est encore environ 2 dp
  plus haute que le texte « En attente du Wi-Fi · 0 Mo sur 111 ». Le texte
  garde sa marge du haut de 5 dans la ligne (`ZoneUpdate.tsx`,
  `styles.progress`). Non bloquant, phase 10, correction inchangée (voir
  partie 1).

### Variante A, échec (Android `-28`) : conforme

- Ligne rouge « Échec de la mise à jour · 0 Mo sur 111 » en 15, graisse
  600, `hn.danger`. Phrase « La zone reste utilisable avec la carte du
  22 oct. » avec un seul point final. Mot pour mot.
- Barre vide sans trait (0 Mo : l'échec vient d'un téléchargement qui
  n'avançait plus). La maquette montre 47 Mo : simple différence d'instant.
- « Réessayer » : bouton clair, bord brun, Jost, à gauche sous la phrase
  (x 31), environ 56 de haut. La croix reste au niveau du titre et ne le
  chevauche pas (le titre garde 44 à droite).
- Haut de la carte inchangé : « 111 Mo · carte du 22 oct. », « Prête sans
  réseau ».

### Variante B, place insuffisante (Android `-21`) : conforme, plus Z1

- « Place insuffisante : il faut 161 Mo libres. » en rouge : 111 + 50, la
  règle de la note. Pas de barre. Puis la même phrase et le même
  « Réessayer » que l'échec. Comme la maquette.

### Z1. Non bloquant : « 0,0 Go libres » quand il reste moins de 50 Mo

- **Capture** : Android `-21`, en haut à droite de la section
  « DISPONIBLES » (x 321 à 395, y 521) : « 0,0 Go libres ».
- **Maquette 41** : la place libre est toujours en Go (« 23,4 Go
  libres ») ; la maquette ne dessine pas un téléphone plein.
- **App** : `formatFreeSpace` (`core/zones/zoneRow.ts`) écrit toujours en Go
  avec une décimale.
- **Jugement** : non bloquant, et cet état est rare. Mais c'est justement
  l'écran où l'utilisateur doit faire de la place : la carte lui dit qu'il
  faut 161 Mo, l'en-tête lui dit « 0,0 Go ». Il ne peut pas savoir combien
  libérer, et « 0,0 » ressemble à une erreur.
- **Correction** : sous 1 Go, écrire la place en Mo, avec le format de
  `formatMegabytes` (« 45 Mo libres ») ; à partir de 1 Go, garder « 8,4 Go
  libres ». Une règle dans `formatFreeSpace`, un test.
- **Phase** : 10 (finitions), ou au prochain passage sur `zoneRow.ts`.

### Variante C, finie (iOS `-30`, Android `-17`) : conforme

- Plus de partie « mise à jour », plus de trait. La carte montre « 111 Mo ·
  carte du 2 nov. » et « Prête sans réseau » : la nouvelle date, comme la
  note le demande. Pas de message. Carte de 90 de haut sur iOS (de y 247 à
  337), la taille d'une zone prête simple.
- Total de « SUR LE TÉLÉPHONE » à 111 Mo : juste (une seule version
  gardée). Place libre à jour.
- Seul écart visible : N6 (section « DISPONIBLES » vide, sans la ligne
  « Toutes les zones sont sur le téléphone. »). Ancien, phase 10.

---

## Écarts de la partie 1 : ce que T8 a corrigé

| Écart (partie 1) | État | Preuve |
|---|---|---|
| C1, trait plein sur Android | **Corrigé** | Tirets sur Android `-01` T8, `-04` (bandeau et carte), `-28`, `-21` ; iOS inchangé (`-01` T8). Code : `ui/DashedRule` dans `ZoneUpdate.tsx` et `ZonesView.tsx` |
| P1, icône pause 2 à 3 dp trop haute | **Pas corrigé** | Android `-04`, vers x 38, y 523. `styles.progress` garde `marginTop: 5` dans la ligne. Non bloquant, phase 10 |
| P2, trait brun dans la barre vide | **Corrigé** | Android `-04` et `-28`. Code : `ProgressBar.tsx`, `borderRightWidth: percent > 0 ? 2 : 0` |
| P3, « Lecture du catalogue… » décalé de 4 | **Corrigé dans le code, pas revu en capture** | `ZonesView.tsx` : `marginHorizontal: spacing.s1` sur le message, le titre et la phrase du bloc d'erreur. Aucune capture de ces états dans t6-2a à t6-2c |
| N4, N6 (phase 2) | Toujours ouverts | Phase 10, comme prévu |

Les manques listés en partie 1 sont comblés : variante A (Android),
variante B (Android), variante C (les deux). Restent non vus : écran 4 et
variantes A et B sur iOS, barre qui avance sur Android, retour à « Mise à
jour disponible » après annulation sur Android. Aucun n'a de mise en page
propre à iOS ou à Android que les autres captures ne montrent pas.

## Questions pour le Product Owner

Aucune. Tous les écarts relèvent du design. Les textes de C7 et C8 sont
gardés mot pour mot ; D3 ne change que la graisse et la couleur.
