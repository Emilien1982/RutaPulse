# Phase 8 — Suivi sur le vélo

> 10 novembre 2026. Spec de la session de pilotage, **validée par
> Émilien le 10 novembre**, avec les recommandations des questions 1 à 3.
> Question 4 : il choisit **deux phases plus petites, 8a puis 8b** (voir
> « Découpage en 8a et 8b »). Tient compte de sa décision du même jour : la
> phase 9 (suivi téléphone verrouillé) passe en V2. Découpage : [docs/05](../05-decoupage-v1.md), ligne 8.
> Fonction du cadrage : 7 (suivi sur le vélo). S'appuie sur l'ADR 0006
> (suivi, GPS, écran allumé), l'ADR 0016 (itinéraire en création, trait de
> liaison), l'ADR 0017 (calcul des infos), l'ADR 0019 (itinéraires gardés),
> l'ADR 0020 (circuits et trace modifiable), les décisions de design
> ([docs/06](../06-decisions-design.md)) et les maquettes 30, 31b, v1/20,
> v1/60, v1/80 et v1/90.

## Objectif

Suivre un itinéraire gardé sur le vélo, l'écran allumé : voir où l'on est
sur le tracé, combien il reste, et la prochaine direction écrite
(« À droite dans 200 m »). Puis voir le résumé de la sortie à l'arrivée.

## Ce que tu verras à la fin

- **Sur l'écran Infos d'un itinéraire gardé**, le bouton « Démarrer le
  suivi » (maquette v1/20). Il marche pour un itinéraire créé, un circuit
  devenu itinéraire et un GPX importé.
- **L'écran de suivi** (maquette 30), sur fond blanc :
  - en haut, la prochaine direction en grand (« 200 m », « À droite sur
    le sentier ») ; le panneau passe au **jaune sous 100 m** ;
  - la carte orientée dans le sens de la marche, la partie déjà roulée en
    gris, le zoom qui se rapproche à l'approche d'une direction ;
  - en bas, la **distance restante** et le **D+ restant** (décision de
    design 3) ;
  - si tu t'écartes du tracé, la **distance jusqu'à l'itinéraire**, sans
    alerte ni son (décision de design 4) ;
  - la boussole (remet le nord en haut), la roue dentée (panneau 31b,
    luminosité) et « Terminer », confirmé par une boîte de dialogue.
- **L'écran reste allumé** pendant tout le suivi, et seulement pendant le
  suivi.
- **À l'arrivée**, l'écran « ARRIVÉE ! » (maquette v1/60) : distance
  parcourue, D+ et durée réels, pauses comprises. Un seul bouton,
  « Fermer ». « Terminer » avant l'arrivée montre le même résumé, titré
  « Sortie terminée ».
- **Sur l'onglet Carte** (maquette 90) : le point de position avec sa
  **flèche de cap** et son halo de précision, et le bouton de recentrage
  avec ses trois états, dont « suit ma position » (questions 2 et 3).
- **Dans l'onglet Réglages**, le réglage « Luminosité pendant le suivi »
  (automatique ou maximum), le même que celui du panneau 31b.
- Tout marche en mode avion. Tout est **testé avec une trace GPS rejouée**
  sur les deux simulateurs : personne n'a besoin de rouler.

## Comment le suivi marche (en bref)

1. Au départ, l'app prend le **tracé gardé** de l'itinéraire, tel quel.
   Il ne change pas pendant le suivi.
2. Elle en tire les **directions** (tourner à droite, prendre le sentier,
   etc.). Un itinéraire gardé ne garde pas les directions du moteur, et un
   GPX ou un circuit n'en a jamais eu. Le pilotage propose de les demander
   au moteur Valhalla (moteur de calcul d'itinéraire, ADR 0002) par sa
   fonction `trace_route` : on lui donne le tracé, il le recale sur les
   voies et rend les directions. Hors zone et sur un tronçon tracé à la
   main, pas de direction : le panneau dit « Suivez le tracé ». L'essai de
   T1 éprouve ce choix ; la parade est de calculer les virages d'après la
   forme du tracé (choix 1).
3. À chaque position GPS (une par seconde au plus), l'app place la
   position **sur le tracé** et en déduit la distance restante, le D+
   restant, la prochaine direction et l'écart au tracé. Le calcul tient
   compte de l'avancement, pour ne pas sauter sur un autre passage du même
   tracé (boucle, aller-retour, deux passages proches).
4. Elle cumule la distance et le D+ **réellement** parcourus pour le
   résumé de l'arrivée. Le D+ réel vient de l'altitude du relief (le
   moteur, comme pour l'écran Infos), pas de l'altitude du GPS, trop
   bruitée.

Le suivi téléphone verrouillé (notification, Live Activity) passe en
**V2** (décision d'Émilien du 10 novembre : la phase 9 est retirée de la
v1). En phase 8, si l'app passe en arrière-plan, le suivi se met
en pause et reprend au retour, sans perdre l'avancement.

## Critères d'acceptation

| # | Critère | Comment on le vérifie |
|---|---|---|
| C1 | **Essai d'abord** : sur les deux simulateurs, une trace GPS rejouée fait avancer une position ; `trace_route` rend des directions utiles pour un itinéraire créé, le circuit de la forêt de Haye et un GPX importé ; la caméra MapLibre suit la position et le cap ; l'écran reste allumé | Essai jetable de T1, sorties brutes et captures gardées |
| C2 | **Directions** : pour chaque itinéraire de référence, liste des directions écrites en français, dans l'ordre, sans direction absurde (demi-tour sur une ligne droite, « tout droit » répétés). Tronçon à la main ou hors zone : « Suivez le tracé » | Tests Jest sur des réponses du moteur enregistrées ; liste relue par le pilotage |
| C3 | **Position sur le tracé** : distance restante juste à 20 m près sur une trace rejouée ; pas de saut sur un autre passage du tracé dans une boucle, un aller-retour ou deux passages à moins de 30 m | Tests Jest de la logique pure, avec des traces fabriquées |
| C4 | **Écran de suivi** (maquette 30) : distance et direction en haut, panneau jaune sous 100 m, carte orientée, partie roulée en gris, zoom rapproché à l'approche, distance restante et D+ restant en bas | Tests ; captures release |
| C5 | **Écart** : à plus de 30 m du tracé, la distance jusqu'à l'itinéraire s'affiche, sans alerte. De retour sur le tracé, le guidage reprend où il faut | Tests ; trace rejouée qui s'écarte puis revient |
| C6 | **Arrivée** : détectée à moins de 30 m de l'arrivée, après au moins 90 % du tracé parcouru (une boucle ne finit pas au départ). Écran v1/60 aux chiffres réels ; suivi arrêté (GPS coupé, écran libéré) | Tests ; trace rejouée jusqu'au bout |
| C7 | **Terminer** : confirmation, puis le même résumé titré « Sortie terminée ». Retour du système (Android) pendant le suivi : même confirmation | Tests ; parcours Maestro |
| C8 | **Écran allumé** pendant le suivi seulement ; arrière-plan = pause du suivi, reprise au retour sans perdre l'avancement | Tests ; essai sur simulateur |
| C9 | **Réglage « Luminosité pendant le suivi »** (automatique ou maximum) dans l'onglet Réglages et dans le panneau 31b, qui est le même réglage. Le panneau ne bloque pas le guidage et se ferme seul à moins de 100 m d'une direction. Luminosité rendue à la fin du suivi et au passage en arrière-plan | Tests ; captures. La luminosité réelle se vérifie sur un vrai téléphone (liste de PILOTAGE.md) |
| C10 | **Onglet Carte** (maquette 90, questions 2 et 3) : flèche de cap et halo ; bouton de recentrage à trois états ; ouverture et cadrage hors zone selon la question 2 | Tests ; captures avec une trace rejouée (le cap vient du mouvement) |
| C11 | **Trait de liaison** selon la question 1 | Tests |
| C12 | **Rapidité**, en version finale : départ du suivi en moins de 2 s pour un itinéraire de 35 km ; chaque position traitée en moins de 50 ms ; écran mis à jour une fois par seconde au plus | Mesures en release, méthode des phases 4 et 6 |
| C13 | Parcours Maestro, en mode avion, avec une trace rejouée : ouvrir un itinéraire, démarrer le suivi, voir une direction changer, s'écarter puis revenir, arriver, fermer ; et « Terminer » avant l'arrivée | Réussi sur Android ; sur iOS, sans mode avion |
| C14 | `npm run verify` passe, `pytest` passe, la CI est verte | Sorties et run GitHub |
| C15 | Captures release sur les deux simulateurs, comparées par le designer aux maquettes 30, 31b, v1/20, v1/60, v1/80 et v1/90 | Comparaison écrite dans `design/comparaisons/` |

## Hors périmètre

- Suivi téléphone verrouillé, notification et Live Activity : **V2**
  (ancienne phase 9, retirée de la v1 le 10 novembre).
- Sons, voix, alerte d'écart, économiseur d'écran : V2 ou plus tard.
- Enregistrer la sortie (trace réelle, statistiques) : plus tard. Le
  résumé de l'arrivée n'est pas gardé.
- Recalculer un chemin pour rejoindre l'itinéraire quand on s'en écarte.
- Animation du podium (V2) : l'illustration reste fixe.
- Suivre un itinéraire en création sans l'enregistrer : on enregistre
  d'abord.
- Les vérifications sur un vrai téléphone (GPS en forêt, batterie,
  luminosité réelle) : phase 10.

## Tâches, dans l'ordre

| # | Qui | Tâche |
|---|---|---|
| T1 | `developpeur` pour l'essai, puis `architecte` et `designer` | **Essai jetable** sur les deux simulateurs (C1) : trace rejouée (`xcrun simctl location` sur iOS, lecture de GPX de l'émulateur ou `adb emu geo fix` sur Android) ; `trace_route` sur un itinéraire créé, le circuit de Haye et un GPX ; caméra qui suit le cap ; écran allumé. Puis l'**ADR 0021** : source des directions et parade, placement sur le tracé avec l'avancement, seuils (écart 30 m, arrivée 30 m et 90 %, panneau jaune 100 m), D+ réel, pause en arrière-plan, luminosité. Le designer complète la maquette 30 (« Suivez le tracé », écart au tracé, arrivée détectée) et la maquette 90 (états, cadrage hors zone). **Le pilotage te montre la maquette et l'ADR pour validation** |
| T2 | `developpeur` | **Logique pure** dans `core/` : directions écrites depuis la réponse du moteur, position sur le tracé avec l'avancement, distance et D+ restants, écart, arrivée, chiffres réels. Avec leurs tests |
| T3 | `developpeur` | **Écran de suivi** (maquette 30) avec « Démarrer le suivi » sur l'écran Infos, écran allumé, pause en arrière-plan, « Terminer » |
| T4 | `developpeur` | **Arrivée** (v1/60), « Sortie terminée », réglage de la luminosité (v1/80 et panneau 31b) |
| T5 | `developpeur` | **Onglet Carte** : flèche de cap, halo, états du recentrage, cadrage hors zone (maquette 90, questions 2 et 3) ; trait de liaison (question 1) |
| T6 | `testeur` | Traces rejouées sur les deux simulateurs (C3, C5, C6), mesures C12, parcours Maestro C13, captures release |
| T7 | `designer` | Compare les captures aux maquettes et liste les écarts |

Chaque tâche de code passe ensuite par le `relecteur`, puis par le
`testeur`, un par un. Le designer regarde les captures de l'écran de suivi
dès la fin de T3, pour éviter une longue tâche de corrections à la fin.
Une tâche de corrections suit T7 si le designer trouve des écarts
bloquants.

## Découpage en 8a et 8b (décision d'Émilien, 10 novembre)

**Phase 8a — le suivi (taille M)** : T1 (essai, ADR 0021, maquette 30
complétée ; la maquette 90 attend la 8b), T2, T3, puis T4 **sans la
luminosité** (arrivée et « Sortie terminée »), puis T6 et T7 sur ce
périmètre. Critères : C1 à C8, C12 à C15. Dans l'écran de suivi, la roue
dentée est absente en 8a ; elle arrive en 8b avec son panneau.

**Phase 8b — les finitions du suivi (taille P)** : luminosité (C9 :
réglage dans l'onglet Réglages, roue dentée et panneau 31b), onglet Carte
(C10 : flèche de cap, halo, états du recentrage, cadrage hors zone ;
maquette 90 complétée par le designer), trait de liaison (C11). Puis
tests, captures et comparaison du designer sur ce périmètre ; C14 et C15
de nouveau. Elle a sa propre session, sa fusion et sa passation.

Chaque phase a son fichier de résultats :
`p08a-suivi-velo-resultats.md`, puis `p08b-suivi-velo-resultats.md`.

## Coût et risques

- **Taille : G**, soit 3 sessions de travail ou plus, enchaînées. Échelle
  de docs/05 : **P** (petite) = 1 session, **M** (moyenne) = 2 sessions,
  **G** (grande) = 3 sessions ou plus. Docs/05 l'estimait à M. Elle
  grossit pour trois raisons : les directions ne sont gardées nulle part
  et doivent être recalculées (circuits et GPX compris) ; les états de la
  maquette 90, reportés depuis la phase 2 ; l'arrivée et la luminosité,
  qui n'étaient pas comptées. Pour repère, la phase 7 (G) a pris environ
  45 points du quota de la semaine.
- **Quota** : 55 % utilisés le mardi 10 novembre au matin, renouvellement
  le lundi 16 à 7 h. Avec la réserve (2 % par jour jusqu'au samedi, rien
  le dimanche) et la marge de 5 points, la phase peut utiliser environ
  30 points d'ici samedi, et jusqu'à 45 le dimanche. Une phase G tient
  donc **à peine** avant lundi : elle s'arrêtera sans doute une fois
  proprement en fin de tâche, puis reprendra seule le dimanche matin ou le
  lundi 16 à 7 h. Une phase M tiendrait. Voir la question 4.
- **Risque 1** : `trace_route` peut mal recaler une trace sur des
  sentiers proches les uns des autres, ou rendre des directions trop
  nombreuses. L'essai de T1 le teste sur 3 itinéraires ; la parade est de
  calculer les virages d'après la forme du tracé.
- **Risque 2** : placer la position sur un tracé qui repasse au même
  endroit (boucle en 8, aller-retour). La règle d'avancement le traite ;
  `Jest` sur des traces fabriquées.
- **Risque 3** : le cap et la caméra qui suit, mal rendus par les
  simulateurs. La trace rejouée donne un cap par le mouvement ; le
  confort réel se vérifie sur un vrai téléphone en phase 10.
- **Risque 4** : la place sur le Mac (12 Go libres). La phase construit
  l'app en release sur les deux simulateurs : il faut d'abord effacer
  DerivedData.
- **Essai réel au plus tôt** : la phase 9 passe en V2, donc la phase 10
  (finition et test interne) suit directement. Le pilotage propose de
  commencer la phase 10 par l'APK Android installable et l'app iOS
  installée par Xcode, pour que tu roules avec l'app dès que possible ;
  la finition viendra après ce premier essai.
- **Ce que tu devras faire** : valider cette spec et répondre aux
  questions 1 à 4 ; valider la maquette 30 complétée et l'ADR 0021 (T1) ;
  valider la fusion.

## Question 1 : le trait de liaison compte-t-il dans la distance et le GPX ?

Quand tu poses un point loin d'un chemin (moins de 200 m), le moteur le
recale sur le chemin le plus proche. Un trait en pointillés relie ton
point au chemin. Aujourd'hui, ce trait ne compte ni dans la distance, ni
dans la durée, ni dans le GPX (décision du 27 octobre).

- **Recommandation : on garde cette règle, et le suivi ne guide pas sur
  le trait.** Le suivi passe par le point recalé, sur le chemin. Le trait
  reste dessiné en pointillés pendant le suivi, pour montrer le point
  posé. Raison : le trait n'est pas un chemin ; le suivre ferait couper à
  travers bois. Si tu veux vraiment aller jusqu'au point, le tronçon
  « tracé à la main » existe déjà et, lui, compte partout.
- Autre choix : le trait compte dans la distance et le GPX, et le suivi
  te mène jusqu'au point posé, aller et retour. Plus fidèle à ton geste,
  mais il guide hors des chemins.

## Question 2 : à l'ouverture de la carte, si tu es hors de la zone

Aujourd'hui, l'onglet Carte montre toute la zone et le message « Vous êtes
hors de la zone téléchargée ». Ta position n'est pas à l'écran.

- **Recommandation** : si tu es à **moins de 10 km** du bord de la zone
  (par exemple au parking, avant de partir), la carte montre ensemble ta
  position et le bord de la zone le plus proche. Plus loin, rien ne change
  (toute la zone et le message). La carte reste bloquée sur la zone
  (décision du 26 octobre) : au-delà de 10 km, ta position ne tiendrait
  pas à l'écran avec la zone.
- **Pendant le suivi**, la caméra suit toujours ta position, même hors de
  la zone : c'est l'itinéraire qui compte. Hors zone, le fond de carte est
  uni, mais le tracé et ta position restent visibles.
- Autre choix : ne rien changer sur l'onglet Carte.

## Question 3 : états « suit ma position » et flèche de cap (maquette 90)

La maquette 90 prévoit trois choses que la phase 2 n'a pas faites : la
flèche de cap sur le point bleu, le halo de précision, et l'état « suit ma
position » du bouton de recentrage (fond brun : la carte te suit ; il
repasse au repos dès que tu déplaces la carte).

- **Recommandation : les faire en phase 8 (T5)**, car l'écran de suivi a
  besoin du même point bleu avec son cap. Sur l'onglet Carte, le nord
  reste en haut (rotation désactivée) : c'est la flèche qui tourne, pas
  la carte. Pendant le suivi, c'est la carte qui tourne (maquette 30).
- Autre choix : les reporter à la phase 10 (finition).

## Question 4 : une seule phase G, ou deux phases plus petites ? (tranchée : deux phases)

- **Recommandation : une seule phase G, lancée dès ta validation.** Elle
  s'arrêtera proprement si elle approche la réserve de quota, et
  reprendra seule (dimanche matin ou lundi 16 à 7 h). Tu n'as rien à
  faire pour la relancer.
- Autre choix : couper en **8a** (taille M : directions, écran de suivi,
  arrivée, « Terminer » ; tâches T1 à T4) puis **8b** (taille P : onglet
  Carte, luminosité, trait de liaison). 8a tient avant lundi ; 8b viendrait
  après. Prix : une fusion et une passation de plus.

**Décision d'Émilien (10 novembre)** : deux phases plus petites, 8a puis
8b. Questions 1 à 3 : recommandations validées.

## Choix déjà faits par le pilotage (validés)

1. Les directions viennent du moteur (`trace_route`), recalculées au
   départ du suivi, pour tous les itinéraires. Rien de nouveau n'est gardé
   dans la base : pas de montée de version.
2. Seuils : écart affiché au-delà de 30 m du tracé ; arrivée à moins de
   30 m de la fin, après 90 % du tracé ; panneau jaune sous 100 m.
   L'architecte peut les ajuster après l'essai.
3. Le D+ réel de l'arrivée vient de l'altitude du relief aux positions
   reçues, pas du GPS (note du designer, LISEZMOI).
4. En phase 8, le suivi se met en pause quand l'app passe en arrière-plan.
   Le suivi verrouillé viendra en V2, sur la même logique. Pour un essai
   réel, garde l'écran allumé : c'est le cas normal de la phase 8.
5. Les tests utilisent des traces GPS rejouées sur les simulateurs, tirées
   des itinéraires de référence, avec un écart et un retour fabriqués.
6. Le résumé de l'arrivée n'est pas enregistré (« enregistrement des
   sorties » : plus tard, dans le cadrage).
