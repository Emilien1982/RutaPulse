# Résultats de l'essai E1 (ADR 0013)

Appareils : simulateur iOS « iPhone 17 » (iOS 26.5) et émulateur Android
`Pixel_6_API_34_arm64` (emulator-5554). expo-file-system 58.0.11,
expo-network 58.0.4, build de développement (dev client), identifiant `fr.vttnav.e1`.
Journal complet : `e1.log` (lignes `[E1] <plateforme> t=<ms>`). Sections repérées par `--- <nom> <s>`.
Réseau de la machine : lien rapide (111 Mo en 7 s sur iOS).
Remarque : les journaux iOS sont aussi dans e1.log ; une ligne « ios » apparaît dans la section
« AND T2/T4 » car l'app iOS tournait encore (refaites ensuite sous « AND T2b/T4b »).

## 1. Téléchargement (createDownloadTask, foreground, adresses github.com)
- Redirection github.com suivie : OUI sur les deux plateformes (9 fichiers, tailles exactes).
- iOS : 111 Mo en 7 078 ms. Android : 12 386 ms. Mémoire : iOS RSS 532 Mo avant, 537 Mo au pic
  (stable) ; Android PSS 285 Mo avant, pic 310 Mo (mem-ios.txt, mem-and.txt).
- Progression : reçue (onProgress), environ 1 événement toutes les 100 à 150 ms (iOS : 4 à 8
  événements par gros fichier à ce débit, premier événement après 300 à 400 ms ; Android : 14 à 22).
```
[E1] ios t=1793005607446 dlseq-total ms=7078
[E1] ios t=1793005607118 dl-ok valhalla_tiles.tar ms=1147 events=8 firstProgressMs=340 size=28846080 expected=28846080
[E1] android t=1793006028182 dlseq-total ms=12386
[E1] android t=1793006027955 dl-ok valhalla_tiles.tar ms=2098 events=22 firstProgressMs=234 size=28846080 expected=28846080
```

## 2. File.digest('SHA-256')
- Les 9 empreintes égales à celles du catalogue (iOS et Android). Contrôle externe : `shasum -a 256`
  sur map.pmtiles, contours.pmtiles, N48E005.hgt = mêmes valeurs que le catalogue.
- Durée : plus gros fichier (28,8 Mo) 14 ms iOS / 17 ms Android ; ensemble des 9 fichiers 65 ms iOS /
  80 ms Android. Retard max du fil JS : 16 ms (iOS), 12 ms (Android) : l'interface reste fluide.
```
[E1] ios t=1793005613592 digest-total ms=65 sumMs=55
[E1] ios t=1793005613591 digest valhalla_tiles.tar ms=14 match=true maxJsLagMs=0 got=7fa29249411c want=7fa29249411c
[E1] android t=1793006061952 digest-total ms=80 sumMs=70
[E1] android t=1793006061950 digest valhalla_tiles.tar ms=17 match=true maxJsLagMs=0 got=7fa29249411c want=7fa29249411c
```
(fichiers dans le cache disque du système, SSD du Mac : sur un vrai téléphone ce sera plus lent.)

## 3. Coupure réseau en plein fichier
- Android, vraie coupure (`svc wifi disable` + `svc data disable`) pendant un fichier de 28,8 Mo servi
  lentement (2 Mo/s) par le Mac : promesse REJETÉE en 29 ms. Un fichier partiel de 8 331 712 octets reste
  à l'adresse de destination.
```
CUT at 1793006097   (s)
[E1] android t=1793006097240 net-event {"isInternetReachable":false,"type":"NONE","isConnected":false}
[E1] android t=1793006097269 dl-ERROR valhalla_tiles.tar afterMs=5349 sinceLastProgressMs=220 ... Unable to download a file: Software caused connection abort existsOnDisk=true size=8331712
```
- Android, vers github.com (coupure pendant la connexion) : rejet en 25 ms (« Failed to connect to github.com »).
- Connexion qui se fige sans se fermer (le serveur arrête d'envoyer) : Android rejette après ~60 s
  sans octet (« Read timed out », 63 606 ms, fichier partiel de 5 242 880 octets resté) ; iOS rejette après
  ~60 s (« The request timed out », 62 875 ms, aucun fichier à destination). Donc PAS de blocage sans fin.
```
[E1] android t=1793006252367 dl-ERROR valhalla_tiles.tar afterMs=63606 sinceLastProgressMs=60134 ... Read timed out existsOnDisk=true size=5242880
[E1] ios t=1793005910570 dl-ERROR valhalla_tiles.tar afterMs=62875 sinceLastProgressMs=60096 ... The request timed out. existsOnDisk=false
```
- iOS : pas de vrai mode avion sur simulateur (il partage le réseau du Mac). Je n'ai pas coupé le Wi-Fi du Mac
  (il aurait coupé aussi cet outil). Fait à la place : serveur local qui se fige (ci-dessus) ; connexion
  réinitialisée (app tuée, côté serveur « Connection reset »).

## 4. Adresse en 404
- Erreur (promesse rejetée) sur les deux plateformes ; AUCUN fichier écrit. Une release inexistante et
  un fichier inexistant dans une release existante donnent le même résultat. (iOS émet un événement de
  progression 9/9 octets avant l'erreur, le corps « Not Found ».)
```
[E1] ios ... dl-ERROR zone.json afterMs=241 ... server returned HTTP 404 existsOnDisk=false size=-1
[E1] android ... dl-ERROR zone.json afterMs=1236 ... HTTP 404 existsOnDisk=false size=-1
```

## 5. App tuée pendant un fichier
- Android (`am force-stop` à 7 s) : le fichier partiel RESTE à l'adresse de destination (9 240 576 octets,
  `files/e1/valhalla_tiles.tar`) ; le dossier garde aussi les fichiers déjà finis. (Android écrit donc
  directement à la destination : la taille faussée doit être détectée par le contrôle de taille.)
- iOS (`simctl terminate`) : RIEN à la destination (le fichier de ce nom n'existait pas). Le partiel
  (11 730 944 octets) reste dans `tmp/CFNetworkDownload_x51QI2.tmp`, hors du dossier de la zone, et y était
  encore après le relancement de l'app (pas de nettoyage par l'app).
- Dans les deux cas : jamais de fichier « complet » trompeur ; la taille suffit à le détecter sur Android.

## 6. expo-network (`type`)
- iOS (simulateur, réseau du Mac) : `WIFI` (isConnected true, isInternetReachable true), au lancement et par écouteur.
- Android, normal : `WIFI`. Après `svc wifi disable` seul (données actives) : brève valeur `NONE` puis
  `CELLULAR` en 0,3 s ; après `svc wifi enable` : `WIFI`. Wifi et données coupés : `NONE`,
  isConnected false. Après remise : `CELLULAR` puis `WIFI` (5 s), événement `WIFI` parfois en double.
```
[E1] ios t=1793005461649 net-event {"type":"WIFI","isInternetReachable":true,"isConnected":true}
[E1] android t=1793006375138 net-event {"isInternetReachable":false,"type":"NONE","isConnected":false}
[E1] android t=1793006375425 net-event {"isInternetReachable":true,"type":"CELLULAR","isConnected":true}
[E1] android t=1793006390806 net-event {"isInternetReachable":true,"type":"WIFI","isConnected":true}
```

## Repli `createDownloadResumable` (legacy)
Non nécessaire : les points 1 et 3 passent. Le code d'essai l'a prévu (bouton « legacy »), non lancé.

## Limites
- Débit machine élevé : pas de test sur réseau lent réel. Pas de test en arrière-plan.
- Build de développement, pas « release ».
