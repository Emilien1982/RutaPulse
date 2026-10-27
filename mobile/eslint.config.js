const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

// Dependency rules between folders: see ADR 0011, section 3, as replaced by
// ADR 0014 (shared-data/).
// Each rule covers the alias form (@/x) and the relative form (../x).
function group(message, ...names) {
  const group = names.flatMap((n) => [
    `@/${n}`,
    `@/${n}/*`,
    `**/${n}`,
    `**/${n}/*`,
  ]);
  return { group, message };
}

const features = group('Not allowed from this folder.', 'features');
const modules = group('Not allowed from this folder.', 'modules');
modules.group.push('@modules', '@modules/*');
const nativeModules = {
  ...modules,
  message: 'Seul shared-data/ importe un module natif (ADR 0015).',
};
const ui = group('Not allowed from this folder.', 'ui');
const core = group('Not allowed from this folder.', 'core');
const app = group('Not allowed from this folder.', 'app');
const sharedData = group('Not allowed from this folder.', 'shared-data');

function restrict(files, { paths = [], patterns = [] }) {
  return {
    files,
    rules: { 'no-restricted-imports': ['error', { paths, patterns }] },
  };
}

// A feature may only import itself: no "../" that leaves its own folder.
// The depth of the file inside the feature decides how many "../" leave it.
const featureDepths = [1, 2, 3, 4].map((depth) =>
  restrict([`src/features/${'*/'.repeat(depth)}*`], {
    patterns: [
      group('A feature must not import another feature.', 'features'),
      nativeModules,
      {
        group: [`${'../'.repeat(depth)}*`],
        message:
          'A feature must not import another feature (a "../" leaves its own folder).',
      },
    ],
  }),
);

module.exports = defineConfig([
  expoConfig,
  { ignores: ['dist/*', 'android/*', 'ios/*', '.expo/*'] },
  restrict(['src/core/**'], {
    paths: ['react', 'react-native'].map((name) => ({
      name,
      message: 'core/ must stay pure TypeScript.',
    })),
    patterns: [
      {
        group: [
          'react/*',
          'react-native/*',
          'react-native-*',
          'expo',
          'expo/*',
          'expo-*',
        ],
        message: 'core/ must stay pure TypeScript.',
      },
      features,
      ui,
      app,
      modules,
      sharedData,
    ],
  }),
  restrict(['src/ui/**'], { patterns: [features, sharedData, modules] }),
  restrict(['src/app/**'], { patterns: [core, ui, sharedData, modules] }),
  restrict(['src/shared-data/**'], { patterns: [features, ui, app] }),
  ...featureDepths,
  restrict(['modules/**'], {
    patterns: [
      {
        group: ['@/*', '**/src', '**/src/*'],
        message: 'modules/ must not import anything from src/.',
      },
    ],
  }),
]);
