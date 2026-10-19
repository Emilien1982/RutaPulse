---
name: verif
description: Règles pour prouver qu'une vérification passe vraiment (build, tests, app). À appliquer avant d'annoncer un succès.
---

# Prouver une vérification

Un message de succès n'est pas une preuve. Un code de sortie non plus.

1. **Lire le résultat réel.** Pour des tests : le nombre de tests exécutés,
   réussis et échoués. Zéro test exécuté = échec, même si la commande dit OK.
2. **Ne pas filtrer la sortie** au point de cacher une erreur (un `grep` peut
   masquer un échec). En cas de doute, lire la sortie complète.
3. **Tester le code de sortie explicitement** :
   `commande && echo OK || echo ÉCHEC`.
4. **Après un build, vérifier que le fichier produit existe** (taille, date).
5. **Vérifier l'instrument.** Avant de conclure à un échec ou à un succès, se
   demander si la commande mesure bien ce qu'on croit (bon identifiant, bon
   fichier, bon appareil).
6. **Pour l'app : une capture d'écran** qui montre le comportement attendu
   est la preuve la plus directe.
7. **Un garde-fou se prouve en le cassant.** Introduire volontairement le
   défaut qu'il doit attraper, constater qu'il l'attrape, puis annuler.

Dans le compte rendu, séparer ce qui est prouvé de ce qui ne l'est pas.
