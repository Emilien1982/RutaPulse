# ADR 0010 — Distribution en test interne, sans les stores

- Statut : Accepté le 2026-10-19 (iOS : compte Apple gratuit d'abord, TestFlight quand un proche avec un iPhone voudra l'app)
- Date : 2026-10-19

ADR veut dire « Architecture Decision Record » (fiche de décision
d'architecture).

## Contexte

- La v1 est installée chez Émilien et ses proches, sans publication sur les
  stores (magasins d'applications).
- Aucun coût récurrent n'est permis. Si ce n'est pas possible,
  l'architecte chiffre le coût.

## Décision

- **Android** : un fichier APK (paquet d'installation Android) compilé sur
  le Mac et envoyé aux proches. Installation directe. Coût : 0.
- **iOS** : deux options, à trancher par Émilien.
  1. **Compte Apple gratuit** : installation par Xcode (outil de
     développement d'Apple), téléphone branché au Mac. L'app expire au bout de 7 jours et doit être réinstallée. 3
     appareils au plus, 3 apps par appareil. Coût : 0. Inconnu : si les Live
     Activities (bandeau en direct sur l'écran verrouillé) marchent avec ce
     compte, car elles demandent un « App Group » (groupe d'apps qui
     partagent des données).
  2. **Apple Developer Program** : 99 USD par an (prix affiché par Apple,
     montant local non vérifié). Donne TestFlight (distribution de test
     d'Apple) : les proches installent et mettent à jour l'app sans câble.
- Recommandation : commencer avec le compte gratuit pour les essais et les
  premières phases. Passer au programme payant quand des proches sur iPhone
  doivent l'utiliser, ou si l'essai 2 montre que le compte gratuit bloque
  les Live Activities.

## Alternatives rejetées

- **Publication sur les stores** : hors du périmètre v1.
- **Services de distribution tiers** : non étudiés en détail. Ils ne
  dispensent pas, à ma connaissance, de la signature d'Apple. Non vérifié.

## Conséquences

- Positif : Android ne coûte rien et reste simple.
- Négatif : sur iOS, le seul moyen sans coût est contraignant (7 jours,
  câble). C'est le seul coût récurrent possible du projet : 99 USD par an.

## Sources

- Comptes Apple, limites du compte gratuit : https://developer.apple.com/support/compare-memberships/
- Apple Developer Program, prix : https://developer.apple.com/programs/enroll/
- expo-widgets, App Group : https://docs.expo.dev/versions/latest/sdk/widgets/
