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

import {describe, expect, jest, test, beforeEach, afterEach} from '@jest/globals';
import * as fs from 'fs';
import * as path from 'path';
import * as rimraf from 'rimraf';
import osm = require('os');

import {Install} from '../../src/docker/install';

// prettier-ignore
const tmpDir = path.join(process.env.TEMP || '/tmp', 'buildx-jest');

beforeEach(() => {
  jest.clearAllMocks();
});

afterEach(function () {
  rimraf.sync(tmpDir);
});

describe('download', () => {
  // prettier-ignore
  test.each([
    ['19.03.6', 'linux'],
    ['20.10.22', 'linux'],
    ['20.10.22', 'darwin'],
    ['20.10.22', 'win32'],
  ])(
  'acquires %p of docker (%s)', async (version, platformOS) => {
    jest.spyOn(osm, 'platform').mockImplementation(() => platformOS);
    const install = new Install();
    const toolPath = await install.download(version);
    expect(fs.existsSync(toolPath)).toBe(true);
  }, 100000);
});
