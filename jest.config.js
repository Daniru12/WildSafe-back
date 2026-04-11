module.exports = {
  testEnvironment: 'node',
  maxWorkers: 1, // run one worker so projects run sequentially and default cleanup does not wipe ranger data
  collectCoverageFrom: [
    'controllers/**/*.js',
    'models/**/*.js',
    'routes/**/*.js',
    'middleware/**/*.js',
    '!**/node_modules/**',
    '!**/coverage/**'
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  verbose: true,
  testTimeout: 10000,
  // tests/ranger/* uses setupRanger.js so afterEach does not wipe cases/rangermissions
  projects: [
    {
      displayName: 'default',
      testEnvironment: 'node',
      testMatch: ['**/__tests__/**/*.js', '**/?(*.)+(spec|test).js'],
      testPathIgnorePatterns: [
        '/node_modules/',
        '[/\\\\]tests[/\\\\]ranger[/\\\\]'
      ],
      setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
      testTimeout: 10000
    },
    {
      displayName: 'ranger',
      testEnvironment: 'node',
      testMatch: ['<rootDir>/tests/ranger/**/*.test.js'],
      setupFilesAfterEnv: ['<rootDir>/tests/setupRanger.js'],
      testTimeout: 60000
    }
  ]
};
