# Preuves de la tâche T7 (phase 5) : Android

Date : 2 novembre 2026. **Android seulement, iOS en attente de la licence
Xcode.** Release sur `Pixel_6_API_34_arm64`, zone Nancy v3.

Banc jetable : [../t7-banc/LISEZMOI.md](../t7-banc/LISEZMOI.md) (branche
locale `claude/p05-banc`, `72ee978`, jamais poussée).

| Critère | Résultat | Preuve |
|---|---|---|
| C3, C5 | R1 à R5 : écart 0 sur D+, D−, altitudes basse et haute, et chaque part, pour les deux contrôles (même méthode ; même moteur, Valhalla 3.9.1 en Docker). Tolérance 1 m et 1 point | `comparaison-mac/` (`comparer.py`, `LISEZMOI.md`, `sortie/resultat.txt`) ; `references/passage-1` et `passage-2` (identiques) |
| C9, temps | Infos de R4 (40,3 km) : 179,6 à 247,6 ms à froid, 48,9 à 50,0 ms à chaud. Seuil 1 s | `c9-affichage/analyse.txt` |
| C9, fluidité | Arrêt max du fil JavaScript : 47,6 à 53,2 ms sur 3 gestes (témoin 39,9 ms). Seuil 100 ms. 0 appel d'infos pendant le geste | `c9-geste/analyse.txt` |
| Chaîne jusqu'à l'écran | Infos de R4 : D+ 659 m, le même que le banc | `capture-chaine/p05-android-chaine-R4-infos.png` |
| C13 | Parcours `mobile/e2e/p05-infos.yaml` en mode avion : 50 étapes réussies, 0 échec, 1 avertissement (autorisation de position absente, étape facultative) | `c13-maestro/maestro.log`, `mode-avion-avant.txt` |

Captures release pour le designer : `docs/phases/captures/p05-android-*.png`.
Préparation : `captures-flows/`.

Le paquet Nancy v3 n'est pas dans le dépôt (77 Mo) : `comparer.py` le prend
en argument. Empreinte sur l'émulateur en fin de tâche :
`empreinte-emulateur.txt` (conforme).

Limites : les références n'ont aucun tronçon « À la main » (part à 0) ; le
temps d'affichage est mesuré dans le JavaScript, sans l'animation ni le
dernier dessin natif ; émulateur, pas un vrai téléphone ; iOS en attente.
