const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

// Dependency rules between folders: see ADR 0011, section 3.
const modules = {
  group: ['modules', 'modules/*', '**/modules/*'],
  message: 'modules/ is reserved to features/.',
};
const features = {
  group: ['@/features', '@/features/*'],
  message: 'Not allowed from this folder.',
};

function restrict(files, { paths = [], patterns = [] }) {
  return {
    files,
    rules: { 'no-restricted-imports': ['error', { paths, patterns }] },
  };
}

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
      {
        group: ['@/ui', '@/ui/*', '@/app', '@/app/*'],
        message: 'core/ must not depend on ui/ or app/.',
      },
      modules,
    ],
  }),
  restrict(['src/ui/**'], { patterns: [features, modules] }),
  restrict(['src/app/**'], {
    patterns: [
      {
        group: ['@/core', '@/core/*', '@/ui', '@/ui/*'],
        message: 'app/ imports only features/.',
      },
      modules,
    ],
  }),
  restrict(['src/features/**'], {
    patterns: [
      {
        ...features,
        message:
          'A feature must not import another feature. Use a relative import in its own folder.',
      },
    ],
  }),
]);
