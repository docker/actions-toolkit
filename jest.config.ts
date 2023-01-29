process.env = Object.assign({}, process.env, {
  GITHUB_REPOSITORY: 'docker/actions-toolkit',
  RUNNER_TEMP: '/tmp/github_runner',
  RUNNER_TOOL_CACHE: '/tmp/github_tool_cache'
}) as {
  [key: string]: string;
};

module.exports = {
  clearMocks: true,
  testEnvironment: 'node',
  moduleFileExtensions: ['js', 'ts'],
  setupFiles: ['dotenv/config'],
  testMatch: ['**/*.test.ts'],
  transform: {
    '^.+\\.ts$': 'ts-jest'
  },
  moduleNameMapper: {
    '^csv-parse/sync': '<rootDir>/node_modules/csv-parse/dist/cjs/sync.cjs'
  },
  collectCoverageFrom: ['src/**/{!(toolkit.ts),}.ts'],
  coveragePathIgnorePatterns: ['lib/', 'node_modules/', '__mocks__/', '__tests__/'],
  verbose: true
};
