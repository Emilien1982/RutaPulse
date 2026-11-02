# Banc jetable de la tâche T7 (phase 5) : C3, C5 et C9

THROWAWAY. Branche locale `claude/p05-banc` (commit `72ee978`, depuis
`12e4dad`), jamais poussée, jamais fusionnée. Il mesure la VRAIE app en
version finale (release), avec le vrai code de `core/` et `shared-data/`.
Essayé sur Android (`emulator-5554`) seulement ; iOS attend la licence Xcode
(les branches iOS de `banc.sh` sont écrites, NON ESSAYÉES).

## Ce que fait le banc

Il ne s'active que si `<documents>/banc-p05-demande.json` existe. Sans lui,
l'app est celle de la phase. Trois mesures, choisies par le champ `mesure`.

1. **references** (C3, C5). Pour R1 à R5 (points des requêtes de
   `docs/phases/preuves/p03/c5/requetes/`), un tronçon calculé par paire de
   points. Pour chaque tronçon, le vrai chemin : `computeRoute`, `infoShape`,
   `computeHeights`, `computeTerrain`, puis `summarizeInfo` sur l'ensemble.
   Un fichier par référence, `refs-Rn.json` : par tronçon, la requête et la
   réponse brute (`height`, `trace_attributes`, relevées sur le module natif
   lui-même) ; en fin, `calcul_ts` : D+, D−, altitudes basse et haute, parts.
   `refs-fini.json` marque la fin.
2. **affichage** (C9, temps). R4 (40,3 km, 22 points) posé dans `/draft` ;
   `banc.sh` touche le résumé (`adb input tap`, position lue par
   `uiautomator dump`). Le banc note le temps entre le toucher (première
   instruction de `openInfos`) et les chiffres (distance, D+, D−, profil,
   parts) : validés (effet après rendu) et dessinés (2 images plus tard).
   Froid = `queryClient.clear()` au moment du toucher (l'écran Infos refait
   route, altitudes et terrain de tous les tronçons) ; chaud = cache plein.
   `affichage-N.json`.
3. **geste** (C9, fluidité). Méthode de la phase 4 (minuteur de 16 ms,
   11 points de la forêt de Haye, point d'index 5 glissé 2 s). Un
   `geste-N.json` par geste, avec en plus : tous les arrêts du fil JS de plus
   de 30 ms (date et durée), l'arrêt max jusqu'au relâchement, jusqu'au calcul
   final et jusqu'à la fin des infos, et le détail des appels d'infos (aucun
   attendu pendant le geste, 4 après : altitudes et terrain des 2 tronçons).
   `temoin-N.json` (mesure `temoin`) : le minuteur seul, 3 s.

Code : `code/bancP05.ts.txt`, `code/bancP05Refs.ts.txt` (nouveaux fichiers de
`mobile/src/shared-data/routing/`) et `code/branchement.diff.txt` (les lignes
ajoutées à `DraftScreen.tsx`, `RouteInfoScreen.tsx`, `computeRoute.ts`,
`computeInfos.ts`, `routingEngine.ts`, qui enveloppe le module natif).

## Construire la release du banc

Depuis la branche `claude/p05-banc`, dans `mobile/` :

    export ANDROID_HOME=$HOME/Library/Android/sdk LANG=fr_FR.UTF-8
    npx expo run:android --variant release --device emulator-5554

Le processus reste ouvert (Metro) : l'arrêter par son numéro (PID), la release
n'en a pas besoin. La zone Nancy v3 doit être installée dans l'app.

## Rejouer (depuis ce dossier)

    sh raz.sh android                              # efface résultats ET demande
    sh banc.sh android references sortie           # 1 fois (27 s)
    sh banc.sh android affichage-froid sortie      # x3 (app relancée à chaque fois)
    sh banc.sh android affichage-chaud sortie      # x3
    sh banc.sh android geste sortie                # x3
    sh banc.sh android temoin sortie
    python3 -I analyse.py sortie                   # tableaux et verdicts
    sh raz.sh android                              # à la fin : l'app redevient normale

Un lancement = une app relancée à froid, un passage. Les JSON sont numérotés
par le nombre de fichiers présents sur l'appareil : `raz.sh` avant une
série ; la copie `sortie/banc-p05` contient tout ce que l'app avait. Les
captures de l'écran Infos sont à côté (`capture-affichage-*.png`). Le
geste : `geste-android.sh`, départ et fin donnés par `positions.py`
(`demande-geste.json`).

## Passage de contrôle (Android, release, 2 novembre 2026)

Dossiers `controle-android*` ; tableaux dans `analyse-controle.txt`.
Empreinte de `valhalla_tiles.tar` de Nancy v3 relevée sur l'appareil après
les mesures : `7fa29249411c75fd0cc651b4f0e06baf9dbd80109eea7df51b8116b7ceb07a44`.

## Limites

- Le temps d'affichage est mesuré dans le JavaScript (le toucher est celui
  de `onPress`, au relâchement du doigt) ; il ne voit ni l'animation de
  l'écran ni le dernier dessin natif. La capture prise 6 s après montre les
  chiffres. Pas de mesure externe (enregistrement vidéo).
- Froid = cache de requêtes vidé, pas moteur natif ni système de fichiers
  refroidis. L'app est tout de même relancée avant chaque mesure.
- Les 4 appels d'infos « attendus » après le glisser valent pour un point
  intérieur d'un itinéraire à tronçons calculés.
- Le banc a besoin du moteur ouvert : il attend `routingEngine.getState()`.
