# Preuves de la tâche T9 (phase 5) : corrections de la comparaison T8

Date : 2 novembre 2026. **Android seulement.** Release sur
`Pixel_6_API_34_arm64` (l'app installée n'est pas débogable :
`run-as: package not debuggable`). Corrections de
[p05-t8.md](../../../../design/comparaisons/p05-t8.md), B1 et C1 à C7, puis
« Décisions pour T9 » du designer.

- `t9/` (premier passage) : `01` à `03` résumé et chevron, appui ; `04` à
  `07` écran Infos (bande et légende en tirets, légende en brun, sans
  étiquettes) ; `08`, `09`, `12`, `13` à 360 dp ; `10`, `11` point relié à
  la main hors de la zone et « Altitudes indisponibles » (4 cases, titre,
  une ligne).
- `../t9b/` (après les décisions du designer) : `01-appui-resume.png`,
  `01b-appui-zoom.png` (coins arrondis de l'ondulation),
  `02-resume-360dp-compact.png` (124,1 km, 1 035 m, 8 h 19 sur une ligne à
  360 dp), `03-resume-normal-411dp.png`, `04-creation-note-a-la-main.png`,
  `04-infos-coin-haut.png` et `05-infos-diagonale.png` (ronds entiers, long
  itinéraire dans l'arche grâce au zoom minimal à 0).
- Le 3e aller-retour (nom accessible, écarts 16 et 12) n'a pas changé
  l'affichage à 411 dp au-delà de l'écart : pas de nouvelle capture.
- Tests adaptés : [../t9-tests-adaptes.md](../t9-tests-adaptes.md).
- `verify-commit.log` : `npm run verify` avant le commit.

Non prouvé : le pire cas « 125,4 km / 1 250 m / 10 h 45 » à 360 dp
(calcul du designer seulement) ; un rond collé à un coin du haut de l'arche
(calcul seulement) ; iOS.
