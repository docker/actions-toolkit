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

module.exports = {
  testEnvironment: 'node',
  moduleFileExtensions: ['js', 'ts'],
  setupFiles: ['dotenv/config'],
  testMatch: ['**/*.test.itg.ts'],
  testTimeout: 1800000, // 30 minutes
  transform: {
    '^.+\\.[tj]s$': [
      'ts-jest',
      {
        useESM: true,
        tsconfig: '<rootDir>/tsconfig.test.json'
      }
    ]
  },
  transformIgnorePatterns: ['/node_modules/(?!(?:@actions/core|@actions/exec|@actions/github|@actions/http-client|@actions/io|@octokit|universal-user-agent|before-after-hook)/)'],
  moduleNameMapper: {
    '^@actions/core': '<rootDir>/node_modules/@actions/core/lib/core.js',
    '^@actions/exec$': '<rootDir>/node_modules/@actions/exec/lib/exec.js',
    '^@actions/github$': '<rootDir>/node_modules/@actions/github/lib/github.js',
    '^@actions/http-client$': '<rootDir>/node_modules/@actions/http-client/lib/index.js',
    '^@actions/http-client/lib/auth$': '<rootDir>/node_modules/@actions/http-client/lib/auth.js',
    '^@actions/http-client/lib/interfaces$': '<rootDir>/node_modules/@actions/http-client/lib/interfaces.js',
    '^@actions/io$': '<rootDir>/node_modules/@actions/io/lib/io.js',
    '^@actions/io/lib/io-util$': '<rootDir>/node_modules/@actions/io/lib/io-util.js',
    '^(\\.{1,2}/.*)\\.js$': '$1'
  },
  extensionsToTreatAsEsm: ['.ts'],
  testResultsProcessor: '<rootDir>/__tests__/testResultsProcessor.cjs',
  verbose: false
};
