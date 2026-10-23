# Phase 2 — Carte hors ligne (spec, à valider)

> 24 octobre 2026. Spec de la session de pilotage, **à valider par Émilien**
> avant tout code. Découpage : [docs/05](../05-decoupage-v1.md), ligne 2.
> Fonctions du cadrage : 1 (carte des sentiers) et 6 (hors ligne).
> S'appuie sur les ADR 0003, 0004, 0007 et 0011, sur l'essai 3, et sur le
> design validé (`design/v1/`, docs/06).

## Objectif

Dans l'app : choisir une zone, la télécharger, puis voir la carte des
sentiers et sa position GPS, **en mode avion**.

## Ce que tu verras à la fin

- L'onglet **Zones** dans le style années 70 : la zone Nancy, « Télécharger »,
  la progression, puis « Prête sans réseau ». On peut aussi la supprimer.
- L'onglet **Carte** : la carte de Nancy avec les sentiers, les pistes, le
  relief et les courbes de niveau, ta position, et un bouton pour te
  recentrer. Tout marche en mode avion.
- L'onglet **Réglages** : l'interrupteur « Télécharger en Wi-Fi seulement ».

## Critères d'acceptation

| # | Critère | Comment on le vérifie |
|---|---|---|
| C1 | L'onglet Zones lit le catalogue publié sur GitHub et affiche ses zones (nom, taille, date des données) | Capture, et test d'écran avec un faux catalogue |
| C2 | Télécharger une zone affiche la progression ; à la fin, chaque fichier est contrôlé par son empreinte SHA-256 | Capture pendant et après ; test : un fichier abîmé est refusé, et la zone n'est pas « prête » |
| C3 | Un téléchargement coupé (réseau perdu, app fermée) reprend ou recommence proprement, sans zone à moitié prête | Test avec un réseau coupé en cours de route |
| C4 | « Wi-Fi seulement » (activé par défaut) : sans Wi-Fi, la zone attend, avec le bandeau et le raccourci vers le réglage, comme dans la maquette 41 | Capture, et test de la règle |
| C5 | Une zone téléchargée se supprime, et la place est rendue | Taille des dossiers avant et après |
| C6 | L'onglet Carte affiche la zone téléchargée, en **mode avion**, du zoom 8 au zoom 18 (au-delà du 14, la carte s'agrandit), sans tuile vide dans la zone | Captures en mode avion sur les deux simulateurs, à plusieurs zooms |
| C7 | Le style de carte suit le design : sentiers, pistes et routes bien distincts ; **les trottoirs ne sont plus dessinés comme des sentiers** (défaut de l'essai 3) ; courbes visibles dès le zoom 13 | Captures comparées par le `designer` aux maquettes |
| C8 | La position GPS s'affiche (point bleu), avec la permission « pendant l'utilisation » ; un bouton recentre la carte | Capture avec une position simulée |
| C9 | Les attributions sont visibles : © OpenStreetMap, © OpenMapTiles, © Mapterhorn, © IGN | Captures |
| C10 | Sans zone téléchargée, la carte propose d'en télécharger une (état vide dessiné par le designer) | Capture |
| C11 | Les écrans Zones et Réglages suivent les maquettes années 70 (`41`, `80`) : couleurs, polices, bandeau rayé | Comparaison par le `designer` |
| C12 | `npm run verify` passe, avec des tests pour la lecture du catalogue, les empreintes, la règle du Wi-Fi et les écrans ; la CI est verte | Sortie de `verify` et run GitHub |
| C13 | Un parcours Maestro (test de bout en bout) : télécharger Nancy, passer en mode avion, voir la carte | Parcours réussi sur Android ; sur iOS, autant que le simulateur le permet |

## Hors périmètre

- Créer un itinéraire, calculer : phases 3 et 4.
- La couche des circuits balisés : phase 7.
- Le suivi sur le vélo : phases 8 et 9.
- Les écrans Itinéraires et l'écran Réglages complet : seulement
  l'interrupteur Wi-Fi ici.
- Plusieurs zones affichées en même temps : une seule zone active en v1.
- Le nettoyage des anciennes versions de zone sur GitHub (voir « Points
  d'attention »).

## Tâches, dans l'ordre

| # | Qui | Tâche |
|---|---|---|
| T0 | `designer` | Deux petites maquettes manquantes : l'écran Carte avec une zone, et sans zone (état vide). Plus le **style de carte** détaillé : couleur et épaisseur de chaque type de voie, en partant de l'essai 3, sans les trottoirs. |
| T1 | `architecte` | ADR 0013 : téléchargement et stockage des zones (dossiers sur le téléphone, reprise, contrôle des empreintes, zone « prête » seulement si tout est contrôlé, usage de TanStack Query). |
| T2 | `developpeur` | Thème et composants de base du style années 70 : valeurs de `design/tokens.md` en code, police Jost embarquée, bandeau rayé, boutons. Rien de plus que ce qu'utilisent les écrans de la phase. |
| T3 | `developpeur` | Lecture du catalogue, téléchargement, empreintes, règle du Wi-Fi, suppression : logique pure dans `core/`, testée sans téléphone. |
| T4 | `developpeur` | Écran Zones (maquette 41) et interrupteur Wi-Fi dans Réglages (maquette 80). |
| T5 | `developpeur` | Écran Carte : MapLibre avec les fichiers de la zone, style de T0, zoom jusqu'à 18, position GPS, bouton de recentrage, attributions, état vide. |
| T6 | `testeur` | Parcours Maestro, mode avion, captures à tous les zooms sur les deux simulateurs. |
| T7 | `designer` | Compare les captures aux maquettes et liste les écarts. Les écarts bloquants retournent au développeur. |

Chaque tâche de code passe ensuite par le `relecteur` et le `testeur`, un par
un.

## Coût et risques

- **Taille : G**, soit environ 3 sessions, enchaînées dans une session
  ouverte dans `vtt-nav`. C'est la plus grosse phase depuis le début : la
  première avec de vrais écrans.
- **Risque 1** : télécharger 110 Mo de façon fiable sur un téléphone. On
  utilise le téléchargement d'`expo-file-system`, avec reprise. À éprouver
  dès T3.
- **Risque 2** : MapLibre et les fichiers PMTiles locaux. Déjà prouvé par
  l'essai 3 sur les deux simulateurs : le risque est faible.
- **Risque 3** : l'écart entre le rendu réel et les maquettes HTML. T7 sert
  à le mesurer.
- **Ce que tu devras faire :** rien pendant la phase, sauf un accord
  éventuel d'accès à un simulateur. Je te notifierai.

## Points d'attention

- **Chaque lancement de la fabrique ajoute une release d'environ 110 Mo**
  (v1, v2 et v3 existent déjà). Il faudra décider combien de versions
  garder, par exemple les 2 dernières. C'est à traiter dans une petite
  tâche à part, hors de cette phase.
- Le catalogue sera lu à son adresse fixe :
  `https://github.com/Emilien1982/RutaPulse/releases/download/catalogue/catalogue.json`.
