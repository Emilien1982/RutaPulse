# Icône A et écran de démarrage : fichiers sources

Phase 10a, tâche T1 (designer). Pour le développeur de T2.
Dessin : planche `design/v1/70-icone.html` (icône A, « le soleil rayé »).
Écran de démarrage : planche `design/v1/71-demarrage.html`.
Valeurs : `design/tokens.md`, rubriques « Icône » et « Écran de démarrage ».

Les fichiers SVG (dessin vectoriel) sont les sources. Le développeur les
convertit en PNG (image en pixels), puis remplace les images d'Expo qui
portent le même nom. Les noms ne changent pas : `app.json` garde les mêmes
chemins, sauf l'icône iOS.

## Les fichiers

| Source (ici) | Rendu PNG | Destination dans `mobile/assets/images/` | Réglage `app.json` |
|---|---|---|---|
| `icone-ios-1024.svg` | 1024 × 1024 px, **opaque** (sans canal alpha, la transparence) | `icon.png` (remplace) | `expo.icon` ; sert aussi d'icône de secours sur les vieux Android |
| `android-dessin-108.svg` | 1024 × 1024 px, transparent autour du dessin | `android-icon-foreground.png` (remplace) | `android.adaptiveIcon.foregroundImage` |
| `android-fond-108.svg` | 1024 × 1024 px, crème uni | `android-icon-background.png` (remplace) | `android.adaptiveIcon.backgroundImage` |
| `android-monochrome-108.svg` | 1024 × 1024 px, noir sur transparent | `android-icon-monochrome.png` (remplace) | `android.adaptiveIcon.monochromeImage` |
| `demarrage.svg` | 1024 × 1024 px, transparent autour du rond | `splash-icon.png` (remplace) | `image` du plugin `expo-splash-screen` |

Pourquoi 1024 px partout : Expo réduit lui-même chaque image à la taille de
chaque densité d'écran (432 px pour une couche Android en xxxhdpi, 704 px
pour l'image de démarrage en xxxhdpi). Partir de plus grand ne coûte rien.

Pas de `favicon` : l'app n'a pas de version web.

## Les réglages `app.json`

```json
"icon": "./assets/images/icon.png",
"ios": {
  "bundleIdentifier": "fr.rutapulse.app"
},
"android": {
  "adaptiveIcon": {
    "backgroundColor": "#F4E4C1",
    "foregroundImage": "./assets/images/android-icon-foreground.png",
    "backgroundImage": "./assets/images/android-icon-background.png",
    "monochromeImage": "./assets/images/android-icon-monochrome.png"
  }
}
```

```json
[
  "expo-splash-screen",
  {
    "backgroundColor": "#F4E4C1",
    "image": "./assets/images/splash-icon.png",
    "imageWidth": 176
  }
]
```

- `ios.icon` pointe aujourd'hui vers `./assets/expo.icon`, l'icône d'Expo au
  format Icon Composer (l'outil d'Apple pour les icônes en couches d'iOS 26).
  Retirer cette ligne et le dossier `mobile/assets/expo.icon/` : iOS prend
  alors `expo.icon`, le PNG de 1024.
- `adaptiveIcon.backgroundColor` passe de `#E6F4FE` (bleu clair d'Expo) à
  `#F4E4C1`. Il ne se voit pas tant que `backgroundImage` existe, mais il ne
  doit plus rester de bleu.
- Code, dans `FontGate.tsx`, à côté de `preventAutoHideAsync()` :
  `SplashScreen.setOptions({ fade: true, duration: 300 })`. Le fondu est
  géré sur iOS seulement ; sur Android, c'est le système qui termine
  l'écran de démarrage.

## Les dessins, en bref

- Toutes les couches sont dans le carré de 108 de la planche 70. Le
  soleil (centre 54, 62 ; rayon 24) est découpé en trois morceaux exacts
  au lieu d'être recouvert de deux filets crème : même image, et le
  convertisseur n'a besoin ni de `clipPath` ni de masque.
- **Zone sûre** (cercle de 66 dp au centre) : le soleil y tient entier
  (point le plus loin du centre : 25,3 ; limite 33). Les bandes, le sol
  brun et le chemin vont jusqu'aux bords exprès : ce sont des aplats qui
  remplissent tout masque de lanceur (rond, carré arrondi, goutte). Aucun
  recadrage n'a été nécessaire.
- **iOS** : les 72 du centre du carré de 108 (comme la planche 70).
- **Monochrome** (icônes à thème d'Android 13) : le soleil et ses deux
  filets, puis une barre d'horizon (x 27 à 81, y 66 à 72, bouts ronds),
  sans les bandes ni le chemin. Tout tient dans la zone sûre (31,3 ; limite
  33).
- **Démarrage** : le disque visible de l'icône (cercle de 72) dans un anneau
  brun de 3,5 sur 78, soit environ 8 points à 176. Rond, donc rien n'est
  coupé par le rond de 192 dp d'Android 12 et plus.

## Conversion et contrôle

N'importe quel convertisseur SVG courant convient (`rsvg-convert` de
librsvg, `sharp`, Inkscape). Exemple :
`rsvg-convert -w 1024 -h 1024 icone-ios-1024.svg -o icon.png`.

Contrôler chaque PNG : 1024 × 1024 px (`sips -g pixelWidth -g pixelHeight`),
et pour `icon.png`, pas de canal alpha (`sips -g hasAlpha` doit répondre
`no` ; sinon l'aplatir sur `#F4E4C1`).
