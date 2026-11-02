# Phase 5 — Infos de l'itinéraire : résultats

> Commencée le 28 octobre 2026, reprise le 2 novembre 2026. Spec :
> [p05-infos-itineraire.md](p05-infos-itineraire.md). Branche
> `claude/phase-5-infos`, poussée, non fusionnée.
>
> **Android seulement. iOS en attente de la licence Xcode.** Xcode est passé
> en 27.2 pendant la pause du 28 octobre au 2 novembre, et sa licence n'est
> pas acceptée : `xcrun simctl` refuse tout. Décision d'Émilien (2 novembre) :
> avancer toute la phase sur Android ; la partie iOS se fera quand la
> licence sera acceptée. Liste des contrôles iOS en attente en bas.

## En bref

- Le résumé de la création affiche la **montée (D+)**, après chaque action,
  jamais pendant un glisser. Toucher le résumé (chevron « › ») ouvre l'écran
  **Infos** : distance, durée, D+, D−, profil d'altitude avec altitudes
  basse et haute, bande de terrain, parts route / piste / sentier /
  « À la main », carte dans sa fenêtre en arche, bouton « Modifier ».
- Les altitudes viennent de `height` et le terrain de `trace_attributes`,
  deux fonctions ajoutées au module natif (ADR 0017). Le D+ et les parts se
  calculent dans `core/route-info/`, sur le profil joint de tous les
  tronçons.
- Sur R1 à R5, le D+, le D− et les parts de l'app sont **identiques** à ceux
  du Mac (écart 0), avec la même méthode et avec le même moteur.
- Les infos d'un itinéraire de 40 km s'affichent en **248 ms** au plus (seuil
  1 s). Le glisser reste fluide : arrêt maximal du fil JavaScript de
  **53 ms** (seuil 100 ms).
- Les trois écarts « plus tard » de la phase 4 sont faits (point choisi
  agrandi, bulle et note « À la main »).
- `npm run verify` : voir T9 plus bas. CI verte jusqu'à T8.

## Liens

| Quoi | Adresse |
|---|---|
| ADR 0017 (accepté le 28 octobre 2026) | [0017-infos-itineraire-calcul.md](../adr/0017-infos-itineraire-calcul.md) |
| Essai jetable T1 | [preuves/p05/t1-essai/LISEZMOI.md](preuves/p05/t1-essai/LISEZMOI.md) |
| Module natif T2 | [preuves/p05/t2/LISEZMOI.md](preuves/p05/t2/LISEZMOI.md) |
| Référence Python T3 | [preuves/p05/t3/reference-python.txt](preuves/p05/t3/reference-python.txt) |
| Tests adaptés T4, T5 | [t4-tests-adaptes.md](preuves/p05/t4-tests-adaptes.md), [t5-tests-adaptes.md](preuves/p05/t5-tests-adaptes.md) |
| Écran Infos T5 | [preuves/p05/t5/LISEZMOI.md](preuves/p05/t5/LISEZMOI.md) |
| Écarts de la phase 4, T6 | [preuves/p05/t6/LISEZMOI.md](preuves/p05/t6/LISEZMOI.md) |
| Banc jetable T7 | [preuves/p05/t7-banc/LISEZMOI.md](preuves/p05/t7-banc/LISEZMOI.md) |
| Preuves T7 (C3, C5, C9, C13) | [preuves/p05/t7/LISEZMOI.md](preuves/p05/t7/LISEZMOI.md) |
| Écart de D+ entre T1 et T7 | [preuves/p05/t7/ecart-t1-t7.txt](preuves/p05/t7/ecart-t1-t7.txt) |
| Comparaison aux maquettes T8 | [design/comparaisons/p05-t8.md](../../design/comparaisons/p05-t8.md) |
| Corrections T9 | [preuves/p05/t9/](preuves/p05/t9/), [preuves/p05/t9b/](preuves/p05/t9b/) |
| Captures release Android | [captures/](captures/), préfixe `p05-android-` |

## Critères

Émulateur Android 14 `Pixel_6_API_34_arm64` (`emulator-5554`), version
finale (release), zone Nancy v3.

| # | Attendu | Mesuré | Preuve | Verdict |
|---|---|---|---|---|
| C1 | `height` et `traceAttributes` dans le module natif, hors ligne, Android et iOS, Nancy v3 | Essai T1 sur les deux plateformes (avant la pause), puis module final appelé en release (T2) | `t1-essai/`, `t2/` | **oui** (iOS : essai T1 seulement, le module final n'est pas rebuildé avec Xcode 27.2) |
| C2 | D+ et D− dans `core/`, une altitude tous les 30 m, seuil 5 m | `core/route-info/elevation.ts`, profils connus, seuil exact, jonctions | Tests de `core/route-info/`, `t3/reference-python.txt` | **oui** |
| C3 | Même D+ et D− que le Mac sur R1 à R5, à 1 m près | Écart 0 sur les 5, même méthode et même moteur (Valhalla 3.9.1) | `t7/comparaison-mac/sortie/resultat.txt` | **oui**, Android seulement, iOS en attente |
| C4 | Un tronçon à la main a ses altitudes, comptées dans le D+ et le profil | `height` sur la ligne droite ; tests ; capture d'un itinéraire mixte | Tests T3 et T4 ; `captures/p05-android-infos-a-la-main.png` | **oui** |
| C5 | Terrain classé en route / piste / sentier + « À la main », parts à 100 %, à 1 point du Mac | Écart 0 sur R1 à R5 ; 2 000 cas aléatoires à 100 % | `t7/comparaison-mac/`, tests T3 | **oui**, Android seulement. Réserve : les références n'ont pas de tronçon à la main |
| C6 | D+ dans le résumé, mis à jour après chaque action, jamais pendant un glisser | Tests ; captures pendant, 0,3 s et 3 s après un glisser | `captures/p05-android-glisser-*.png`, `creation-resume-dplus.png` | **oui**, Android seulement |
| C7 | Infos s'ouvre en touchant le résumé ; « Modifier » revient, itinéraire intact ; pas de « Démarrer le suivi » ; en-tête « Nouvel itinéraire » | Pile imbriquée éprouvée en release ; tests ; Maestro | `t5/`, `RouteInfoScreenSpec.test.tsx`, `t7/c13-maestro/` | **oui**, Android seulement (pile iOS en attente) |
| C8 | Profil de la maquette 20 ; carte en arche avec tout le tracé, attribution courte et « i » | Comparé par le designer ; corrections T9 (cadrage, échelle, étiquettes, zoom minimal) | `p05-t8.md`, `t9/`, `t9b/` | **oui** après T9, Android seulement |
| C9 | Infos d'un 40 km en moins de 1 s ; glisser sans arrêt de plus de 100 ms | 180 à 248 ms à froid, 49 à 50 ms à chaud ; arrêt max 48 à 53 ms | `t7/c9-affichage/analyse.txt`, `t7/c9-geste/analyse.txt` | **oui**, Android seulement, iOS en attente |
| C10 | Jamais de plantage ; altitudes ou terrain manquants dits en français, le reste montré | « Altitudes indisponibles » (tout ou rien, décision d'Émilien), « Terrain indisponible », « … » en attente | Tests T3 à T5 et T9 ; `captures/p05-android-infos-altitudes-indisponibles.png`, `t9/11-*.png` | **oui** |
| C11 | Pas de ligne « Difficulté » | Tests | Tests T3, T5 | **oui** |
| C12 | `verify` passe, CI verte | Voir T9 | À compléter | **à compléter** |
| C13 | Maestro en mode avion : créer, infos, D+ et parts, « Modifier » | `e2e/p05-infos.yaml` : 50 étapes réussies (T7), 46 (T9) | `t7/c13-maestro/maestro.log` | **oui**, Android ; iOS en attente |
| C14 | Point glissé agrandi avec halo, bulle « À la main », note « À la main : x km » | Fait (T6), avec l'essai MapLibre de T1 | `t6/`, `captures/p05-android-point-choisi-agrandi.png` | **oui**, Android seulement |
| C15 | Captures release sur les deux simulateurs comparées aux maquettes 10, 11, 20 | Android comparé (1 bloquant, 7 « à corriger », corrigés en T9) | `design/comparaisons/p05-t8.md` | **à moitié** : iOS en attente |

## Écart de D+ entre l'essai T1 et T7 (question du pilotage)

R4 donne 671 m en T1 et 659 m en T7 ; R5, 702 m et 568 m. Cause : **le
tracé**, pas le profil joint. Mêmes points de passage, mais T1 calculait une
seule route avec des points `through`, et l'app un tronçon `break` par paire
de points (phase 4). L'app est plus courte de 0,55 à 4,02 km (R5 :
40,35 → 36,33 km), avec le même nombre d'altitudes par kilomètre. Le D+
recalculé en Python sur les altitudes brutes jointes est égal à celui de
l'app pour les 5 références. Preuve rejouable :
`preuves/p05/t7/ecart-t1-t7.py`. Hypothèse non prouvée : `break` autorise
le demi-tour à un point de passage, `through` non.

## Contrôles iOS en attente (licence Xcode 27.2)

1. Build iOS release avec Xcode 27.2 (paquet Swift valhalla-mobile, ADR 0015
   § 6).
2. Pile imbriquée (croix → « Abandonner ? », glissement depuis le bord,
   défilement de la carte d'Infos).
3. Captures release iOS de toutes les tâches (création, D+, glisser, point
   choisi, bulle et note « À la main », Infos, états manquants).
4. Mesures C9 sur iOS.
5. Parcours Maestro C13 sur iOS (sans mode avion).
6. Comparaison C3 et C5 sur iOS (banc jetable, branches iOS écrites, non
   essayées).
7. Comparaison du designer sur les captures iOS (C15).
8. Remise en ordre du simulateur iOS et empreinte de Nancy v3.

## Remise en ordre (Android)

Empreinte de `valhalla_tiles.tar` (Nancy v3) sur l'émulateur en fin de T7 :
`7fa29249…7a44`, conforme. Mode avion coupé, fichiers du banc effacés, taille
d'écran d'origine (`1080x2400`).

## Branches jetables (locales, jamais poussées)

- `claude/p05-essai-infos` (`9d68b81`) : essai T1.
- `claude/p05-essai-pile` (`65e6c2b`) : pile imbriquée, T5.
- `claude/p05-banc` (`72ee978`) : banc de mesure, T7.
