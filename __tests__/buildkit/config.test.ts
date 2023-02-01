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

import {BuildKit} from '../../src/buildkit/buildkit';
import {Context} from '../../src/context';

const fixturesDir = path.join(__dirname, '..', 'fixtures');
const tmpDir = path.join('/tmp/.docker-actions-toolkit-jest').split(path.sep).join(path.posix.sep);
const tmpName = path.join(tmpDir, '.tmpname-jest').split(path.sep).join(path.posix.sep);

jest.spyOn(Context.prototype, 'tmpDir').mockImplementation((): string => {
  if (!fs.existsSync(tmpDir)) {
    fs.mkdirSync(tmpDir, {recursive: true});
  }
  return tmpDir;
});
jest.spyOn(Context.prototype, 'tmpName').mockImplementation((): string => {
  return tmpName;
});

beforeEach(() => {
  jest.clearAllMocks();
});

afterEach(() => {
  rimraf.sync(tmpDir);
});

describe('generate', () => {
  test.each([
    ['debug = true', false, 'debug = true', null],
    [`notfound.toml`, true, '', new Error('config file notfound.toml not found')],
    [
      `${path.join(fixturesDir, 'buildkitd.toml').split(path.sep).join(path.posix.sep)}`,
      true,
      `debug = true
[registry."docker.io"]
  mirrors = ["mirror.gcr.io"]
`,
      null
    ]
  ])('given %p config', async (val, file, exValue, error: Error) => {
    try {
      const buildkit = new BuildKit({
        context: new Context()
      });
      let config: string;
      if (file) {
        config = buildkit.config.generateFromFile(val);
      } else {
        config = buildkit.config.generateFromString(val);
      }
      expect(config).toEqual(tmpName);
      const configValue = fs.readFileSync(tmpName, 'utf-8');
      expect(configValue).toEqual(exValue);
    } catch (e) {
      // eslint-disable-next-line jest/no-conditional-expect
      expect(e.message).toEqual(error?.message);
    }
  });
});
