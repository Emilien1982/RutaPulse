# Preuves de la tâche T6 (phase 5) : écarts A1, A2, A3 de la phase 4 (C14)

Date : 2 novembre 2026. **Android seulement, iOS en attente de la licence
Xcode.** Release sur `Pixel_6_API_34_arm64`, zone Nancy v3.

- `05-glisser-point-choisi.png` : première passe, avant corrections. En
  plein glisser, le point 2 choisi reste à 40 avec son halo et suit le
  doigt ; bulle « Point 2 : relâchez pour le poser » ; pas de plantage.
- Après corrections (espace insécable, ombre relevée, bulle cachée au
  toucher d'un point) :
  - `10-bulle-main-v2.png` : bulle d'aide « À la main », pastille en haut ;
  - `11-bulle-reentree.png` : la bulle revient à un nouveau passage dans le
    mode ;
  - `12-note-mixte.png` : un tronçon par les chemins et un à la main :
    distance 39,9 km, note « À la main : 17,9 km » ;
  - `13-point-choisi-ombre.png` : point choisi à 40 avec halo ; l'ombre
    relevée se voit peu sur fond clair (valeurs prouvées par Jest) ;
  - `14-infos.png`, `15-apres-modifier.png` : ouvrir Infos puis « Modifier »
    ne fait pas revenir la bulle d'aide.
- `build-android-fin.txt` : fin du journal de build release.
- `verify-commit.log` : `npm run verify` avant le commit.

Incident : pendant les captures, une commande `adb monkey` mal lancée a
ouvert Google Photos sur l'émulateur ; le développeur l'a fermé
(`am force-stop`) et a refait les captures concernées.

Non vérifié : iOS ; la clé stable sur un vrai téléphone ; la comparaison
du designer (T8).
