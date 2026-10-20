# Phase 3e — Découpage de la v1 (proposition)

> 21 octobre 2026. Proposition de la session de pilotage, **à valider par
> Émilien**. S'appuie sur le cadrage (docs/03), l'architecture (docs/04,
> ADR 0001 à 0010) et les essais 1 à 3 (docs/essais/).

## Principes

- **Une phase = un livrable que tu peux voir tourner** sur les simulateurs,
  avec ses preuves (captures, sortie des tests).
- **Chaque phase suit le circuit `/phase`** : spec écrite, ta validation,
  développement tâche par tâche, contrôle par le relecteur et le testeur,
  commit, compte rendu.
- **Une session par phase**, ouverte dans `vtt-nav`. Cette conversation reste
  celle du pilotage.
- **Le plus risqué d'abord, la valeur visible tôt.** Les essais ont levé les
  gros risques techniques ; il reste surtout du travail d'assemblage.
- **On ne réutilise pas le code des essais tel quel.** Il est jetable. On
  s'en inspire, on le réécrit proprement, avec des tests.
- Taille : **P** = 1 session, **M** = 2 sessions, **G** = 3 sessions ou plus.

## Les phases

| # | Phase | Livrable démontrable | Fonctions (docs/03) | Taille | Dépend du design |
|---|---|---|---|---|---|
| 0 | **Socle du projet** | App Expo vide qui démarre sur les deux simulateurs. TypeScript strict, lint (contrôle de style), formatage, tests Jest, hooks qui lancent ces contrôles automatiquement, CI (vérification automatique sur GitHub) à chaque push. Règles de code dans un ADR. | — | M | Non |
| 1 | **Fabrique de zones** | Un paquet de zone complet (calcul, altitude, carte, circuits) fabriqué par GitHub Actions et publié en release, avec `catalogue.json`. Un seul script, reprenant ceux des essais 1 et 3. | 6 | M | Non |
| 2 | **Carte hors ligne** | Dans l'app : liste des zones, téléchargement d'une zone, carte affichée en mode avion, position GPS, attributions. | 1, 6 | M | Oui |
| 3 | **Module de calcul** | Module natif Valhalla propre, testé, branché sur la zone téléchargée. Un itinéraire calculé entre deux points s'affiche sur la carte. | 2 (base) | M | Oui |
| 4 | **Créer et modifier un itinéraire** | Poser, déplacer et supprimer des points, avec recalcul en direct ; annuler ; tracé à la main d'un tronçon. | 2 | G | Oui |
| 5 | **Infos de l'itinéraire** | Distance, D+ et D−, profil d'altitude, part de route, de piste et de sentier, difficulté connue, durée estimée. | 3 | M | Oui |
| 6 | **Mes itinéraires et GPX** | Enregistrer, lister, renommer, supprimer (SQLite + TanStack Query). Importer et exporter en GPX. | 4, 5 | M | Oui |
| 7 | **Circuits VTT balisés** | Couche des circuits sur la carte ; un geste transforme un circuit en itinéraire modifiable. | 9 | P | Oui |
| 8 | **Suivi sur le vélo** | Position sur l'itinéraire, distance restante, indications écrites, écran allumé. Testé avec une trace GPS rejouée. | 7 | M | Oui |
| 9 | **Suivi téléphone verrouillé** | Service Android avec une seule notification mise à jour ; Live Activity iOS. Reprend les résultats de l'essai 2. | 8 | M | Oui |
| 10 | **Finition et test interne** | Écran « Licences », textes en français, icône, écran de démarrage, APK Android installable, app iOS installée par Xcode. Vérifications sur un vrai téléphone (liste de PILOTAGE.md). | — | M | Oui |

Total estimé : environ 20 sessions de travail.

## Pourquoi cet ordre

- **0 et 1 d'abord, car ils ne dépendent pas du design.** On peut les lancer
  pendant que tu valides les maquettes.
- **La phase 0 installe les garde-fous de code** (hooks lint, typecheck,
  tests) qu'on ne pouvait pas écrire avant de connaître la stack. C'est elle
  qui protège de l'effet « code spaghetti » sur toute la suite.
- **2 → 3 → 4** : chaque phase s'appuie sur la précédente. À la fin de la
  phase 4, l'app a déjà sa valeur principale : créer un itinéraire VTT hors
  ligne.
- **5, 6 et 7 sont assez indépendantes.** Elles pourraient être faites en
  parallèle, mais le quota d'utilisation incite à les enchaîner.
- **8 puis 9** : le suivi d'abord à l'écran, puis téléphone verrouillé.
- **10 en dernier**, avec les vérifications qui demandent un vrai téléphone.

## Points d'attention

- **Le style de carte** (trottoirs dessinés comme des sentiers, courbes
  anguleuses) se corrige en phase 2, d'après le design validé.
- **La difficulté VTT** (`mtb:scale`) est peu renseignée autour de Nancy :
  la phase 5 doit prévoir l'affichage « inconnue ».
- **Le temps d'ouverture du moteur** (7 s mesurées sur l'émulateur en
  version de développement) se traite en phase 3 : ouverture en arrière-plan
  au démarrage.
- **Les zones** restent fabriquées sur demande en v1 (ADR 0003). La phase 1
  rend cette fabrication automatique, sans ton Mac.

## Ce que je te demande de valider

1. Les 11 phases et leur ordre.
2. Lancer les phases 0 et 1 pendant que tu valides le design.
3. Le rythme : une phase à la fois, avec ta validation de la spec avant
   chaque phase.
