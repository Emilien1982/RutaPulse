# Phase 4 — Créer et modifier un itinéraire : résultats

> 28 octobre 2026. Spec : [p04-creer-modifier-itineraire.md](p04-creer-modifier-itineraire.md).
> Branche `claude/phase-4-creation-4b4c7e`, poussée, non fusionnée.

## En bref

- « Nouvel itinéraire » ouvre la création **en plein écran**. Chaque touche
  ajoute un point à la fin, et seul le nouveau tronçon est calculé. On
  **glisse un point** : ses deux tronçons se recalculent pendant le geste,
  5 fois par seconde au plus. Supprimer, Annuler (50 actions), Boucler, le
  choix « Par les chemins / À la main » et le résumé marchent, sans réseau.
- Un tronçon « à la main » est une ligne droite en tirets. Un point à plus
  de 200 m d'un chemin, ou hors de la zone, ouvre une feuille d'erreur avec
  « Relier ce point à la main » et « Retirer ce point ».
- Les 15 critères sont tenus, avec deux écarts expliqués (C9 et C14, voir
  plus bas). Tout est mesuré sur simulateurs, pas sur un vrai téléphone.
- Fluidité pendant le glisser, en version finale (release) : arrêt maximal du
  fil JavaScript de **30,8 ms sur iOS** et **71,1 ms sur Android**, pour
  100 ms permis.
- `npm run verify` : 80 suites, 893 tests réussis. CI verte.
- ADR 0016 (l'itinéraire en création) accepté par Émilien.

## Liens

| Quoi | Adresse |
|---|---|
| Run `verify` du dernier commit de code (T8, d9a8d28) | https://github.com/Emilien1982/RutaPulse/actions/runs/40650761163 |
| ADR 0016 | [0016-itineraire-en-creation.md](../adr/0016-itineraire-en-creation.md) |
| Essai jetable T1 | [preuves/p04/t1-essai/LISEZMOI.md](preuves/p04/t1-essai/LISEZMOI.md) |
| Banc de mesure T6 | [preuves/p04/t6-banc/LISEZMOI.md](preuves/p04/t6-banc/LISEZMOI.md) |
| Mesures C3 et C11 | [preuves/p04/t6-mesures/analyse.txt](preuves/p04/t6-mesures/analyse.txt) |
| Tests portés en T4 | [preuves/p04/t4-tests-portes.md](preuves/p04/t4-tests-portes.md) |
| Tests adaptés en T8 | [preuves/p04/t8-tests-adaptes.md](preuves/p04/t8-tests-adaptes.md) |
| Comparaison aux maquettes (T7) | [design/comparaisons/p04-t7.md](../../design/comparaisons/p04-t7.md) |

## Critères

Captures dans [captures/](captures/), préfixe `p04-`, toutes en release, sans
le menu de développement d'Expo. Simulateurs : iPhone 17 (iOS 26.5) et
émulateur Android 14 `Pixel_6_API_34_arm64` (`emulator-5554`).

| # | Attendu | Mesuré | Preuve | Verdict |
|---|---|---|---|---|
| C1 | Plein écran sans barre d'onglets ; la croix ferme ; dès 2 points, boîte native « Abandonner cet itinéraire ? » | Écran `/draft` hors des onglets (`fullScreenModal`). La croix et le retour d'Android sont bloqués par `usePreventRemove` dès 2 points | `p04-t6-*-10-creation.png`, `p04-t6-*-abandon.png` ; `DraftScreenSpec.test.tsx` (C1) | **oui** |
| C2 | Une touche = un point à la fin ; seul le nouveau tronçon est calculé | 1 appel au moteur par ajout (faux moteur qui compte). Capture à 5 points | `legRecomputeSpec.test.tsx`, `DraftScreenSpec.test.tsx` ; `p04-t6-*-10-creation.png` | **oui** |
| C3 | Glisser : au plus 5 calculs par seconde (Pacer), calcul final juste, autres tronçons inchangés | Release, 3 gestes par plateforme, 11 points : au plus 5 calculs par seconde, au moins 199,8 ms entre deux calculs, calcul final à la position du relâchement, 0 autre tronçon recalculé | [analyse.txt](preuves/p04/t6-mesures/analyse.txt) ; `legRecomputeSpec.test.tsx` (fausse horloge) ; `p04-t6-*-10-glisser.png` | **oui** |
| C4 | Choisir un point, « Supprimer » ; les voisins sont reliés ; supprimer le départ ou l'arrivée raccourcit | Modèle et écran testés ; un seul recalcul. Le point glissé devient le point choisi (décision du pilotage) | `draftSpec.test.ts`, `DraftScreenSpec.test.tsx`, `DraftScreenT8*.test.tsx` ; `p04-t4-testeur-*-4-supprime.png` | **oui** |
| C5 | Annuler, jusqu'à 50 actions, sans nouveau calcul | Historique de 50 états. Le cache de TanStack Query (clé = deux points et mode) rend un état déjà calculé avec 0 appel au moteur | `draftSpec.test.ts`, `legRecomputeSpec.test.tsx` | **oui** |
| C6 | Boucler ajoute le départ à la fin ; grisé sous 2 points | Aussi grisé si l'arrivée est déjà sur le départ | `draftSpec.test.ts`, `DraftScreenSpec.test.tsx` | **oui** |
| C7 | À la main : prochain tronçon, ligne droite en tirets, distance comptée, durée à la vitesse moyenne ou 10 km/h, zoom 18 | Tirets de la maquette 11. Durée vérifiée par valeurs calculées à la main (12 km/h, 10 km/h). Capture au zoom 18 (lien profond) | `p04-t6-*-11-main-z18.png` ; `legs.test.ts`, `DraftScreenT5Spec.test.tsx` | **oui** |
| C8 | Point à plus de 200 m d'un chemin refusé (« Aucun chemin trouvé ») ; liaison en pointillés sous 200 m, non comptée | `search_cutoff: 200` envoyé au moteur, code 171 → « Aucun chemin trouvé ». Liaison dessinée, absente de la somme | `p04-t6-*-52-aucun-chemin.png`, `p04-t5-testeur-*-3-liaison-pointillee.png` ; `legRecomputeSpec.test.tsx`, `DraftScreenT5Spec.test.tsx` | **oui** |
| C9 | Point hors zone : feuille 52 avec « Relier ce point à la main » et « Retirer ce point », sans « Télécharger » | Fait, en mode avion sur Android. **Écart justifié** : un *premier* point hors zone n'a que « Retirer », car il n'a aucun tronçon à relier | `p04-t6-*-52-hors-zone.png`, `p04-t8-*-52-hors-zone.png` | **oui**, écart accepté par le pilotage |
| C10 | Résumé = somme des tronçons, mis à jour après chaque action, au moins « 1 min » | `summarize` ; « — » tant qu'il n'y a pas d'itinéraire (décision du pilotage) | `DraftScreenSpec.test.tsx` (C10), `DraftScreenT8*.test.tsx` ; `p04-t8-*-vide.png` | **oui** |
| C11 | Aucun arrêt du fil JavaScript de plus de 100 ms pendant le glisser, en release, sur les deux simulateurs | iOS 26,8 à 30,8 ms (témoin sans geste 25,3) ; Android 51,2 à 71,1 ms (témoin 39,4) | [analyse.txt](preuves/p04/t6-mesures/analyse.txt), JSON bruts dans `t6-mesures/` | **oui** |
| C12 | Jamais de plantage ; un échec pendant le geste garde l'ancien tracé ; l'échec final ouvre la feuille | Testé avec un faux moteur qui échoue ou rejette ; aucun rejet non attrapé | `legRecomputeSpec.test.tsx`, `DraftScreenT5Spec.test.tsx` | **oui** |
| C13 | `verify` passe, avec des tests du modèle pur dans `core/` ; CI verte | 80 suites, 893 tests réussis. Modèle dans `core/draft/` | run 40650761163 (`success`) | **oui** |
| C14 | Maestro en mode avion : 3 points, en supprimer un, annuler, tronçon à la main, distance qui change | `e2e/p04-creer-modifier.yaml` vert sur Android (mode avion) et iOS. Distance lue et comparée à chaque étape. **Écart** : Maestro ne voit pas les repères de la carte ; le point est choisi par sa position à l'écran, et la suppression est prouvée par la distance | Sortie dans le compte rendu de T6 ; garde éprouvée par un parcours modifié qui échoue | **oui**, avec cette réserve |
| C15 | Captures release comparées aux maquettes 10, 11 et 52 | 2 bloquants, corrigés en T8 ; 4 « plus tard » ; 3 mineurs, corrigés en T8 | [p04-t7.md](../../design/comparaisons/p04-t7.md) | **oui** |

## Ce qui a été construit

- **T1, essai jetable et ADR 0016.** Glisser un `ViewAnnotation` de MapLibre
  marche sur les deux plateformes. Sur iOS, il faut un appui long d'environ
  0,5 s. TanStack Pacer 0.24.1 s'installe et marche en release. Le moteur
  refuse un point au-delà de 200 m avec `search_cutoff`. Branche locale
  jetable `claude/p04-essai-glisser` (79b8b28).
- **T2, le modèle pur** `core/draft/` : points, tronçons et leur mode,
  historique de 50 états, Boucler, somme, durée à la main.
- **T3, le recalcul** : une requête TanStack Query par tronçon (le cache sert
  « Annuler »), Pacer pendant le glisser (calculs hors cache, abandon des
  calculs périmés), seuil de 200 m, code 171 → « Aucun chemin trouvé ».
- **T4, l'écran** `/draft` en plein écran : points numérotés et glissables,
  barre d'outils, choix du mode, résumé, confirmation à la fermeture, point
  bleu et bouton « Ma position ». Écarts A1, A2, A3 et M1 à M6 de la phase 3
  corrigés. Les tests de l'ancienne création sont portés (table T4).
- **T5, le tracé à la main et la feuille complète** : tirets, « Relier ce
  point à la main » en une action annulable, « Retirer ce point » en lien
  (M7), points reliés retenus pour viser le bon point.
- **T6, les preuves** : banc de mesure jetable (branche locale
  `claude/p04-banc`, a09b821), mesures C3 et C11, parcours Maestro C14,
  captures release.
- **T7, la comparaison aux maquettes** par le designer.
- **T8, les corrections** : choix d'un point pendant un glisser (B1),
  étiquette « Hors de la zone » qui cachait le point refusé (B2), « — » sur
  l'écran vide (A4), police, couleur des boutons de la boîte sur Android,
  espaces insécables (M1 à M3).

## Décisions prises dans la phase

- ADR 0016 accepté par Émilien le 27 octobre 2026.
- Appui long pour glisser un point (Émilien) : la bulle dit « Maintenez le
  point, puis glissez-le », sur les deux plateformes. À revoir sur un vrai
  téléphone.
- Supprimer un point du milieu : le nouveau tronçon est « à la main »
  seulement si les deux tronçons retirés l'étaient (pilotage).
- « Relier ce point à la main » passe tous les tronçons en échec du point en
  une seule action, et retient ce point (`Draft.linked`). Pour « Aucun chemin
  trouvé », la feuille vise d'abord un point retenu ; pour « hors zone »,
  c'est le rectangle de la zone qui décide (session de phase, après relecture).
- Après un glisser, le point déplacé devient le point choisi (pilotage).
- Sous 2 points, ou tant qu'aucun chiffre n'est connu, le résumé affiche « — »
  (pilotage).
- Boucler est grisé si l'arrivée est déjà sur le départ.
- Une touche sur la carte attend 120 ms avant d'ajouter un point : sur iOS,
  toucher un point envoyait aussi la touche à la carte.
- « Retirer ce point » est un lien quand « Relier » est présent, sinon un
  bouton (M7 à la lettre).
- Couleur des boutons de la boîte native sur Android : plugin de
  configuration `mobile/plugins/withAndroidAccent.js` (pas de modification à
  la main de `mobile/android/`).

## Ce qui n'est pas vérifié

- **Un vrai téléphone** : fluidité du glisser (Android à 71 ms sur
  l'émulateur), appui long au vrai doigt (Maestro l'imite par un glissement
  lent de 6 s), double appui pour zoomer.
- **iOS sans réseau** : pas de vrai mode avion sur le simulateur.
- **Un point à plus de 300 m d'un chemin** n'a pas été essayé : la forêt de
  Haye est très maillée. Le plus loin testé était à 206 m.
- **Les évènements de glisser sur Android** : 111 à 117 par geste en T6,
  contre 65 à 70 dans l'essai T1. Hypothèse : le fil JavaScript était plus
  chargé dans l'essai. Non rejoué.

## Limites connues et écarts restants

- **Deux points de suite loin d'un chemin.** Scénario : point 1 sur un
  chemin ; point 2 à plus de 200 m d'un chemin, « Relier » ; point 3 lui aussi
  à plus de 200 m, la feuille vise le point 2 (retenu), « Relier » passe 2→3 à
  la main ; point 4 sur un chemin, « Par les chemins » : le tronçon 3→4 renvoie
  le code 171 et la feuille vise le point 4, qui est bon. Cause : le code 171
  ne dit pas lequel des deux bouts est loin d'un chemin. Une vraie correction
  demande d'interroger le moteur bout par bout (essai jetable). Accepté par le
  pilotage, à revoir après usage. De même, un point retenu puis glissé près
  d'un chemin garde son drapeau.
- **Premier point hors zone** : seulement « Retirer » (écart à C9). Un
  itinéraire ne peut donc pas partir de hors de la zone.
- **Feuille d'erreur ouverte** : elle remplace la barre d'outils, donc
  « Annuler » n'est pas accessible tant qu'elle est là. Conforme à la
  maquette 52.
- **Double appui sur Android** : non reproduit avec de vrais doubles appuis
  (0,10 à 0,29 s : la carte zoome, aucun point). Artefact de la commande
  `doubleTapOn` de Maestro. Preuve rejouable :
  [t8-double-appui.sh](preuves/p04/t8-double-appui.sh). À revérifier sur un
  vrai téléphone.
- **Liaison en pointillés cachée par le marqueur** quand le point est à moins
  d'environ 28 pt du tracé : jugée acceptable par le designer.
- **À corriger plus tard** (p04-t7) : A1, point glissé agrandi à 40 et halo du
  point choisi plus visible (essai MapLibre d'abord) ; A2, bulle d'aide
  « À la main » ; A3, note « À la main : 0,6 km » dans la feuille.
- Jest affiche toujours « A worker process has failed to exit gracefully »
  (déjà en phase 3, pas causé par les fichiers de cette phase).

## Ce qui a été appris sur les agents

- **Un essai jetable court lève les vrais risques.** L'essai T1 a trouvé
  l'appui long d'iOS, la voie de glisser qui marche, et le comportement exact
  de Valhalla au-delà de 200 m (`search_cutoff` et non `radius`). L'ADR s'est
  écrit sur des faits.
- **Le relecteur trouve les défauts de parcours que les tests ratent.** Le
  plus net : après « Relier », le point suivant, bon, était refusé à sa place.
  Aucun test ne jouait « relier puis continuer ». Le relecteur a aussi trouvé
  une régression (point bleu disparu) et une mise à jour d'état pendant le
  rendu.
- **Un test doit échouer sur l'ancien code.** Trois fois, un test annoncé
  ne prouvait rien : une attente Maestro satisfaite dès l'ouverture (« 0 m »),
  une source fausse jamais vidée, un style lu sur le mauvais élément.
  L'essai « casser le garde-fou » les a révélés.
- **Une table de correspondance rend le portage de tests contrôlable** :
  776 tests avant, 818 après en T4, chaque test retiré ayant un équivalent ou
  une justification. Le relecteur l'a vérifiée contre le diff.
- **Un défaut se reproduit avant de se corriger.** Le « double appui » venait
  de l'outil de test, pas de l'app. Le correctif essayé était inutile et
  rendait un parcours instable : il a été retiré.
- **Le garde-fou du relecteur** n'autorise que `git`. C'est la session de
  phase qui relance `verify` et lui donne la sortie.
- **Les limites d'utilisation** ont coupé la phase deux fois. Les sous-agents
  se reprennent par message, là où ils s'étaient arrêtés. Un sous-agent qui
  attend un build sans fin doit être arrêté, et son travail repris par le
  suivant du circuit.

## À reporter dans PILOTAGE.md

- Phase 4 terminée sur la branche `claude/phase-4-creation-4b4c7e`, à
  fusionner après l'accord d'Émilien. 15 critères tenus (écarts expliqués sur
  C9 et C14), CI verte.
- ADR 0016 accepté le 27 octobre 2026, complété le 28 (points reliés à la
  main, cible de la feuille, mesures). ADR 0011 : `mobile/plugins/` pour les
  réglages natifs (plugins de configuration Expo).
- Décisions : appui long pour glisser, avec la bulle « Maintenez le point,
  puis glissez-le » ; suppression d'un point du milieu ; « Relier » en une
  action, point retenu ; point glissé = point choisi ; « — » sur l'écran vide.
- Plus tard (p04-t7) : A1 (point glissé agrandi, halo, essai MapLibre
  d'abord), A2 (bulle « À la main », affichée à chaque passage en mode
  « À la main » jusqu'à la première touche sur la carte, décision du
  pilotage), A3 (note « À la main : 0,6 km »).
- Limite connue : deux points de suite loin d'un chemin (code 171 ambigu).
- À vérifier sur un vrai téléphone : fluidité du glisser sur Android, appui
  long au doigt, double appui pour zoomer.
- Branches locales jetables, non poussées : `claude/p04-essai-glisser`,
  `claude/p04-banc`.
- Émulateur `emulator-5554` : réglage « Télécharger en Wi-Fi seulement »
  rétabli à « oui » en fin de phase (le testeur de T4 l'avait coupé, faute de
  Wi-Fi sur l'émulateur).
