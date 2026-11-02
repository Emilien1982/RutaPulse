# Preuves de la tâche T5 (phase 5) : écran Infos

Date : 2 novembre 2026. **Android seulement, iOS en attente de la licence
Xcode** (Xcode 27.2 installé pendant la pause ; décision d'Émilien :
avancer sur Android).

## Contrôle de la pile imbriquée (ADR 0017, « Début de T5 »)

Branche jetable locale `claude/p05-essai-pile` (`65e6c2b`, jamais poussée).
Release sur `Pixel_6_API_34_arm64`. Parcours `essai-pile.yaml`, journal
`maestro-essai-pile.log`, captures `essai-android-*.png` :

- Infos s'empile, le retour montre la création dessous ;
- « Modifier » et le retour d'Android depuis Infos n'ouvrent pas
  « Abandonner cet itinéraire ? » ;
- la croix et le retour d'Android depuis la création l'ouvrent ; après
  Infos puis retour, la croix l'ouvre encore.

`usePreventRemove` voit la sortie : la parade de l'ADR n'a pas servi.
Non fait sur iOS : croix, glissement depuis le bord, défilement.

## Écran Infos, release Android

Parcours `infos-haye.yaml` (journal `maestro-infos-haye.log`), forêt de
Haye, zone Nancy v3, 5 points dont un tronçon à la main, sans mode avion :

- `p05-t5-android-haye-creation-4-points.png` : la création (5 points,
  malgré le nom du fichier), tronçon en tirets entre 3 et 4 ;
- `p05-t5-android-haye-infos.png` : Infos, 1,7 km, D+ 58 m, D− 40 m,
  9 min, « de 203 à 240 m », Route 16 %, Piste 35 %, Sentier 21 %, À la
  main 28 %, carte en arche, attribution et « i » ;
- `p05-t5-android-haye-retour-creation.png` : retour par « Modifier »,
  itinéraire et chiffres intacts, pas de dialogue.

Ces captures datent d'avant l'aller-retour de corrections (`readOnly`,
verrou du double appui, boucles min/max, mémo de la géométrie), qui ne
change pas l'affichage. Les captures release de référence sont celles de T7.

- `build-*-fin.txt` : fin des journaux de build release.

## Tests

Tests commités adaptés : [../t5-tests-adaptes.md](../t5-tests-adaptes.md).
`verify-commit.log` : `npm run verify` avant le commit.

## Non vérifié

- Empreinte de Nancy v3 après ces essais : l'app release ne permet pas
  `run-as`. Aucun essai n'a touché aux zones ; à contrôler en T7.
- Tout iOS (voir la liste des contrôles iOS en attente dans les résultats).
