/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: '.',
  testMatch: ['<rootDir>/test/**/*.spec.ts'],
  moduleNameMapper: {
    '^@stranger/test-fixtures$': '<rootDir>/../../packages/test-fixtures/src/index.ts',
    '^@stranger/ts-platform$': '<rootDir>/../../packages/ts-platform/src/index.ts',
  },
};
