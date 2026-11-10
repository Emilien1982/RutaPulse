# Phase 7 — Circuits balisés et trace modifiable : résultats

> Commencée le 9 novembre 2026, terminée le 10 novembre 2026, en trois
> sessions de phase (deux passations, deux arrêts pour la limite
> d'utilisation). Spec : [p07-circuits-balises.md](p07-circuits-balises.md).
> Branche `claude/phase-7-circuits-balises-715f16`, poussée, non fusionnée.
>
> **15 critères sur 16 sont tenus.** C12 ne l'est qu'en partie : sur
> iPhone, « En faire un itinéraire » prend 1,25 s (cible : moins de 1 s),
> et le glisser d'un point n'est pas mesuré. Les réserves sont écrites plus bas.

## En bref

- **Fabrique** : chaque circuit VTT balisé d'un seul morceau reçoit sa
  ligne ordonnée dans le sens de la relation OSM (OpenStreetMap), et dit
  s'il est une boucle. La règle d'ordre est tolérante : elle retire les
  petits culs-de-sac et les petites boucles, garde une branche d'une
  variante, et refuse un circuit si elle doit en retirer plus de 15 %.
  **Zone Nancy v6** fabriquée sur GitHub et publiée.
- **Couche des circuits** sur l'onglet Carte et dans la création. Elle est
  visible dès la vue de toute la zone (zoom 8). Les chevrons de sens
  apparaissent dès le zoom 10. Toucher un circuit ouvre sa **feuille**
  (maquette 12) : nom, longueur, boucle ou aller simple, attribution OSM.
  Si la zone est ancienne, la feuille propose de la mettre à jour.
- **« En faire un itinéraire »** : la création s'ouvre avec le circuit
  découpé en points de passage, sans aucun calcul du moteur. Seuls les
  tronçons touchés sont recalculés. La partie hors zone reste un tronçon
  gardé, et une bulle le dit. L'itinéraire s'enregistre avec l'origine
  « circuit balisé », puis « circuit modifié » après une retouche.
- **« Modifier » d'un GPX importé** : même geste et même fidélité. Une
  bulle dit que l'enregistrement remplace l'original. L'origine devient
  « GPX modifié ».
- **« Dupliquer »** dans le menu (4 actions). Sur Android, ce menu est une
  feuille faite dans l'app (`Modal`), acceptée par le designer.
- **Base en version 2** (origines `trail` et `editedGpx`), avec une montée
  de version testée depuis la version 1. Elle est vérifiée sur les deux
  simulateurs (contrôle 2).
- `npm run verify` : 220 suites, **2 529 tests** réussis. Jest rend enfin
  la main : les minuteurs de TanStack Query sont en `unref`. `pytest` :
  **280 tests** réussis. CI verte (runs plus bas).

## Où sont les preuves

Les preuves durables sont hors du dépôt, dans
`/Users/utilisateur/dev_ai/vtt-nav-preuves/p07/` (abrégé `preuves/`
ci-dessous). Chaque dossier a son `LISEZMOI.md`.

| Quoi | Chemin |
|---|---|
| ADR 0020 (acceptée le 9 novembre 2026) et ADR 0003 complétée | [0020-circuits-balises-et-trace-modifiable.md](../adr/0020-circuits-balises-et-trace-modifiable.md) |
| Maquettes 10, 12, 20, 40 (T1), alignées après T8 | `design/v1/`, captures `design/v1/captures/12-circuit-balise.png`, `40-mes-itineraires.png` |
| Essai jetable T1 (C1) ; contrôle 1 (D+) | `preuves/t1-essai/`, `preuves/controle1/` |
| Fabrique T2 ; zone v6 publiée | `preuves/t2-fabrique/`, `preuves/t2-testeur/`, `preuves/t2-release-v6/` |
| Logique pure T3 | `preuves/t3-logique/`, `preuves/t3-testeur/` |
| Couche et feuille T4 (contrôle 5) | `preuves/t4-couche/`, `preuves/t4-testeur/` |
| Base v2 T5a (contrôle 2) | `preuves/t5a-base/`, `preuves/t5a-testeur/` |
| Itinéraire d'un circuit T5b | `preuves/t5b-itineraire/`, `preuves/t5b-testeur/` |
| Dupliquer et menu T6a (contrôle 6) | `preuves/t6a-dupliquer/`, `preuves/t6a-testeur/` |
| « Modifier » d'un GPX T6b | `preuves/t6b-gpx/`, `preuves/t6b-testeur/` |
| Simulateurs T7 (C3, C7, C11, C12, C13, captures) | `preuves/t7/android/`, `preuves/t7/ios/` |
| Comparaison du designer (C15) | [p07-t8-circuits-balises.md](../../design/comparaisons/p07-t8-circuits-balises.md) |
| Corrections T9 et leur vérification en release | `preuves/t9-corrections/`, `preuves/t9-verif/` |
| Sortie finale `pytest` | `preuves/fin/` |
| Parcours Maestro | `mobile/e2e/p07-circuit.yaml`, `p07-gpx-modifier.yaml`, `p07-dupliquer.yaml` et leurs variantes `-ios` ; `p04-creer-modifier`, `p06-enregistrer`, `p06-itineraires` remis à jour |

## Critères

iPhone 17 (iOS 26.5) et émulateur Android (`emulator-5584`), version finale
(release). T7 sur `7faff23` (Android) et `313cd03` (iOS), vérification des
corrections sur le code de `30a5280`.

| # | Critère | Résultat | Preuve | Tenu |
|---|---|---|---|---|
| C1 | Essai d'abord | Toucher une ligne fine : OK sur les deux. Un circuit rouvert garde son tracé (0,000 m d'écart, 0 calcul) ; déplacer un point lance 2 calculs. Les deux circuits de Nancy se remettent en ordre (règle tolérante) | `preuves/t1-essai/` | **oui** |
| C2 | Fabrique : ligne ordonnée et boucle | `pytest` sur des cas fabriqués : voie à l'envers, sous-relation, boucle, fourche, morceaux séparés, côté de boucle, voie unique. Lorraine : 87 circuits d'un seul morceau refusés sur 281 (31 %, sous le tiers) | `preuves/t2-fabrique/`, `preuves/t2-testeur/` | **oui** |
| C3 | Zone Nancy v6, mise à jour depuis la v5 | Run 42643796850, release `zone-nancy-v6`, catalogue en v6 (API publique). Sur l'émulateur, en v5 : la feuille propose « Mettre à jour · 111 Mo ». Après la mise à jour : seul `v6` reste, la feuille propose « En faire un itinéraire » | `preuves/t2-release-v6/`, `preuves/t7/android/captures/c3-*` | **oui** |
| C4 | Couche sous le tracé, au-dessus des voies ; toucher sur l'onglet Carte seulement | Ordre des couches et nom le long du trait vérifiés sur les deux (contrôle 5). Couche dès z8 et chevrons dès z10 après T9 (vu sur Android) | `preuves/t4-testeur/`, `preuves/t9-verif/` | **oui** |
| C5 | Feuille du circuit (maquette 12) | Nom, 34,9 km, boucle, attribution, bouton. Le cas « en plusieurs morceaux » est vu en Jest seulement (aucun à Nancy) | `preuves/t7/*/captures/` | **oui** |
| C6 | « En faire un itinéraire » : sens, départ | Boucle : départ au point le plus proche de la position ; aller simple : au début. Tests de la logique pure, et parcours sur les deux simulateurs | `preuves/t3-logique/`, `preuves/t7/` | **oui** |
| C7 | Fidélité à 1 m et 10 m, aucun calcul à l'ouverture | Jest sur les deux circuits de Nancy et sur un GPX de 10 000 points. À l'écran : 34,9 km dans la feuille, la création et l'Infos, sur les deux plateformes | `preuves/t3-*`, `preuves/t7/` | **oui** |
| C8 | Modifier : seuls les tronçons touchés ; hors zone | Tests ; parcours Maestro (ajout d'un point). Un tronçon hors zone reste gardé et une bulle le dit. Après T9, cette bulle n'est plus perdue si on touche pendant la première (vu sur Android) | `preuves/t5b-*`, `preuves/t9-verif/` | **oui** |
| C9 | Enregistrer, base v2 | Nom du circuit, puis « (2) », « (3) » ; origine « circuit balisé ». Montée de version depuis la v1 testée sur un vrai SQLite et sur les deux simulateurs | `preuves/t5a-*`, `preuves/t5b-testeur/` | **oui** |
| C10 | « Modifier » d'un GPX | Bouton présent si la zone est `usable` ou `leaves`, absent sinon. Enregistrer sans changement : rien n'est écrit (bouton inactif). Abandon : GPX intact. Parcours Maestro sur les deux | `preuves/t6b-*`, `preuves/t7/` | **oui** |
| C11 | Infos inchangées (distance à 10 m, D+ à 5 m) | Circuit : D+ 459 m dans la création et dans l'Infos, sur les deux plateformes. GPX de 10 000 points : 9,5 km et D+ 16 m des deux côtés. GPX de 53,6 km : D+ 835 m des deux côtés | `preuves/t7/`, `preuves/t6b-testeur/` | **oui** |
| C12 | Rapidité en release | « Modifier » d'un GPX de 10 000 points : 747 ms sur Android ; 1,00 s sur iOS, animation comprise, contenu affiché à 0,4 s. **« En faire un itinéraire » (35 km)** : sur Android, contenu à 0,45 s ; **sur iOS, 1 236 à 1 257 ms**. **Glisser : non mesuré** (voir réserves) | `preuves/t7/`, `preuves/t9-verif/` | **en partie** |
| C13 | Parcours Maestro | Android en mode avion : circuit, GPX, Dupliquer, non-régression (p04, p06). iOS sans mode avion : variantes `-ios`. `p07-gpx-modifier-ios` est à reprendre après T9 (voir réserves) | `preuves/t7/*/maestro/`, `preuves/t9-verif/*/maestro/` | **oui**, réserve iOS |
| C14 | `verify`, `pytest`, CI | 2 529 tests, 280 `pytest`, CI verte | runs plus bas | **oui** |
| C15 | Captures comparées par le designer | 2 bloquants et 8 mineurs, corrigés en T9 et revérifiés en release. 6 mineurs laissés pour la phase 10 | [p07-t8-circuits-balises.md](../../design/comparaisons/p07-t8-circuits-balises.md), `preuves/t9-verif/` | **oui** |
| C16 | Dupliquer | « (copie) », puis « (copie 2) », 60 caractères au plus. La copie garde l'origine, arrive en haut de la liste, et la modifier laisse l'original intact. Tests sur un vrai SQLite ; parcours Maestro sur les deux | `preuves/t6a-*`, `preuves/t7/` | **oui** |

## Runs de la CI

| Commit | Moment | Run | Résultat |
|---|---|---|---|
| `7f08525` | fabrique T2 | 42643371709 ; zone v6 : 42643796850 | succès |
| `2090381` | logique pure T3 | 42646145387 | succès |
| `70fc79e` | couche T4 | 42669302972 | succès |
| `5be541b` | base v2 T5a | 42671398073 | succès |
| `252497e` | itinéraire d'un circuit T5b | 42679582899 | succès |
| `1aeb980` | Dupliquer T6a | 42706438765 | succès |
| `7faff23` | « Modifier » d'un GPX T6b | 42710487041 | succès |
| `e71ca53` | parcours Maestro T7 | 42723837620 | succès |
| `eec05bb` | comparaison T8 | 42725207838 | succès |
| `30a5280` | corrections T9 | 42742545812 | voir le message de fin |

## Écarts et réserves

- **C12 « En faire un itinéraire » sur iOS : 1,25 s au lieu de moins de
  1 s.** La création s'ouvre bien cadrée et sans saut (correction M6 de
  T9). Mais avant, la carte de l'onglet Carte vole environ 0,5 s vers la
  position de l'utilisateur. T9 n'a gagné que 50 ms (avant : 1,29 à
  1,31 s). Corriger ce vol demande une nouvelle construction iOS, que la
  place disque ne permettait pas (décision du pilotage).
- **C12 glisser d'un point : non mesuré** (décision du pilotage). Sur
  l'émulateur, la vidéo donne un écart maximal de 134 à 235 ms (36 points)
  et de 161 à 177 ms (52 points). Mais le témoin, un simple balayage de la
  carte, fait déjà 132 ms : l'émulateur limite la mesure. Repère : le
  mécanisme du glisser est celui de la phase 4, mesuré à 31 ms au plus sur
  iOS. Le glisser réel d'un point marche (`adb shell input draganddrop` :
  le D+ passe de 835 à 811 m).
- **Glisser sous Maestro impossible** : un balayage déplace la carte, pas
  le point. Les parcours ajoutent donc un point par un toucher.
- **D+ selon la plateforme et la version.** Le circuit Petite Suisse
  Lorraine affiche 459 m en release sur les deux plateformes, et 469 m en
  debug sur iPhone (T5b). Après une retouche, le D+ n'est qu'un ordre de
  grandeur (environ ±6 %, parade b de l'ADR 0020).
- **Vu sur Android seulement** (après T9) : M2 (titre de l'Infos d'un
  circuit non enregistré), M4 (couche dès z8), la file des bulles. Le code
  est commun aux deux plateformes, et des tests Jest couvrent ces points.
- **Vu en Jest seulement** : la liste « {n} circuits passent ici » (aucun
  chevauchement à Nancy) ; la feuille sans réseau (pas de mode avion sur
  le simulateur iOS) ; un circuit en plusieurs morceaux ; l'annonce vocale
  « Copie créée ».
- **Parcours Maestro à reprendre** : `p07-gpx-modifier-ios` touche une
  vignette par sa position dans le sélecteur de fichiers, et la grille a
  changé ; `p06-enregistrer` laisse un itinéraire dans la liste.
- **Tests existants adaptés**, chacun décidé par la session de phase et
  justifié dans les preuves de sa tâche : mocks ajoutés sans retrait
  d'assertion (T4, T5a, T5b) ; menu Android passé d'une alerte à une
  feuille (T6a, 13 fichiers) ; « pas de Modifier sur un GPX » retourné,
  car C10 le remplace (T6b) ; minzoom, texte de mise à jour échouée,
  ordre des points d'une boucle (T9).
- **Le trajet qui sort puis revient dans la zone** : déplacer un point
  voisin recalcule dans la zone et efface la partie hors zone. « Annuler »
  la rend. C'est accepté pour la v1.
- **Garde-fou** : aucun refus contourné.
  - Refusés au relecteur : `git -C`, `grep`, `git grep`, `git ls-files`,
    `tail`, `ls`, les commandes enchaînées. La relecture s'est faite sur
    des fichiers de diff, lus directement.
  - Refusé au développeur : `pkill -P` (arrêt par PID ensuite).
  - Refusé à la session de phase : arrêter par PID un `find /` qu'un
    testeur avait laissé tourner 4 h.
  - Refusés en T2 : `cd` au relecteur, et une consigne au testeur qui
    proposait un contournement.
- **Deux arrêts pour la limite d'utilisation**, pendant les testeurs de T6a
  et de T9 : la reprise s'est faite là où le testeur s'était arrêté.
- **Place disque** : entre 12 et 17 Go libres pendant toute la fin de
  phase. Il n'y a eu que les constructions release nécessaires : une par
  plateforme en T7, une par plateforme en T9.

## Pour plus tard

- **C12 iOS** : supprimer le vol de la carte vers la position avant
  d'ouvrir la création, puis mesurer à nouveau (phase 10).
- **Design** (comparaison T8, phase 10) :
  - L1 : habillage de la feuille du circuit ;
  - L2 : avis sur fond moutarde pâle ;
  - L3 : icônes dans la feuille du menu Android ;
  - L4 : une seule ligne par circuit, pour éviter les points foncés aux
    jonctions ;
  - L5 : police d'« Enregistrer ».
  - Un anneau rose bref apparaît sur le départ, sur iOS, pendant le calcul.
- **Choix qui changent un détail des maquettes validées** (fait par le
  designer en T8, à montrer à Émilien) :
  - circuits visibles dès la vue de toute la zone ;
  - « Enregistrer » actif seulement une fois les chiffres arrivés (environ
    1 s pour un circuit).
- **Émulateur Android** : le réglage « Wi-Fi seulement » de l'app est
  désactivé (il l'a fallu pour la mise à jour v5 → v6 en 3G). À remettre
  si besoin.
- **Trait de liaison** d'un point posé hors chemin : à trancher avant la
  phase 8 (déjà noté).
