process.env = Object.assign({}, process.env, {
  GITHUB_REPOSITORY: 'docker/test-docker-action',
  GITHUB_RUN_ID: '123',
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
  verbose: true
};
