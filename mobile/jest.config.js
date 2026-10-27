const preset = require('jest-expo/jest-preset');

module.exports = {
  preset: 'jest-expo',
  setupFiles: ['<rootDir>/jest.setup.js'],
  moduleNameMapper: {
    '^@modules/(.*)$': '<rootDir>/modules/$1',
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  // TanStack Pacer is pure ESM (ADR 0016, section 9): Babel must transform it.
  transformIgnorePatterns: [
    preset.transformIgnorePatterns[0].replace(
      'react-native|',
      'react-native|@tanstack/react-pacer|@tanstack/pacer|',
    ),
    ...preset.transformIgnorePatterns.slice(1),
  ],
};
