---
name: phase
description: Circuit à suivre pour mener une phase de développement, de la spec au commit. À utiliser au début de chaque phase.
---

# Circuit d'une phase

1. **Spec.** Écrire `docs/phases/NN-titre.md` avec :
   - l'objectif en une phrase ;
   - les critères d'acceptation, chacun vérifiable par une commande ou une
     capture ;
   - le hors périmètre ;
   - le découpage en tâches (chacune faisable par le développeur en une fois) ;
   - le coût estimé (petit, moyen, gros) et les risques.
2. **Validation.** Présenter la spec à Émilien. Ne rien lancer avant son accord.
3. **Pour chaque tâche :**
   1. Lancer `developpeur` avec la tâche et le chemin de la spec.
   2. Commiter le travail sur une branche ou noter la référence des
      modifications.
   3. Lancer `relecteur` et `testeur` en parallèle, avec la spec et la
      référence des modifications. Ne pas leur transmettre le raisonnement
      du développeur.
   4. S'il y a des défauts bloquants : renvoyer au `developpeur` la liste
      exacte. Deux allers-retours maximum, ensuite prévenir Émilien.
   5. Si le `developpeur` échoue deux fois sur la même tâche avec Sonnet, la
      relancer avec le modèle Opus et le noter dans `PILOTAGE.md`.
   6. Commit final de la tâche.
4. **Clôture.**
   - Mettre à jour `PILOTAGE.md` (état, décisions, prochaine étape).
   - Compte rendu à Émilien : ce qui marche, les preuves (sortie des tests,
     captures), ce qui n'est pas vérifié, ce qui a été appris sur les agents.
