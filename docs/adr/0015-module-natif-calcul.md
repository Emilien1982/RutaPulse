# ADR 0015 — Le module natif de calcul `valhalla-route`

- Statut : Accepté le 2026-10-27 par Émilien
- Date : 2026-10-27 (phase 3, tâche T1 de [p03-module-calcul](../phases/p03-module-calcul.md))
- Précise l'ADR 0002 (fonctions du module). Modifie le tableau de
  dépendances de l'[ADR 0014](0014-dossier-shared-data.md).

ADR veut dire « Architecture Decision Record » (fiche de décision
d'architecture).

## Contexte

- Valhalla tourne dans le téléphone grâce à valhalla-mobile 0.6.4
  (ADR 0002). C'est la dernière version publiée (Maven, 6 octobre 2026).
  Notre module natif `mobile/modules/valhalla-route/` fait le pont avec
  TypeScript, par l'Expo Modules API.
- **Essai jetable T1, 27 octobre 2026** (branche locale
  `claude/p03-essai-installation`, commit 19b6484) :
  - iOS : la podspec (fiche qui décrit un pod CocoaPods) appelle
    `spm_dependency(s, url: 'https://github.com/Rallista/valhalla-mobile',
    requirement: { kind: 'exactVersion', version: '0.6.4' }, products:
    ['Valhalla'])`. Ni copie locale, ni script.
  - Android : Maven (dépôt de bibliothèques Java),
    `io.github.rallista:valhalla-mobile:0.6.4`, `valhalla-models:0.6.0`,
    `valhalla-models-config:0.6.0`.
  - Depuis un clone neuf : `npm ci`, `npx expo prebuild --clean`, puis
    `npx expo run:ios --device "iPhone 17"` et `npx expo run:android`.
    Les deux compilent, sans autre commande. Forêt de Haye, 2 points :
    5,918 km sur les deux. Calcul 129 ms (iOS) et 70 ms (Android).
    Ouverture 55 ms (iOS) et 2 086 ms (Android, version de développement).
  - **Le blocage de SwiftPM de l'essai 1 venait du bac à sable (sandbox)
    du terminal de Claude Code.** Il empêche SwiftPM (gestionnaire de
    paquets Swift) de télécharger `valhalla-wrapper.xcframework.zip`
    (21,9 Mo). Hors bac à sable, `swift package resolve` réussit en 48 s.
    Une fois le binaire dans le cache de SwiftPM
    (`~/Library/Caches/org.swift.swiftpm/artifacts`), il réussit aussi
    dans le bac à sable, en 1 s. Un humain ou la CI (vérification
    automatique sur GitHub) n'ont pas de bac à sable.
- Essai 1 : ouverture du moteur sur Android 7 s en développement, 1,1 s en
  version finale.

## Décision

### 1. Fonctions exposées à TypeScript

`mobile/modules/valhalla-route/index.ts`, une enveloppe fine :

```ts
open(tarPath: string, elevationDir: string): Promise<void>
close(): Promise<void>
route(requestJson: string): Promise<string>
```

- Le JSON (format texte de données) de Valhalla passe **sans
  transformation**, dans les deux sens (ADR 0002).
- Les chemins sont des chemins de fichier simples (sans `file://`),
  recalculés depuis `Paths.document` à chaque ouverture (ADR 0013).
- `traceAttributes(requestJson)` s'ajoutera **en phase 5** (type de voie,
  ADR 0005), sur le même modèle que `route`. Pas avant : il ne serait pas
  testé.
- `height` est abandonné : le profil d'altitude vient de `route` avec
  `elevation_interval` (ADR 0005).
- **Mis à jour le 2026-10-28** : `height` et `traceAttributes` sont ajoutés
  en phase 5, sur le modèle de `route` ; le profil vient de `height`
  (ADR 0017).
- La conversion en types à nous se fait **dans `core/routing/`** :
  construction de la requête (réglage C4 de l'ADR 0002) et lecture de la
  réponse (tracé décodé, distance, durée). Ce code se teste sans
  téléphone.

### 2. Fil d'exécution (thread)

- Les trois fonctions sont des `AsyncFunction` (fonctions asynchrones
  d'Expo), sur la file (queue) par défaut. Jamais sur le fil de
  l'interface, ni sur celui de JavaScript (doc Expo).
- Code lu : par défaut, cette file est **un seul fil, partagé par tous les
  modules Expo** (`expo.modules.AsyncFunctionQueue`, file série sur iOS,
  `HandlerThread` sur Android). Les appels passent donc un par un.
- **Un seul calcul à la fois**, et on ne compte pas seulement sur ce
  détail d'Expo :
  - valhalla-mobile 0.6.4 dit lui-même que son moteur C++ « n'est pas sûr
    depuis plusieurs fils à la fois ». Il sérialise chaque appel par un
    verrou (`NSLock` sur iOS, `synchronized` sur Android). Le calcul
    tourne sur un fil à lui, avec une pile de 16 Mo.
  - Notre module garde **un verrou** autour de sa référence au moteur
    (ouvrir, fermer, lire).
  - `core/routing/` envoie les demandes l'une après l'autre (§ 4).
- Conséquence connue : pendant l'ouverture (1,1 s sur Android en version
  finale, essai 1), les autres fonctions asynchrones d'Expo attendent.
  C2 le mesure. Si ça gêne, on passe le module sur une file à lui
  (`.runOnQueue` sur iOS, `Coroutine` sur Android), sans changer
  l'interface TypeScript.

### 3. Ouverture, fermeture, changement de zone

- **Une seule instance du moteur à la fois.** `open` ferme l'instance
  précédente avant d'ouvrir la nouvelle.
- `open` vérifie que `valhalla_tiles.tar` existe, puis crée le moteur.
  Échec : erreur `ERR_ZONE_UNREADABLE` (§ 5).
- `close` libère le moteur. Sans effet s'il est déjà fermé. Le module
  ferme aussi le moteur à sa destruction (`OnDestroy`).
- Rien de spécial quand l'app passe en arrière-plan : le moteur reste
  ouvert.
- La zone du moteur est **la zone affichée par la carte** (ADR 0013, § 8).
  Elle change quand une zone est installée ou supprimée : on ferme, puis
  on ouvre la nouvelle. Plus de zone : on ferme.

### 4. Cycle de vie côté TypeScript, et qui importe le module

| Endroit | Contenu |
|---|---|
| `core/routing/` | Requête, lecture de la réponse, erreurs (§ 5). Le moteur logique : état (fermé, ouverture, ouvert, en échec), zone courante, **file d'attente** des demandes. Le module natif lui est passé en paramètre, comme les opérations de `downloadZone` (ADR 0013). Testé avec un faux module |
| `shared-data/routing/` | **Le seul importateur de `@modules/valhalla-route`.** Une seule instance du moteur logique pour toute l'app, branchée sur le vrai module. Un hook qui suit la zone affichée (`useInstalledZones`, `pickActiveZone`) et ouvre ou ferme le moteur. Une fonction de calcul pour les écrans |
| `features/shell/` | Un composant sans affichage, monté dans `app/_layout.tsx` à côté de `ZoneDownloaderStarter`, qui appelle ce hook. Le moteur s'ouvre donc au démarrage, quel que soit l'onglet |
| `features/map/` | Phase 3 : départ, arrivée, appel du calcul, affichage. L'écran d'itinéraire fera de même plus tard |

- **Calcul demandé pendant l'ouverture (C2)** : la demande attend dans la
  file, puis part dès que le moteur est ouvert. Si l'ouverture échoue, elle
  reçoit l'erreur de l'ouverture.
- Un calcul en cours pendant un changement de zone se termine sur
  l'ancienne zone. Les demandes suivantes partent sur la nouvelle.
- Phase 4 (recalcul en direct) : l'abandon des demandes périmées
  s'ajoutera dans `core/routing/`, sans toucher au module natif.

**Pourquoi `shared-data/` :** le moteur est un état natif unique. La Carte
s'en sert en phase 3, l'écran d'itinéraire et le suivi plus tard. Une
fonctionnalité ne peut pas en importer une autre, et `core/` n'importe pas
de module natif. `shared-data/` branche déjà la logique de `core/` sur les
API du téléphone (ADR 0014) : le module natif en est une. Un seul
importateur évite qu'un écran ferme le moteur dans le dos des autres.

Règle de dépendance, qui remplace le tableau de l'ADR 0014 (changements
en gras) :

| Dossier | Peut importer | Ne doit pas importer |
|---|---|---|
| `src/app/` | `features/`, `expo-router`, bibliothèques | `core/`, `ui/`, `shared-data/`, `modules/` |
| `src/features/<x>/` | `ui/`, `core/`, `shared-data/`, bibliothèques | une autre fonctionnalité, **`modules/`** |
| `src/shared-data/` | `core/`, **`modules/`**, bibliothèques (`expo-*`, TanStack, React pour les hooks) | `features/`, `ui/`, `app/` |
| `src/ui/` | `core/`, React, React Native | `features/`, `shared-data/`, `modules/` |
| `src/core/` | `core/`, bibliothèques en TypeScript pur | React, React Native, `expo-*`, `modules/`, `shared-data/` |
| `modules/` | ses fichiers, `expo`, `expo-modules-core` | tout `src/` |

ESLint (contrôle du code), dans `mobile/eslint.config.js` :
- le groupe `modules` ajoute `@modules` et `@modules/*`. **Sans cet ajout,
  l'alias passe à travers toutes les interdictions** : les motifs actuels
  (`@/modules`, `**/modules`) ne reconnaissent pas `@modules/…` ;
- `src/shared-data/**` n'interdit plus `modules` ;
- `src/features/**` interdit `modules`, avec le message « Seul
  shared-data/ importe un module natif (ADR 0015) ».

### 5. Erreurs

Le module distingue deux cas.

**Valhalla refuse la demande** : `route` **réussit** et renvoie le JSON
d'erreur de valhalla-mobile, `{"code": <n>, "message": "…"}`. C'est la
forme que produit son code C++. Mais ses deux enveloppes la transforment
en exception : le module la remet en JSON.
- iOS : `ValhallaError.valhallaError(code, message)`, code lisible.
- Android : `ValhallaException.Internal` ne garde pas le code ; il est
  seulement dans le texte du message (`response.toString()`). Le module
  l'y relit. Code introuvable : `-1`.

**Le module ne peut pas répondre** : la promesse est rejetée avec un code
stable (`error.code` côté JavaScript, convention d'Expo).

| Code natif | Quand |
|---|---|
| `ERR_ENGINE_NOT_OPEN` | `route`, `height` ou `traceAttributes` sans moteur ouvert, ou après `close` |
| `ERR_ZONE_UNREADABLE` | `open` : fichier absent, configuration refusée |
| `ERR_ENGINE` | Toute autre erreur native imprévue |

`core/routing/` convertit tout en une sorte d'erreur à nous. L'écran
affiche le texte par `t()`, une clé par sorte, dans `core/i18n/fr.ts`.
Une erreur n'est jamais levée jusqu'à l'écran sans être convertie (C6 :
jamais de plantage).

| Sorte | Vient de | Idée du message (texte final en T4) |
|---|---|---|
| `outOfZone` | Point hors du rectangle de la zone, contrôlé **avant** l'appel (`isInsideBbox`) ; ou Valhalla **171** | « Point hors de votre zone » (maquette 52) |
| `noRoute` | Valhalla **442**, **441**, **170** | « Aucun chemin trouvé entre ces points » |
| `engineUnavailable` | Aucune zone prête, ou `ERR_ENGINE_NOT_OPEN` | « Téléchargez une zone pour calculer un itinéraire » |
| `zoneUnreadable` | `ERR_ZONE_UNREADABLE` | « Zone illisible : supprimez-la puis téléchargez-la à nouveau » |
| `failed` | Autre code Valhalla, `ERR_ENGINE`, réponse illisible | « Calcul impossible. Réessayez » |

Codes Valhalla (doc de l'API) : 171 « No suitable edges near location »
(aucune voie près du point ; Valhalla cherche jusqu'à 35 km, donc dans
une zone c'est un point hors des tuiles), 170 « Locations are in
unconnected regions », 441 « Location is unreachable », 442 « No path could
be found for input ». Le 443 concerne le recalage d'une trace
(`trace_attributes`, phase 5), pas `route`.

### 6. Distribution reproductible

- **iOS** : `spm_dependency` dans la podspec, version exacte 0.6.4, adresse
  distante. SwiftPM vérifie l'empreinte SHA-256 du binaire, écrite dans le
  `Package.swift` de valhalla-mobile. La référence se retrouve dans
  `ios/Pods/Pods.xcodeproj`, généré : rien à garder à part dans git.
- **Android** : les trois paquets Maven, versions exactes, dans le
  `build.gradle` du module.
- **Dépendances de valhalla-mobile sur iOS, non figées par nous** :
  `valhalla-openapi-models-swift` (0.6.x), `Light-Swift-Untar` (1.x),
  `swift-docc-plugin` (1.x, outil de documentation, absent de l'app).
  **Accepté** : les écarts permis sont des corrections sans rupture, sur
  de petites bibliothèques. Pas de `Package.resolved` gardé : `ios/` est
  généré. Parade simple : à chaque compilation iOS depuis un clone neuf
  (C1, puis à chaque phase), le testeur **note les versions résolues** dans
  le compte rendu, lues dans le `Package.resolved` qu'Xcode écrit sous
  `ios/`. Une panne iOS inexpliquée commence par comparer ces versions.
  Si une dérive gêne un jour, on les figera par un ADR, après un essai.
- **Changer de version de valhalla-mobile** : deux nombres à changer
  (podspec et `build.gradle`), puis C1 et C5 à refaire. L'enveloppe fine
  (§ 1) garde la porte ouverte à un Valhalla compilé par nous (risque 3
  de la spec).

**Règle pour les agents.** Une compilation iOS qui doit télécharger un
binaire SwiftPM absent du cache **bloque dans le bac à sable** (premier
passage, ou nouvelle version de valhalla-mobile). Signe : la résolution
des paquets reste sur le téléchargement du binaire. L'agent :
1. s'arrête sur iOS et continue ce qui ne dépend pas d'iOS (Android) ;
2. envoie au pilotage le paquet et le binaire en cause, avec la demande :
   « lancer une fois `npx expo run:ios --device "iPhone 17"` dans un vrai
   terminal, pour remplir le cache » ;
3. **ne contourne pas** : ni copie locale du paquet, ni chemin local dans
   la podspec, ni téléchargement à la main dans le cache, ni réglage du
   bac à sable.

### 7. Alias d'import et imitation sous Jest

- **Alias `@modules/*`** vers `mobile/modules/*`, dans `tsconfig.json` et
  `jest.config.js` : accepté. Il suit la forme de `@/`, et Metro lit les
  alias de `tsconfig.json` (l'essai T1 compile et tourne).
- **Enveloppe toute dans `index.ts`** : acceptée. La règle ESLint interdit
  à `modules/` d'importer `src/`, y compris le sien. Pour une enveloppe de
  trois fonctions, un fichier suffit ; pas d'exception dans la règle.
- **Imitation (mock) globale dans `jest.setup.js`** : acceptée. Tout écran
  qui importe `shared-data/routing/` charge le module natif, absent sous
  Jest. Les tests de `core/routing/` n'en dépendent pas : ils reçoivent
  un faux module en paramètre.

## Alternatives rejetées

- **Copie locale de valhalla-mobile (essai 1)** : 91 Mo hors de git, un
  script à lancer, et elle masquait la vraie cause (le bac à sable).
- **Binaire valhalla-mobile rangé dans git** : 22 Mo de binaire dans un
  dépôt public, à remplacer à chaque version, alors que SwiftPM vérifie
  déjà l'empreinte.
- **Figer dès maintenant les dépendances Swift de valhalla-mobile** (par
  des `spm_dependency` en version exacte) : non éprouvé, pour un risque
  faible. Gardé en réserve.
- **Fonctions natives qui renvoient des objets typés** : enveloppe épaisse,
  à réécrire deux fois (Swift et Kotlin). L'ADR 0002 choisit le JSON brut.
- **Rejeter la promesse pour un refus de Valhalla** : il faudrait un code
  par cas Valhalla dans le module natif. Le JSON d'erreur garde le module
  fin et range la règle dans `core/`, testée.
- **Le moteur dans `features/map/`** : l'écran d'itinéraire et le suivi ne
  pourraient pas s'en servir. **Le module importé par chaque
  fonctionnalité** : plusieurs propriétaires d'un seul moteur natif.
- **File native à part dès maintenant** : utile seulement si l'attente des
  autres modules gêne. C2 le dira.
- **Calculs en parallèle** : le moteur C++ ne le permet pas.

## Conséquences

- Positif : C1 est acquis sans manipulation. Le module tient en trois
  fonctions par plateforme ; la logique est dans `core/`, testée.
- Positif : un seul endroit importe le module natif, et ESLint le vérifie.
- Négatif : sur Android, la lecture du code d'erreur dépend du texte d'une
  exception de valhalla-mobile. À revérifier à chaque changement de
  version (contrôle ci-dessous).
- Négatif : la première compilation iOS d'un agent, ou d'une nouvelle
  version, demande un passage humain.
- Négatif : les dépendances Swift de valhalla-mobile peuvent bouger dans
  leurs limites. Elles sont notées à chaque phase.
- Une zone effacée pendant que le moteur l'utilise (nouvelle version
  installée) : le système garde les fichiers ouverts jusqu'à la fermeture,
  qui suit aussitôt. À vérifier en T5 : supprimer la zone ouverte, sans
  plantage.
- À l'acceptation : l'ADR 0014 reçoit la mention « tableau remplacé par
  l'ADR 0015 ».

## Contrôles avant de bâtir dessus

- **Début de T2, sur les deux simulateurs** : trois appels directs au
  module. Un point hors des tuiles (code 171 attendu), deux points sans
  chemin entre eux (442 ou 170), un `route` après `close`
  (`ERR_ENGINE_NOT_OPEN`). Il prouve surtout la relecture du code sur
  Android.
- **C2, en version finale Android** : temps d'ouverture, et temps
  d'attente d'une autre fonction Expo lancée pendant l'ouverture.
- **C1** : versions Swift résolues notées.

## Sources (relevées le 27 octobre 2026)

- valhalla-mobile, versions Maven (dernière : 0.6.4, 6 octobre 2026) :
  https://repo1.maven.org/maven2/io/github/rallista/valhalla-mobile/maven-metadata.xml
- valhalla-mobile 0.6.4, fil à part et sérialisation par la couche du
  dessus : https://github.com/Rallista/valhalla-mobile/blob/0.6.4/src/wrapper/valhalla_actor.cpp
- JSON d'erreur `{"code","message"}` :
  https://github.com/Rallista/valhalla-mobile/blob/0.6.4/src/wrapper/main.cpp
- Enveloppe iOS (`NSLock`, `ValhallaError.valhallaError`) :
  https://github.com/Rallista/valhalla-mobile/blob/0.6.4/apple/Sources/Valhalla/Valhalla.swift
- Enveloppe Android (`synchronized`, `ValhallaException.Internal`) :
  https://github.com/Rallista/valhalla-mobile/blob/0.6.4/android/valhalla/src/main/java/com/valhalla/valhalla/ValhallaActor.kt,
  https://github.com/Rallista/valhalla-mobile/blob/0.6.4/android/valhalla/src/main/java/com/valhalla/valhalla/Valhalla.kt,
  https://github.com/Rallista/valhalla-mobile/blob/0.6.4/android/valhalla/src/main/java/com/valhalla/valhalla/ValhallaException.kt
- Dépendances Swift de valhalla-mobile :
  https://github.com/Rallista/valhalla-mobile/blob/0.6.4/Package.swift
- Expo, `AsyncFunction` et `.runOnQueue` : https://docs.expo.dev/modules/module-api/
- Expo, file par défaut sur iOS :
  https://github.com/expo/expo/blob/main/packages/expo-modules-core/ios/Core/Functions/AsyncFunctionDefinition.swift
- Expo, file par défaut sur Android :
  https://github.com/expo/expo/blob/main/packages/expo-modules-core/android/src/main/java/expo/modules/kotlin/AppContext.kt,
  https://github.com/expo/expo/blob/main/packages/expo-modules-core/android/src/main/java/expo/modules/kotlin/functions/AsyncFunctionComponent.kt
- Valhalla, codes d'erreur, `search_cutoff`, `elevation_interval` :
  https://valhalla.github.io/valhalla/api/route/api-reference/
- `spm_dependency` de React Native (depuis la 0.75) :
  https://www.callstack.com/blog/integrating-swift-package-manager-with-react-native-libraries
