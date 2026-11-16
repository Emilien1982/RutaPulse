# Phase 8a — Suivi sur le vélo : résultats

> Commencée le 10 novembre 2026, terminée le 16 novembre 2026, en
> plusieurs sessions de phase (passations après T3, T4 et T6 ; arrêts pour
> la limite d'utilisation et pour la place sur le disque).
> Spec : [p08-suivi-velo.md](p08-suivi-velo.md) (critères C1 à C8 et C12
> à C15 ; C9 à C11 vont en phase 8b).
> Branche `claude/phase-8a-suivi-velo-7c0055`, poussée, non fusionnée.
>
> **Les 12 critères de la phase 8a sont tenus, dont 2 avec réserve.** C2 : les
> listes de directions sont écrites, leur relecture par le pilotage reste à
> confirmer. C12 : le maximum par position n'est mesuré qu'en Node, pas sur
> appareil. Les réserves sont écrites plus bas.

## En bref

- **Directions** calculées au départ du suivi par `trace_route` (moteur
  Valhalla, dans le module natif), en français, avec « Suivez le tracé »
  sur un tronçon à la main ou hors zone. Deux virages à moins de 25 m
  s'annoncent ensemble.
- **Placement sur le tracé avec l'avancement** : pas de saut sur un autre
  passage d'une boucle ou d'un aller-retour. Distance et D+ restants.
- **Écran de suivi** (maquette 30) : direction en haut, panneau jaune sous
  100 m, carte orientée, partie roulée en gris, écart au tracé au-delà de
  30 m sans alerte, « Recherche du GPS… », « Signal GPS perdu ».
- **Arrivée** à moins de 30 m de la fin, après 90 % du tracé et au moins
  100 m réellement roulés. Écran v1/60 « ARRIVÉE ! » ou « SORTIE
  TERMINÉE » avec distance, D+ (une requête `height` à la fin) et durée
  réels. Suivi arrêté, écran libéré.
- **Départ** : une position prise avant le départ est ignorée ; une
  première position incohérente avec la suivante (25 m/s ou plus) est
  jetée.
- **Écran allumé** pendant le suivi seulement ; arrière-plan = pause, reprise
  sans perte.
- `npm run verify` : 249 suites, **2 902 tests** réussis. `pytest` : **280 tests** réussis (fabrique inchangée). CI verte (run plus
  bas).

## Où sont les preuves

Toutes dans le dépôt, sous `docs/phases/preuves/p08a/` (abrégé `p08a/`).
Chaque dossier de captures a son `LISEZMOI.md`.

| Quoi | Chemin |
|---|---|
| ADR 0021 (acceptée le 10 novembre 2026), avec « Contrôles avant de bâtir dessus » et « Écarts acceptés pendant la phase 8a » | [0021-suivi-sur-le-velo.md](../adr/0021-suivi-sur-le-velo.md) |
| Maquette 30 (complétée en T1 et après T3) | `design/30-suivi-velo.html` |
| Essai T1 partie A (Mac) et partie B (simulateurs) | `essais/08-suivi-velo/LISEZMOI.md`, `essais/08-suivi-velo/partie-b/LISEZMOI.md` |
| Listes de directions (C2) | `p08a/directions-itineraire-cree.md`, `directions-circuit-haye.md`, `directions-gpx-simule.md`, `directions-gpx-simule-sans-bruit.md` |
| Écran de suivi T3 | `p08a/t3/`, `p08a/t3-testeur/` |
| Arrivée et « Sortie terminée » T4 | `p08a/t4-testeur/LISEZMOI.md` |
| Traces rejouées, C8, C12, C13 (T6) | `p08a/t6-testeur/LISEZMOI.md` § 1 à 6 |
| Releases finales (code final) | `p08a/t8-final/LISEZMOI.md` |
| Comparaisons du designer | `design/comparaisons/p08a-t3-suivi.md`, `design/comparaisons/p08a-suivi-velo.md` |
| Parcours Maestro | `mobile/e2e/p08a-suivi-arrivee.yaml`, `p08a-suivi-terminer.yaml`, `p08a-suivi-arrivee-ios.yaml`, `p08a-suivi-terminer-ios.yaml` |
| Banc C12 | `mobile/src/core/tracking/perf.bench.test.ts` |
| Outils de rejeu | `essais/08-suivi-velo/t3-outils/`, `essais/08-suivi-velo/t6-outils/` |

## Critère par critère

| Critère | Verdict | Preuves |
|---|---|---|
| C1 Essai d'abord | tenu ; B5 (vrai GPX VTT) partiel, reporté à la phase 10 | `essais/08-suivi-velo/LISEZMOI.md`, `essais/08-suivi-velo/partie-b/LISEZMOI.md` ; résultats B1 à B6 dans l'ADR 0021, « Contrôles avant de bâtir dessus » |
| C2 Directions | tenu dans les tests ; **relecture des listes par le pilotage à confirmer** | tests Jest de `mobile/src/core/tracking/` sur les réponses enregistrées du moteur ; listes `p08a/directions-*.md` |
| C3 Position sur le tracé | tenu | tests Jest de `mobile/src/core/tracking/` (boucle, aller-retour, passages à moins de 30 m) ; rejeux : Reste égal à la longueur au départ (`p08a/t8-final/ios-final-c13a-02-depart.png`), arrivée 34,4 km pour 34,3 km attendus (`p08a/t4-testeur/LISEZMOI.md`) |
| C4 Écran de suivi | tenu | tests ; `p08a/t8-final/ios-suivi-panneau-reste.png`, `ios-final-c13a-03-direction-changee.png`, `ios-panneau-jaune-arrivee-50m.png`, `android-17-suivi-200m-b.png` ; `p08a/t6-testeur/ios-p5-suivez-le-trace-troncon-main.png` |
| C5 Écart | tenu | tests ; `p08a/t6-testeur/LISEZMOI.md` § 2 (Android : 60 m puis guidage repris) ; `p08a/t8-final/ios-m3-ecart-60m-pointilles-stable.png`, `ios-final-c13a-05-retour-sur-le-trace.png` |
| C6 Arrivée | tenu | tests (`arrivalNeedsRide.test.ts`, `TrackingEndTester.test.tsx`) ; arrivée rejouée : `p08a/t8-final/ios-final-c13a-06-arrivee.png` (720 m, D+ 46 m, 2 min), `android-18-arrivee.png`, `p08a/t4-testeur/android-07-arrivee-run2.png` (34,4 km) ; pas d'arrivée au départ sur l'arrivée : `p08a/t8-final/ios-04-c6-sur-place-14s.png`, `android-06-c6-sur-place-12s.png` ; GPS coupé et écran libéré : `p08a/t6-testeur/LISEZMOI.md` § 5, C8 |
| C7 Terminer | tenu | tests ; Maestro `p08a/t6-testeur/android-p4-c13b-maestro-sortie.txt` ; `p08a/t8-final/ios-term-c13b-01` à `-04` ; retour système : `p08a/t3-testeur/android-15-retour-systeme-boite.png` (à la main, pas dans Maestro) |
| C8 Écran allumé, arrière-plan | tenu ; verrou d'écran vu sur Android seulement | `p08a/t6-testeur/LISEZMOI.md` § 5 (`dumpsys power`, captures `android-p4-04` à `-07`) et § 6 (iOS `ios-p5-c8-01` à `-03`) |
| C12 Rapidité | tenu en partie : départ et moyenne mesurés en release ; maximum mesuré en Node seulement | `p08a/t6-testeur/LISEZMOI.md` § 5 (départ 1,5 à 1,7 s pour 34,9 km ; 12 ms par position en moyenne ; 0,92 mise à jour par seconde) et § 6 (banc `perf.bench.test.ts` : maximum 2 ms) |
| C13 Maestro | tenu : Android en mode avion, iOS sans | `p08a/t6-testeur/android-p4-c13a-maestro-sortie.txt`, `android-p4-c13b-maestro-sortie.txt`, `ios-p5-c13a-maestro-sortie.txt`, `ios-p5-c13b-maestro-sortie.txt` ; repassés sur iOS avec le code final (`p08a/t8-final/LISEZMOI.md`) |
| C14 verify, pytest, CI | tenu | `p08a/t8-final/LISEZMOI.md` (verify) ; pytest 280 tests ; run de la CI plus bas |
| C15 Captures comparées | tenu ; aucun écart bloquant, 4 écarts mineurs corrigés (M1 à M4) et vérifiés sur le code final | `design/comparaisons/p08a-t3-suivi.md`, `design/comparaisons/p08a-suivi-velo.md` ; `p08a/t8-final/LISEZMOI.md` § M1 à M4. Maquettes 31b, v1/80, v1/90 : phase 8b |

Remarques non bloquantes du testeur sur le code final (`p08a/t8-final/LISEZMOI.md`, Réserves) :
- Sur le point d'arrivée, le panneau jaune dit « Arrivée 10 m » et le bas
  « Reste 0 m ». À regarder en phase 8b.
- Pendant un recadrage, les pointillés de l'écart se serrent (environ 4 pt)
  quelques secondes, vu une fois sur iOS. À regarder en phase 8b.
- Sur l'émulateur Android, « Sortie terminée » a affiché 2,4 km pour
  environ 200 m rejoués, après plusieurs `geo fix` éloignés : même cause
  que la position ancienne répétée (phase 10).

## Intégration continue

__CI__

## Écarts acceptés

Écrits dans l'ADR 0021, section « Écarts acceptés pendant la phase 8a » :
type de voie seulement sur la partie commune des deux formes recalées ;
« Au rond-point, 1re sortie » ; deux virages proches annoncés ensemble ;
position antérieure au départ ignorée ; première position incohérente
jetée ; arrivée après 100 m roulés.

## Reporté

- **Phase 8b** (prévu) : luminosité (C9), roue dentée et panneau 31b, onglet
  Carte (flèche de cap, halo, recentrage, cadrage hors zone, C10), trait de
  liaison (C11).
- **Phase 10 (vrai téléphone)** :
  - Position ancienne répétée par l'émulateur Android : il repousse le
    `geo fix` chaque seconde, daté « maintenant ». Ni le filtre de l'heure
    ni la règle de cohérence ne la voient. Propre à l'émulateur (décision
    du pilotage du 14 novembre). À vérifier sur un vrai téléphone.
  - Dans ce même cas, « Reste 14,3 km » au lieu d'environ 33 km : la
    position éloignée semble placée sur un passage plus tardif de la
    boucle. Non analysé.
  - Maximum du temps par position sur appareil (seulement mesuré en Node).
  - Fluidité de la caméra ; GPS, batterie en forêt ; un vrai GPX VTT (B5).
  - Virages du même côté entre 25 et 50 m (doublons), zigzags de 25 à 55 m.
- **Rejeu à 180 km/h** : « Terminer » peut ramener à Infos sans résumé,
  car la règle de cohérence jette chaque deuxième position. Effet du rejeu,
  pas d'un vélo ; noté pour mémoire.
