module.exports = {
    preset: 'ts-jest',
    testEnvironment: 'node',
    testMatch: ['**/*.(test|spec).ts'],
    // testMatch: ['**/?(*.)+(test|spec|workflow-tests).ts'],

    collectCoverageFrom: [
      'src/**/*.ts',
      'examples/**/*.ts',
      '!**/*.d.ts',
    ],
    setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
    testTimeout: 30000,
  };
  