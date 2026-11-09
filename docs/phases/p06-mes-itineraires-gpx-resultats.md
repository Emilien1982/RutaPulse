# Phase 6 — Mes itinéraires et GPX : résultats

> Commencée le 3 novembre 2026, terminée le 9 novembre 2026 (pause pour le
> quota du 4 au 9). Spec : [p06-mes-itineraires-gpx.md](p06-mes-itineraires-gpx.md).
> Branche `claude/phase-6-itineraires-gpx-60a1e0`, poussée, non fusionnée.
>
> **Les 16 critères sont tenus**, avec les réserves écrites plus bas
> (C6 de bout en bout, C11 sur la longueur du tracé, B3 vérifié sur
> Android seulement, iOS sans mode avion).

## En bref

- **Enregistrer** dans la création garde l'itinéraire tout de suite, avec
  le nom par défaut « Itinéraire du 3 nov. » (puis « (2) » le même jour).
  La création se ferme et l'écran de l'itinéraire s'ouvre, titré par son
  nom. La commune n'est pas dans le nom : l'essai de T1 ne la trouve hors
  ligne que dans 68 % des cas (décision de design 9 : la date seule).
- **L'onglet Itinéraires** liste les itinéraires, le plus récent en haut,
  avec distance, D+, durée, zone et origine. Menu « ⋮ » et appui long :
  renommer, exporter en GPX, supprimer (avec confirmation).
- **Un itinéraire gardé** garde son tracé. Ses infos (D+, terrain,
  difficulté) sont recalculées à l'ouverture, sur la zone en service.
  « Modifier » rouvre la création, cadrée sur le tracé ; seuls les
  tronçons touchés sont recalculés.
- **Import GPX** : traces et routes, refus en français (vide, illisible,
  sans tracé, plus de 20 Mo), aucun `DOCTYPE` ni entité externe, aucun
  appel réseau. Un GPX hors de vos zones est accepté, avec la zone
  proposée. **Export GPX 1.1**, valide selon le schéma officiel, par la
  feuille de partage du téléphone.
- Base SQLite (`expo-sqlite` 58.0.15) en version 1, avec montée de version
  testée ; lecture par TanStack Query. Lecteur GPX écrit pour l'app, sans
  bibliothèque. ADR 0019.
- `npm run verify` : 182 suites, **2 193 tests** réussis. `pytest` : 228
  tests réussis. CI verte (runs plus bas).

## Où sont les preuves

Les preuves durables sont hors du dépôt, dans
`/Users/utilisateur/dev_ai/vtt-nav-preuves/p06/` (abrégé `preuves/`
ci-dessous). Chaque dossier a son `LISEZMOI.md`.

| Quoi | Chemin |
|---|---|
| ADR 0019 (accepté le 3 novembre 2026, complété en T2 et T4) | [0019-itineraires-gardes-et-gpx.md](../adr/0019-itineraires-gardes-et-gpx.md) |
| Maquette 40 complétée (T1), puis alignée sur l'app (T8) | `design/v1/40-mes-itineraires.html`, capture `design/v1/captures/40-mes-itineraires.png` |
| Essai jetable T1 (C1, C4) | `preuves/t1-essai/` |
| GPX T2 (développeur, testeur) | `preuves/t2/`, `preuves/t2-testeur/` |
| Base T3 | `preuves/t3/`, `preuves/t3-testeur/` |
| Enregistrer, Infos, Modifier T4 | `preuves/t4/`, `preuves/t4-testeur/` |
| Onglet Itinéraires T5 | `preuves/t5/`, `preuves/t5-testeur/` |
| Contrôles en release avant T6 (SQLite iOS, vitesse de lecture) | `preuves/controles-avant-t6/` |
| Import et export T6 | `preuves/t6/`, `preuves/t6-testeur/` |
| Simulateurs T7 (C3, C6, C9, C11, C13, C14, captures) | `preuves/t7/` |
| Corrections (CI, petits défauts, écarts T8) | `preuves/corrections/` |
| Vérification des corrections en release | `preuves/t8-verif/` |
| Correction B3 (cadrage de « Modifier ») | `preuves/b3/` |
| Sorties finales `verify` et `pytest` | `preuves/fin/` |
| Comparaison du designer (C16) | [p06-t8-itineraires-gpx.md](../../design/comparaisons/p06-t8-itineraires-gpx.md) |
| Parcours Maestro | `mobile/e2e/p06-itineraires.yaml`, `p06-enregistrer.yaml`, `p06-importer.yaml`, `p06-import-refus.yaml`, `p06-import-hors-zone.yaml` |

## Critères

iPhone 17 (iOS 26.5, UDID `DAF21CEF-…`) et émulateur Android 14
(`emulator-5554`), version finale (release). T7 sur `423cdee`,
vérification des corrections sur `9ffb1d4`, B3 sur `03c0ed5` (Android).

| # | Attendu | Mesuré | Preuve | Verdict |
|---|---|---|---|---|
| C1 | `expo-sqlite`, sélecteur de fichier et feuille de partage marchent, Android et iOS, SDK 58 | Les trois modules marchent en release sur les deux. Piège Android : plantage avec `expo-modules-core` 58.0.23, réglé en 58.0.29 (T3). Partage sans le plugin `expo-sharing` (contrôle 5, T7) | `preuves/t1-essai/LISEZMOI.md`, `preuves/t7/*/controle5-feuille-de-partage.png` | **oui** |
| C2 | SQLite lu par Query, schéma versionné, montée testée | Table `routes` `STRICT`, `user_version` 1 ; SQLite 3.53.3 sur iOS et Android ; migrations dans une transaction, annulation sur erreur, base plus récente jamais écrite. Tests sur un vrai SQLite (`node:sqlite`) | `mobile/src/core/routes/migrations.test.ts`, `routesTesteurT3.test.ts`, `preuves/controles-avant-t6/` | **oui** |
| C3 | Tout est gardé ; identique après l'app tuée puis relancée | Ligne de la base identique octet pour octet (`cmp`) avant et après, iOS et Android | `preuves/t7/android/c3-avant.txt`, `c3-apres.txt`, idem `ios/` | **oui** |
| C4 | Nom par défaut (commune si possible, sinon date) ; renommer : non vide, 60 caractères | Date seule (commune juste dans 68 % des cas seulement, T1) ; « (2) » le même jour ; 60 acceptés, 61 refusés, emoji comptés pour 1 | `preuves/t1-essai/`, tests T3 et T5, `preuves/t7/*/c14/08` à `10` | **oui** |
| C5 | Liste de la maquette 40, tri, liste vide ; renommer et supprimer à jour aussitôt ; confirmation | Conforme selon le designer ; renommer ne change pas l'ordre (réponse 1 d'Émilien) | Tests T5 ; `preuves/t7/*/c14/`, `preuves/t8-verif/*/shots/` | **oui** |
| C6 | Infos recalculées sur la zone en service ; tracé gardé inchangé | Tests avec une fausse zone (v3 sans table → difficulté visible en v5) ; sur simulateur, version de zone et chiffres faussés en base : à l'ouverture, D+ recalculé, `legs` identiques (même md5) | `SavedRouteInfoT4Testeur.test.tsx`, `preuves/t7/android/c6-sim-*.txt`, `preuves/t7/ios/c6-sim-*.txt` | **oui**, réserve : difficulté après une vraie mise à jour non jouée sur simulateur |
| C7 | « Modifier » : tronçons non touchés gardés ; Enregistrer remplace ; Fermer laisse intact | Tests : versions `[3, 5, 5]`, même ligne, base intacte après abandon. Parcours C14 : une seule ligne après Modifier puis Enregistrer. Cadrage du tracé corrigé (B3) | `DraftSave*.test.tsx`, `preuves/t7/*/c14-maestro.log`, `preuves/b3/` | **oui** |
| C8 | Zone supprimée : l'itinéraire reste, message clair, renommer, exporter, supprimer | Zone simulée absente en base : « Zone Vosges supprimée », écran Infos qui dit ce qui manque, sans plantage | Tests T4 et T5 ; `preuves/t7/*/c16/liste-remplie-zone-supprimee.png`, `infos-zone-supprimee.png` | **oui** |
| C9 | Export GPX 1.1 valide selon le schéma officiel | `xmllint --schema` : « validates » pour un itinéraire créé et un GPX importé, sur les deux simulateurs ; 5 fichiers en Jest | `preuves/t7/*/gpx/xmllint-*.txt`, `preuves/t6-testeur/xmllint.txt` | **oui** |
| C10 | Import `trk`/`rte` ; refus en français ; pas de réseau ni d'entité externe | 7 fichiers d'apps courantes importés ; refus avec les textes exacts ; taille contrôlée avant toute lecture ; `DOCTYPE` refusé, `fetch` jamais appelé ; nombres et imbrication piégés traités en temps linéaire | `preuves/t2-testeur/`, `preuves/t6-testeur/`, `preuves/t7/*/c16/refus-*.png` | **oui** |
| C11 | Aller-retour : même tracé à 1 m, même distance à 10 m | Tracé : 0,000 m en Jest, 0,5 m au plus sur simulateur. Distance : comparée sur la **longueur du tracé** (voir écarts) | `preuves/t2/controle7-sortie.txt`, `preuves/t6-testeur/aller-retour.txt`, `preuves/t7/*/c11-aller-retour.txt` | **oui**, sur la longueur du tracé |
| C12 | GPX hors zone accepté, zone proposée ; D+, terrain, difficulté indisponibles | Feuille avec la zone proposée, et variante sans réseau ; écran Infos avec distance et durée seules (10 km/h, réponse 6) | Tests T6 ; `preuves/t7/*/c16/feuille-hors-zone-*.png`, `infos-gpx-hors-zone.png` | **oui** |
| C13 | Release : liste de 50 en < 1 s ; GPX de 10 000 points en < 3 s ; infos d'un 40 km en < 1 s | Liste : Android 266 à 363 ms, iOS 151 à 166 ms. Import : Android 1,67 à 1,79 s, iOS 1,31 à 1,38 s. Infos (49 km) : Android 637 à 772 ms ; iOS 543 à 558 ms, une mesure à 1 086 ms à cause du fond de carte (chiffres à l'écran dès 180 ms) | `preuves/t7/android/c13-*.txt`, `preuves/t7/ios/c13-mesures.txt` | **oui**, réserve sur une mesure iOS |
| C14 | Maestro, mode avion : créer, enregistrer, liste, renommer, infos, modifier, supprimer ; importer | Android en mode avion : 120 étapes, 0 échec (T7 et à nouveau sur `9ffb1d4`). iOS : 111 puis 113 étapes, 0 échec | `preuves/t7/*/c14-maestro.log`, `preuves/t8-verif/*/c14-maestro.log` | **oui** (iOS sans mode avion) |
| C15 | `verify`, `pytest`, CI verte | 182 suites, 2 193 tests ; 228 pytest ; CI verte | `preuves/fin/verify.txt`, `preuves/fin/pytest.txt`, runs plus bas | **oui** |
| C16 | Captures release comparées aux maquettes 10, 20 et 40 | 4 bloquants et 11 mineurs trouvés, corrigés puis revérifiés ; M1 et M2 réglés en alignant la maquette 40 sur l'app (décision du pilote) | [p06-t8-itineraires-gpx.md](../../design/comparaisons/p06-t8-itineraires-gpx.md) | **oui**, réserve : B3 revérifié sur Android seulement |

## Runs de la CI

| Commit | Moment | Run | Résultat |
|---|---|---|---|
| `423cdee` | fin de T6 | 41736774981 | **échec** (voir écarts) |
| `f96a1a0` | correction de la CI | 41750151434 | succès |
| `9ffb1d4` | corrections T8 | 41752970952 | succès |
| `03c0ed5` | correction B3 | 42573336098 | annulé (remplacé par le run suivant) |
| `7a70fc7` | maquette 40 alignée | 42573388157 | annulé (remplacé par le run suivant) |
| `43e2605` | résultats, tout le code de la phase dont B3 | 42573593514 | **succès** |

## Écarts et réserves

- **CI rouge sur `423cdee`.** Un test de C3 écrivait ses bases dans un
  dossier du Mac (`/Users/…`), absent sur la machine Linux de GitHub.
  Corrigé dans `940f434` (dossier temporaire du système). Le journal n'a
  pas pu être lu sans compte GitHub : la cause a été reproduite en local.
- **C11 sur la longueur du tracé.** Le contrôle 7 de l'ADR montre que la
  distance du moteur et la longueur de sa propre forme diffèrent de 5 à
  19 m (R1 à R5, jusqu'à +18,9 m sur 40 km). C'est le moteur, pas l'export.
  Selon la réponse 9 d'Émilien, C11 compare la longueur du tracé avant et
  après l'aller-retour (`preuves/t2/controle7-sortie.txt`).
- **C6 de bout en bout.** La difficulté qui apparaît après une vraie mise
  à jour de zone n'a pas été jouée sur simulateur : le placement des
  points sur un tronçon noté a raté 3 fois sur Android. Couvert par les
  tests Jest et par une simulation en base sur les deux simulateurs.
- **B3 (cadrage de « Modifier »)** : il a demandé un 3e aller-retour,
  accordé par le pilote. La cause était un cadrage envoyé avant que la
  carte ait créé sa caméra. Revérifié sur Android (564 m et 41 km) ; pas
  sur iOS, selon la décision du pilote (un seul simulateur).
- **iOS sans mode avion** (Maestro ne sait pas le couper). Pas de capture
  iOS de la feuille hors zone sans réseau.
- **M8 et M9 vus en partie** : phrase « dans la zone {zone} » non vue à
  l'écran (le catalogue ne connaît que Nancy) ; cas « zone inactive »
  impossible à provoquer avec une seule zone (textes vérifiés en Jest).
- **Garde-fou** : trois refus, aucun contourné. L'effacement de
  `DerivedData` (fait ensuite par Émilien), le vidage d'un dossier de
  fichiers du simulateur iOS (deux fichiers d'essai y restent :
  `00-cible.gpx`, `trace-testeur.gpx`, dans « File Provider Storage »), et
  des commandes `grep` du relecteur (lecture faite autrement).
- **Place disque** : les constructions ont été arrêtées deux fois sous le
  seuil, jusqu'au nettoyage fait par Émilien.
- **Tests existants adaptés**, chacun justifié dans le `tests-adaptes.md`
  de sa tâche : clés de Query (`shapeVersion`) et bouton « Enregistrer »
  (T4), écran de la liste (T5), bouton d'import (T6), chemin du test C3,
  annonces, ordre du menu Android et texte « inactive » (corrections).
- **Nombre d'allers-retours** : 2 au plus par tâche, sauf B3 (3, accordé).

## Pour plus tard

- **Deux zones installées** : un itinéraire d'une zone prête mais pas en
  service n'a pas d'infos (réponse 8 d'Émilien). À revoir quand une 2e zone
  sera publiée.
- **La commune dans le nom par défaut** : V2, avec une table des communes
  dans le paquet de zone.
- **Design** (comparaison T8) : N1 menu ancré au lieu de la boîte Android ;
  N7 effet d'appui carré sur Android ; « Voir les zones » sur toute la
  largeur (N3) et la note « Export » de la maquette 40 ; la maquette 20 met
  encore le nom sous l'arche → phase 10.
- **Trait de liaison** hors du GPX et de la distance : à trancher avant la
  phase 8 (déjà noté).
- **ESLint** : pas encore de règle qui interdit `fetch` dans `core/`
  (l'ADR 0019 l'annonce).
- **Jest** : « A worker process has failed to exit gracefully » à chaque
  `verify` (déjà avant la phase) ; un fichier lancé seul ne rend pas la
  main sans `--forceExit`.
- **Simulateur iOS** : retirer à la main les deux fichiers d'essai de
  « File Provider Storage ».
