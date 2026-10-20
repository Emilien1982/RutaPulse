# Workflow GitHub Actions : fabriquer un paquet de zone

`fabriquer-zone.yml` décrit une tâche automatique (un « workflow ») de
GitHub Actions. Elle fabrique un paquet de zone complet sur une machine
gratuite de GitHub et le publie dans une release (version publiée).

## Pourquoi il n'est pas actif

GitHub ne lit que les fichiers du dossier `.github/workflows/`. Ce fichier est
rangé ici, hors de ce dossier : il ne se lance donc jamais tout seul. Il n'a
pas été poussé, ni lancé. Il décrit ce qu'on ferait si l'essai 3 conclut que
c'est possible (voir le tableau de mesures dans
`../zone/preuves/mesures-paquet.txt`).

## Comment l'activer

1. Copier le fichier : `cp essais/03-carte-hors-ligne/actions/fabriquer-zone.yml .github/workflows/`
2. Pousser sur la branche par défaut (`main`). Un workflow à lancement manuel
   n'apparaît dans l'onglet Actions que s'il est sur cette branche.
3. Sur GitHub : onglet Actions, « Fabriquer une zone », « Run workflow »,
   remplir le nom et les limites.
4. Le paquet est publié dans une release nommée `zone-<nom>-<date>`.

## Limites connues

- Les scripts de fabrication ne gèrent encore que la zone de Nancy : les tuiles
  d'altitude (`N48E005`, `N48E006`) et l'extrait Lorraine y sont écrits en dur.
  Les entrées « nom » et « limites » sont transmises, mais une autre zone
  demandera d'abord de rendre ces deux points variables.
- La machine gratuite n'a que 4 processeurs, 16 Go de mémoire et 14 Go de
  disque. Les mesures du Mac (10 cœurs) ne s'y transposent pas telles quelles.
