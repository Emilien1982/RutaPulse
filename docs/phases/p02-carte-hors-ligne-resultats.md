# Phase 2 — Carte hors ligne : résultats

> 27 octobre 2026. Spec : [p02-carte-hors-ligne.md](p02-carte-hors-ligne.md).
> Branche `claude/phase-2-carte-d49860`, poussée, non fusionnée.

## En bref

- Dans l'app, on choisit la zone Nancy, on la télécharge (111 Mo), puis on
  voit la carte des sentiers et sa position **en mode avion**, sur Android
  et sur iOS.
- Les 13 critères sont tenus. Deux réserves : le zoom 8 n'est prouvé que
  par une copie jetable (aucun geste de pincement possible sur les
  simulateurs), et iOS n'a pas de vrai mode avion (remplacé par une mesure
  du trafic réseau).
- `npm run verify` : 49 suites, 409 tests réussis. CI verte.
- Trois décisions prises pendant la phase : ADR 0013 et 0014 (dossier
  `shared-data/`), blocage de la carte aux bords de la zone, voile et
  message hors zone.

## Liens

| Quoi | Adresse |
|---|---|
| Dernier run `verify` vert (commit 27cfec2) | https://github.com/Emilien1982/RutaPulse/actions/runs/40419150967 |
| Run `verify` de T5 (commit 7e1e13e) | https://github.com/Emilien1982/RutaPulse/actions/runs/40372232181 |
| Run `verify` de T4 (commit 42ba5f3) | https://github.com/Emilien1982/RutaPulse/actions/runs/40306217446 |
| Run `verify` de T3 (commit 3ca07aa) | https://github.com/Emilien1982/RutaPulse/actions/runs/40301219852 |
| Catalogue lu par l'app | https://github.com/Emilien1982/RutaPulse/releases/download/catalogue/catalogue.json |

## Critères

Captures dans [captures/](captures/), préfixe `p02-`. « Release » : version
publiable, sans le menu de développement d'Expo.

| # | Attendu | Mesuré | Preuve | Verdict |
|---|---|---|---|---|
| C1 | L'onglet Zones lit le catalogue et affiche nom, taille, date | Nancy, « 111 Mo · carte du 22 oct. », sur les deux plateformes. Tests avec un faux catalogue et avec une copie du vrai (17 catalogues invalides refusés) | `p02-zones-ios-avant.png` ; `core/zones/catalogue.test.ts`, `testeurCatalogue.test.ts`, `zonesT4Testeur.test.tsx` | **oui** |
| C2 | Progression, puis contrôle SHA-256 de chaque fichier ; un fichier abîmé est refusé | « 56 Mo sur 111 » pendant, « Prête sans réseau » après. Empreintes natives (`File.digest`) égales au catalogue, 9 sur 9 (essai E1). Empreinte fausse : 3 essais du fichier, « Échec », pas de `.ready.json` | `p02-zones-ios-progression.png`, `p02-zones-ios-prete.png`, `p02-e2-android-empreinte-fausse.png` ; [essai E1](p02-essai-e1.md), [essai E2](p02-essai-e2-coupure.md) ; `downloadZone.test.ts`, `testeurDownload.test.ts` | **oui** |
| C3 | Coupure (réseau perdu, app fermée) : reprise propre, jamais de zone à moitié prête | Serveur local lent (essai jetable E2). Réseau coupé en plein fichier : « En attente du réseau », puis seul le fichier coupé est redemandé. App tuée : reprise seule au lancement. Sur les deux plateformes. Annulation pendant l'empreinte : pas de `.ready.json` (test) | `p02-e2-android-coupure.png` ; [essai E2](p02-essai-e2-coupure.md) ; `downloadZoneCancel.test.ts` | **oui** |
| C4 | « Wi-Fi seulement », activé par défaut : sans Wi-Fi, la zone attend, avec le bandeau et le raccourci | Android : Wi-Fi coupé, bandeau « Pas de Wi-Fi » et « En attente du Wi-Fi » ; réglage coupé dans le bandeau, départ en données mobiles ; les deux interrupteurs partagent la valeur. iOS : le simulateur annonce toujours `WIFI`, la perte du Wi-Fi n'y est pas testable | `p02-zones-android-attente-wifi.png` ; `networkRule.test.ts`, `zonesT4Testeur.test.tsx` | **oui** (Android) |
| C5 | Suppression, place rendue | iOS : 108 384 Ko, puis 0 Ko. Android : 108 464 Ko, puis 8 Ko (dossiers vides) | `p02-zones-ios-supprimee.png` ; mesures `du -sk` des comptes rendus de T4 | **oui** |
| C6 | Carte en mode avion, zoom 8 à 18, sans tuile vide dans la zone | Android en vrai mode avion, release : aucune tuile vide du zoom 8,7 (ouverture) au zoom 18. iOS : aucune connexion pendant la série (`nettop`), aucune tuile vide. Zoom 8 : copie jetable avec le zoom d'ouverture forcé à 8, en mode avion, sans tuile vide. `minZoom` = 8 vérifié par un test | `p02-t6-android-avion-z*.png`, `p02-t6-ios-z*.png`, `p02-t7-android-zoom8-avion.png` ; `mapStyleSpec.test.ts`, `MapScreenSpec.test.tsx` | **oui**, réserve : le pincement n'est pas testé par un geste |
| C7 | Sentiers, pistes, routes distincts ; trottoirs plus dessinés comme des sentiers ; courbes dès le zoom 13 | `footway` et `pedestrian` sortis des sentiers : gris fin à partir du zoom 16. Forêt de Haye : pistes brunes pleines, sentiers en tirets rouges. Villers-lès-Nancy au zoom 15 : plan de ville sans tirets le long des rues. Courbes et cotes dès le zoom 13. Designer : tenu | `p02-c7-haye-z15.png`, `p02-c7-haye-z18-sentiers.png`, `p02-c7-villers-z15.png`, `p02-t6-android-avion-z13.7.png` ; [comparaison T7](../../design/comparaisons/p02-t7.md) ; `mapStyle.test.ts` | **oui** |
| C8 | Point bleu, permission « pendant l'utilisation », bouton de recentrage | Point bleu avec position simulée, sur les deux plateformes. Ouverture centrée sur la position au zoom 14. Permission refusée : viseur barré, puis alerte vers les réglages | `p02-t7-ios-ouverture-position.png`, `p02-t6-android-recentrage.png`, `p02-t7-ios-viseur-barre.png`, `p02-t7-ios-alerte-reglages.png` | **oui** |
| C9 | Attributions © OpenStreetMap, © OpenMapTiles, © Mapterhorn, © IGN | Visibles sur toutes les captures de la carte ; vérifiées par Maestro et par un test | toutes les `p02-t6-*-z*.png` ; `MapScreenSpec.test.tsx` | **oui** |
| C10 | Sans zone, la carte propose d'en télécharger une | État vide de la maquette 91 (soleil, vététiste, « Choisir une zone » qui ouvre Zones). Le bouton reste visible sur un iPhone SE et un Android de 360 dp | `p02-t7-ios-vide.png`, `p02-t7-ios-se-vide.png`, `p02-t7-android-360-vide.png` | **oui** |
| C11 | Zones et Réglages suivent les maquettes 41 et 80 | Designer, après corrections : tenu. 7 écarts bloquants corrigés (barre d'état, interrupteur, accents, état vide, ouverture, voile, position refusée) | [comparaison T7](../../design/comparaisons/p02-t7.md), section « Recontrôle » ; `p02-t7-ios-reglages.png`, `p02-t7-ios-titre-avant.png` / `-apres.png` | **oui** |
| C12 | `npm run verify` passe, tests du catalogue, des empreintes, du Wi-Fi et des écrans ; CI verte | 49 suites, 409 tests réussis, 0 échec. CI `verify` : success | sortie de `verify` ; run 40419150967 | **oui** |
| C13 | Parcours Maestro : télécharger Nancy, mode avion, voir la carte | `e2e/carte-hors-ligne.yaml`. Android : deux passages de suite, 23 étapes chacun, 0 échec ; l'app est relancée déjà hors ligne. iOS : 17 étapes, 0 échec, sans mode avion (absent du simulateur). Le parcours de la phase 0 passe aussi (14 étapes, iOS et Android) | `preuves/p02-maestro-android.log`, `preuves/p02-maestro-ios.log`, `preuves/p02-maestro-phase0-*-t7.log` ; `p02-t6-android-maestro-fin.png` | **oui** (iOS : sans mode avion) |

## Ce qui a été construit

| Tâche | Qui | Commits |
|---|---|---|
| T0 Maquettes 90 et 91, style de carte | designer | d3cc6b8 |
| T1 ADR 0013 (téléchargement), 0014 (`shared-data/`) | architecte | 79f5969, b148aeb |
| Essai E1 (téléchargement réel, empreintes, coupure, 404) | développeur | 9b6d889 |
| T2 Thème et composants années 70 | développeur, testeur | 3ffa631, 0da56f4, a52673c |
| T3 Catalogue, téléchargement, empreintes, Wi-Fi, suppression | développeur, testeur | c559a62, 83880e4, 3ca07aa |
| T4 Écran Zones, réglage Wi-Fi | développeur, testeur | 42ba5f3, 519f5ea |
| T5 Écran Carte | développeur, testeur | 7e1e13e, d3ba405 |
| T6 Maestro, captures, essai E2 (coupure à mi-fichier) | testeur, développeur | 1c934e7, d655ff1 |
| T7 Comparaison, corrections, recontrôle | designer, développeur, testeur | f4c74bb, 27cfec2, 81e82b7 |

Décisions prises pendant la phase (pilotage et Émilien) :
- ADR 0013 et 0014 acceptés ; le dossier s'appelle `shared-data/`.
- Le centre de la carte reste dans le rectangle de la zone (`maxBounds` de
  MapLibre limite bien le centre : vérifié dans le code natif).
- « Recentrer » hors zone va au point de la zone le plus proche ; le
  message « Vous êtes hors de la zone téléchargée » reste tant qu'on est
  dehors.
- Contour de la zone en tirets, et voile (`hn.voile-hors-zone`) sur
  l'extérieur.
- Les chemins urbains en tirets rouges (place Stanislas, chemin de halage)
  sont acceptés en v1 : ils viennent des données, pas du style.

## Ce qui n'est pas vérifié

- **Le geste de pincement** pour descendre au zoom 8 : aucun outil ne
  l'envoie au simulateur. Le zoom 8 est prouvé par une copie jetable qui
  ouvre la carte à ce zoom.
- **iOS sans réseau** : pas de vrai mode avion sur le simulateur. Mesure
  par `nettop` (0 connexion). La perte du Wi-Fi (C4) n'est testée que sur
  Android.
- **Un vrai téléphone** : tout est prouvé sur simulateurs. Durées de
  téléchargement et de calcul d'empreinte mesurées sur un Mac rapide.
- **Le gros texte du système** sur les petits écrans (état vide, barre
  d'onglets).
- **Le débord des tuiles** au-delà du rectangle de la zone (Lunéville,
  Charmes, Épinal au zoom 8) : c'est le fichier de tuiles qui déborde un
  peu du rectangle, déjà mesuré par l'essai 3. Il est maintenant voilé.
- **Le menu de développement d'Expo** (roue dentée) cachait le bouton de
  recentrage sur les captures de T5 : c'est un outil de développement,
  absent en release (captures `p02-t6-*`).

## Écarts restants, non bloquants

Détail dans la [comparaison T7](../../design/comparaisons/p02-t7.md).
- Hors zone, le point bleu tombe sous l'îlot dynamique ou la barre d'état
  (cadrer la zone et la position ensemble).
- Message hors zone de 42 de haut, bouton de 48 : bas non alignés.
- Au premier lancement, le viseur est barré avant la réponse à la demande
  de permission ; le lecteur d'écran dit « Recentrer » sur le bouton barré.
- « Recentrer » ne remet pas le zoom à 15 si l'on est déjà plus près.
- Maquette 90 : pas d'état « suit ma position », pas de flèche de cap, pas
  de halo de précision, pas de dégradé sous la barre d'état.
- Écran Zones : pendant les 5 s entre deux essais, la progression est
  figée sans signe de panne.
- Sur iOS, un fichier partiel orphelin reste dans `tmp/` après une app
  tuée (place perdue, sans effet sur la zone).
- Jest signale « A worker process has failed to exit gracefully » : sans
  doute un minuteur de TanStack Query (`gcTime`) dans les tests de T4.

## Ce qui a été appris sur les agents

- **Les cibles chiffrées règlent les défauts visuels.** La barre d'onglets
  de T2 a demandé trois allers-retours. Le troisième a réussi en un passage
  grâce à des mesures cibles par appareil (« pastille à 16 points, libellé
  fini à 67 ») et une capture mesurée en pixels.
- **Un test qui relit la valeur qu'il a écrite ne prouve rien.** En T2, le
  test vérifiait `padding: 0` dans l'option, pas le rendu : seule la
  lecture du code d'expo-router l'a montré.
- **Le relecteur trouve les vrais bugs de logique** : annulation pendant
  l'empreinte qui écrivait « prête » (T3), « Réessayer » sans plan de
  reprise (T4), copie des glyphes non attendue (T5). Aucun n'aurait été vu
  par les tests du développeur seul.
- **L'essai réel trouve ce que les imitations cachent** : `bytesWritten`
  arrive en BigInt sur iOS, ce qui faisait planter la progression (T4).
- **L'adaptation des tests existants par le testeur, avec l'accord du
  pilotage, puis contrôlée par le relecteur, a bien marché** : 6 tests
  existants adaptés (phase 0 et T5), chacun justifié par une maquette ou
  une décision, aucun affaibli.
- **Mes propres consignes peuvent être fausses** : j'ai transmis « bouts
  carrés » comme `square`, alors que style-carte.md précise `butt`. Le
  relecteur l'a rattrapé. Citer le texte exact du document plutôt que le
  reformuler.
- **Un agent peut casser l'environnement** : un testeur a tué un émulateur
  qu'il n'avait pas lancé (T2). La consigne « ne tue aucun processus que
  tu n'as pas lancé » a ensuite été respectée.
- **Les captures en version release** évitent un faux écart (la roue
  dentée du menu de développement) et prouvent en même temps que les
  glyphes passent dans une version publiable.

## À reporter dans PILOTAGE.md

- Phase 2 terminée sur la branche `claude/phase-2-carte-d49860`, à fusionner
  après relecture d'Émilien. 13 critères tenus, CI verte.
- ADR 0013 et 0014 acceptés le 26 octobre 2026 (`shared-data/`).
- Décisions : carte bloquée au rectangle de la zone ; « Recentrer » hors
  zone vers le point le plus proche, message tant qu'on est dehors ;
  contour en tirets et voile hors zone ; chemins urbains en tirets rouges
  acceptés en v1.
- Pour la fabrique (plus tard) : distinguer les chemins urbains des
  sentiers dans les tuiles ; décider combien de versions de zone garder
  sur GitHub.
- Pour la phase 8 au plus tard : cadrage hors zone avec la position
  visible ; états « suit ma position » et flèche de cap de la maquette 90.
- Petites tâches possibles : écarts non bloquants ci-dessus, nettoyage des
  fichiers partiels iOS dans `tmp/`, minuteur Jest.
