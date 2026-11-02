# Phase 5 — Infos de l'itinéraire : résultats

> Commencée le 28 octobre 2026, reprise le 2 novembre 2026. Spec :
> [p05-infos-itineraire.md](p05-infos-itineraire.md). Branche
> `claude/phase-5-infos`, poussée, non fusionnée.
>
> **Terminée sur Android et iOS.** Xcode est passé en 27.2 pendant la pause
> du 28 octobre au 2 novembre, sans licence acceptée. Décision d'Émilien
> (2 novembre) : Android d'abord. La licence a été acceptée le même jour ;
> la partie iOS a suivi (preuves `preuves/p05/ios/`, corrections T10).

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
- Les mêmes résultats sur iOS et Android, au mètre près.
- Les infos d'un itinéraire de 40 km s'affichent en **248 ms** au plus sur
  Android, **117 ms** sur iOS (seuil 1 s). Le glisser reste fluide : arrêt
  maximal du fil JavaScript de **53 ms** sur Android, **30 ms** sur iOS
  (seuil 100 ms).
- Les trois écarts « plus tard » de la phase 4 sont faits (point choisi
  agrandi, bulle et note « À la main »).
- `npm run verify` : 103 suites, 1 326 tests réussis (T10). CI : voir C12.

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
| Preuves iOS (C3, C5, C7, C9, C13) | [preuves/p05/ios/](preuves/p05/ios/), banc iOS : [preuves/p05/t7-banc/ios-controle/](preuves/p05/t7-banc/ios-controle/) |
| Comparaison iOS du designer | [design/comparaisons/p05-ios.md](../../design/comparaisons/p05-ios.md) |
| Corrections T10 | [preuves/p05/t10/](preuves/p05/t10/), [t10-tests-adaptes.md](preuves/p05/t10-tests-adaptes.md) |
| Captures release | [captures/](captures/), préfixes `p05-android-` et `p05-ios-` |

## Critères

Émulateur Android 14 `Pixel_6_API_34_arm64` (`emulator-5554`) et simulateur
iPhone 17, iOS 26.5 (UDID `DAF21CEF-…`, Xcode 27.2), version finale
(release), zone Nancy v3.

| # | Attendu | Mesuré | Preuve | Verdict |
|---|---|---|---|---|
| C1 | `height` et `traceAttributes` dans le module natif, hors ligne, Android et iOS, Nancy v3 | Module final appelé en release sur les deux (Android T2, iOS : banc et app rebuildés avec Xcode 27.2) | `t2/`, `t7-banc/ios-controle/`, `ios/build-ios-phase.log` | **oui** |
| C2 | D+ et D− dans `core/`, une altitude tous les 30 m, seuil 5 m | `core/route-info/elevation.ts`, profils connus, seuil exact, jonctions | Tests de `core/route-info/`, `t3/reference-python.txt` | **oui** |
| C3 | Même D+ et D− que le Mac sur R1 à R5, à 1 m près | Écart 0 sur les 5, même méthode et même moteur (Valhalla 3.9.1), Android et iOS ; iOS = Android | `t7/comparaison-mac/sortie/resultat.txt`, `ios/comparaison-mac/resultat.txt` | **oui** |
| C4 | Un tronçon à la main a ses altitudes, comptées dans le D+ et le profil | `height` sur la ligne droite ; tests ; capture d'un itinéraire mixte | Tests T3 et T4 ; `captures/p05-android-infos-a-la-main.png` | **oui** |
| C5 | Terrain classé en route / piste / sentier + « À la main », parts à 100 %, à 1 point du Mac | Écart 0 sur R1 à R5, Android et iOS ; 2 000 cas aléatoires à 100 % | `t7/comparaison-mac/`, `ios/comparaison-mac/`, tests T3 | **oui**. Réserve : les références n'ont pas de tronçon à la main |
| C6 | D+ dans le résumé, mis à jour après chaque action, jamais pendant un glisser | Tests ; captures pendant et après un glisser, deux plateformes | `captures/p05-*-glisser-*.png`, `p05-*-creation-resume-dplus.png` | **oui** |
| C7 | Infos s'ouvre en touchant le résumé ; « Modifier » revient, itinéraire intact ; pas de « Démarrer le suivi » ; en-tête « Nouvel itinéraire » | Pile imbriquée éprouvée en release sur les deux (iOS : croix, glissement depuis le bord, défilement, 55 étapes) ; tests ; Maestro | `t5/`, `ios/pile/`, `RouteInfoScreenSpec.test.tsx`, `t10/maestro2-*.log` | **oui** |
| C8 | Profil de la maquette 20 ; carte en arche avec tout le tracé, attribution courte et « i » | Comparé par le designer sur les deux ; corrections T9 et T10 | `p05-t8.md`, `p05-ios.md`, `t9/`, `t9b/`, `t10/` | **oui** |
| C9 | Infos d'un 40 km en moins de 1 s ; glisser sans arrêt de plus de 100 ms | Android : 180 à 248 ms à froid, 49 à 50 ms à chaud, arrêt max 48 à 53 ms. iOS : 116 ms à froid, 49 à 66 ms à chaud, arrêt max 30 ms | `t7/c9-*/analyse.txt`, `ios/c9-analyse.txt` | **oui** |
| C10 | Jamais de plantage ; altitudes ou terrain manquants dits en français, le reste montré | « Altitudes indisponibles » (tout ou rien, décision d'Émilien), « Terrain indisponible », « … » en attente | Tests T3 à T5 et T9 ; `captures/p05-android-infos-altitudes-indisponibles.png`, `t9/11-*.png` | **oui** |
| C11 | Pas de ligne « Difficulté » | Tests | Tests T3, T5 | **oui** |
| C12 | `verify` passe, CI verte | 103 suites, 1 326 tests réussis ; CI verte à chaque tâche | `preuves/p05/t10/verify-commit.log` ; runs listés plus bas | **oui** |
| C13 | Maestro en mode avion : créer, infos, D+ et parts, « Modifier » | `e2e/p05-infos.yaml` (adapté en T10 : `id: info-modify`) : Android en mode avion 50 étapes, iOS 41 étapes (sans mode avion, le simulateur ne le permet pas) | `t10/maestro2-android.log`, `t10/maestro2-ios.log` | **oui** (iOS sans mode avion) |
| C14 | Point glissé agrandi avec halo, bulle « À la main », note « À la main : x km » | Fait (T6), sur les deux plateformes | `t6/`, `captures/p05-*-point-choisi-agrandi.png`, `p05-*-a-la-main-*.png` | **oui** |
| C15 | Captures release sur les deux simulateurs comparées aux maquettes 10, 11, 20 | Android : 1 bloquant, 7 « à corriger » (T9). iOS : 0 bloquant, 2 « à corriger » (T10), aucun écart propre à iOS à taille de texte normale | `p05-t8.md`, `p05-ios.md` | **oui** |

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
- **Partie iOS** : build avec Xcode 27.2, banc iOS, mesures C3, C5, C9,
  pile, Maestro, captures, passe du designer (0 bloquant, 2 « à corriger »).
- **T10, les corrections iOS** (communes aux deux plateformes) : marge
  compensée du résumé (le coin arrondi rognait le « D » de « Distance ») ;
  attributions courtes à taille fixe (Infos, création, onglet Carte) ;
  parcours C13 par `id: info-modify`. 2 tests commités adaptés (table T10).
  **2 allers-retours** (le 2e : ma consigne désignait la mauvaise carte).

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
| Résultats Android | `a12641b` | https://github.com/Emilien1982/RutaPulse/actions/runs/41451668710 |
| T10 et preuves iOS | `17eb58b` | https://github.com/Emilien1982/RutaPulse/actions/runs/41495574117 |

## Décisions prises dans la phase

- ADR 0017 accepté par Émilien le 28 octobre 2026. Réponses : altitudes
  manquantes en tout ou rien ; part « À la main » en magenta, confirmée par
  le designer avec la forme en tirets (jeton `terrain.a-la-main`).
- Avancer sur Android d'abord, iOS après la licence Xcode (Émilien,
  2 novembre).
- Session de phase : `handLengthKm` dans `core/route-info/` (pas dans
  `summarize`) ; le résumé n'est pas grisé pendant le glisser (comme en
  phase 4), grisé après le relâchement tant que le calcul tourne (accepté
  par le pilotage) ; zoom minimal à 0 pour la carte d'Infos (sinon un long
  itinéraire sort de l'arche).
- Designer : marges de l'arche 20/56/32/56 ; mode compact du résumé sous
  390 dp (chiffres en 24, légendes courtes) ; jetons
  `marqueur.depart-arrivee-vignette` et `texte.chiffre-cle-compact`.
- Designer (passe iOS) : le point glissé reste le point choisi, agrandi,
  avec sa bulle (conforme, jeton `marqueur.point-deplace` précisé) ;
  attribution courte à taille fixe (`texte.attribution`) ; les très grandes
  tailles de texte sont reportées (voir plus bas).

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
- **Très grandes tailles de texte (E3 du designer)** : à la plus grande
  taille d'accessibilité iOS, Infos casse les mots, la carte couvre le
  titre, « Modifier » est coupé. Sur Android à 1,3, « PROCHAIN TRONÇON »
  touche la note « À la main » (D1). Correct à « xxl » sur Infos. Reporté :
  cause commune à toute l'app (hauteurs fixes, deux colonnes).
- **Android : changer la taille du texte pendant une création ramène à
  l'accueil et perd le brouillon** (D2, vu par le testeur ; l'activité est
  recréée). iOS garde l'écran. Hors spec, non corrigé.
- **Point choisi et ajout** : quand un point est choisi et qu'on en ajoute
  un, le premier reste choisi, « Supprimer » le vise (designer). Commun aux
  deux plateformes.
- Non capturé sur iOS : « Altitudes indisponibles » (couvert par les tests
  et la capture Android).
- R5 : les réponses brutes `height` iOS et Android diffèrent sur 12 tronçons
  sur 23 (axe des distances à 1 m près), sans changer aucun résultat. Cause
  non cherchée.
- Un geste du banc dure 5,6 s sur iOS (appui long MapLibre) contre 2 s sur
  Android : durées non comparables, le seuil d'arrêt est tenu sur toute la
  durée.
- `T10IosFixes.test.tsx` : le bloc de `ZoneMap` s'appelle « creation map
  attribution » (c'est l'onglet Carte) ; un `QueryClient` n'est pas vidé
  après son test. Remarques du relecteur, non corrigées.

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

## Remise en ordre

- Android : empreinte de `valhalla_tiles.tar` (Nancy v3) `7fa29249…7a44`,
  conforme (fin de T10) ; mode avion coupé, `font_scale` 1,0, fichiers du
  banc effacés, app de la phase en release, taille d'écran d'origine.
- iOS (iPhone 17, iOS 26.5) : même empreinte, conforme ; taille de texte
  `large`, fichiers du banc effacés (`raz.sh ios`), app de la phase en
  release. Reste dans l'app le dossier `Documents/essai` de T1 (inoffensif).
- Metro arrêté par PID à chaque fois ; aucun arrêt par motif.

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
- **Une erreur de nom dans une consigne passe tous les contrôles sauf la
  relecture.** En T10, j'ai appelé `ZoneMap.tsx` « carte de la création ».
  Le développeur et le testeur ont suivi ; le relecteur, qui a relu la
  demande du designer, a vu que la création est `DraftScreen.tsx`.
  Leçon : vérifier le fichier d'un écran avant de le nommer dans un brief.
- **Le simulateur au nom ambigu** : deux « iPhone 17 » (iOS 26.5 et 27.2).
  Les agents ont utilisé l'UDID. À écrire dans les briefs.
- **Maestro lit le nom accessible sur iOS, le texte sur Android** : un
  parcours qui cherche « Modifier » passait sur Android et échouait sur
  iOS (« Modifier l'itinéraire »). Cibler par identifiant (`id:`).

## À reporter dans PILOTAGE.md

- Phase 5 : **terminée, Android et iOS.** Branche `claude/phase-5-infos`,
  poussée, non fusionnée (fusion à la décision d'Émilien).
- ADR 0017 accepté le 28 octobre 2026 ; ADR 0005 et 0015 annotés.
- Décisions : tout ou rien sur les altitudes ; « À la main » en magenta à
  tirets ; mode compact du résumé sous 390 dp ; zoom minimal 0 de la carte
  d'Infos ; pas de grisé pendant le glisser ; attribution courte à taille
  fixe ; le point glissé reste choisi.
- Écart de D+ entre l'essai T1 et l'app : dû aux tronçons `break` (tracés
  plus courts), pas au calcul. Question de tracé à revoir dans une autre
  phase (ADR 0016).
- **Questions pour Émilien** (recommandations du designer et de la session
  de phase) :
  1. Très grandes tailles de texte (E3, D1) : un chantier pour toute l'app
     au début de la phase 6, au plus tard avant la première diffusion
     publique. Recommandé, plutôt qu'une correction d'Infos seul.
  2. Point choisi quand on ajoute un point : l'ajout vide le choix.
     Recommandé, au prochain passage sur la création.
  3. Android, brouillon perdu au changement de taille du texte (D2) : à
     corriger avec le chantier 1 (garder l'état de la création quand
     l'activité est recréée). Recommandé.
- À faire plus tard : nom accessible du résumé en mode compact non
  touchable ; « plus tard » P1 à P7 du designer ; capture iOS « Altitudes
  indisponibles ».
- Règles nouvelles des briefs : ne jamais contourner un refus du garde-fou ;
  arrêter ses processus par PID seulement ; preuves dans un dossier durable ;
  désigner un simulateur par son UDID ; vérifier le fichier d'un écran avant
  de le nommer.
- Allers-retours : 3 en T9 (le 3e accordé ; cause : décision de la session
  de phase prise avant celle du designer), 2 en T10 (cause : erreur de nom
  dans la consigne).

## Branches jetables (locales, jamais poussées)

- `claude/p05-essai-infos` (`9d68b81`) : essai T1.
- `claude/p05-essai-pile` (`65e6c2b`) : pile imbriquée, T5.
- `claude/p05-banc` (`72ee978`) : banc de mesure, T7 (Android et iOS, sans commit de plus).
