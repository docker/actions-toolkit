/**
 * Copyright 2023 actions-toolkit authors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require('fs');
const os = require('os');
const path = require('path');

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'docker-actions-toolkit-'));

process.env = Object.assign({}, process.env, {
  TEMP: tmpDir,
  GITHUB_REPOSITORY: 'docker/actions-toolkit',
  GITHUB_RUN_ATTEMPT: 2,
  GITHUB_RUN_ID: 2188748038,
  GITHUB_RUN_NUMBER: 15,
  RUNNER_TEMP: path.join(tmpDir, 'runner-temp'),
  RUNNER_TOOL_CACHE: path.join(tmpDir, 'runner-tool-cache')
});

module.exports = {
  clearMocks: true,
  testEnvironment: 'node',
  moduleFileExtensions: ['js', 'ts'],
  setupFiles: ['dotenv/config'],
  testMatch: ['**/*.test.ts'],
  transform: {
    '^.+\\.[tj]s$': [
      'ts-jest',
      {
        useESM: true,
        tsconfig: '<rootDir>/tsconfig.test.json'
      }
    ]
  },
  // prettier-ignore
  transformIgnorePatterns: ['/node_modules/(?!(?:@actions/artifact|@actions/cache|@actions/core|@actions/exec|@actions/github|@actions/glob|@actions/http-client|@actions/io|@actions/tool-cache|@octokit|universal-user-agent|before-after-hook)/)'],
  moduleNameMapper: {
    '^@actions/artifact$': '<rootDir>/node_modules/@actions/artifact/lib/artifact.js',
    '^@actions/cache$': '<rootDir>/node_modules/@actions/cache/lib/cache.js',
    '^@actions/core': '<rootDir>/node_modules/@actions/core/lib/core.js',
    '^@actions/exec$': '<rootDir>/node_modules/@actions/exec/lib/exec.js',
    '^@actions/github$': '<rootDir>/node_modules/@actions/github/lib/github.js',
    '^@actions/github/lib/utils$': '<rootDir>/node_modules/@actions/github/lib/utils.js',
    '^@actions/glob$': '<rootDir>/node_modules/@actions/glob/lib/glob.js',
    '^@actions/http-client$': '<rootDir>/node_modules/@actions/http-client/lib/index.js',
    '^@actions/http-client/lib/auth$': '<rootDir>/node_modules/@actions/http-client/lib/auth.js',
    '^@actions/http-client/lib/interfaces$': '<rootDir>/node_modules/@actions/http-client/lib/interfaces.js',
    '^@actions/io$': '<rootDir>/node_modules/@actions/io/lib/io.js',
    '^@actions/io/lib/io-util$': '<rootDir>/node_modules/@actions/io/lib/io-util.js',
    '^@actions/tool-cache$': '<rootDir>/node_modules/@actions/tool-cache/lib/tool-cache.js',
    '^(\\.{1,2}/.*)\\.js$': '$1'
  },
  extensionsToTreatAsEsm: ['.ts'],
  collectCoverageFrom: ['src/**/{!(index.ts),}.ts'],
  coveragePathIgnorePatterns: ['lib/', 'node_modules/', '__mocks__/', '__tests__/'],
  testResultsProcessor: '<rootDir>/__tests__/testResultsProcessor.cjs',
  verbose: true
};
