# Phase 5b — Difficulté VTT et mise à jour des zones : résultats

> Commencée le 2 novembre 2026, terminée le 3 novembre 2026. Spec :
> [p05b-difficulte-maj-zones.md](p05b-difficulte-maj-zones.md). Branche
> `claude/phase-5b-difficulte-d161f2`, poussée, non fusionnée.
>
> **Les 15 critères sont tenus**, avec les réserves écrites plus bas
> (coupure réseau sur iOS, variante B sur iOS, C12 mesuré sur un build de
> banc).

## En bref

- La fabrique ajoute au paquet de zone une table `difficulty.json` :
  identifiant de voie OSM → niveau `mtb:scale` (S0 à S6). Sur Nancy :
  505 voies (S0 52, S1 226, S2 151, S3 57, S4 12, S5 3, S6 4), 0 valeur
  écartée. Le même compte sort d'une requête osmium indépendante.
- **Zone Nancy v5 publiée** avec la table (run GitHub 41622214717, depuis
  la branche de la phase). La v4, lancée depuis `main` par erreur, est
  publiée sans table : elle a servi de cas réel pour C8.
- L'écran Infos affiche la ligne **« Difficulté »** : les niveaux connus du
  plus fréquent au moins fréquent, puis « inconnue ». Sur 6 itinéraires,
  les parts de l'app sont **identiques** à celles du Mac (écart 0), sur iOS
  et Android.
- L'écran Zones propose la **mise à jour** d'une zone prête. Elle se lance à
  la main, suit « Wi-Fi seulement » et se télécharge à côté de l'ancienne
  version. L'ancienne reste en service jusqu'à la fin des contrôles. Elle
  est effacée seulement quand plus rien ne la lit (ADR 0018, « zone en
  service »).
- `npm run verify` : 128 suites, 1 513 tests réussis. `pytest` : 228 tests
  réussis. CI verte à chaque commit de code.

## Où sont les preuves

Les preuves durables sont hors du dépôt, dans
`/Users/utilisateur/dev_ai/vtt-nav-preuves/p05b/` (abrégé `preuves/`
ci-dessous). Chaque dossier a son `LISEZMOI.md`, sauf `t3-v5/` (preuves du
pilotage, résumées en C4).

| Quoi | Chemin |
|---|---|
| ADR 0018 (accepté le 2 novembre 2026) | [0018-difficulte-et-mise-a-jour-des-zones.md](../adr/0018-difficulte-et-mise-a-jour-des-zones.md) |
| Maquette 41 complétée | `design/v1/41-zones.html`, capture `design/v1/captures/41-zones.png` |
| Essai jetable T1 (C1) | `preuves/t1-essai/LISEZMOI.md` |
| Fabrique T2 (C2, C3) | `preuves/t2/LISEZMOI.md` |
| Zone v5 publiée (C4) | `preuves/t3-v5/` (`catalogue.json`, `release/`, `urls.txt`) |
| Mise à jour T4 | `preuves/t4/`, tests adaptés : `preuves/t4-tests-adaptes.md` |
| Difficulté T5 | `preuves/t5/LISEZMOI.md`, tests adaptés : `preuves/t5-tests-adaptes.md` |
| Simulateurs, partie 1 (C8, C9, C10) | `preuves/t6/LISEZMOI.md` |
| Simulateurs, partie 2a (C11 iOS, C13, captures) | `preuves/t6-2a/LISEZMOI.md` |
| Banc C6 et C12 | `preuves/t6-2b/` ; script et LISEZMOI dans la branche locale `claude/p05b-banc` (voir C6) |
| Simulateurs, partie 2c (C11 Android, C13 depuis la v3, variante B) | `preuves/t6-2c/LISEZMOI.md` |
| Corrections T8 | `preuves/t8/` |
| Comparaisons du designer (C15) | [p05b-t7-zones.md](../../design/comparaisons/p05b-t7-zones.md), [p05b-t7-infos-et-zones-2.md](../../design/comparaisons/p05b-t7-infos-et-zones-2.md) |
| Parcours Maestro | `mobile/e2e/p05b-maj-difficulte.yaml` |

## Critères

iPhone 17 (iOS 26.5, UDID `DAF21CEF-…`) et émulateur Android 14
(`emulator-5554`), version finale (release) du commit `76a549b` (même code
que `18978e8`).

| # | Attendu | Mesuré | Preuve | Verdict |
|---|---|---|---|---|
| C1 | `trace_attributes` renvoie `edge.way_id` hors ligne, iOS et Android, Nancy v3 ; ce sont bien les voies OSM | 1 564 tronçons, 100 % avec un `way_id` ; 889 voies, toutes présentes dans l'extrait OSM ; mêmes sorties sur iOS, Android et le Mac | `preuves/t1-essai/LISEZMOI.md` | **oui** |
| C2 | Table voie → difficulté dans le paquet, format ADR 0003, valeurs invalides écartées et comptées | 505 voies, 0 écartée ; comptes égaux à `controle_osmium.py` ; tests pytest dont intégration à la fabrication | `preuves/t2/build.log`, `preuves/t2/controle_osmium.txt`, `zones/tests/test_difficulty*.py`, `zones/tests/test_build_difficulty.py` | **oui** |
| C3 | Paquet conforme (`SHA256SUMS`, catalogue) ; une app de la phase 5 lit le nouveau catalogue sans planter | `shasum` OK sur le paquet du Mac et sur la release v5 ; schéma du catalogue inchangé (ADR 0018) ; tests Jest du catalogue | `preuves/t2/shasum.txt`, `preuves/t3-v5/release/SHA256SUMS`, `mobile/src/core/zones/catalogue.test.ts`, `testeurCatalogue.test.ts` | **oui** |
| C4 | Zone publiée par le workflow, depuis la branche de la phase ; catalogue à jour ; `sha256sum -c` passe | **v5** (et non v4, voir écarts) : run 41622214717 (branche de la phase, commit `76a549b`, succès). Release `zone-nancy-v5` : 11 fichiers, `shasum -a 256 -c SHA256SUMS` OK sur les 10. `difficulty.json` : 52, 226, 151, 57, 12, 3, 4 (505 voies, comme le Mac). Catalogue : nancy version 5, 10 fichiers dont `difficulty.json` | `preuves/t3-v5/` (contrôle du pilotage) | **oui**, sur la v5 |
| C5 | Calcul dans `core/`, parts en distance à 100 %, tronçon à la main = « inconnue » | `core/route-info/difficulty.ts` ; cas connus ; cas réels M1 et M2 égaux à la référence Python | `difficulty.test.ts`, `difficultySpec.test.ts`, `difficultyReal.test.ts`, `preuves/t5/reference-m1-m2-sortie.txt` | **oui** |
| C6 | Parts de l'app = Mac à 1 point, R1 à R5 + un 6e sur voies notées, iOS et Android | 24 contrôles sur 24, écart 0, même ordre. R1 à R4 : inconnue 100. R5 : S1 6, S2 1, inconnue 93. R6 (2,8 km, choisi exprès) : S3 18, S2 13, S1 8, S5 2, S6 1, inconnue 58. Zone v5 | `preuves/t6-2b/comparaison-mac/resultat.txt`, `preuves/t6-2b/references/`, `preuves/t6-2b/choix6e/` ; script `mobile/e2e/p05b-t6-2b/comparer-difficulte.py` de la branche locale `claude/p05b-banc` | **oui**, sur la v5 |
| C7 | Ligne « Difficulté » de la maquette 20 ; ordre ; « moins de 1 % » ; texte sans donnée | Tests ; captures à 1 et à 6 niveaux sur les deux plateformes ; conforme selon le designer | `RouteInfoDifficultySpec.test.tsx`, `RouteInfoDifficultyT5.test.tsx`, `preuves/t6-2b/p05b-ios-60-infos-r6-plusieurs-niveaux-release.png`, `preuves/t6-2b/p05b-android-60-infos-r6-plusieurs-niveaux-release.png` | **oui** |
| C8 | Zone sans table : « inconnue », sans erreur | v3 et v4 (sans table) : « Difficulté inconnue, la carte la donne rarement. » | Tests T5 ; `preuves/t6/p05b-ios-03-c8-infos-difficulte-inconnue.png`, `preuves/t6/p05b-android-03-c8-infos-difficulte-inconnue.png`, `preuves/t6-2a/p05b-ios-26-c11-infos-sur-v3-v5-prete.png` | **oui** |
| C9 | Mise à jour signalée selon la maquette 41, lancée à la main, règle « Wi-Fi seulement » | Signalée, rien ne part seul ; attente du Wi-Fi sur Android | `preuves/t6/LISEZMOI.md`, `preuves/t6-2a/p05b-ios-01-zones-maj-disponible-T8.png`, `preuves/t6-2a/p05b-android-01-zones-maj-disponible-T8.png`, `preuves/t6-2a/p05b-android-04-wifi-seulement-attente.png` | **oui**. Attente du Wi-Fi non provoquée sur iOS |
| C10 | Téléchargement à part ; ancienne version en service ; coupure ou app fermée → reprise ou annulation ; jamais de mélange | Android : coupure réseau, app tuée, reprise, annulation, v3 toujours utilisable. iOS : app tuée en plein téléchargement, reprise, annulation, v3 intacte. Tests avec faux réseau | `preuves/t6/LISEZMOI.md` (relevés de dossiers, captures `-05` à `-14`), tests T4 | **oui**, réserve iOS (voir écarts) |
| C11 | Passage sans casse ; création ni perdue ni faussée ; ancienne version effacée quand plus rien ne la lit | iOS et Android : v5 prête pendant une création ouverte sur la v3 ; v3 et v5 coexistent ; calcul et infos marchent ; v3 effacée dans la seconde après la fermeture. Contrôle 1 de l'ADR : carte bougée pendant et après le passage, pas de plantage | `preuves/t6-2a/ios-c11-passage-suivi.txt`, `preuves/t6-2c/android-c11-passage-suivi.txt`, captures `p05b-ios-25` à `-30` (2a) et `p05b-android-12` à `-17` (2c) | **oui** |
| C12 | Infos d'un 40 km en moins de 1 s, release | R4 (40,3 km) : iOS 100 à 116 ms à froid, 82 ms à chaud ; Android 316 à 470 ms à froid, 152 à 200 ms à chaud (chiffres dessinés) | `preuves/t6-2b/c12/` (12 JSON bruts) | **oui**, réserve : build de banc |
| C13 | Maestro : depuis la v3, mise à jour, création, infos, ligne « Difficulté » | Joué depuis la v3 réinstallée : code de sortie 0 sur iOS et Android. Aussi 3 sur 3 en mode avion sur Android (sur la v5) | `preuves/t6-2c/c13-ios.log`, `preuves/t6-2c/c13-android.log`, `preuves/t6-2a/c13-android-avion-resume.txt` | **oui** (iOS sans mode avion), vers la v5 |
| C14 | `verify`, `pytest`, CI verte | 128 suites, 1 513 tests ; 228 tests pytest ; CI verte (runs plus bas) | `preuves/t6-2c/verify-avant-commit.txt` | **oui** |
| C15 | Captures release comparées aux maquettes 20 et 41 | Partie 1 : 1 écart à corriger (tirets sur Android), fait en T8. Partie 2 : 14 captures, 0 bloquant | `design/comparaisons/p05b-t7-zones.md`, `design/comparaisons/p05b-t7-infos-et-zones-2.md` | **oui** |

## Runs de la CI

| Commit | Tâche | Run | Résultat |
|---|---|---|---|
| `8bc64d8` | T2 | 41508424043 | succès |
| `19968e2` | T4 | 41528326826 | succès |
| `6c9e5ed` | T5 | 41531847920 | succès |
| `76a549b` | T8 | 41545804740 | succès |
| `76a549b` | Fabriquer la zone v5 | 41622214717 | succès |
| `18978e8` | T6 (Maestro) | 41635515168 | succès |

## Écarts et réserves

- **v4 publiée sans table.** Le workflow a d'abord été lancé depuis `main`
  (run 41511956144) : `zone-nancy-v4` n'a pas `difficulty.json`. La zone de
  référence est devenue la **v5** pour C4, C6 et C13 (décision du pilote).
  La v4 a servi de cas réel pour C8.
- **C10 sur iOS.** Le simulateur ne sait pas couper le réseau. La coupure a
  été remplacée par l'app tuée en plein téléchargement. L'annulation a suivi
  un arrêt où la v4 ne contenait que `.plan.json`. À refaire sur un vrai
  iPhone (phase 10).
- **Variante B (place insuffisante) sur iOS : non faite.** Le simulateur
  partage le disque du Mac, plein à 98 %. Faite sur Android.
- **Attente du Wi-Fi et variante A sur iOS : non provoquées** (simulateur
  toujours en Wi-Fi). Même composant que sur Android, accepté par le
  designer.
- **C12** est mesuré sur un build de banc (code de la phase plus crochets de
  mesure), comme en phase 5, pas sur le binaire exact de la phase.
- **C6** : aucun itinéraire ne contient S0 ni S4. Le test prouve que l'app
  ne déforme ni le moteur ni le calcul ; la justesse de la table face à OSM
  vient du contrôle osmium de T2.
- **Script de C6 hors du dossier de preuves.** Le garde-fou a refusé au
  testeur l'écriture du script dans `preuves/t6-2b/`. Le testeur l'a écrit
  dans le worktree du banc puis copié ; la session de phase a retiré ces
  copies pour ne pas contourner le refus. Le script et son mode d'emploi
  restent dans la branche locale `claude/p05b-banc` (commits `084cebe`,
  `461a7f1`, jamais poussée), dossier `mobile/e2e/p05b-t6-2b/`. Note :
  `preuves/t6-2b/OU-EST-LE-SCRIPT.txt`.
- **Tests existants adaptés** : 1 en T4, 8 en T5, chacun justifié dans
  `preuves/t4-tests-adaptes.md` et `preuves/t5-tests-adaptes.md`.
- **Parcours Maestro un peu instable sur Android** : les points sont posés
  à l'aveugle, un essai sur trois rate le tronçon noté ; d'où `retry`.
- **Observations sans défaut prouvé** (2a, 2c) : échec de la mise à jour
  avec le débit ralenti de l'émulateur ; Wi-Fi de l'émulateur qui ne se
  reconnecte pas ; bouton « localiser » qui ne recentre pas ; dossier `v5/`
  avec seulement `.plan.json` laissé après un refus pour place
  insuffisante (réutilisé par « Réessayer ») ; app Android qui ne démarre
  pas avec 100 Mo libres.

## Reporté (non bloquant)

- Design, partie 1 : P1 (icône pause 2 dp trop haute), N4 et N6 hérités de
  la phase 2 → phase 10.
- Design, partie 2 : D1 (niveau coupé en fin de ligne, espaces
  insécables dans `fr.ts`), D3 (« Difficulté » en gras quand elle est
  inconnue), Z1 (« 0,0 Go libres » sous 1 Go, écrire en Mo) → phase 10.
  D2 : la maquette sera corrigée par le designer.
