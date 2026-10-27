# ADR 0016 — L'itinéraire en création : modèle, recalcul par tronçon, glisser, plein écran

- Statut : Proposé le 2026-10-27 (à accepter par Émilien, via le pilotage)
- Date : 2026-10-27 (phase 4, tâche T1 de [p04-creer-modifier-itineraire](../phases/p04-creer-modifier-itineraire.md))
- Précise l'[ADR 0007](0007-donnees-locales-et-etat.md) (clé de Query,
  Pacer) et l'[ADR 0015](0015-module-natif-calcul.md) (code 171, abandon
  des demandes). Suit ses règles d'import, sans les changer.

ADR veut dire « Architecture Decision Record » (fiche de décision
d'architecture).

## Contexte

- La spec validée fait foi : 15 critères (C1 à C15) et 4 choix faits.
- Phase 3 : un départ, une arrivée, un calcul, dans
  `features/map/useRouteCreation.ts`. Le moteur a une file d'attente : un
  calcul à la fois (ADR 0015).
- **Essai jetable T1**, en version finale (release)
  ([LISEZMOI](../phases/preuves/p04/t1-essai/LISEZMOI.md)) :
  - `@tanstack/react-pacer` 0.24.1 marche sous React Native. `useThrottler`
    (limiteur de cadence) à 200 ms tient 5 calculs par seconde ;
  - `ViewAnnotation` `draggable` de MapLibre 11.5.0 marche sur les deux
    plateformes, carte fixe. Sur iOS, un appui long (≈ 0,5 s) précède le
    glisser. La position juste est celle de l'événement de fin ;
  - arrêt maximal du fil JavaScript : iOS 25 à 30 ms, Android 84 à 88 ms
    (témoin sans geste : 35 ms). Seuil C11 : 100 ms ;
  - `search_cutoff: 200` fait refuser par Valhalla un point à plus de
    200 m d'un chemin, code 171. `radius` ne refuse rien.

## Décision

### 1. Le modèle, en logique pure dans `core/draft/`

« Tracé en création » se dit `draft` dans le code (ADR 0011).

```ts
type LegMode = 'path' | 'hand';  // par les chemins / à la main
type DraftPoint = { id: number; lon: number; lat: number };
type Draft = { points: DraftPoint[]; modes: LegMode[] }; // modes[i] : tronçon i -> i+1
type DraftState = { draft: Draft; past: Draft[]; nextMode: LegMode; selected: number | null; nextId: number };
// DraftAction : add, move, remove, loop, setLegMode, undo ; chooseMode et select (hors historique)
function reduceDraft(state: DraftState, action: DraftAction): DraftState;
function summarize(draft: Draft, legs: (LegResult | undefined)[]): { distanceKm: number; durationS: number };
```

- **Ajouter** : le point va à la fin ; son tronçon prend `nextMode`.
- **Déplacer** : une action, au relâchement seulement (§ 4).
- **Supprimer** un point du milieu : ses voisins sont reliés par un
  tronçon. Il est « à la main » si les deux tronçons retirés l'étaient,
  sinon « par les chemins ». Supprimer le départ ou l'arrivée retire aussi
  son tronçon.
- **Boucler** : copie du départ à la fin (nouvel `id`), avec `nextMode`.
  Sans effet sous 2 points.
- **Changer le mode d'un tronçon** (`setLegMode`) : pour « Relier ce point
  à la main » (§ 5).
- **Annuler** : reprend le dernier `Draft` de `past`. Pas de « Rétablir ».
- **Dans l'historique** : une copie de `Draft` (points et modes) avant
  chaque action, 50 au plus ; au-delà, la plus ancienne part.
- **Hors de l'historique** : `nextMode`, le point choisi, et **les
  résultats des calculs**. Après « Annuler », ils reviennent du cache de
  Query (§ 3) : la clé d'un tronçon ne dépend que de ses points et de son
  mode.
- **Somme** des tronçons connus :
  - calculé : distance et durée du moteur. Le moteur part des points
    recalés, donc la liaison en pointillés n'est pas comptée (C8) ;
  - à la main : distance à vol d'oiseau (`distanceMeters`, déjà dans
    `core/routing/routeLink.ts`). Durée à la vitesse moyenne des tronçons
    calculés, ou 10 km/h sans tronçon calculé (`HAND_SPEED_KMH`) ;
  - « 1 min » au minimum : déjà dans `formatDuration`.

### 2. Où vit chaque morceau

| Dossier | Contenu |
|---|---|
| `core/draft/` | `reduceDraft`, `summarize`, `handLeg` (tronçon à la main), tests Jest |
| `core/routing/` | `search_cutoff` et `MAX_SNAP_METERS` (§ 5) ; sorte d'erreur `farFromPath` ; demande sautée si son `AbortSignal` (signal d'abandon) est coupé (§ 4) |
| `shared-data/routing/` | `computeRoute(points, signal?)` : seul changement |
| `features/map/` | L'écran de création, son Store, les requêtes par tronçon, l'aperçu du glisser, les couches, la barre d'outils, les feuilles |
| `app/` | `draft.tsx` (fichier mince) et sa ligne dans `app/_layout.tsx` (§ 6) |

- **L'écran reste dans `features/map/`** : il a besoin du fond de carte
  (style, caméra, polices) de cette fonctionnalité. Ce fond sort de
  `ZoneMap.tsx` en un composant du même dossier, pour les deux écrans.
- `useRouteCreation.ts` et la création dans `ZoneMap.tsx` disparaissent.
  « Nouvel itinéraire » ouvre `/draft`.
- **L'état vit dans un TanStack Store** (magasin d'état), créé à
  l'ouverture de l'écran, jeté à sa fermeture. Tout changement passe par
  `reduceDraft`. Raisons :
  - les événements natifs du glisser et les feuilles lisent l'état courant
    tout de suite (`store.state`), sans copie dans une `ref` (référence),
    le piège de la phase 3 ;
  - un composant ne se redessine que si sa part change (sélecteur de
    `useStore`) : utile pour C11 ;
  - c'est le rôle donné à Store par l'ADR 0007.
- Le Store reste dans `features/map/` tant qu'un seul écran s'en sert
  (ADR 0014).

### 3. Le recalcul par tronçon, avec TanStack Query

- **Une requête au moteur par tronçon « par les chemins »**, avec 2
  points. `buildRouteRequest` garde sa signature : avec 2 points, les deux
  sont déjà `break`. Il gagne seulement `search_cutoff` (§ 5).
- Un tronçon « à la main » n'appelle pas le moteur : `handLeg`, sans
  attente.
- Un hook (fonction React réutilisable) `useLegResults` appelle
  `useQueries`, une requête par tronçon calculé :
  - clé : `['routing', 'leg', zone.id, zone.version, 'path', from.lon, from.lat, to.lon, to.lat]`.
    Avec la zone : un changement de zone recalcule ;
  - `queryFn` : `computeRoute([from, to], signal)`. Un succès est la
    donnée. Un échec est levé comme erreur : jamais gardé comme résultat,
    recalculé la prochaine fois qu'on en a besoin ;
  - `staleTime: Infinity` (un tronçon calculé ne change pas),
    `gcTime: 30 min` (durée de vie d'un résultat inutilisé ; 5 min par
    défaut), `retry: false`, `networkMode: 'always'`,
    `refetchOnReconnect: false`.
- Effet : ajouter calcule 1 tronçon (C2), déplacer 2, supprimer 1.
  Annuler retrouve des clés en cache : 0 calcul (C5).
- **Taille du cache** : les tronçons affichés, plus 2 par action de
  l'historique, soit environ 150 entrées de quelques kilo-octets. Moins de
  2 Mo : pas de limite à ajouter.
- Un tronçon devenu inutile avant sa réponse (annulé) : Query coupe son
  signal, et le moteur saute la demande.

### 4. Le glisser

- Chaque point est une `ViewAnnotation` `draggable`, numérotée.
- **Pendant le geste** :
  - la position va dans une `ref`, sans `setState` (mise à jour de l'état
    React) par événement ;
  - `useThrottler` (200 ms, `leading` et `trailing` : un calcul en début et
    en fin de fenêtre) calcule les deux tronçons voisins ;
  - **ces calculs passent à côté du cache de Query** (`computeRoute`
    direct). Sinon chaque position intermédiaire y resterait 30 min ;
  - l'aperçu des voisins vit dans l'état local du hook. Un échec garde
    l'ancien tracé du tronçon (C12).
- **Calcul périmé** : chaque calcul a un numéro et son `AbortController`.
  Le suivant coupe le signal du précédent. Dans la file du moteur, une
  demande coupée est sautée à son tour, sans appel natif. Un calcul natif
  déjà parti finit, mais sa réponse est ignorée si son numéro n'est plus
  le dernier. Au plus un calcul en cours et un en attente.
- **Au relâchement** : `cancel()` du limiteur, abandon du calcul en
  cours, puis `move` avec la position **de l'événement de fin** (sur iOS,
  le doigt est 15 pt plus loin). Query calcule les voisins et garde le
  résultat pour « Annuler ». En attendant, l'écran garde le dernier
  aperçu. Un échec ouvre la feuille d'erreur (C12).
- **Couches** : une source GeoJSON (format de données géographiques) pour
  tous les tronçons, le mode en propriété (trait plein ou tirets). Une
  seconde pour l'aperçu. Pendant le geste, seule la seconde change.

### 5. Le seuil de 200 m

- **`search_cutoff: 200`** dans chaque `location`. Valhalla refuse seul,
  en un calcul. Constante unique `MAX_SNAP_METERS = 200`, dans
  `core/routing/routeRequest.ts`.
- **Hors zone et loin d'un chemin sont séparés** :
  - hors zone : test du rectangle **avant** le calcul (déjà dans
    `routingEngine.route`), sorte `outOfZone` ;
  - code 171 : désormais `farFromPath`. Titre « Aucun chemin trouvé »,
    texte sur les 200 m (textes finaux en T5) ;
  - 170, 441, 442 : `noRoute`, inchangé.
- Un point refusé reste dans le modèle, avec un tronçon en échec. La
  feuille vise le point de la dernière action (ajouté, déplacé ; après une
  suppression, l'arrivée du nouveau tronçon) :
  - « Relier ce point à la main » = `setLegMode` « à la main » sur ses
    tronçons en échec, hors zone compris (C9) ;
  - « Retirer ce point » = `remove`. Les deux s'annulent.
- La liaison en pointillés (`linkSegments`, phase 3) se dessine aux deux
  bouts de chaque tronçon calculé.

### 6. Le plein écran avec Expo Router

- `src/app/draft.tsx`, **hors de `(tabs)`** : la pile racine le pose
  au-dessus des onglets, sans leur barre.
- Dans `app/_layout.tsx` : `presentation: 'fullScreenModal'`,
  `headerShown: false`, `gestureEnabled: false`. Sur iOS, rien ne le ferme
  d'un glissement. Sur Android, il s'affiche comme un écran de pile.
- **La croix** appelle `router.back()`. L'écran déclare
  `usePreventRemove(points.length >= 2, …)` (Expo Router, SDK 58), qui
  bloque toute sortie, retour d'Android compris. Il ouvre `Alert.alert`
  (boîte native) « Abandonner cet itinéraire ? ». « Abandonner » appelle
  `repeat()`. Sous 2 points, la croix ferme sans question (C1).

### 7. L'appui long sur iOS

- Sur iOS, glisser demande un appui d'environ 0,5 s (MapLibre). Sur
  Android, le glisser part tout de suite. L'enlever demanderait une autre
  voie, non éprouvée. L'utilisateur doit le savoir : voir Question 1.
- Maestro (outil de test de bout en bout) l'imite par un `swipe` lent.

### 8. Le risque Android (84 à 88 ms pour 100 ms permis)

- **Déjà dans la conception** : pas de `setState` par événement, une
  seule source qui change pendant le geste, sélecteurs du Store.
- **Mesure en T6**, méthode de l'essai (minuteur de 16 ms jusqu'au calcul
  final) : release, 3 gestes par plateforme, itinéraire de 10 points au
  moins, point du milieu glissé, plus un témoin sans geste.
- **Si Android dépasse 100 ms**, dans l'ordre, en remesurant :
  1. cadence de 250 ms (4 calculs par seconde : C3 tenu) ;
  2. un seul voisin en aperçu pendant le geste, l'autre au relâchement ;
  3. sinon, le pilotage décide (par exemple remesurer sur un vrai
     téléphone).

### 9. Pacer en 0.x

- `@tanstack/react-pacer` **0.24.1**, version exacte (sans `^`), publiée
  le 5 octobre 2026. Seule étiquette npm : `latest`. Elle est en 0.x
  plutôt qu'en « bêta » (ADR 0007).
- Pacer ne sert que dans **un hook à nous**, `useDragThrottle`
  (`useThrottler`, `maybeExecute`, `cancel`).
- **Parade** : si Pacer casse, ce hook passe sur une petite fonction
  `createThrottle(wait, now)` de `core/`, testée avec une fausse horloge.
  Un seul fichier change.
- Pacer est en ESM pur (format de module récent). Début de T3 : vérifier
  que Jest le charge, sinon l'ajouter à `transformIgnorePatterns`.

## Alternatives rejetées

- **Une requête à N points** (phase 3) : bouger un point recalcule tout
  (contraire à C2) ; pas de cache tronçon par tronçon pour « Annuler ».
- **Les résultats dans l'historique** : il grossit de milliers de points
  par action, et double le cache.
- **`useReducer`** (état local de React) : marche avec `reduceDraft`, mais
  les événements natifs lisent l'état par une copie dans une `ref`, et
  tout l'écran se redessine à chaque changement.
- **Calculs du glisser dans le cache** : des dizaines d'entrées jamais
  relues.
- **Mesurer la distance au point recalé** (bout du tracé) : marche aussi,
  mais du code en plus pour un seuil que Valhalla tient seul. En réserve si
  le seuil doit varier ou le message donner la distance.
- **`radius`** : ne refuse rien. **`Marker` + `PanResponder`** : ne marche
  sur aucune plateforme (essai).
- **Écran poussé (`card`)** : sur iOS, glisser depuis le bord ferme
  l'écran et gêne la carte.
- **Une fonctionnalité `features/route-draft/` à part** : il faudrait
  d'abord déplacer le fond de carte dans `ui/`, sans second utilisateur.

## Conséquences

- Positif : le cœur (modèle, somme, seuil, file du moteur) se teste sans
  téléphone. Un seul fichier touche Pacer, une seule constante fixe le
  seuil.
- Négatif : 171 change de sens (`farFromPath`). Les tests de la phase 3
  sur `ios-171.json` et `android-171.json` sont à adapter.
- Négatif : les tests `RouteCreation*.test.tsx` de la phase 3 sont à
  réécrire pour le nouvel écran.
- Négatif : `features/map/` grossit ; à découper le jour où une autre
  fonctionnalité affiche une carte.
- À l'acceptation : l'ADR 0007 reçoit la mention « clé de Query par
  tronçon et version de Pacer : ADR 0016 ».

## Contrôles avant de bâtir dessus

- **Début de T4, sur les deux simulateurs** (contrôle court) : toucher une
  `ViewAnnotation` (`onPress`) n'ajoute pas de point ; le numéro d'un
  point se met à jour après une suppression (sur iOS, l'image d'une
  annotation peut rester figée : parade, une clé React liée au numéro) ;
  20 points glissables restent fluides ; `usePreventRemove` bloque la croix
  et le retour d'Android.
- **T3** : un test prouve qu'un tronçon annulé avant sa réponse ne fait
  aucun appel natif.
- **T6** : mesure du § 8.
- Non prouvé par l'essai : un point à plus de 300 m d'un chemin, un vrai
  téléphone, l'appui long au vrai doigt.

## Questions pour Émilien (sans blocage : la phase suit la recommandation)

1. **Appui long sur iOS pour glisser.** Recommandation : le garder, et le
   dire dans la bulle quand un point est choisi : « Maintenez le point,
   puis glissez-le ». Même texte sur Android, où ce geste marche aussi.
   Pas de vibration en phase 4 (dépendance de plus, `expo-haptics`) ; à
   revoir après usage sur un vrai téléphone.
2. **Mode du tronçon qui remplace un point supprimé.** Recommandation :
   « à la main » seulement si les deux tronçons retirés l'étaient, sinon
   « par les chemins ». Un échec propose « Relier ce point à la main ».

## Sources (relevées le 27 octobre 2026)

- Essai T1 : [LISEZMOI](../phases/preuves/p04/t1-essai/LISEZMOI.md),
  `useDragTrial.tsx.txt` (branche `claude/p04-essai-glisser`, 79b8b28).
- `@tanstack/react-pacer` (0.24.1, 5 octobre 2026) :
  https://registry.npmjs.org/@tanstack/react-pacer
- TanStack Query, `gcTime` : https://tanstack.com/query/latest/docs/framework/react/guides/caching
- TanStack Query, abandon par signal :
  https://tanstack.com/query/latest/docs/framework/react/guides/query-cancellation
- Expo Router, `fullScreenModal` : https://docs.expo.dev/router/advanced/modals/
- Expo Router, `usePreventRemove` :
  https://docs.expo.dev/router/advanced/prevent-screen-removal/
- MapLibre React Native, `ViewAnnotation` :
  https://maplibre.org/maplibre-react-native/docs/components/annotations/view-annotation
- Valhalla, `search_cutoff` et codes d'erreur :
  https://valhalla.github.io/valhalla/api/route/api-reference/
