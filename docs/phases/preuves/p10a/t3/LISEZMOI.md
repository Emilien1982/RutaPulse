# Phase 10a, T3 : APK signé par la vraie clé

17 novembre 2026. Fabriqué par `npm run build:apk` (`mobile/scripts/build-apk.sh`),
signature par le plugin `mobile/plugins/withReleaseSigning.js` (ADR 0022).
Rien n'a été installé dans cette tâche. Faits rapportés par le développeur ;
la session de phase a revérifié les empreintes de l'APK et du `.p12`
(`shasum -a 256`) et lu `apksigner-verify.txt`.

| Fichier | Ce qu'il prouve |
|---|---|
| `build-apk.log` | Sortie complète de `npm run build:apk` : `mobile/apk/RutaPulse-1.0.0-1.apk`, 54 158 175 octets, 17 novembre 15:07 |
| `apksigner-verify.txt` | Signataire `CN=RutaPulse`, certificat SHA-256 `43fcead7…32b9af` : la vraie clé, pas celle de débogage |
| `release-sans-variable.log` | `assembleRelease` sans `RUTAPULSE_SIGNING` échoue à `preReleaseBuild` (verrou 1), code 1 |
| `debug-sans-variable.log` | `assembleDebug` sans la variable passe : le débogage et la CI ne sont pas cassés |
| `taille-apk-arm64.txt` | 52 Mo en `arm64-v8a` seul, contre 172 Mo à l'essai T1 (4 architectures) |
| `place-avant-build.txt`, `place-apres-build.txt` | Place libre autour de `npm run build:apk` (55 Gi, caches chauds) |
| `place-avant-b-c.txt`, `place-apres-b-c.txt` | Place libre autour des preuves (b) release sans variable et (c) débogage sans variable : 55 puis 52 Gi |
| `refus-ecrasement.txt` | Le script final refuse d'écraser un APK existant, avant toute construction (code 1) |
| `verify.txt` | `npm run verify` après les corrections de relecture : 274 suites, 3 074 tests réussis |
| `audit.txt` | Commandes d'audit de l'ADR 0022 § 8 et recherche du vrai mot de passe : rien trouvé dans le dépôt |

Empreinte SHA-256 du fichier APK : `7cc80be3ddefc6657869dedc4f52ba28578c8307fbd71c214612b71703e82b4e`.

Non prouvé ici : installation sur l'émulateur et parcours de fumée (T4),
CI GitHub (fin de phase).

Limites : `build-apk.log` vient de la première version du script (sans la
ligne `Commit :`), les corrections de relecture sont venues ensuite sans
nouvelle construction (l'app ne change pas). `debug-sans-variable.log` ne
montre pas lui-même que la variable était absente.
