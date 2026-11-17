// Essai jetable : signe la release avec une cle lue dans un fichier de
// proprietes HORS du depot (chemin dans RUTAPULSE_SIGNING).
const { withAppBuildGradle } = require('expo/config-plugins');

module.exports = function withReleaseSigning(config) {
  return withAppBuildGradle(config, (config) => {
    let g = config.modResults.contents;
    if (g.includes('signingConfigs.release')) return config;
    g = g.replace(
      /signingConfigs \{/,
      `signingConfigs {
        release {
            def p = new Properties()
            def f = System.getenv('RUTAPULSE_SIGNING')
            if (f == null || !file(f).exists()) {
                throw new GradleException('RUTAPULSE_SIGNING manquant : pas de release signee')
            }
            file(f).withInputStream { p.load(it) }
            storeFile file(p['storeFile'])
            storePassword p['storePassword']
            keyAlias p['keyAlias']
            keyPassword p['keyPassword']
        }`,
    );
    g = g.replace(
      /(release \{\s*\/\/ Caution[^\n]*\n[^\n]*\n\s*)signingConfig signingConfigs\.debug/,
      '$1signingConfig signingConfigs.release',
    );
    config.modResults.contents = g;
    return config;
  });
};
