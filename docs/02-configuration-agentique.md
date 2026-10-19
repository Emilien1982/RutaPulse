# Phase 2 — Configuration agentique (proposition)

> 19 octobre 2026. Validé par Émilien le 19 octobre 2026.

## 1. Les prix des modèles

Prix officiels de l'API (interface de programmation) d'Anthropic, en dollars
par million de tokens (un token ≈ ¾ d'un mot). « Entrée » = ce que le modèle
lit, « sortie » = ce qu'il écrit.

| Modèle | Entrée | Sortie | Coût relatif | Usage type |
|---|---|---|---|---|
| Fable 5.1 | 10 $ | 50 $ | × 2,5 | Problèmes très difficiles, longues tâches autonomes |
| Opus 5.5 | 4 $ | 20 $ | × 1 (référence) | Raisonnement, jugement, décisions |
| Sonnet 5.5 | 2 $ | 10 $ | × 0,5 | Écrire du code au quotidien |
| Haiku 5.5 | 0,10 $ | 0,50 $ | × 0,025 | Recherches simples, lecture de logs (journaux) |

Avec ton abonnement, tu ne paies pas ces prix directement : chaque token
consommé réduit ton quota. Le rapport entre les modèles reste le même.

**Où partent les tokens :** dans un projet comme le nôtre, l'écriture du code
et des tests représente la grande majorité des tokens. L'architecture, le
design et la relecture en consomment peu, mais ce sont eux qui évitent les
erreurs coûteuses. D'où la règle : **modèle moyen là où le volume est fort,
meilleur modèle là où le volume est faible et l'enjeu élevé.**

## 2. Qui fait quoi

### Les deux rôles qui ne sont pas des agents

| Rôle | Qui | Pourquoi |
|---|---|---|
| Product Owner (responsable du produit) | **Toi** | Tu décides ce que fait l'app. |
| Chef de projet | **La session principale** (cette conversation), Opus 5.5 | Elle seule voit notre conversation. Elle découpe, délègue, tient `PILOTAGE.md`, te rend compte. |

Un sous-agent démarre sans rien savoir de notre conversation et ne peut pas
te poser de question. Un PO ou un chef de projet en sous-agent n'aurait donc
pas les informations nécessaires.

### Les cinq sous-agents

| Agent | Modèle | Outils | Mission |
|---|---|---|---|
| `architecte` | Opus 5.5 | Lecture + écriture dans `docs/` seulement | Proposer la structure du code et la stack (ensemble des technologies). Rédiger les ADR (fiches de décision d'architecture). Vérifier qu'un nouveau besoin rentre dans l'architecture. |
| `designer` (concepteur d'interface) | Opus 5.5 | Lecture + écriture dans `design/` + captures d'écran | Proposer les écrans sous forme de maquettes que tu peux ouvrir. Comparer une capture de l'app à la maquette et lister les écarts. |
| `developpeur` | Sonnet 5.5 | Tous, sauf modifier `docs/` et les tests existants | Implémenter **une** tâche décrite dans une spec (spécification). S'arrêter quand les vérifications passent, montrer les preuves. |
| `relecteur` | Opus 5.5 | Lecture seule + commandes git en lecture | Relire le diff (les modifications) en le comparant à la spec et aux règles d'architecture. Ne signaler que les défauts bloquants : bug, exigence manquante, règle violée. |
| `testeur` | Sonnet 5.5 | Tous, sauf modifier le code de l'app | Écrire les tests à partir de la spec (pas à partir du code). Lancer l'app sur l'émulateur ou le téléphone, faire des captures, dire ce qui marche ou non. |

Pour les recherches dans le code, Claude Code fournit déjà un agent
`Explore`. Je n'en crée pas un autre. Je vérifierai quel modèle il utilise et
je le mettrai sur Haiku si ce n'est pas le cas.

### Justification des modèles

- **Développeur et testeur sur Sonnet** : ce sont eux qui consomment le plus.
  Sonnet coûte deux fois moins cher qu'Opus et écrit du code de très bon
  niveau. Si Sonnet échoue deux fois sur la même tâche, je relance cette tâche
  avec Opus et je le note.
- **Relecteur sur Opus** : il lit un diff, donc peu de tokens. Trouver un bug
  subtil est justement là où le meilleur modèle fait la différence.
- **Architecte et designer sur Opus** : peu d'appels, mais leurs erreurs se
  paient pendant tout le projet.
- **Pas de Fable 5.1 par défaut** : 2,5 fois le prix d'Opus. Je le proposerai
  seulement pour un problème précis qu'Opus n'arrive pas à résoudre.
- **Pas de Haiku pour écrire du code** : il perd le fil quand une modification
  touche plusieurs fichiers.

### Pourquoi séparer développeur, relecteur et testeur

Un agent qui relit son propre code le juge trop favorablement. Un agent qui
écrit les tests de son propre code écrit des tests qui passent forcément.
Chacun travaille donc dans un contexte neuf, sans connaître le raisonnement
des autres.

## 3. Le circuit d'une phase

1. **Spec** : je rédige la spec de la phase avec toi : objectif, critères
   d'acceptation vérifiables, hors périmètre, estimation du coût.
2. **Ta validation.**
3. **Développement** : `developpeur`, une tâche à la fois.
4. **Contrôle** : `relecteur` et `testeur`, en parallèle.
5. **Correction** si besoin, puis nouveau contrôle (deux allers-retours
   maximum, ensuite je te préviens).
6. **Clôture** : commit (enregistrement dans git), mise à jour de
   `PILOTAGE.md`, compte rendu avec les preuves (captures, sortie des tests).

## 4. Les garde-fous

| Garde-fou | Quand | Rôle |
|---|---|---|
| Dépôt git + e-mail noreply | Phase 2 | Historique et retour arrière. Pas ton Gmail dans les commits si le dépôt devient public. |
| `CLAUDE.md` de moins de 60 lignes | Phase 2 | Les règles lues par chaque agent. Court, sinon ignoré. |
| Skill (procédure enregistrée) `/phase` | Phase 2 | Le circuit ci-dessus, pour que je l'applique toujours de la même façon. |
| Skill `/verif` | Phase 2 | Comment prouver qu'une vérification passe vraiment. |
| Restriction des outils de chaque agent | Phase 2 | Le relecteur ne peut rien modifier, le développeur ne peut pas toucher aux specs. |
| Hooks (crochets automatiques) : lint (contrôle de style), typecheck (vérification des types), tests | Après le choix de la stack (phase 3) | Exécutés automatiquement, impossibles à oublier. On ne peut pas les écrire avant de connaître le langage. |

## 5. L'épreuve de la configuration

Avant le vrai développement, on teste le circuit sur une tâche jetable :
une petite fonction qui calcule la distance entre deux points GPS.

1. Le `developpeur` l'écrit, le `testeur` la teste, le `relecteur` la relit.
2. J'introduis ensuite **volontairement** un bug, pour vérifier que le
   relecteur et les tests le détectent.
3. Je vérifie que les restrictions tiennent : le relecteur essaie de modifier
   un fichier, l'outil doit refuser.

Le code de l'épreuve est jeté à la fin. On garde seulement les corrections
apportées à la configuration.

**Coût estimé** : faible, moins de 1 $ en prix API, soit quelques minutes
d'usage normal de ton quota.

## 6. Ce que je te demande de valider

1. Les cinq agents et leurs modèles.
2. Le circuit d'une phase.
3. L'épreuve.

Si tu valides, je crée les fichiers, je lance l'épreuve et je te montre le
résultat.
