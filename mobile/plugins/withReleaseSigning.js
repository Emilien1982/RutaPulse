// Release signing (ADR 0022). The release is signed with the key described by
// the properties file named in RUTAPULSE_SIGNING, kept outside the repository.
// Debug builds and the CI do not need it: without the file, the release
// config stays empty and only a release build is stopped (lock 1).
const { withAppBuildGradle } = require('expo/config-plugins');

// Mark of this plugin, used to avoid patching twice.
const MARK = '// RutaPulse: a release never falls back on the debug key';

const SIGNING_BLOCK = `signingConfigs {
        release {
            def signingPath = System.getenv('RUTAPULSE_SIGNING')
            if (signingPath != null && file(signingPath).exists()) {
                def props = new Properties()
                file(signingPath).withInputStream { props.load(it) }
                storeFile file(props['storeFile'])
                storePassword props['storePassword']
                keyAlias props['keyAlias']
                keyPassword props['keyPassword']
            }
        }`;

// Lock 1: preReleaseBuild only runs for a release.
const GUARD_BLOCK = `
${MARK} (ADR 0022).
tasks.matching { it.name == 'preReleaseBuild' }.configureEach {
    doFirst {
        def signingPath = System.getenv('RUTAPULSE_SIGNING')
        if (signingPath == null || !file(signingPath).exists()) {
            throw new GradleException('RUTAPULSE_SIGNING manquant : pas de release signée')
        }
    }
}
`;

const SIGNING_ANCHOR = 'signingConfigs {';
const RELEASE_ANCHOR =
  /(release \{\s*\/\/ Caution[^\n]*\n[^\n]*\n\s*)signingConfig signingConfigs\.debug/;

// Lock 2: fail if the generated file no longer has the lines to replace.
function patchBuildGradle(contents) {
  if (contents.includes(MARK)) return contents;
  if (!contents.includes(SIGNING_ANCHOR) || !RELEASE_ANCHOR.test(contents)) {
    throw new Error(
      'withReleaseSigning: build.gradle has changed, the release signing line was not found',
    );
  }
  return (
    contents
      .replace(SIGNING_ANCHOR, SIGNING_BLOCK)
      .replace(RELEASE_ANCHOR, '$1signingConfig signingConfigs.release') +
    GUARD_BLOCK
  );
}

module.exports = function withReleaseSigning(config) {
  return withAppBuildGradle(config, (config) => {
    config.modResults.contents = patchBuildGradle(config.modResults.contents);
    return config;
  });
};
module.exports.patchBuildGradle = patchBuildGradle;
