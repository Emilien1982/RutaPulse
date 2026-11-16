# Phase 8b — Finitions du suivi

> 16 novembre 2026. Spec de la session de pilotage, **à valider par
> Émilien**. Suite de la phase 8a (fusionnée le 16 novembre). Périmètre
> fixé par sa décision du 10 novembre : voir
> [p08-suivi-velo.md](p08-suivi-velo.md), « Découpage en 8a et 8b ».
> Les questions 1 à 3 de la phase 8 sont déjà tranchées (recommandations
> validées le 10 novembre) : cette spec les applique, sans les reposer.
> S'appuie sur l'ADR 0006 (suivi, GPS, écran allumé), l'ADR 0016 (trait
> de liaison), l'ADR 0021 (suivi sur le vélo), les décisions de design 2
> et 6 ([docs/06](../06-decisions-design.md)) et les maquettes 30, 31b,
> v1/80 et v1/90.

## Objectif

Finir le suivi avant le premier essai réel : régler la luminosité
pendant la sortie, voir sa position et son cap sur l'onglet Carte, et
garder le trait de liaison visible sans qu'il compte.

## Ce que tu verras à la fin

- **Pendant le suivi**, une petite roue dentée sur l'écran de suivi. Elle
  ouvre le panneau « Réglages du suivi » (maquette 31b) : « Luminosité de
  l'écran », **Automatique** ou **Maximum**. Le choix s'applique tout de
  suite. Le panneau ne cache pas le guidage et se ferme seul à moins de
  100 m d'une direction.
- **Dans l'onglet Réglages** (maquette v1/80), la rubrique « Pendant le
  suivi » avec le même choix. Changer l'un change l'autre, et le choix
  reste pour les sorties suivantes. « Automatique » par défaut.
- À la fin du suivi, ou quand l'app passe en arrière-plan, l'écran
  **reprend sa luminosité d'avant**.
- **Sur l'onglet Carte** (maquette 90) :
  - ton point bleu avec sa **flèche de cap** (la direction où tu vas) et
    son **halo** (la précision du GPS). Le nord reste en haut : c'est la
    flèche qui tourne, pas la carte ;
  - le **bouton de recentrage à trois états** : au repos ; « suit ma
    position » (fond brun, la carte te suit) ; position refusée (viseur
    barré, toucher mène aux réglages du téléphone). Il repasse au repos
    dès que tu déplaces la carte ;
  - **hors de la zone, à moins de 10 km de son bord** (au parking, par
    exemple), la carte s'ouvre sur ta position et le bord de la zone le
    plus proche, ensemble. Plus loin, rien ne change : toute la zone et
    le message « hors de la zone ».
- **Le trait de liaison** (pointillés entre un point posé hors chemin et
  le chemin) reste dessiné sur l'écran Infos et pendant le suivi, pour
  montrer le point posé. Il ne compte ni dans la distance, ni dans la
  durée, ni dans le GPX, et le suivi ne guide pas dessus.
- Deux défauts vus par le testeur de la 8a sont corrigés : « Arrivée
  10 m » en haut alors que le bas dit « Reste 0 m » ; les pointillés de
  l'écart qui se serrent pendant un recadrage.
- Tout marche en mode avion, testé avec une trace GPS rejouée sur les
  deux simulateurs.

## Critères d'acceptation

Les numéros C9, C10 et C11 reprennent ceux de la spec de la phase 8.

| # | Critère | Comment on le vérifie |
|---|---|---|
| C1 | **Essai d'abord** : sur les deux simulateurs, changer la luminosité de l'app et la rendre ensuite ; le cap de `UserLocation` (MapLibre) avec une trace rejouée ; la caméra qui suit la position et repasse au repos quand on déplace la carte | Essai jetable de T1, sorties brutes et captures gardées |
| C9 | **Luminosité** : réglage dans l'onglet Réglages et dans le panneau 31b, qui est le même réglage, gardé d'une sortie à l'autre. Le panneau ne bloque pas le guidage et se ferme seul à moins de 100 m d'une direction. Luminosité rendue à la fin du suivi et au passage en arrière-plan, reprise au retour | Tests ; captures. La luminosité réelle se vérifie sur un vrai téléphone (liste de PILOTAGE.md) |
| C10 | **Onglet Carte** (maquette 90) : flèche de cap et halo ; sans cap connu, le rond sans flèche ; bouton de recentrage à trois états ; ouverture dans la zone (centrée sur toi, zoom 14, « suit ma position ») ; hors zone à moins de 10 km, cadrage sur ta position et le bord le plus proche ; plus loin, comportement actuel | Tests ; captures avec une trace rejouée (le cap vient du mouvement) |
| C11 | **Trait de liaison** : dessiné en pointillés sur l'écran Infos et pendant le suivi, aux deux bouts d'un tronçon dont le point posé est à plus de 5 m du chemin. Distance, durée, D+, GPX et guidage inchangés (même chiffres qu'avant la phase) | Tests ; capture d'un itinéraire avec un point posé hors chemin |
| C12 | **Remarques du testeur de la 8a** : sur le point d'arrivée, le panneau du haut et « Reste » disent la même chose ; les pointillés de l'écart gardent leur espacement pendant un recadrage | Tests ; captures |
| C13 | **Rapidité** : rien ne ralentit le suivi (départ en moins de 2 s pour 35 km, chaque position en moins de 50 ms) ; l'onglet Carte s'ouvre aussi vite qu'avant | Banc de la phase 8a ; mesure en release |
| C14 | Parcours Maestro, en mode avion : démarrer le suivi, ouvrir le panneau, choisir « Maximum », le retrouver dans l'onglet Réglages ; ouvrir l'onglet Carte et voir le bouton « suit ma position » | Réussi sur Android ; sur iOS, sans mode avion |
| C15 | `npm run verify` passe, `pytest` passe, la CI est verte | Sorties et run GitHub |
| C16 | Captures release sur les deux simulateurs, comparées par le designer aux maquettes 30, 31b, v1/80 et v1/90 | Comparaison écrite dans `design/comparaisons/` |

## Hors périmètre

- Suivi téléphone verrouillé, notification et Live Activity : V2.
- La vraie luminosité, le confort de la flèche de cap et la précision du
  GPS : sur un vrai téléphone, en phase 10.
- « Licences et attributions » de l'onglet Réglages : phase 10.
- Position ancienne répétée par l'émulateur Android (« Sortie terminée »
  à 2,4 km) : propre à l'émulateur, vérifiée en phase 10.
- Faire tourner la carte de l'onglet Carte : le nord reste en haut.

## Tâches, dans l'ordre

| # | Qui | Tâche |
|---|---|---|
| T1 | `developpeur` pour l'essai, puis `architecte` et `designer` | **Essai jetable** sur les deux simulateurs (C1). Puis l'architecte complète l'**ADR 0021** (§ 8 luminosité, et une section onglet Carte et trait de liaison) : bibliothèque de la luminosité, ce qui est rendu et quand, états du recentrage, règle des 10 km et du bord le plus proche, source du trait de liaison pour un itinéraire gardé. Le designer complète la maquette 90 (états du bouton, cap, cadrage hors zone) et vérifie la roue dentée sur la maquette 30. **Le pilotage te montre la maquette et l'ADR pour validation** |
| T2 | `developpeur` | **Luminosité** : réglage gardé, rubrique de l'onglet Réglages (v1/80), roue dentée et panneau 31b, rendu de la luminosité |
| T3 | `developpeur` | **Onglet Carte** : flèche de cap, halo, trois états du recentrage, cadrage hors zone |
| T4 | `developpeur` | **Trait de liaison** sur l'écran Infos et pendant le suivi ; les deux remarques du testeur de la 8a (C12) |
| T5 | `testeur` | Traces rejouées sur les deux simulateurs, mesures C13, parcours Maestro C14, captures release |
| T6 | `designer` | Compare les captures aux maquettes 30, 31b, v1/80 et v1/90, et liste les écarts |

Chaque tâche de code passe ensuite par le `relecteur`, puis par le
`testeur`, un par un. Une tâche de corrections suit T6 si le designer
trouve des écarts bloquants.

## Coût et risques

- **Taille : P** (petite), soit 1 session de travail, peut-être 2.
  Échelle de docs/05 : **P** = 1 session de phase, **M** (moyenne) = 2
  sessions, **G** (grande) = 3 sessions ou plus. Une « session » est une
  conversation de phase qui mène 3 ou 4 tâches avant sa passation écrite.
  Avec 6 tâches, la 8b peut donc demander une passation, comme une petite
  M. Pour repère, la phase 8a (taille M) a pris environ 60 points du
  quota de la semaine, sur deux semaines.
- **Quota** : 21 % utilisés le lundi 16 novembre au soir, renouvellement
  le lundi 23 à 7 h. Réserve pour ta veille emploi : 12 points (lundi à
  samedi), plus 5 points de marge. La phase peut donc utiliser environ
  60 points : elle tient largement. Estimation : 20 à 30 points.
- **Risque 1 : la luminosité.** Sur iOS, la luminosité est celle de tout
  le téléphone ; il faut la rendre à coup sûr (fin, arrière-plan, app
  fermée de force). Sur Android, elle peut ne toucher que la fenêtre de
  l'app. L'essai de T1 le vérifie ; une nouvelle bibliothèque
  (`expo-brightness`, d'Expo) entre sans doute dans le projet.
- **Risque 2 : le cap sur simulateur.** Le cap vient du mouvement d'une
  trace rejouée, pas d'une boussole. Le confort réel se juge en phase 10.
- **Risque 3 : la place sur le Mac.** La phase construit l'app en release
  sur les deux simulateurs. Environ 88 Go libres aujourd'hui ; les copies
  Time Machine en mangent environ 1 Go par heure. Je te demanderai tôt ton
  accord pour les effacer si la place passe sous 20 Go.
- **Ce que tu devras faire** : valider cette spec ; valider la maquette 90
  complétée et le complément de l'ADR 0021 (T1) ; valider la fusion.

## Questions

Aucune nouvelle question : les choix de produit de cette phase ont été
faits le 10 novembre (questions 1 à 3 de la phase 8).

## Choix déjà faits par le pilotage (tu peux les changer)

1. Sur le point d'arrivée, le panneau du haut et « Reste » prennent la
   même distance, mesurée le long du tracé. Sous 30 m, le panneau dit
   seulement « Arrivée » (sans chiffre), jusqu'à l'écran « ARRIVÉE ! ».
2. Le trait de liaison se redessine à partir des points posés, gardés
   avec l'itinéraire : rien de nouveau dans la base, pas de montée de
   version.
3. Un GPX importé et un circuit n'ont pas de points posés hors chemin :
   pas de trait de liaison pour eux.
4. Le panneau 31b ne garde que la luminosité en v1 (pas d'autres
   réglages).
5. La rubrique « À propos » de l'onglet Réglages reste pour la phase 10.
