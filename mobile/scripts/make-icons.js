// Converts the SVG sources of design/v1/icone/ into the PNG images of
// assets/images/ (phase 10a, T2). Rerunnable. Needs Google Chrome (macOS).
// Usage (from mobile/): node scripts/make-icons.js
/* global __dirname */
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { PNG } = require('pngjs');

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const SRC = path.join(__dirname, '..', '..', 'design', 'v1', 'icone');
const OUT = path.join(__dirname, '..', 'assets', 'images');
const SIZE = 1024;

// [svg, png, opaque]
const JOBS = [
  ['icone-ios-1024.svg', 'icon.png', true],
  ['android-dessin-108.svg', 'android-icon-foreground.png', false],
  ['android-fond-108.svg', 'android-icon-background.png', true],
  ['android-monochrome-108.svg', 'android-icon-monochrome.png', false],
  ['demarrage.svg', 'splash-icon.png', false],
];

// Removes the alpha channel (the picture is already fully opaque).
function dropAlpha(file) {
  const png = PNG.sync.read(fs.readFileSync(file));
  for (let i = 3; i < png.data.length; i += 4) {
    if (png.data[i] !== 255) throw new Error(`${file}: not opaque`);
  }
  fs.writeFileSync(file, PNG.sync.write(png, { colorType: 2 }));
}

// Fails if the picture is not SIZE x SIZE px.
function checkSize(file) {
  const { width, height } = PNG.sync.read(fs.readFileSync(file));
  if (width !== SIZE || height !== SIZE) {
    throw new Error(`${file}: ${width}x${height}, expected ${SIZE}x${SIZE}`);
  }
}

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rutapulse-icons-'));
try {
  for (const [svg, png, opaque] of JOBS) {
    const html = path.join(tmp, `${png}.html`);
    const svgUrl = pathToFileURL(path.join(SRC, svg)).href;
    fs.writeFileSync(
      html,
      `<!doctype html><style>html,body{margin:0;background:transparent}` +
        `img{display:block;width:${SIZE}px;height:${SIZE}px}</style>` +
        `<img src="${svgUrl}">`,
    );
    const out = path.join(OUT, png);
    execFileSync(
      CHROME,
      [
        '--headless=new',
        '--disable-gpu',
        '--hide-scrollbars',
        '--force-device-scale-factor=1',
        '--default-background-color=00000000',
        `--window-size=${SIZE},${SIZE}`,
        `--user-data-dir=${path.join(tmp, 'profile')}`,
        `--screenshot=${out}`,
        pathToFileURL(html).href,
      ],
      { stdio: 'ignore' },
    );
    if (opaque) dropAlpha(out);
    checkSize(out);
    console.log(`${svg} -> ${png}`);
  }
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}
