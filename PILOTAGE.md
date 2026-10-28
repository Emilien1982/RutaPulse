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
| 4+ | Développement en 11 phases → [docs/05](docs/05-decoupage-v1.md) | phase 0 ✅ ([résultats](docs/phases/p00-socle-resultats.md)) ; phase 1 ✅ ([résultats](docs/phases/p01-fabrique-zones-resultats.md)) ; phase 2 ✅ ([résultats](docs/phases/p02-carte-hors-ligne-resultats.md)) ; phase 3 ✅ ([résultats](docs/phases/p03-module-calcul-resultats.md)) ; phase 4 ✅ ([résultats](docs/phases/p04-creer-modifier-itineraire-resultats.md)) ; phase 5 à spécifier |

## Décisions prises

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

- Combien de versions de zone garder sur GitHub (3 releases de 110 Mo déjà).

## À vérifier sur un vrai téléphone (plus tard, en une fois)

- Temps de calcul d'un itinéraire, et temps d'ouverture du moteur.
- Android : arrêt d'environ 0,2 s du fil JavaScript au démarrage (dû au démarrage de l'app sur l'émulateur ; petit effet du moteur non exclu). Mémoire du moteur.
- Consommation de batterie (écran allumé et verrouillé).
- Précision du GPS en forêt.
- Glisser un point : confort de l'appui long ; fluidité sur Android (jusqu'à 71 ms d'arrêt sur l'émulateur, pour 100 ms permis) ; double appui pour zoomer.
- Live Activity iOS avec un compte Apple gratuit (signature : 2 identifiants + App Group, sans push).
- Suivi verrouillé sur batterie : mode Doze et économies d'énergie des fabricants ; notification visible sur l'écran verrouillé (canal de faible importance).

## Prochaine étape

Écrire la spec de la phase 5 (infos de l'itinéraire), la faire valider par Émilien, puis la lancer dans une session de phase. Y regarder les trois écarts « plus tard » de la phase 4.

## Passation du pilotage (27 octobre 2026)

La session de pilotage d'origine (19 au 27 octobre) a été remplacée par une
nouvelle, pour alléger le contexte. Ce qu'il faut savoir pour reprendre :

**État exact**
- Mise à jour du 27 octobre au soir : phase 3 fusionnée par le nouveau
  pilotage (session « Pilotage RutaPulse (reprise) », local_4f9d736d).
- Les anciennes sessions (essais, phases 0 à 2) sont finies ; leurs
  branches locales ne servent plus que de trace.

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

**Leçons du pilotage**
- Une session de phase peut finir sans prévenir : vérifier régulièrement
  l'état des sessions liées.
- Après une limite d'utilisation, relancer soi-même les sessions dès la
  réinitialisation (minuterie en arrière-plan qui réveille le pilotage).
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

- Icônes des onglets provisoires (à faire avec le style années 70, phase 2).
- À vérifier en phase 3 : ce que calcule le téléphone (ARM) avec les tuiles publiées.
- La fabrique dépend de serveurs tiers (Geofabrik, osmdata) ; une zone côtière échoue si osmdata est en panne. Parade possible plus tard : copie des annexes dans une release.
- Une zone côtière et une 2e zone n'ont pas encore été fabriquées.
- Fabrique : distinguer les chemins urbains des sentiers dans les tuiles (place Stanislas, halage dessinés en tirets rouges).
- Plus tard (comparaison p04-t7) : point glissé agrandi avec halo (essai MapLibre d'abord) ; bulle « À la main », à chaque passage en mode « À la main » jusqu'à la première touche ; note « À la main : 0,6 km » de la maquette 11.
- Limite connue : deux points de suite loin d'un chemin, l'erreur peut viser le mauvais point (code 171 ambigu).
- Avant la phase 8 : décider si la liaison compte dans la distance et le GPX.
- Phase 8 au plus tard : cadrage hors zone avec la position visible ; états « suit ma position » et flèche de cap (maquette 90).
- Petites tâches : écarts non bloquants de la phase 2, nettoyage des fichiers partiels iOS dans `tmp/`, minuteur Jest.
- Non testé sur simulateur : geste de pincement, vrai mode avion iOS, gros texte du système sur petits écrans.
