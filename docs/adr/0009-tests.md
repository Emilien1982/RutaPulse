# ADR 0009 — Tests : Jest, Testing Library et Maestro

- Statut : Accepté le 2026-10-19
- Date : 2026-10-19

ADR veut dire « Architecture Decision Record » (fiche de décision
d'architecture).

## Contexte

- Le `testeur` doit prouver chaque tâche, avec au moins un cas général
  comparé à une valeur de référence externe (règle de la phase 2).
- Une grande part de la logique est du calcul pur : dénivelé, regroupement
  route-piste-sentier, guidage, lecture et écriture de GPX (format
  d'échange de traces GPS).
- Le reste dépend du téléphone : GPS, carte, module natif Valhalla.

## Décision

- **Tests unitaires** : Jest (outil de test JavaScript) avec le préréglage
  `jest-expo`. Ils couvrent la logique pure, sans téléphone.
- **Tests d'écrans** : `@testing-library/react-native` 14.1.0 (teste un
  écran comme un utilisateur : on cherche un texte, on appuie).
- **Tests de bout en bout** (E2E, end-to-end : l'app réelle sur un
  émulateur ou un téléphone) : **Maestro** (licence Apache 2.0, version
  2.11.0 de son outil en ligne de commande, du 29 septembre 2026). Les scénarios sont écrits en YAML (format
  texte simple). On utilise l'outil gratuit en local, pas son service payant
  en ligne.
- **Données de référence** : une zone de test figée dans le dépôt de tests,
  et des itinéraires de référence (distance et dénivelé mesurés par une
  autre source, par exemple un site cartographique reconnu).
- **Ce qui reste manuel** : le suivi sur le vélo et la batterie. Ils sont
  vérifiés par des sorties réelles, avec un compte rendu chiffré.

## Alternatives rejetées

- **Detox** (outil E2E de Wix) : plus puissant mais plus lourd à installer.
  Maestro suffit pour nos parcours simples.
- **Tests E2E seulement** : lents et fragiles. La logique pure doit être
  testée sans téléphone.

## Conséquences

- Positif : la logique métier est testée vite et souvent.
- Négatif : le GPS en arrière-plan ne se teste pas bien en automatique.
  Il faudra des sorties réelles.

## Sources

- Testing Library sur npm : https://registry.npmjs.org/-/v1/search?text=%40testing-library%2Freact-native&size=3
- Maestro, release : https://api.github.com/repos/mobile-dev-inc/maestro/releases/latest
- Maestro, licence : https://api.github.com/repos/mobile-dev-inc/maestro
