# Pilotage — RutaPulse, app de navigation VTT

> Tableau de bord du projet. Relu au début de chaque session, mis à jour à la
> fin de chaque étape. Si une décision n'est pas ici ou dans un ADR, elle
> n'est pas prise.

## Objectif

1. **Réel :** apprendre le développement agentique de qualité.
2. **Support :** une app de navigation VTT digne d'un produit grand public.

## Règles du jeu

- Émilien est **Product Owner** : il valide le design, l'architecture, le
  découpage des phases, et toute phase coûteuse (temps ou tokens) **avant**
  son lancement.
- À l'intérieur d'une phase validée, la session principale tranche et annonce.
- Phases petites, chacune avec un livrable démontrable et des preuves.

## Phases

| # | Phase | État |
|---|---|---|
| 1 | Bonnes pratiques agentiques → [docs/01](docs/01-bonnes-pratiques-agentiques.md) | ✅ validé |
| 2 | Configuration agentique → [docs/02](docs/02-configuration-agentique.md) | ✅ fait, épreuve réussie |
| 3 | Cadrage produit → [docs/03](docs/03-cadrage-produit.md), puis architecture, design, découpage | 🔧 cadrage et architecture validés → [docs/04](docs/04-architecture.md) ; essai 1 ✅ ([résultats](docs/essais/01-calcul-hors-ligne.md)), essais 1, 2 et 3 ✅ ([résultats](docs/essais/)) ; maquettes et découpage proposés |
| 4+ | Développement en 10 phases (la 9 passe en V2) → [docs/05](docs/05-decoupage-v1.md) | phase 0 ✅ ([résultats](docs/phases/p00-socle-resultats.md)) ; phase 1 ✅ ([résultats](docs/phases/p01-fabrique-zones-resultats.md)) ; phase 2 ✅ ([résultats](docs/phases/p02-carte-hors-ligne-resultats.md)) ; phase 3 ✅ ([résultats](docs/phases/p03-module-calcul-resultats.md)) ; phase 4 ✅ ([résultats](docs/phases/p04-creer-modifier-itineraire-resultats.md)) ; phase 5 ✅ ([résultats](docs/phases/p05-infos-itineraire-resultats.md)) ; phase 5b ✅ ([résultats](docs/phases/p05b-difficulte-maj-zones-resultats.md)) ; phase 6 ✅ ([résultats](docs/phases/p06-mes-itineraires-gpx-resultats.md)) ; phase 7 ✅ ([résultats](docs/phases/p07-circuits-balises-resultats.md)) ; phase 8a en cours (suivi sur le vélo), puis 8b ; phase 9 passée en V2 ; puis phase 10 |

## Décisions prises

- 2026-11-10 — Incident phase 8a : `npx expo run:android` a ignoré `ANDROID_SERIAL=emulator-5584` et installé l'APK de l'essai (écran /essai) sur le téléphone réel d'Émilien (R5CR21B1KDW, 10 nov. 13 h 43). Règle : tant qu'un téléphone est branché, jamais `expo run:android` ; construire par `./gradlew app:assembleRelease` puis `adb -s emulator-5584 install -r`. Émilien doit réinstaller ou désinstaller l'app sur son téléphone.
- 2026-11-10 — Place du Mac : `df` montrait 11 Go libres, le Finder 89 Go. L'écart venait de 18 copies locales Time Machine (une par heure), qui gardaient DerivedData effacé. Sur l'idée d'Émilien, les 17 plus vieilles ont été effacées une par une (`tmutil deletelocalsnapshots <date>`) : 61 Go libres. À refaire de la même façon si `df` et le Finder divergent.
- 2026-11-10 — Phase 8a, T1 : ADR 0021 (suivi sur le vélo) et maquette 30 complétée validés par Émilien, avec les 11 recommandations : directions par `trace_route` (map_snap), morceau mal recalé = « Suivez le tracé » ; suivi perdu si le système ferme l'app (sauvegarde en V2) ; GPX hors zones suivable (fond uni, D+ « — ») ; « Terminer » avant 100 m = pas de résumé ; départ loin du tracé = guidage à vol d'oiseau. Partie B de l'essai (simulateurs) en attente de place (13 Go libres).
- 2026-11-10 — Spec de la phase 8 ([p08-suivi-velo.md](docs/phases/p08-suivi-velo.md)) validée par Émilien, avec les recommandations : le trait de liaison ne compte ni dans la distance ni dans le GPX, et le suivi ne guide pas dessus ; hors zone à moins de 10 km, la carte cadre la position et le bord de la zone, et le suivi suit partout ; flèche de cap, halo et « suit ma position » faits en phase 8. Question 4 : **deux phases**, 8a (suivi, M) puis 8b (luminosité, onglet Carte, trait de liaison, P).
- 2026-11-10 — Décision d'Émilien : la phase 9 (suivi téléphone verrouillé) passe en **V2**. La phase 8 reste complète, puis vient la phase 10 (finition et test interne). Le niveau de process ne change pas. But : un essai réel au plus tôt après la phase 8 (le projet lui paraît long et coûteux en quota).
- 2026-11-10 — Nouvelle session de pilotage : `local_b89c76a2-43a1-4417-8c81-ac486e333c4d` (passation après la phase 7). C'est l'adresse à donner dans les briefs de phase.
- 2026-11-10 — Phase 7 fusionnée dans main (679b66d) : couche des circuits balisés et leur feuille, « En faire un itinéraire » (tracé gardé, aucun calcul à l'ouverture), « Modifier » d'un GPX (remplace l'original), « Dupliquer », base en version 2, fabrique qui ordonne les circuits, zone Nancy v6. 15 critères sur 16 ; C12 en partie (iOS 1,25 s, cause : vol de la carte vers la position, à corriger en phase 10 ; glisser non mesuré, l'émulateur limite la mesure). 2 529 tests, 280 pytest, CI verte. ADR 0020 ; ADR 0003 complété.
- 2026-11-10 — Phase 7, détails tranchés par le pilotage : glisser noté « non mesuré » (pas de banc) ; C12 iOS reporté à la phase 10 plutôt qu'un build de plus (disque à 12 Go). Choix du designer acceptés : circuits visibles dès le zoom 8 ; « Enregistrer » actif une fois les chiffres arrivés.
- 2026-11-09 — Phase 7, T1 : ADR 0020 et maquette 12 validés par Émilien, avec les recommandations des 8 questions (ordre des voies par une règle tolérante qui garde le tronc et refuse au-delà de 15 % retirés ; D+ d'une trace non touchée calculé d'un seul tenant). Ajout : « Dupliquer » un itinéraire (copie modifiable, l'original reste), critère C16. Le D+ est un ordre de grandeur en v1 : pas de travail de précision en plus.
- 2026-11-09 — Spec de la phase 7 (circuits VTT balisés et trace modifiable, taille G) validée par Émilien, avec les choix du pilotage. Un GPX modifié remplace l'original (origine « GPX modifié le … »). Ordre des voies des circuits fait dans la fabrique : zone Nancy v6 à publier.
- 2026-11-09 — Nouvelle session de pilotage : `local_1ea128ca-dd2d-45af-b97e-66ec21c85b89` (passation après la phase 6). CI de 9799484 verte.
- 2026-11-09 — Phase 6 fusionnée dans main : Enregistrer (nom « Itinéraire du 9 nov. »), onglet Itinéraires (liste, menu « ⋮ », renommer, exporter, supprimer), itinéraire gardé (tracé fixe, infos recalculées sur la zone en service), « Modifier » cadré sur le tracé, import et export GPX 1.1. 16 critères tenus avec réserves (C6 pas joué de bout en bout sur simulateur ; C11 sur la longueur du tracé ; C13 une mesure iOS à 1,09 s à cause du fond de carte ; C14 iOS sans mode avion ; B3 revérifié sur Android seulement). 2 193 tests, 228 pytest, CI verte. ADR 0019 ; maquette 40 alignée sur l'app (nom au-dessus de l'arche, feuille « hors de vos zones » sur la liste).
- 2026-11-09 — Phase 6, détails tranchés par le pilotage : 3e aller-retour accordé sur B3 seul ; écarts M1 et M2 du designer : on garde l'app, la maquette suit. CI rouge un temps sur 423cdee (un test écrivait dans /Users), corrigée en 940f434.
- 2026-11-07 — Règle d'Émilien complétée : le dimanche, pas de réserve de quota (pas de nouvelles offres d'emploi) ; tout le quota restant peut servir à RutaPulse.
- 2026-11-03 — Règle d'Émilien : à chaque fin de phase et à chaque pause, garder au moins 2 % du quota hebdomadaire par jour restant avant le renouvellement (lundi 7 h), dimanche non compté. Cette réserve sert à sa veille emploi. Sinon, la phase finit sa tâche, commite et s'arrête.
- 2026-11-03 — Phase 6, T1 : ADR 0019 et maquette 40 validés par Émilien, avec les recommandations : nom par défaut « Itinéraire du 3 nov. » (commune en V2, trouvée hors ligne dans 68 % des cas seulement), « (2) » le même jour, renommer ne fait pas remonter, pas de balayage (menu « ⋮ » et appui long), import → écran Infos, GPX importé à 10 km/h, avertissement à la suppression d'une zone utilisée.
- 2026-11-03 — Spec de la phase 6 (mes itinéraires et GPX, taille G) validée par Émilien, avec les choix du pilotage. Un GPX importé n'est pas modifiable ; le geste « trace → itinéraire modifiable » se fera en phase 7, pour les circuits et les GPX.
- 2026-11-03 — Nouvelle session de pilotage (passation après la phase 5b).
- 2026-11-03 — Phase 5b fusionnée dans main : table `difficulty.json` dans le paquet (505 voies notées à Nancy), ligne « Difficulté » sur l'écran Infos (écart 0 avec le Mac sur 6 itinéraires), mise à jour d'une zone à côté de l'ancienne version. 15 critères tenus avec réserves (coupure réseau, place insuffisante et attente du Wi-Fi prouvées sur Android seulement). 1 513 tests, 228 pytest, CI verte. ADR 0018 ; ADR 0003, 0005, 0013, 0015 et 0017 complétés.
- 2026-11-03 — Zone Nancy v5 publiée avec la table (run 41622214717). La v4, lancée depuis `main`, est publiée sans table. Émilien peut effacer les releases v1 à v3 (règle des 2 dernières versions).
- 2026-11-03 — Nettoyage du Mac avec l'accord d'Émilien : anciens worktrees, fichiers de compilation iOS, simulateurs hors service, cache npm, émulateurs KillerTest et Pixel_6_API_33. 57 Go libres.
- 2026-11-02 — Phase 5b, T1 : maquette 41 (mise à jour d'une zone) et ADR 0018 validés par Émilien. Date de la carte plutôt que « v4 » ; pas de pastille sur l'onglet en v1 ; pas de bouton « Ignorer » ; pas de confirmation pour annuler une mise à jour ; un itinéraire gardé (phase 6) a ses infos recalculées sur la zone en service, son tracé ne change jamais.
- 2026-11-02 — Spec de la phase 5b (difficulté VTT `mtb:scale` et mise à jour des zones) validée par Émilien, avec les choix du pilotage. Garder sur GitHub les 2 dernières versions d'une zone ; Émilien efface lui-même les plus anciennes après la fusion.
- 2026-11-02 — Nouvelle session de pilotage (passation après la phase 5).
- 2026-10-19 — Dossier du projet : `~/dev_ai/vtt-nav` (nom provisoire).
- 2026-10-19 — Style : phrases simples et concrètes ; tout terme anglais ou sigle est traduit entre parenthèses.
- 2026-10-19 — Config validée : 5 sous-agents (architecte, designer et relecteur sur Opus 5.5 ; développeur et testeur sur Sonnet 5.5), circuit `/phase`, épreuve.
- 2026-10-19 — Dépôt public sur GitHub : e-mail noreply en config locale git.
- 2026-10-19 — Session principale : Opus 5.5, effort `high`.
- 2026-10-19 — Nom de l'app : RutaPulse. Dépôt public : github.com/Emilien1982/RutaPulse.
- 2026-10-19 — Pas de relecture sur GitHub (PR) pour l'instant : trop lourd pour le gain.
- 2026-10-19 — v1 : création d'itinéraires VTT (aussi hors ligne), suivi avec indications écrites et notification téléphone verrouillé, Android + iOS, test interne (voir docs/03).
- 2026-10-19 — V2 : guidage vocal, économiseur d'écran.
- 2026-10-19 — Préférences de stack d'Émilien : React Native (qu'il connaît bien) ; bibliothèques TanStack quand elles conviennent (il veut les découvrir).
- 2026-10-19 — TanStack DB retiré de la v1 : Query, qui lit SQLite, suffit.
- 2026-10-19 — Essais sur simulateurs iOS et Android, pour limiter les manipulations d'Émilien.
- 2026-10-19 — Stack validée : Expo + React Native, MapLibre, Valhalla sur le téléphone, TanStack Query/Store/Pacer (ADR 0001 à 0010 acceptés).
- 2026-10-19 — Zone test : autour de Nancy (forêt de Haye, Petite Suisse lorraine).
- 2026-10-20 — Essai 1 : calcul hors ligne prouvé sur simulateurs Android et iOS. Émilien juge les itinéraires praticables (C3), mais peu intéressants en VTT : trop de ville, de laies et de petites boucles, et les pistes sont évitées. La création hors ligne reste en v1.
- 2026-10-20 — Essai 1-bis : aucun réglage ne rend les itinéraires plus « VTT ». Valhalla cherche le chemin le moins coûteux entre les points, pas une belle boucle. On garde Valhalla et son réglage de l'essai 1.
- 2026-10-20 — Cadrage modifié : recalcul en direct, tracé à la main par tronçon, circuits VTT balisés d'OSM (fonction 9). Génération de boucles : plus tard.
- 2026-10-20 — Essai 3 : carte hors ligne prouvée (MapLibre + PMTiles, 29 Mo pour Nancy), circuits balisés dans le paquet (2 seulement autour de Nancy), GitHub Actions jugé faisable.
- 2026-10-27 — Spec de la phase 3 (module de calcul) validée par Émilien.
- 2026-10-27 — ADR 0015 (module natif de calcul) accepté par Émilien. Le blocage SwiftPM de l'essai 1 venait du bac à sable du terminal : installation iOS reproductible par `spm_dependency`.
- 2026-10-27 — Nouvelle session de pilotage ; la phase 3 était déjà lancée par l'ancienne.
- 2026-10-27 — Phase 3 fusionnée dans main : calcul d'itinéraire hors ligne sur l'onglet Carte (départ, arrivée, tracé magenta, distance et durée, feuille hors zone). 10 critères sur 10, 576 tests, CI verte. Tracés de l'app identiques à ceux du Mac sur les 5 références : la question ARM de la phase 1 est réglée.
- 2026-10-27 — Point posé hors chemin : un trait de liaison en pointillés le relie au tracé. Il n'est pas compté dans la distance, la durée, le suivi ni le GPX pour l'instant (à revoir avant la phase 8). Durée affichée au moins « 1 min ».
- 2026-10-27 — Spec de la phase 4 (créer et modifier un itinéraire) validée par Émilien, avec les choix du pilotage : ajout à la fin seulement, confirmation à la fermeture dès 2 points, tronçon à la main à la vitesse moyenne (ou 10 km/h), annuler jusqu'à 50 actions sans « Rétablir ».
- 2026-10-27 — ADR 0016 (itinéraire en création) accepté par Émilien. Glisser un point demande un appui long (obligatoire sur iOS) ; la bulle d'aide le dit sur les deux plateformes. À revoir sur un vrai téléphone.
- 2026-11-02 — Phase 5 fusionnée dans main, Android et iOS : D+ dans le résumé de la création, écran Infos (distance, durée, D+ et D−, profil, parts route/piste/sentier/à la main, carte en arche, « Modifier »), point choisi agrandi, bulle et note « À la main ». 15 critères tenus, D+ et terrain identiques au Mac sur 5 références, 1 326 tests, CI verte. ADR 0017 ; ADR 0005 et 0015 annotés.
- 2026-11-02 — Très grandes tailles de texte (écrans qui cassent) et brouillon perdu sur Android au changement de taille du texte : à traiter à la finition (phase 10), décision d'Émilien.
- 2026-11-02 — Quand on ajoute un point, le choix d'un point est vidé (décision du pilotage), au prochain passage sur la création.
- 2026-11-02 — L'app calcule par tronçons `break` (phase 4), qui donnent des tracés plus courts qu'une route d'un seul tenant (R5 : −4 km). À surveiller à l'usage : demi-tours ou raccourcis sur un point de passage (ADR 0016).
- 2026-10-28 — ADR 0017 (calcul des infos d'itinéraire) accepté par Émilien. Altitudes par `height` de Valhalla (même D+ sur iOS, Android et Mac), terrain par `trace_attributes`. Altitudes manquantes : tout ou rien. Part « À la main » en magenta, à confirmer par le designer.
- 2026-10-28 — Spec de la phase 5 (infos de l'itinéraire) validée par Émilien : 4e part de terrain « À la main », écran Infos ouvert depuis le résumé, calcul après chaque action.
- 2026-10-28 — Nouvelle phase 5b, après la 5 : difficulté VTT (`mtb:scale`), avec une table ajoutée par la fabrique, une zone Nancy v4 et la mise à jour d'une zone dans l'app.
- 2026-10-28 — Phase 4 fusionnée dans main : création en plein écran, ajouter, glisser (recalcul en direct, 5 calculs par seconde au plus), supprimer, annuler, Boucler, tracé à la main, seuil de 200 m, feuilles d'erreur complètes. 15 critères tenus (écarts expliqués sur C9 et C14), 893 tests, CI verte. Fluidité en release : 31 ms au plus sur iOS, 71 ms sur Android (100 ms permis). ADR 0016 complété ; ADR 0011 : `mobile/plugins/` pour les réglages natifs.
- 2026-10-28 — Détails tranchés par le pilotage en phase 4 : point glissé = point choisi ; « — » sur l'écran vide ; « Relier ce point à la main » en une action ; le double appui sur Android n'est pas un défaut (artefact de Maestro, preuve adb rejouable).
- 2026-10-27 — Un point à plus de 200 m environ d'un chemin est refusé (feuille « Aucun chemin trouvé ») : à coder en phase 4.
- 2026-10-27 — Ne pas vider `~/Library/Caches/org.swift.swiftpm` sur le Mac : le bac à sable de Claude Code empêche SwiftPM de retélécharger valhalla-mobile (ADR 0015 § 6).
- 2026-10-27 — Niveau de process **maximal** gardé jusqu'à la fin de RutaPulse, volontairement (voir `~/dev_ai/STRATEGIE-NIVEAUX-DE-PROCESS.md`). Ne pas l'alléger.
- 2026-10-27 — Phase 2 fusionnée dans main : onglets Zones et Carte, téléchargement contrôlé et reprise, carte en mode avion bloquée sur la zone (contour, voile, message hors zone), thème années 70. 13 critères sur 13, 409 tests, CI verte. ADR 0013 et 0014 (`shared-data/`) acceptés.
- 2026-10-26 — Seule la session de pilotage parle à Émilien (règle dans CLAUDE.md).
- 2026-10-23 — Lancement à la main du workflow par Émilien : run réussi, release zone-nancy-v3, catalogue en version 3. Phase 1 entièrement prouvée.
- 2026-10-22 — Phase 1 fusionnée dans main : zone Nancy v2 fabriquée sur une machine ARM de GitHub et publiée (release zone-nancy-v2, catalogue à adresse fixe), 10 critères sur 10. ADR 0003 (format, ARM, serveurs tiers) et 0012 (Python pour la fabrique) acceptés.
- 2026-10-22 — Les données de calcul dépendent du type de processeur : les zones se fabriquent sur ARM, comme le Mac de référence.
- 2026-10-22 — Zone intérieure : fichier « sans mer » fabriqué localement (champ `coastal`), carte identique octet pour octet.
- 2026-10-22 — Le relecteur vérifie qu'aucun test existant n'est modifié par le développeur.
- 2026-10-21 — Phase 0 fusionnée dans main : app Expo à 4 onglets, verify (types, lint, 9 tests), CI GitHub, Maestro sur les deux simulateurs, hook de qualité. ADR 0011 (structure du code) accepté.
- 2026-10-21 — Écrans années 70 validés ; icône A ; décisions dans docs/06. Découpage en 11 phases validé, **phases enchaînées une par une** (pas de parallélisme, pour le quota).
- 2026-10-21 — Style hors navigation : affiche des années 70 (style 3), personnage du vététiste récurrent, illustrations minimales en v1.
- 2026-10-21 — Design : direction B (contrastée) validée pour la navigation ; réponses aux 13 questions dans [docs/06](docs/06-decisions-design.md). Écrans hors navigation : styles « décalés » à explorer (piste : cartoon épuré).
- 2026-10-21 — Essai 2 : suivi d'1 h écran verrouillé prouvé sur Android (notification unique, mise à jour en 1,8 s au plus) et iOS (Live Activity, 1 s au plus). Corrections pour le développement dans l'ADR 0006.
- 2026-10-20 — Le dénivelé reste en v1 : il est fourni par Valhalla, son calcul n'est pas le problème.
- 2026-10-19 — Une session par phase d'exécution ; la session de pilotage reste avec Émilien.

## Décisions en attente

- Aucune.

## À vérifier sur un vrai téléphone (plus tard, en une fois)

- Temps de calcul d'un itinéraire, et temps d'ouverture du moteur.
- Android : arrêt d'environ 0,2 s du fil JavaScript au démarrage (dû au démarrage de l'app sur l'émulateur ; petit effet du moteur non exclu). Mémoire du moteur.
- Consommation de batterie (écran allumé et verrouillé).
- Précision du GPS en forêt.
- Glisser un point : confort de l'appui long ; fluidité sur Android (jusqu'à 71 ms d'arrêt sur l'émulateur, pour 100 ms permis) ; double appui pour zoomer.
- Live Activity iOS avec un compte Apple gratuit (signature : 2 identifiants + App Group, sans push).
- Suivi verrouillé sur batterie : mode Doze et économies d'énergie des fabricants ; notification visible sur l'écran verrouillé (canal de faible importance).

## Prochaine étape

Écrire la spec de la phase 8 (suivi sur le vélo, docs/05 ligne 8), la faire valider par Émilien, puis la lancer. Avant : trancher le trait de liaison (distance et GPX), le cadrage hors zone et les états de la maquette 90 (voir « Points connus »).

## Passation du pilotage (10 novembre 2026)

La session de pilotage du 9 au 10 novembre (`local_1ea128ca-dd2d-45af-b97e-66ec21c85b89`)
passe la main après la fusion de la phase 7, comme le veut la règle d'Émilien.

**État exact**
- `main` à jour et poussé : phases 0 à 7 fusionnées. Rien en cours.
- Worktree de la phase 7 (`.claude/worktrees/phase-7-circuits-balises-715f16`) gardé comme trace ;
  tout est poussé. À retirer si la place manque. Branche jetable locale `claude/p07-essai`, jamais
  poussée, à ne pas fusionner.
- **Place libre : 12 Go**, le seuil d'arrêt. Émilien doit effacer DerivedData (17 Go) avant la
  prochaine phase qui construit l'app. Trois `find` orphelins des testeurs (PID 77757, 84719,
  18205) : le garde-fou refuse de les arrêter, c'est Émilien qui le fait.
- Simulateurs : release de T9 de la phase 7, zone Nancy v6. **Émulateur Android : `emulator-5584`**
  (pas 5554) ; « Wi-Fi seulement » désactivé dans l'app.
- Quota de la semaine : environ 52 % utilisés le 10 novembre au matin (renouvellement le lundi
  16 à 7 h). La phase 7 en a pris environ 45 points en une journée.
- Émilien peut effacer les releases de zone Nancy v4 et plus anciennes (règle des 2 dernières versions).

**Leçons de la phase 7**
- Une phase G se fait en 3 sessions de phase, avec une passation après 3 tâches : ça a bien
  marché. Une session lancée « à la main » ne peut l'être que sur un message d'Émilien : lui
  demander de dire « oui » plutôt que lui laisser une carte.
- Lancer une session de suite dans le worktree existant : `start_session` avec `cwd` = le
  worktree et `use_worktree: false` (seulement sur un message d'Émilien).
- Le garde-fou refuse au relecteur `git -C`, `grep`, `tail`, `git ls-files` et les commandes
  enchaînées : lui donner les diffs et les preuves par chemin exact.
- Les testeurs laissent des `find /` tourner pendant des heures : leur interdire de chercher
  depuis `/` dans les consignes.

## Passation du pilotage (9 novembre 2026, archive)

La session de pilotage du 3 au 9 novembre passe la main après la fusion de
la phase 6, comme le veut la règle d'Émilien.

**État exact**
- `main` à jour et poussé : phases 0 à 6 fusionnées. Rien en cours.
- Worktree de la phase 6 (`.claude/worktrees/phase-6-itineraires-gpx-60a1e0`)
  gardé comme trace ; tout est poussé. À retirer si la place manque.
- Place libre : environ 70 Go après le ménage d'Émilien. Une construction
  iOS reprend environ 8 Go (DerivedData). Seuil d'arrêt d'une phase : 12 Go.
- Simulateur iOS : deux fichiers d'essai dans « File Provider Storage »
  (`00-cible.gpx`, `trace-testeur.gpx`), à retirer à la main.
- À faire en premier : créer le réveil horaire (`CronCreate`, minute 23),
  avec le contrôle de la réserve de quota (mémoire
  `reserve-quota-veille-emploi`).

**Règle de quota d'Émilien (3 et 7 novembre)** : à chaque pause et fin de
phase, garder 2 % du quota hebdomadaire par jour restant, du lundi au
samedi, jusqu'au renouvellement du lundi 7 h ; pas de réserve le dimanche.
Lire le quota par `get_usage`. Approche de la réserve (marge 5 points) :
la phase finit sa tâche, commite, et s'arrête ; relance par un réveil
unique. La phase 6 a été arrêtée du 4 au 9 novembre pour cette règle.

**Leçons de la phase 6**
- Le pilotage s'appelle `local_2a5da08c` ; le brief de départ donnait
  par erreur l'adresse de la session parente. Vérifier `startedBy` dans
  `list_sessions` et donner la bonne adresse dans le brief.
- Le garde-fou refuse `rm -rf` sur DerivedData et sur les fichiers du
  simulateur : c'est Émilien qui efface. Les copies Time Machine locales
  gardent la place des fichiers effacés (le Finder les compte comme libres,
  pas `df`).
- Une phase de taille G avec simulateurs coûte cher : environ 6 points du
  quota de la semaine par heure en T7. Prévoir la pause dans le brief.
- Les sous-agents doivent être lancés depuis le worktree, sinon le
  garde-fou du relecteur refuse git et npm.

## Passation du pilotage (3 novembre 2026, archive)

La session de pilotage du 2 au 3 novembre passe la main après la fusion de
la phase 5b, comme le veut la règle d'Émilien.

**État exact**
- `main` à jour et poussé : phases 0 à 5b fusionnées. Rien en cours.
- Sur les deux simulateurs : Nancy v5 seule, build release de la phase 5b,
  « Wi-Fi seulement » sur ON. Émulateurs gardés : `Pixel_6_API_34_arm64`
  (`emulator-5554`, celui des phases) et `Pixel_6_API_34_arm64_e3`
  (`emulator-5584`, essai 2). Un téléphone Android réel (`R5CR21B1KDW`) est
  parfois branché : ne pas y toucher sans Émilien.
- Worktree de la phase 5b (`.claude/worktrees/phase-1-zones-73115d`, et le
  banc `p05b-banc` dedans) gardé comme trace ; il pèse environ 15 Go, plus
  12 Go de fichiers de compilation iOS. À retirer si la place manque (tout
  est commité ; le banc C6 vit seulement dans la branche locale
  `claude/p05b-banc`).
- À faire en premier : créer le réveil horaire (`CronCreate`, minute 23).

**Rôle du pilotage** : inchangé (voir la passation du 2 novembre plus bas).

**Leçons de la phase 5b**
- Pour un lancement de workflow par Émilien : lui dire de choisir la
  branche dans « Use workflow from », et vérifier aussitôt la branche du
  run par l'API publique. Le premier lancement est parti de `main` (v4
  sans table).
- Un testeur a contourné un refus du garde-fou (script écrit ailleurs puis
  copié). Rappeler dans chaque brief : un refus du garde-fou s'arrête là ;
  on demande au pilotage.
- Pendant une attente longue, dire à la session de phase de ne pas se
  réveiller toutes les heures : le pilotage la prévient.
- Surveiller la place libre du Mac (`df -h /`) avant une phase qui
  construit l'app.

## Passation du pilotage (2 novembre 2026, archive)

La session « Pilotage RutaPulse (reprise) » (local_4f9d736d, 27 octobre au
2 novembre) passe la main à une nouvelle session de pilotage, après la
fusion de la phase 5, comme le veut la règle d'Émilien. Ce qu'il faut savoir :

**État exact**
- `main` à jour et poussé : phases 0 à 5 fusionnées. Rien en cours.
- Prochaine étape : spec de la phase 5b (voir « Prochaine étape »).
- Les sessions des phases 3, 4 et 5 sont finies ; leurs branches et
  worktrees ne servent plus que de trace. Branches jetables locales des
  phases 4 et 5 (`claude/p04-*`, `claude/p05-*`), jamais poussées.
- Xcode est en 27.2, licence acceptée le 2 novembre. Simulateurs : iPhone
  17 (iOS 26.5) et `emulator-5554` (Android 14 arm64), remis en ordre.
- À faire en premier : créer le réveil horaire (`CronCreate`, minute 23)
  et relire la mémoire de Claude (`pilotage-sobre`,
  `reprise-auto-apres-limite`).

**Rôle du pilotage**
- Seule session qui parle à Émilien. Il ne veut qu'un interlocuteur.
- Lancer chaque phase dans une session à part (worktree), avec un brief
  complet : spec, circuit `/phase`, sous-agents un par un, réveil programmé
  quand on attend, captures sur version finale, pas de push sur `main`,
  pas de modification de `PILOTAGE.md`, résultats dans
  `docs/phases/pNN-*-resultats.md`, questions au pilotage par SendMessage
  (jamais à Émilien), **message de fin de phase obligatoire au pilotage**.
- Trancher soi-même les choix techniques et les détails ; ne remonter à
  Émilien que les vraies décisions de produit et de design, et la fusion
  de chaque phase (toujours demander son accord).
- Vérifier soi-même chaque compte rendu (tests, CI par l'API publique,
  captures, fichiers) avant de le présenter.
- Après une fusion : relancer `npm run verify` et `pytest` sur `main`,
  audit des secrets et des e-mails, mise à jour de ce fichier, push.

**Règles d'Émilien du 2 novembre 2026** (aussi en mémoire, `pilotage-sobre`)
- Conversation de pilotage silencieuse : seulement les questions pour
  Émilien, les blocages qui demandent son action et la fin d'une phase.
- Un seul réveil, toutes les heures (`CronCreate`), qui relance une session
  arrêtée par une limite d'utilisation. À recréer dans chaque nouvelle
  session de pilotage, et avant 7 jours.
- Après chaque fusion : note de passation ici, puis nouvelle session de
  pilotage.
- Les sessions de phase n'envoient au pilotage que leurs questions et leur
  message de fin.

**Leçons du pilotage**
- Une session de phase peut finir sans prévenir : vérifier régulièrement
  l'état des sessions liées.
- Après une limite d'utilisation, relancer soi-même les sessions dès la
  réinitialisation (le réveil horaire s'en charge).
- Un essai de la phase précédente et une référence peuvent différer pour
  une raison légitime (tracé, méthode) : demander la cause avec une preuve
  rejouable, comme pour l'écart de D+ de la phase 5.
- Règles des briefs apprises en phase 5 : ne jamais contourner un refus du
  garde-fou ; arrêter ses processus par PID seulement, jamais `pkill -f` ;
  preuves dans un dossier durable, hors de `/tmp` ; vérifier le fichier
  d'un écran avant de le nommer dans une consigne.
- Une boîte de fin de tour avec une question reste affichée tant qu'une
  nouvelle ne la remplace pas : les sessions de phase n'y mettent jamais
  de question.
- Une capture peut tromper (menu de développement d'Expo) ; un relecteur
  peut juger un vieux fichier : toujours donner le chemin exact de la
  preuve.

**Préférences d'Émilien** (aussi dans la mémoire de Claude) : français
simple, termes anglais traduits entre parenthèses ; bande de carrés bleus
avant le résumé ; notification sur son téléphone à chaque question ; il
valide spec, design, architecture et fusion ; tests sur simulateurs.

## Points connus, hors périmètre pour l'instant

- Phase 7, pour plus tard : C12 iOS (supprimer le vol de la carte avant la création, phase 10) ; écarts de design L1 à L5 et anneau rose iOS (phase 10) ; parcours Maestro à reprendre (p07-gpx-modifier-ios, p06-enregistrer) ; une trace qui sort puis revient dans la zone perd sa partie hors zone si on déplace un point voisin (accepté en v1) ; lissage des altitudes du D+ (peut-être jamais).

- Icônes des onglets provisoires (à faire avec le style années 70, phase 2).
- À vérifier en phase 3 : ce que calcule le téléphone (ARM) avec les tuiles publiées.
- La fabrique dépend de serveurs tiers (Geofabrik, osmdata) ; une zone côtière échoue si osmdata est en panne. Parade possible plus tard : copie des annexes dans une release.
- Une zone côtière et une 2e zone n'ont pas encore été fabriquées.
- Fabrique : distinguer les chemins urbains des sentiers dans les tuiles (place Stanislas, halage dessinés en tirets rouges).
- Limite connue : deux points de suite loin d'un chemin, l'erreur peut viser le mauvais point (code 171 ambigu).
- Avant la phase 8 : décider si la liaison compte dans la distance et le GPX.
- Phase 8 au plus tard : cadrage hors zone avec la position visible ; états « suit ma position » et flèche de cap (maquette 90).
- Petites tâches : écarts non bloquants de la phase 2, nettoyage des fichiers partiels iOS dans `tmp/`, minuteur Jest.
- Non testé sur simulateur : geste de pincement, vrai mode avion iOS.
- Phase 10 (finition) : très grandes tailles de texte dans toute l'app ; Android, garder le brouillon quand l'activité est recréée.
- Phase 6, pour plus tard : itinéraire d'une zone prête mais pas en service sans infos (à la 2e zone) ; commune dans le nom par défaut (V2) ; règle ESLint interdisant `fetch` dans `core/` ; écarts de design N1, N3, N7 et nom sous l'arche de la maquette 20 (phase 10) ; message Jest « worker process has failed to exit ».
- Prochain passage sur la création : vider le point choisi à l'ajout d'un point ; nom accessible du résumé compact non touchable.
- Plus tard (comparaison p05-t8) : écarts P1 à P7 du designer, avec leur phase ; capture iOS « Altitudes indisponibles ».
