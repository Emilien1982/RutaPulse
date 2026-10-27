# C2 : mesure témoin sur Android (27 octobre 2026)

Question : l'arrêt du fil JavaScript d'environ 200 ms, mesuré sur Android
pendant l'ouverture du moteur (T5b), vient-il du moteur ou du démarrage de
l'app ?

Méthode : banc jetable (branche locale `claude/p03-banc`, ec04c6a), version
finale (release), émulateur `Pixel_6_API_34_arm64`, 3 démarrages à froid par
configuration. Mesure : plus grand écart entre deux tics d'un `setInterval`
de 16 ms, pendant les 1 500 ms qui suivent le lancement du banc.

- A : app normale, le moteur s'ouvre au démarrage.
- B (témoin) : ouverture du moteur désactivée en local (non commitée).

| Passage | Plus grand écart, fenêtre de 1 500 ms | Ouverture du moteur |
|---|---|---|
| A-1 | 266,2 ms | 796,5 ms |
| A-2 | 155,5 ms | 697,2 ms |
| A-3 | 345,1 ms | 693,0 ms |
| B-1 | 212,7 ms | moteur fermé |
| B-2 | 201,9 ms | moteur fermé |
| B-3 | 295,5 ms | moteur fermé |

Règle fixée avant la mesure par le pilotage : si B reste de l'ordre de
200 ms, la cause est le démarrage de l'app ; si B tombe nettement plus bas
(moins de 60 ms), le moteur est en cause.

Conclusion : B reste entre 202 et 296 ms. **L'arrêt vient du démarrage de
l'app, pas du moteur.** Avec 3 passages et une forte dispersion, la mesure
ne permet pas d'exclure un petit effet du moteur. À remesurer sur un vrai
téléphone Android.
