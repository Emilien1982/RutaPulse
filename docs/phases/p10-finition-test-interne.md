# Phase 10 — Finition et test interne

> 17 novembre 2026. Spec de la session de pilotage, **à valider par
> Émilien**. Dernière phase de la v1 (la phase 9 est passée en V2 le
> 10 novembre). Décision d'Émilien du 10 novembre : commencer par l'APK
> Android installable et l'app iOS installée par Xcode, pour **un premier
> essai réel au plus tôt**.
> S'appuie sur le cadrage ([docs/03](../03-cadrage-produit.md) : test
> interne, sans publication sur les stores), le découpage
> ([docs/05](../05-decoupage-v1.md), ligne 10), l'essai 2 (signature avec
> un compte Apple gratuit, § C5), les décisions de design 1 et 5
> ([docs/06](../06-decisions-design.md) : icône A, « le soleil rayé ») et
> les maquettes v1/70 (icône) et v1/80 (Réglages).

## Objectif

Mettre RutaPulse **sur un vrai téléphone**, l'essayer sur le terrain,
puis finir l'app avec ce que l'essai aura appris.

## Découpage proposé : 10a, essai réel, puis 10b, finitions

La phase 10 regroupe deux travaux de nature différente. Je propose de la
couper en deux, avec ton essai sur le terrain entre les deux :

| Partie | Contenu | Taille |
|---|---|---|
| **10a — Premier essai réel** | Icône, écran de démarrage, textes du système en français ; APK Android signé et installable ; app iOS installable par Xcode avec ton compte Apple gratuit ; guide d'installation ; fiche d'essai terrain | **P** |
| *Ton essai* | Tu installes l'app, tu roules avec la fiche d'essai, tu notes ce qui ne va pas | — |
| **10b — Finitions** | Écran « Licences et attributions » ; très grandes tailles de texte ; brouillon gardé sur Android ; écarts de design en attente ; rapidité iOS ; corrections venues de ton essai | **M** |

**Pourquoi.** L'essai réel arrive après une seule petite phase, au lieu
d'attendre toutes les finitions. Et les finitions de 10b profitent de
ton retour : on corrige ce qui gêne vraiment sur le vélo, pas seulement
ce qu'on voit sur simulateur.

La spec détaillée de 10b sera écrite après ton essai. Sa liste de départ
est en fin de document.

**Échelle des tailles** (docs/05) : **P** (petite) = 1 session de phase ;
**M** (moyenne) = 2 sessions ; **G** (grande) = 3 sessions ou plus. Une
« session » est une conversation de phase qui mène 3 ou 4 tâches avant
sa passation écrite. Pour repère : la phase 8b (P) a pris environ
25 points du quota de la semaine ; la 8a (M) environ 60.

---

# Phase 10a — Premier essai réel

## Ce que tu verras à la fin

- Sur les simulateurs, puis sur ton téléphone : l'**icône A** (le soleil
  rayé) sous le nom « RutaPulse », et un **écran de démarrage** au style
  de l'app, à la place des images par défaut d'Expo (fond bleu).
- Les **textes du système en français** : demande de position, nom de
  l'app, boutons des feuilles natives.
- **Android** : un fichier `RutaPulse-1.0.0.apk`, signé par une clé
  propre au projet, gardée hors du dépôt. Une commande le fabrique.
- **iOS** : l'app se construit pour un vrai iPhone. Un guide dit, pas à
  pas, ce que tu fais dans Xcode avec ton compte Apple gratuit (tu te
  connectes toi-même ; personne d'autre ne tape ton mot de passe).
- Un **guide d'installation** (`docs/installer-sur-un-telephone.md`) et une
  **fiche d'essai terrain** (`docs/essais/terrain-1.md`) : ce qu'il faut
  vérifier pendant la sortie, dans l'ordre, avec une case à cocher et
  une ligne de remarque par point.

## Critères d'acceptation

| # | Critère | Comment on le vérifie |
|---|---|---|
| C1 | **Essai d'abord** : un APK release signé par une clé de test s'installe sur `emulator-5584` après désinstallation ; l'app iOS se construit en Release pour un appareil (`generic/platform=iOS`), sans signature, sur le Mac | Essai jetable de T1, sorties brutes gardées |
| C2 | **Icône A** aux formats demandés : iOS (carré de 1024 px), Android adaptative (fond, dessin et version monochrome, dans la zone sûre de 66 dp). Plus aucune image d'Expo dans `mobile/assets/images` | Captures de l'écran d'accueil des deux simulateurs ; comparaison du designer à la maquette v1/70 |
| C3 | **Écran de démarrage** aux couleurs de l'app (pas de bleu d'Expo), sans saut visible vers le premier écran | Captures ; vidéo courte ou suite de captures au démarrage |
| C4 | **Français partout** : langue de l'app déclarée française sur iOS (`CFBundleDevelopmentRegion`) et Android ; demande de position, boutons « OK » et « Annuler » des feuilles natives en français, même sur un téléphone réglé en anglais | Captures sur simulateur en anglais et en français |
| C5 | **APK signé** : une commande (`npm run build:apk`) fabrique l'APK release ; la clé et ses mots de passe sont **hors du dépôt** ; l'APK installé sur l'émulateur ouvre la carte et calcule un itinéraire en mode avion | Sortie de la commande, `apksigner verify`, parcours Maestro de fumée sur l'APK |
| C6 | **iOS pour appareil** : `xcodebuild` Release pour `generic/platform=iOS` réussit sans signature ; les réglages de signature restent à choisir dans Xcode (équipe gratuite), rien n'est écrit en dur dans le dépôt | Sortie de la commande |
| C7 | **Guide d'installation** clair : Android (par câble ou par fichier), iOS (Xcode, compte gratuit, confiance du développeur dans Réglages, réinstallation tous les 7 jours) ; ce que fait Émilien et ce que fait Claude | Relu par le pilotage |
| C8 | **Fiche d'essai terrain** : reprend toute la liste « À vérifier sur un vrai téléphone » de `PILOTAGE.md` et la section « Reporté » des phases 8a et 8b, classée dans l'ordre d'une sortie (avant de partir, au départ, en roulant, à l'arrivée, après) | Relue par le pilotage |
| C9 | Aucun secret dans le dépôt (clé, mot de passe, identifiant d'équipe Apple) ; `npm run verify` passe, `pytest` passe, la CI est verte | Audit `git grep` ; sorties ; run GitHub |

## Hors périmètre de 10a

- Publication sur les stores, TestFlight (essai d'Apple, compte payant),
  Google Play : hors v1.
- Suivi téléphone verrouillé, notification, Live Activity : V2.
- Tout le contenu de 10b (liste plus bas).
- **Installation sur ton téléphone** : c'est toi qui la fais, avec le
  guide, ou Claude par câble seulement si tu le dis ce jour-là. Aucune
  session n'installe quoi que ce soit sur ton téléphone sans ton accord
  (incident du 10 novembre).

## Tâches de 10a, dans l'ordre

| # | Qui | Tâche |
|---|---|---|
| T1 | `developpeur` pour l'essai, puis `architecte` et `designer` | **Essai jetable** (C1) : APK release signé par une clé de test, installé sur `emulator-5584` ; build iOS Release pour appareil sans signature. Puis l'architecte écrit l'**ADR 0022** (distribution en test interne : clé Android, où elle vit, comment la sauvegarder ; signature iOS gratuite ; numéro de version ; ce qui reste hors du dépôt). Le designer exporte l'**icône A** et dessine l'**écran de démarrage** (maquette v1/70 complétée). **Le pilotage te montre l'ADR, l'icône et l'écran de démarrage pour validation** |
| T2 | `developpeur` | Icône, écran de démarrage, langue française déclarée, textes du système en français (C2 à C4) |
| T3 | `developpeur` | Commande `npm run build:apk`, build iOS pour appareil, guide d'installation (C5 à C7) |
| T4 | session de phase, puis `testeur` | Fiche d'essai terrain (C8). Le testeur installe l'APK sur l'émulateur après désinstallation, joue le parcours de fumée, fait les captures release (icône, démarrage, textes en anglais et en français) |
| T5 | `designer` | Compare icône et écran de démarrage à la maquette v1/70 |

Chaque tâche de code passe ensuite par le `relecteur`, puis par le
`testeur`, un par un.

## Coût et risques de 10a

- **Taille : P**, une session de phase. **Quota** : 51 % utilisés le
  mardi 17 novembre à midi, renouvellement le lundi 23 à 7 h. Réserve
  pour ta veille emploi : 10 points (mardi à samedi), plus 5 points de
  marge. La phase peut donc utiliser environ 34 points. Estimation : 15 à
  25 points. Elle tient.
- **Risque 1 : la signature iOS gratuite**, jamais éprouvée sur un vrai
  iPhone. Limites connues (essai 2, § C5) : profil valable 7 jours, donc
  réinstallation chaque semaine ; 3 appareils. L'identifiant
  `fr.rutapulse.app` peut être déjà pris chez Apple ; on le changerait
  alors pour l'essai.
- **Risque 2 : la clé Android.** Si elle est perdue, les mises à jour
  de l'APK ne s'installent plus par-dessus l'ancien (il faut désinstaller,
  et les itinéraires sont perdus). L'ADR 0022 dit où la garder et
  comment la sauvegarder.
- **Risque 3 : la place sur le Mac.** Environ 13 Go libres le 17 novembre,
  sous le seuil d'alerte de 20 Go et tout près du seuil d'arrêt (12 Go).
  La phase construit l'app en release. **La place doit être réglée avant
  le lancement** (copies Time Machine, ton accord).
- **Ce que tu devras faire** : valider cette spec et le découpage ;
  valider l'ADR 0022, l'icône et l'écran de démarrage (T1) ; valider la
  fusion ; te connecter à Xcode avec ton compte Apple ; installer l'app
  et faire l'essai.

## Questions

1. **As-tu un iPhone pour l'essai ?** Le téléphone Android
   (`R5CR21B1KDW`) est connu. Sans iPhone, l'essai réel se fait sur
   Android seulement, et la signature iOS reste « construite, pas
   éprouvée ».
2. **Où feras-tu le premier essai ?** L'app n'a que la zone Nancy.
   Si tu roules ailleurs, on ajoute ta zone : quelques lignes dans
   `zones/zones.json`, puis tu lances le workflow « Fabriquer une zone »
   sur GitHub (environ une heure). Recommandation : une sortie connue
   dans la zone Nancy si possible, pour comparer avec ce qu'on a vu en
   simulateur.

## Choix déjà faits par le pilotage (tu peux les changer)

1. **Clé Android** dédiée au projet, rangée hors du dépôt
   (`~/.rutapulse/`), avec ses mots de passe dans un fichier non suivi
   par git. Pas la clé de débogage : une mise à jour doit pouvoir
   s'installer par-dessus la précédente sans perdre tes itinéraires.
2. **Version** : `1.0.0`, numéro de build 1, augmenté à chaque APK remis.
3. **L'APK te parvient** par câble (`adb install`, lancé par toi ou sur
   ton accord du jour) ou par fichier (AirDrop impossible sur Android :
   Google Drive ou câble). Le guide donne les deux.
4. **L'écran « Licences et attributions »** va en 10b : pour un essai
   personnel, l'attribution déjà affichée sur la carte suffit.
5. **La fiche d'essai** suit l'ordre d'une sortie, pas l'ordre des
   phases. Tu remplis ce que tu peux ; le reste attend une autre sortie.

---

# Phase 10b — Finitions (liste de départ)

Spec détaillée après ton essai. Taille prévue : **M** (2 sessions de
phase). Elle reprendra :

- **Retours de ton essai terrain** (fiche `terrain-1.md`), en premier.
- **Écran « Licences et attributions »** (rubrique « À PROPOS » de
  l'onglet Réglages, maquette v1/80) : OpenStreetMap, IGN, Mapterhorn,
  OpenMapTiles, logiciels libres utilisés.
- **Très grandes tailles de texte** dans toute l'app (écrans qui cassent),
  dont le panneau 31b sur un petit écran (décision du 2 novembre).
- **Android : garder le brouillon** quand l'activité est recréée (par
  exemple au changement de taille du texte).
- **Rapidité iOS** (C12 de la phase 7) : supprimer le vol de la carte
  vers la position avant la création, puis mesurer à nouveau.
- **Écarts de design en attente**, avec leur source :
  - phase 8b, M1 à M6 (`design/comparaisons/p08b-t6-finitions.md`) :
    tirets au lieu de points ronds sur Android, bout du trait de liaison
    sans repère, halo autour du rond gris iOS, trait dépassé resté
    magenta, dézoom trop fort pendant « Recherche du GPS » sur iOS, filet
    de 0,5 pt dans le sélecteur de Réglages iOS ;
  - phase 7, L1 à L5 et anneau rose iOS
    (`design/comparaisons/p07-t8-circuits-balises.md`) ;
  - phase 6, N1, N3, N7 et nom sous l'arche de la maquette 20
    (`design/comparaisons/p06-t8-itineraires-gpx.md`) ;
  - phase 5b, P1 et Z1 (« 0,0 Go libres » sous 1 Go, à écrire en Mo)
    (`design/comparaisons/p05b-t7-infos-et-zones-2.md`) ;
  - phase 5, P2 à P7 ; phase 4, textes et couleurs système
    (`design/comparaisons/p04-t7.md`) ; phase 2, N4 et N6.
  Le designer fera d'abord **une seule liste triée** de tous ces écarts
  (ce qui se voit sur le vélo d'abord), que je te présenterai.
- **Parcours Maestro à reprendre** (`p07-gpx-modifier-ios`,
  `p06-enregistrer`).
- Petites tâches : vider le point choisi à l'ajout d'un point ; nom
  accessible du résumé compact ; minuteur Jest (« worker process has
  failed to exit ») ; fichiers partiels iOS dans `tmp/`.
