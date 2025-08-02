module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/packages'],
  testMatch: ['**/__tests__/**/*.ts', '**/?(*.)+(spec|test).ts'],
  transform: {
    '^.+\\.ts$': 'ts-jest',
  },
  collectCoverageFrom: [
    'packages/*/src/**/*.ts',
    '!packages/*/src/**/*.d.ts',
    '!packages/*/src/**/*.test.ts',
    '!packages/*/src/**/*.spec.ts',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  projects: [
    {
      displayName: 'core',
      testMatch: ['<rootDir>/packages/core/**/*.test.ts'],
    },
    {
      displayName: 'nextjs',
      testMatch: ['<rootDir>/packages/nextjs/**/*.test.ts'],
    },
    {
      displayName: 'vercel',
      testMatch: ['<rootDir>/packages/vercel/**/*.test.ts'],
    },
    {
      displayName: 'cloudflare',
      testMatch: ['<rootDir>/packages/cloudflare/**/*.test.ts'],
    },
    {
      displayName: 'aws-lambda',
      testMatch: ['<rootDir>/packages/aws-lambda/**/*.test.ts'],
    },
  ],
};