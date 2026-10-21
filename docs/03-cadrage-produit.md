# Phase 3a — Cadrage produit de la v1

> 19 octobre 2026. Rédigé à partir de l'interview d'Émilien, puis corrigé
> selon ses remarques. Validé le 19 octobre 2026. Modifié le 20 octobre
> après l'essai 1 : recalcul en direct, tracé à la main, circuits balisés.

## L'app en une phrase
RutaPulse permet de préparer un itinéraire VTT sur son téléphone, calculé
par les sentiers, même sans réseau, puis de le suivre avec des indications
de direction.

## Pour qui, sur quoi
- Utilisateurs de la v1 (première version) : Émilien et ses proches.
  L'installation se fait en test interne, sans publication sur les stores.
- Android et iOS dès la v1, avec un seul code partagé.
- Langue : français. Le texte de l'app reste prêt pour une traduction.
- Aucun coût récurrent : uniquement des services gratuits, ou hébergés par
  nous à coût nul. Si ce n'est pas possible, l'architecte chiffre le coût.

## Ce que fait la v1

| # | Fonction | Détail |
|---|---|---|
| 1 | Carte des sentiers | Fond de carte adapté au VTT (sentiers, pistes, courbes de niveau), avec la position GPS. |
| 2 | Créer un itinéraire | Toucher un départ, des points de passage et une arrivée. L'app calcule le chemin par les voies adaptées au VTT. L'itinéraire se recalcule **en direct** quand on déplace un point. On peut ajouter, déplacer ou supprimer un point, et annuler. Un tronçon peut aussi être **tracé à la main**, pour un passage que le calcul ne prend pas. Marche aussi sans réseau, si la zone a été téléchargée. |
| 3 | Infos de l'itinéraire | Distance, dénivelé positif et négatif, profil d'altitude, part de route, de piste et de sentier, difficulté quand la carte la connaît, durée estimée. |
| 4 | Mes itinéraires | Enregistrés sur le téléphone : liste, renommer, supprimer. |
| 5 | GPX | Importer et exporter un itinéraire au format GPX (format standard d'échange de traces GPS). |
| 6 | Hors ligne | Télécharger à l'avance la carte et les données de calcul d'une zone. Sans réseau, tout marche : carte, création d'itinéraire, suivi. |
| 7 | Suivi sur le vélo | L'itinéraire, la position dessus, la distance restante et des indications de direction écrites (exemple : « À droite dans 200 m »). L'écran reste allumé. |
| 8 | Téléphone verrouillé | Le suivi continue. La prochaine indication s'affiche dans **une seule** notification, mise à jour : la plus récente remplace la précédente. |
| 9 | Circuits VTT balisés | Les circuits VTT balisés connus d'OpenStreetMap s'affichent sur la carte. Un geste transforme un circuit en itinéraire, qu'on peut ensuite modifier. |

## V2 (prévue)
- Animation d'arrivée : un vététiste couvert de boue monte sur un podium et
  brandit un trophée.
- Mode sombre : à reconsidérer.
- Nom de la commune dans le nom par défaut d'un itinéraire, s'il n'est pas
  fait en v1.
- Guidage par la voix.
- Économiseur d'écran quand le téléphone n'est pas verrouillé : l'écran
  s'assombrit ou se simplifie entre deux indications.

## Plus tard (idées non planifiées)
- Générer automatiquement une boucle d'une distance donnée.
- Alerte en cas d'écart avec l'itinéraire.
- Enregistrement des sorties (trace réelle, vitesse, statistiques).
- Comptes utilisateurs, synchronisation, sauvegarde en ligne.
- Version web.
- Partage social, découverte d'itinéraires d'autres utilisateurs.
- Capteurs (cardio, montre).
- Publication sur Google Play et l'App Store.

## Risques techniques, à éprouver avant de construire
Ces points peuvent bloquer le projet ou changer la stack (ensemble des
technologies). L'architecte les étudie. Chacun fait ensuite l'objet d'un
essai jetable avant la phase qui en dépend.

1. **Calcul d'itinéraire VTT sur le téléphone, sans réseau.** C'est le risque
   le plus lourd. Il faut un moteur de calcul qui tourne sur Android **et**
   iOS, avec un profil VTT et des données par zone de taille raisonnable.
   S'il n'existe pas de solution réaliste, la création hors ligne passera en
   V2 : décision à prendre avec Émilien au vu de l'étude.
2. **Cartes hors ligne.** Les serveurs de cartes d'OpenStreetMap interdisent
   le téléchargement en masse. Il faut une autre source de cartes
   téléchargeables.
3. **Altitude.** Une source fiable pour le dénivelé et le profil, disponible
   hors ligne.
4. **Type de terrain et difficulté.** Vérifier que ces données sont présentes
   dans les données de calcul, et assez remplies en France.
5. **Suivi téléphone verrouillé.** Android et iOS limitent le GPS en arrière-
   plan. Il faut une notification qui se met à jour et des permissions
   acceptées par les deux stores.
6. **Batterie.** La consommation pendant plusieurs heures de GPS, avec
   l'écran allumé ou verrouillé.

## Suite (phase 3)

| Étape | Qui | Ce que tu valides |
|---|---|---|
| 3b | `architecte` : étude des 6 risques et proposition de stack | La stack et les ADR (fiches de décision d'architecture) |
| 3c | Essais jetables sur les risques les plus graves | Le résultat des essais |
| 3d | `designer` : maquettes des écrans principaux | Le design |
| 3e | Moi : découpage de la v1 en petites phases | Le plan de développement |
