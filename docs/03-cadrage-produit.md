# Phase 3a — Cadrage produit de la v1

> 19 octobre 2026. Rédigé à partir de l'interview d'Émilien. À valider.

## L'app en une phrase
RutaPulse permet de préparer un itinéraire VTT sur son téléphone, calculé
par les sentiers, puis de le suivre sur une carte qui marche sans réseau.

## Pour qui, sur quoi
- Utilisateurs de la v1 (première version) : Émilien et ses proches.
  L'installation se fait en test interne, sans publication sur les stores.
- Android et iOS dès la v1, avec un seul code partagé.
- Langue : français. Le texte de l'app reste prêt pour une traduction.

## Ce que fait la v1

| # | Fonction | Détail |
|---|---|---|
| 1 | Carte des sentiers | Fond de carte adapté au VTT (sentiers, pistes, courbes de niveau), avec la position GPS. |
| 2 | Créer un itinéraire | Toucher un départ, des points de passage et une arrivée. L'app calcule le chemin par les voies adaptées au VTT. On peut déplacer ou supprimer un point, et annuler. |
| 3 | Infos de l'itinéraire | Distance, dénivelé positif et négatif, profil d'altitude, part de route, de piste et de sentier, difficulté quand la carte la connaît, durée estimée. |
| 4 | Mes itinéraires | Enregistrés sur le téléphone : liste, renommer, supprimer. |
| 5 | GPX | Importer et exporter un itinéraire au format GPX (format standard d'échange de traces GPS). |
| 6 | Hors ligne | Télécharger à l'avance la carte autour d'un itinéraire. Sur le terrain, la carte, l'itinéraire et la position s'affichent sans réseau. |
| 7 | Sur le vélo | Afficher l'itinéraire, sa position dessus et la distance restante. L'écran reste allumé. |

**Choix que j'ai faits, à corriger si besoin :**
- **La fonction 7 n'était pas dans tes réponses.** Je l'ajoute parce qu'un
  itinéraire qu'on ne peut pas suivre sur le vélo ne sert à rien. Je la
  garde au minimum : pas d'alerte, pas de voix.
- **Créer un itinéraire demande du réseau.** On le prépare chez soi. Calculer
  un trajet sans réseau demande d'embarquer un moteur de calcul et des
  données lourdes. C'est un chantier à part.
- **La v1 n'a aucun coût récurrent** : uniquement des services gratuits ou
  hébergés par nous à coût nul. Si ce n'est pas possible, l'architecte le
  signalera avec le coût chiffré.

## Ce que la v1 ne fait pas
- Guidage vocal ou virage par virage, alerte en cas d'écart avec l'itinéraire.
- Enregistrement des sorties (trace réelle, vitesse, statistiques).
- Comptes utilisateurs, synchronisation, sauvegarde en ligne.
- Version web.
- Partage social, découverte d'itinéraires d'autres utilisateurs.
- Capteurs (cardio, montre).
- Publication sur Google Play et l'App Store.
- Calcul d'itinéraire sans réseau.

## Risques techniques, à éprouver avant de construire
Ces points peuvent bloquer le projet ou changer la stack (ensemble des
technologies). L'architecte les vérifie, puis chacun fait l'objet d'un
essai jetable avant la phase qui en dépend.

1. **Calcul d'itinéraire VTT** : trouver un service gratuit qui calcule par
   les sentiers avec un profil VTT, avec ses limites d'usage et sa licence.
2. **Cartes hors ligne** : les serveurs de cartes d'OpenStreetMap interdisent
   le téléchargement en masse. Il faut une autre source de cartes
   téléchargeables, avec une taille raisonnable par zone.
3. **Altitude** : une source fiable pour le dénivelé et le profil.
4. **Type de terrain et difficulté** : vérifier que ces données arrivent avec
   le calcul d'itinéraire et qu'elles sont assez remplies en France.
5. **GPS et batterie** : précision en forêt, consommation de batterie pendant
   plusieurs heures avec l'écran allumé.

## Suite proposée (phase 3)

| Étape | Qui | Ce que tu valides |
|---|---|---|
| 3b | `architecte` : étude des 5 risques et proposition de stack | La stack et les ADR (fiches de décision d'architecture) |
| 3c | Essais jetables sur les risques 1 et 2, les plus graves | Le résultat des essais |
| 3d | `designer` : maquettes des écrans principaux | Le design |
| 3e | Moi : découpage de la v1 en petites phases | Le plan de développement |
