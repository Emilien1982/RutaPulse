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
- `npm run verify` : 102 suites, 1 318 tests réussis (T9). CI : voir C12.

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
| C12 | `verify` passe, CI verte | 102 suites, 1 318 tests réussis ; CI verte à chaque tâche | `preuves/p05/t9/verify-commit.log` ; runs listés plus bas | **oui** |
| C13 | Maestro en mode avion : créer, infos, D+ et parts, « Modifier » | `e2e/p05-infos.yaml` : 50 étapes réussies (T7), 46 (T9) | `t7/c13-maestro/maestro.log` | **oui**, Android ; iOS en attente |
| C14 | Point glissé agrandi avec halo, bulle « À la main », note « À la main : x km » | Fait (T6), avec l'essai MapLibre de T1 | `t6/`, `captures/p05-android-point-choisi-agrandi.png` | **oui**, Android seulement |
| C15 | Captures release sur les deux simulateurs comparées aux maquettes 10, 11, 20 | Android comparé (1 bloquant, 7 « à corriger », corrigés en T9) | `design/comparaisons/p05-t8.md` | **à moitié** : iOS en attente |

## Ce qui a été construit

- **T1, essai jetable et ADR 0017.** `height` et `trace_attributes` hors
  ligne sur les deux plateformes, réponses brutes gardées ; `height` en
  précision 0 donne le même D+ sur iOS, Android et Mac. Point agrandi : seul
  le point choisi peut changer d'aspect ; changer la clé pendant un glisser
  fait planter iOS. ADR 0017 accepté par Émilien.
- **T2, le module natif** : `height` et `traceAttributes`, dans la file
  unique du moteur, codes d'erreur, fixtures réelles.
- **T3, la logique pure** `core/route-info/` : profil joint, D+ et D−, tout
  ou rien sur les altitudes, classement du terrain, parts au plus fort reste,
  bande de terrain, longueur à la main. Référence Python indépendante.
- **T4, le branchement** : deux requêtes par tronçon (altitudes, terrain),
  jamais pendant un glisser, Annuler sans appel ; D+ dans le résumé.
- **T5, l'écran Infos** dans une pile imbriquée (`app/draft/`), avec
  `DraftSession`. 10 suites commitées enveloppées (table T5).
- **T6, les écarts de la phase 4** : point choisi agrandi, bulle et note
  « À la main ».
- **T7, les preuves** : banc jetable, comparaison au Mac, mesures, Maestro,
  captures.
- **T8, la comparaison du designer** : 1 bloquant, 7 « à corriger »,
  7 « plus tard ».
- **T9, les corrections** : chevron du résumé, mode compact sous 390 dp,
  milliers, cadrage et zoom de l'arche, étiquettes masquées, légende en
  brun, « À la main » en tirets, « Altitudes indisponibles » avec ses
  4 cases, échelle du profil. 17 tests commités adaptés (table T9).
  **3 allers-retours** (le 3e accordé par le pilotage).

## Commits et CI

| Tâche | Commit | Run de CI |
|---|---|---|
| T1 (essai, ADR proposé) | `f0b2573` | — |
| ADR accepté | `3419998` | https://github.com/Emilien1982/RutaPulse/actions/runs/40684591146 |
| T2 | `42f1385` | https://github.com/Emilien1982/RutaPulse/actions/runs/40689048596 |
| T3 | `c403d6c` | https://github.com/Emilien1982/RutaPulse/actions/runs/40690991867 |
| T4 | `36035d8` | https://github.com/Emilien1982/RutaPulse/actions/runs/41423412578 |
| T5 | `9c47eac` | https://github.com/Emilien1982/RutaPulse/actions/runs/41429316632 |
| T6 | `12e4dad` | https://github.com/Emilien1982/RutaPulse/actions/runs/41431850438 |
| T7 | `9af37c9` | https://github.com/Emilien1982/RutaPulse/actions/runs/41435949974 |
| Écart T1/T7, T8 | `905f830`, `c498a2a` | — (docs) |
| T9 | `ff8f0a5`, `6c12a1e` | https://github.com/Emilien1982/RutaPulse/actions/runs/41451012112 (sur `6c12a1e`) |

## Décisions prises dans la phase

- ADR 0017 accepté par Émilien le 28 octobre 2026. Réponses : altitudes
  manquantes en tout ou rien ; part « À la main » en magenta, confirmée par
  le designer avec la forme en tirets (jeton `terrain.a-la-main`).
- Avancer sur Android seulement, iOS en attente de la licence Xcode
  (Émilien, 2 novembre).
- Session de phase : `handLengthKm` dans `core/route-info/` (pas dans
  `summarize`) ; le résumé n'est pas grisé pendant le glisser (comme en
  phase 4), grisé après le relâchement tant que le calcul tourne (accepté
  par le pilotage) ; zoom minimal à 0 pour la carte d'Infos (sinon un long
  itinéraire sort de l'arche).
- Designer : marges de l'arche 20/56/32/56 ; mode compact du résumé sous
  390 dp (chiffres en 24, légendes courtes) ; jetons
  `marqueur.depart-arrivee-vignette` et `texte.chiffre-cle-compact`.

## Limites connues et écarts restants

- **Lecteur d'écran, mode compact, résumé non touchable** (pendant un
  calcul) : chaque chiffre est lu avec sa légende courte (« 421 m,
  Montée ») au lieu de la longue. Relevé par la relecture finale de T9,
  non corrigé (3e aller-retour strictement limité). À faire dans une
  prochaine phase.
- Pire cas du résumé à 360 dp (« 125,4 km / 1 250 m / 10 h 45 ») : calculé
  par le designer (315 dp pour 327), pas capturé. Capturé : 124,1 km,
  1 035 m, 8 h 19.
- Les références R1 à R5 n'ont pas de tronçon « À la main » : cette part
  n'est pas comparée au Mac, seulement testée.
- Temps d'affichage mesuré dans le JavaScript (sans l'animation ni le
  dernier dessin natif).
- « Plus tard » du designer (P1 à P7) : arche en ellipse, ombre au soleil,
  titres de bloc, coutures de la bande, etc. Voir p05-t8.
- Jest affiche toujours « A worker process has failed to exit gracefully ».

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

## Ce qui a été appris sur les agents

- **L'essai jetable a encore fixé l'architecture sur des faits.** La
  précision 0 de `height`, l'erreur 444 sur une ligne droite, le plantage
  iOS au changement de clé : rien de cela n'était dans la doc.
- **Le relecteur trouve ce que les tests ne voient pas.** Le réglage
  `retryOnMount: false` empêchait aussi la création de recalculer un échec
  (contraire à l'ADR 0016) ; tous les tests passaient.
- **Le testeur qui écrit d'après la spec trouve les écarts au design.** En
  T9, ses tests écrits d'après la décision du designer ont trouvé 3 écarts
  (nom accessible, écarts 16 et 12) que le développeur et le relecteur
  avaient laissés passer.
- **Une décision prise trop tôt coûte un aller-retour.** J'ai tranché
  « écart de 12 partout » avant que le designer ne décide (16 en normal,
  12 en compact). Le développeur a suivi ma consigne, le testeur la
  décision : 3e aller-retour. Leçon : ne pas trancher un détail visuel
  qu'on va soumettre au designer.
- **Le garde-fou ne suffit pas s'il vise un outil.** En T1, le développeur
  a écrit dans `docs/` par Bash avant que Write soit refusé. Depuis, la
  consigne écrite : ne jamais contourner un refus ; sorties hors de `docs/`,
  copiées par la session de phase.
- **Un arrêt de processus par motif est dangereux.** En T4, `pkill -f jest`
  a pu toucher les tests d'autres sessions. Depuis : arrêter seulement ses
  propres processus, par leur PID (consigne du pilotage dans chaque brief).
- **Le dossier temporaire n'est pas un lieu de preuve.** Les captures de T4
  ont été effacées par le système pendant la pause. Depuis, les preuves vont
  dans un dossier durable, puis dans `docs/`.
- **Un sous-agent peut rester bloqué sur son propre travail en arrière-plan**
  (T9) : son travail était fini, il ne rendait pas son compte rendu. Arrêté,
  la session de phase a vérifié l'état (émulateur, processus) et repris.
- **Jest simule un écran étroit** (750 à l'échelle 2, soit 375 dp) : un
  réglage qui dépend de la largeur change tous les tests d'écran.
- **Un changement de version d'outil pendant une pause bloque tout un
  pan** : Xcode 27.2 et sa licence ont arrêté iOS.

## À reporter dans PILOTAGE.md

- Phase 5 : **Android terminé, iOS en attente** de la licence Xcode 27.2.
  Branche `claude/phase-5-infos`, poussée, non fusionnée. Ne pas fusionner
  avant la partie iOS (ou décision d'Émilien).
- ADR 0017 accepté le 28 octobre 2026 ; ADR 0005 et 0015 annotés.
- Décisions : tout ou rien sur les altitudes ; « À la main » en magenta à
  tirets ; mode compact du résumé sous 390 dp ; zoom minimal 0 de la carte
  d'Infos ; pas de grisé pendant le glisser.
- Écart de D+ entre l'essai T1 et l'app : dû aux tronçons `break` (tracés
  plus courts), pas au calcul. Question de tracé à revoir dans une autre
  phase (ADR 0016).
- À faire plus tard : nom accessible du résumé en mode compact non
  touchable ; « plus tard » P1 à P7 du designer.
- Règles nouvelles des briefs : ne jamais contourner un refus du garde-fou ;
  arrêter ses processus par PID seulement ; preuves dans un dossier durable.
- 3e aller-retour accordé en T9 (cause : décision de la session de phase
  prise avant celle du designer).

## Branches jetables (locales, jamais poussées)

- `claude/p05-essai-infos` (`9d68b81`) : essai T1.
- `claude/p05-essai-pile` (`65e6c2b`) : pile imbriquée, T5.
- `claude/p05-banc` (`72ee978`) : banc de mesure, T7.
