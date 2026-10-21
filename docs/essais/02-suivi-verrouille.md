# Essai 2 — Suivi téléphone verrouillé : résultats

> 20 octobre 2026. Spec : [02-suivi-verrouille-spec.md](02-suivi-verrouille-spec.md).
> Code jetable : `essais/02-suivi-verrouille/` (app, outils, preuves).
> Décision éprouvée : [ADR 0006](../adr/0006-suivi-arriere-plan-notification.md).

## Verdict

**Android : oui.** Sur une heure, app en arrière-plan et écran verrouillé,
le suivi ne s'arrête pas et la notification du service est l'indication,
mise à jour en moins de 2 s, toujours seule. L'ADR 0006 tient, avec deux
corrections (profil de localisation, permission d'arrière-plan
obligatoire).

**iOS : oui.** Sur une heure, écran verrouillé, le suivi ne s'arrête pas
et la Live Activity (bandeau en direct) affiche l'indication sur l'écran
verrouillé. Elle est mise à jour en 1 s au plus et reste toujours seule.
Un accord de plus est demandé à l'utilisateur : « Autoriser les activités
en direct ».

| # | Critère | Attendu | Android (mesuré) | iOS (mesuré) | Verdict | Preuve |
|---|---|---|---|---|---|---|
| C1 | Positions, verrouillé et en arrière-plan | ≥ 1 par 5 s en moyenne, aucun trou > 30 s, 1 h | 3 581 positions sur 3 590 s ; 4,99 par 5 s ; plus grand trou 2,4 s | Écran verrouillé : 3 600 positions sur 3 600 s ; 5,00 par 5 s ; plus grand trou 1,1 s | **oui** | `preuves/android-1h-rejeu2/analyse.md`, `preuves/ios-1h-verrouille/analyse.md` |
| C2 | Mise à jour de la notification | < 5 s, sur ≥ 20 changements | 89 changements sur 89 ; médiane 0,8 s ; maximum 1,8 s | 89 changements sur 89, tous vus en 1 s au plus (OCR, reconnaissance de texte, de l'écran verrouillé chaque seconde) | **oui** | idem |
| C3 | Jamais plus d'une notification | ≤ 1 | 1 au plus, sur 3 640 relevés | 1 Live Activity active au plus ; 1 ligne « Indication » au plus par capture | **oui** | idem |
| C4 | Live Activity iOS | Affichée sur l'écran verrouillé, mise à jour | — | Affichée sur l'écran verrouillé, texte complet, mise à jour 89 fois | **oui** | `docs/essais/captures/02-ios-verrouille-*.png` |
| C5 | Signature, compte Apple gratuit | Ce qu'elle demande | — | Voir plus bas : probablement possible, non éprouvé | **noté** | tableau d'Apple, `app/LISEZMOI.md` |
| C6 | Permissions et textes | Liste par plateforme | Voir plus bas | Voir plus bas | **noté** | `preuves/permissions-release.txt` |

Captures de l'écran verrouillé iOS (rejeu d'1 h, 21 octobre) :
`docs/essais/captures/02-ios-verrouille-indication-45.png` (30 min) et
`02-ios-verrouille-indication-89.png` (fin) ; demande d'accord au premier
affichage : `02-ios-demande-activites-en-direct.png`.

Captures de l'écran verrouillé Android (second rejeu d'1 h) :
`docs/essais/captures/02-android-verrouille-indication-15.png` (10 min) et
`02-android-verrouille-indication-89.png` (fin). La seconde carte,
« Serial console enabled », est une notification système de l'émulateur.

## Protocole

- Trace : R3 de l'essai 1 (forêt de Haye), rééchantillonnée à 5 m/s
  (18 km/h), un point par seconde, 3 600 points, 17 928 m. **Rejeu en temps
  réel : 1 h, sans accélération.** Le GPX n'est pas versionné, les journaux
  versionnés sont expurgés des coordonnées.
- Fausse indication : `k = floor(d / 200)`, `d` = distance parcourue sur
  la trace, calculée dans l'app. Texte : « Indication k : <manœuvre> ».
  89 changements sur l'heure. Mise à jour seulement quand `k` change.
- Mesures, toutes à l'heure du Mac :
  - injection de chaque position (`rejouer.sh`, journal horodaté) ;
  - texte de la notification relu chaque seconde (`dumpsys notification`
    sur Android ; capture d'écran + OCR, reconnaissance de texte, sur iOS) ;
  - journal de l'app, une ligne par position reçue (heure de l'appareil).
- `analyser.py` calcule les critères. Il a été éprouvé sur 12 journaux
  fabriqués, dont chaque défaut attendu (trou de 40 s, app tuée en cours,
  deux notifications, délai négatif, palier manquant, deux Live
  Activities).
- Écran Android : verrouillé (cadenas), éteint pendant tout le rejeu,
  sauf 3 s toutes les 10 min pour une capture.
- Appareils : émulateur Pixel 6, Android 14 (`Pixel_6_API_34_arm64`) ;
  simulateur iPhone 17, iOS 26.5. Builds « release ».

## Android en détail

### Deux rejeux d'une heure

| Rejeu | Code | Positions (fenêtre verrouillée) | Moyenne par 5 s | Plus grand trou | C2 : médiane / max | C3 |
|---|---|---|---|---|---|---|
| 1 (19 h 13) | `ae1095f` | 3 416 sur 3 591 s | 4,76 | **37,1 s** | 0,9 s / 2,5 s (89 sur 89) | 1 |
| 2 (22 h 12) | `2f36b6a`, app finale | 3 581 sur 3 590 s | 4,99 | 2,4 s | 0,8 s / 1,8 s (89 sur 89) | 1 |

**Le trou de 37 s du rejeu 1 vient du banc, pas de l'app.** Le Mac
compilait l'app iOS au même moment (19 h 16 à 19 h 28). Le script
d'injection lui-même s'est arrêté : 25,3 s sans envoi à 19 h 27, 20,9 s à
19 h 18. L'observateur s'est figé aux mêmes heures. Sur les 44,6 min
suivantes, sans charge, le rejeu 1 donne 4,97 positions par 5 s et 2,9 s
de trou au plus. Le rejeu 2 a été refait sans autre travail sur le Mac :
retard d'injection maximal 0,32 s. Il a aussi servi à mesurer l'app
finale, dont l'APK avait changé (voir « expo-widgets » plus bas).

### Ce que l'essai a appris

- **La mise à jour de la notification marche en arrière-plan.** La doc
  d'`expo-location/next` dit que `ensureBackgroundSessionStarted` est
  refusée en arrière-plan. Le code natif (`LocationForegroundService`) le
  précise : quand le service tourne déjà, il reposte la notification
  (même id, 1492) avant tout refus. Seul un premier démarrage depuis
  l'arrière-plan est refusé. Le plan B (module natif) n'est pas utile.
- **Profil « fitness » (ADR 0006) inadapté** : sur Android en
  arrière-plan, il vaut 10 s d'intervalle, 25 m de filtre et 2 min de
  délai. L'app utilise `AUTOMOTIVE_NAVIGATION` (1 s, sans filtre). **L'ADR
  0006 est à corriger.** Effet sur la batterie : à mesurer sur un vrai
  téléphone.
- **La permission d'arrière-plan est obligatoire avec ce module.** Essai
  de 5 min sans `ACCESS_BACKGROUND_LOCATION` : `expo-location/next`
  refuse de démarrer (« Background location permissions are not
  granted »), 0 position. C'est la bibliothèque qui bloque, avant
  Android. D'après la doc Android, un service au premier plan lancé depuis
  l'app visible pourrait s'en passer (non éprouvé, demanderait le plan B). Conséquence : la déclaration Google Play de la localisation en
  arrière-plan sera exigée. Preuve :
  `preuves/android-sans-permission-arriere-plan/`.
- **Après un démarrage raté, la notification reste** et l'app ne peut plus
  l'arrêter (« Arrêter » grisé). La v1 devra arrêter la session si le
  suivi ne démarre pas.
- **Une session survit à la fermeture de l'app** : le service garde ses
  options et réaffiche l'ancienne notification. L'app doit relire l'état
  au lancement (`hasStarted()`).
- **Minification R8 (réduction du code en release)** : elle casse le
  consommateur de tâche d'`expo-task-manager`
  (`TaskRegisteringFailedException`). Désactivée pour l'essai ; une règle
  de conservation sera à écrire pour la v1.
- **Écran verrouillé** : la notification est de faible importance (canal
  d'`expo-location`). Sur l'émulateur, il a fallu
  `lock_screen_show_silent_notifications 1` pour la voir sur l'écran
  verrouillé. À vérifier sur un vrai téléphone ; la v1 devra peut-être
  régler l'importance du canal.
- **`expo-widgets` est lié aussi sur Android** (bibliothèques Glance,
  CMake, récepteur de widget) alors qu'il ne sert qu'à iOS. Exclu de la
  liaison Android dans `package.json`.
- **Banc d'essai** : `adb emu geo fix` répond OK mais ne déplace pas la
  position sur l'émulateur 37.1.11 (elle reste à Mountain View). Le rejeu
  passe par le fournisseur de position de test d'Android (`cmd location
  providers set-test-provider-location`), après `appops set 0
  MOCK_LOCATION allow`.

## iOS en détail

### Rejeu d'une heure, écran verrouillé

21 octobre, 1 h 30 à 2 h 31 ; app finale (`2f36b6a`), build Release.
Suivi démarré, app en arrière-plan (bouton Accueil), puis écran
verrouillé (bouton de verrouillage, outil de simulateur). L'écran est
resté verrouillé tout le rejeu. Preuves : `preuves/ios-1h-verrouille/`.

| Mesure | Résultat |
|---|---|
| C1 positions | 3 600 sur 3 600 s ; 5,00 par 5 s ; plus grand trou 1,1 s |
| C2 délai de mise à jour | 89 changements sur 89 ; médiane 1,0 s ; maximum 1,0 s |
| C3 | 1 Live Activity active au plus ; 1 ligne « Indication » au plus par capture |
| Banc | retard d'injection maximal 0,05 s ; observateur : 3 640 relevés, aucun trou de plus de 1,05 s |
| Arrêt | ligne `end`, `actives` = 0 |

Mesure de C2 : l'observateur prend une capture de l'écran verrouillé
chaque seconde et lit le texte par OCR. La résolution est d'1 s : les
délais réels sont inférieurs ou égaux à 1 s. Limite : l'OCR lit « O » au
lieu de « 0 » pour l'indication 0, qui ne compte pas dans la mesure.

**Accord supplémentaire.** Au premier affichage sur l'écran verrouillé,
iOS demande « Autoriser les activités en direct de Essai 2 ? ». L'effet d'un refus n'est pas testé. L'app de la v1 devra le prévoir (explication avant le premier suivi, et
cas du refus).

### Rejeu d'une heure, app en arrière-plan (non verrouillé)

20 octobre, 23 h 21 à 0 h 21 ; app finale (`2f36b6a`), build Release ;
l'app Réglages au premier plan. Preuves : `preuves/ios-1h-arriereplan/`.

| Mesure | Résultat |
|---|---|
| Positions | 3 601 sur 3 600 s ; 5,00 par 5 s ; plus grand trou 1,1 s |
| Retard d'injection maximal (banc) | 0,03 s |
| Live Activity | 1 démarrage, 90 mises à jour (k = 1 à 89), 1 fin ; `actives` = 1 tout du long, 0 après la fin |
| Capture de fin | îlot dynamique « 89 \| Distance pa… » (`ios-fin-arriereplan.png`) |

La 90e mise à jour répète k = 89 : c'est la relance de l'app pour
l'arrêter (crochet de test). L'app reprend alors la Live Activity
existante, sans en créer une seconde.

Hors écran verrouillé, seul l'îlot dynamique compact est visible ; il
montre le numéro mais pas le texte de l'indication.

### Constats

- Positions : `expo-location/next` ignore l'intervalle sur iOS. Il passe
  par `CLLocationUpdate.liveUpdates` (iOS 17 et plus) avec une session
  d'activité en arrière-plan. Mesuré : environ 1 position par seconde
  (302 positions pour 300 s en arrière-plan, plus grand trou 1,2 s).
- Live Activity avec `expo-widgets` 58.0.21 : `createLiveActivity`,
  `start`, `update`, `end`. Démarrée au début du suivi, mise à jour à
  chaque nouvelle indication (environ toutes les 40 s, sans limite du
  système), terminée à l'arrêt. Le journal compte les instances actives
  (`getInstances()`) : 1 au plus.
- Une Live Activity d'un lancement précédent reste affichée, même après un
  redémarrage du simulateur. ActivityKit ne la liste qu'environ 1 s après
  le lancement. L'app attend 1,5 s, puis reprend ou termine les anciennes.
  Sans cela, 2 ou 3 Live Activities étaient actives.

## C5 — Signature avec un compte Apple gratuit

- Ce que l'app demande (fichiers produits par le prebuild) : deux
  identifiants, `fr.vttnav.essai2` (app) et
  `fr.vttnav.essai2.ExpoWidgetsTarget` (extension de widget) ; un App
  Group (groupe d'apps qui partagent des données) `group.fr.vttnav.essai2`
  sur les deux ; une équipe de signature (`DEVELOPMENT_TEAM`, à choisir
  dans Xcode). Pas de droit `aps-environment` : la Live Activity est mise
  à jour par l'app, sans notification push.
- Tableau d'Apple « Supported capabilities (iOS) », colonne « Apple
  Developer » (compte gratuit) : App Groups **oui**, Background Modes
  (modes d'arrière-plan) **oui**, Push Notifications **non**. Les Live
  Activities ne sont pas une capacité à cocher : il suffit de
  `NSSupportsLiveActivities` dans l'`Info.plist`.
- Limites du compte gratuit (Apple) : 10 identifiants d'app au plus,
  valables 7 jours ; profils de signature valables 7 jours, donc
  réinstallation chaque semaine ; 3 appareils de test.
- **Conclusion : la signature gratuite semble possible, sans rien
  acheter.** Non éprouvé : le simulateur ne vérifie aucune signature.
  Reste à vérifier sur un vrai iPhone (déjà noté dans `PILOTAGE.md`).
- Mise à jour à distance de la Live Activity (push) : impossible avec le
  compte gratuit. Ce n'est pas un besoin : l'app tourne en arrière-plan.

## C6 — Permissions

### Android (manifeste de l'APK release, `aapt dump permissions`)

| Permission | Pourquoi | Demandée à l'utilisateur ? |
|---|---|---|
| `ACCESS_FINE_LOCATION`, `ACCESS_COARSE_LOCATION` | Position | Oui, fenêtre système |
| `ACCESS_BACKGROUND_LOCATION` | Exigée par `expo-location/next` pour le suivi en arrière-plan (prouvé) | Oui ; depuis Android 11, sur la page des réglages (« Toujours autoriser ») |
| `FOREGROUND_SERVICE`, `FOREGROUND_SERVICE_LOCATION` | Service au premier plan de type « location » | Non |
| `POST_NOTIFICATIONS` | Afficher la notification (Android 13 et plus) | Oui, fenêtre système. Refusée : le service tourne mais la notification est invisible |
| `RECEIVE_BOOT_COMPLETED` | Ajoutée par `expo-location/next` | Non |
| `INTERNET`, `VIBRATE`, `SYSTEM_ALERT_WINDOW`, `READ/WRITE_EXTERNAL_STORAGE` (≤ Android 12) | Gabarit Expo, inutiles ici | Non ; à retirer en v1 |

Règles de Google Play (relevées le 20 octobre 2026) :
- **Localisation en arrière-plan** : formulaire dans la Play Console (App
  content → Sensitive app permissions → Location permissions), une seule
  fonction déclarée, vidéo de 30 s au plus qui montre la fonction.
- **Divulgation visible dans l'app**, avant la fenêtre système : elle doit
  contenir le mot « localisation », dire que l'usage continue « quand
  l'app est fermée ou non utilisée », et citer la fonction. Forme
  conseillée par Google : « [App] collecte des données de localisation
  pour permettre [fonction], même quand l'app est fermée ou non
  utilisée. » Proposition pour RutaPulse : « RutaPulse utilise votre
  position pour vous guider sur votre itinéraire et afficher la prochaine
  indication, même quand l'écran est verrouillé ou que l'app est fermée. »
- **Service au premier plan de type « location »** : déclaration à part,
  cas d'usage « navigation », vidéo, et description de l'effet si le
  système retarde ou interrompt le service.

### iOS (`Info.plist` produit)

| Clé | Rôle | Texte de l'essai |
|---|---|---|
| `NSLocationWhenInUseUsageDescription` | Position app ouverte | « Essai 2 utilise votre position pour afficher la prochaine indication. » |
| `NSLocationAlwaysAndWhenInUseUsageDescription`, `NSLocationAlwaysUsageDescription` | Position app en arrière-plan (« Toujours ») | « Essai 2 suit votre position, même écran verrouillé, pour afficher la prochaine indication. » |
| `NSLocationTemporaryUsageDescriptionDictionary` | Précision maximale temporaire | « … a besoin de votre position précise … » |
| `NSMotionUsageDescription` | Exigée par le plugin d'`expo-location`, non utilisée | À supprimer en v1 si possible |
| `UIBackgroundModes` : `location` (et `fetch`, ajouté par `expo-task-manager`) | Suivi en arrière-plan | — |
| `NSSupportsLiveActivities` | Live Activity | — |

Accords demandés à l'utilisateur sur iOS : la localisation (« lorsque
l'app est active », puis « toujours »), et les activités en direct, à leur
premier affichage sur l'écran verrouillé (constaté sur le simulateur).

Règles de l'App Store : textes d'explication clairs et complets
(5.1.1), localisation seulement pour une fonction de l'app (5.1.5),
arrière-plan seulement pour son usage prévu, dont la localisation (2.5.4),
pas de consommation excessive de batterie (2.4.2). Notifications : iOS
demande l'accord pour les notifications classiques ; pour une Live Activity démarrée
par l'app, aucune fenêtre d'accord n'est apparue sur le simulateur ;
l'utilisateur peut la désactiver dans les réglages (non éprouvé).

## Ce qui n'est pas vérifié

- Le refus de « Autoriser les activités en direct » : comportement de
  l'app non testé.
- La signature gratuite sur un vrai iPhone (C5).
- Un vrai téléphone : économies d'énergie des fabricants (Samsung,
  Xiaomi…), mode Doze (veille profonde) sur batterie (l'émulateur est
  « branché »), précision du GPS, batterie (déjà dans `PILOTAGE.md`).
- La durée au-delà d'une heure.

## Outils installés

Aucun nouvel outil. Le Mac avait déjà tout (SDK Android, Xcode, Node,
Python 3). Paquets npm de l'app dans `app/node_modules` (ignoré par git).
Sur l'émulateur : un fournisseur de position de test « gps » et
l'autorisation `MOCK_LOCATION` pour le shell (`adb root`). Réglage de
l'émulateur : notifications silencieuses visibles sur l'écran verrouillé.
