# Banc jetable de la tâche T6 (phase 4) : critères C3 et C11

THROWAWAY (phase 4, T6). Branche locale `claude/p04-banc` (jamais poussée,
jamais fusionnée), construite depuis `2e3c39d`. Elle mesure la VRAIE app
(écran `/draft`, même code), en version finale (release).

## Ce que fait le banc

Il ne s'active que si `<documents>/banc-p04-demande.json` existe. Sans lui,
l'app est celle de la phase.

- `demande.json` : 11 points de la forêt de Haye (tous sur des chemins du
  circuit R1 de la phase 3, ou au milieu de deux), centre et zoom de la
  carte (12,6, tous les points visibles entre la barre du haut et la feuille
  du bas). Les points sont ajoutés tout seuls à l'ouverture de `/draft`,
  un toutes les 150 ms, puis l'app écrit `banc-p04/pret.json`.
- Geste : le 6e point (index 5) est glissé. Un fichier `geste-N.json` par
  geste : arrêt max du fil JS (minuteur de 16 ms, du début du geste au
  résultat du calcul final), durée, évènements de glisser, calculs
  (une rafale = les 2 tronçons voisins demandés ensemble), nombre par
  seconde, écart minimal, calcul final (position, heure), autres tronçons
  recalculés (doit être 0), carte bougée (évènements de région).
- Témoin : si la demande contient `temoin_ms`, le même minuteur tourne
  3 s sur l'écran ouvert, sans geste : `temoin-N.json`.
- Comptage : `computeRoute` appelle `bancTrackCompute`, qui note les appels
  sans toucher à la promesse (comportement inchangé).
- Code : `bancP04.ts.txt` (module) et `branchement.diff.txt` (les quelques
  lignes ajoutées à `DraftScreen.tsx` et `computeRoute.ts`).

## Construire la release du banc

Depuis la branche `claude/p04-banc`, dans `mobile/` :

    export ANDROID_HOME=$HOME/Library/Android/sdk LANG=fr_FR.UTF-8
    npx expo run:ios --device "iPhone 17" --configuration Release
    npx expo run:android --variant release --device emulator-5554

(En arrière-plan. Le processus iOS reste ouvert après l'installation :
l'arrêter, la release n'a pas besoin de Metro.) La zone Nancy v3 doit être
installée dans l'app des deux appareils. Ne toucher ni `emulator-5584` ni
`R5CR21B1KDW`.

## Rejouer (depuis ce dossier)

    sh raz.sh ios                       # efface les anciens résultats
    sh banc.sh ios geste  sortie-ios    # un geste, répéter 3 fois
    sh banc.sh ios temoin sortie-ios    # un témoin
    sh raz.sh android
    sh banc.sh android geste  sortie-android   # x3
    sh banc.sh android temoin sortie-android

Un lancement = une app relancée à froid, un geste. `banc.sh` pose la
demande, lance l'app, ouvre `rutapulse:///draft`, attend `pret.json`, attend
8 s, glisse, récupère les JSON. Sans les 8 s, le geste iOS a échoué 2 fois
sur 3 (aucun évènement de glisser) : ne pas les raccourcir. Si `geste-N.json`
manque, rejouer ce geste.

- iOS : Maestro (`geste-ios.yaml`), appui long imité par un `swipe` de
  6000 ms (voir l'essai T1). Point en (115, 193) pt, fin (175, 253).
- Android : `adb input swipe` 2000 ms (`geste-android.sh`), départ et fin
  calculés par `positions.py` (`python3 -I positions.py android`).
- Si l'écran change (zoom, barre, appareil), relancer `positions.py` et
  recopier les nombres dans `geste-ios.yaml`.
- Les JSON sont numérotés par le nombre de fichiers déjà présents sur
  l'appareil : faire `raz.sh` avant chaque série, et les copies de
  `sortie-*` contiennent tout ce que l'app avait.

## Analyser

    python3 -I analyse.py sortie-ios sortie-android

Tableau : arrêt max, calculs, max par seconde, écart minimal, calcul final,
autres tronçons, carte bougée, et témoin. Verdict « ok » si : release, arrêt
max < 100 ms, au plus 6 calculs dans une fenêtre fermée de 1000 ms (c'est le
rythme de 5 par seconde, voir l'essai T1), écart >= 195 ms (gigue du
minuteur), calcul final réussi à la position du relâchement, 0 autre
tronçon recalculé, carte immobile.

## Limites

- Émulateur et simulateur seulement. Sur iOS, l'appui long est imité.
- « Autres tronçons » se juge sur les appels au moteur : un tronçon retrouvé
  dans le cache de Query ne fait aucun appel (c'est voulu).
- Le geste s'arrête quand les appels sont calmes depuis 400 ms (au plus 8 s) ;
  l'arrêt max inclut donc ce délai de calme, mais pas l'attente d'un calcul
  jamais lancé.
