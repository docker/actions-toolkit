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

import {describe, expect, it, jest, test, beforeEach} from '@jest/globals';
import * as fs from 'fs';
import os from 'os';
import * as path from 'path';
import osm = require('os');

import {Install} from '../../src/buildx/install';

beforeEach(() => {
  jest.clearAllMocks();
});

describe('install', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'actions-toolkit-'));

  // prettier-ignore
  test.each([
    ['v0.4.1', false],
    ['latest', false],
    ['v0.4.1', true],
    ['latest', true]
  ])(
  'acquires %p of buildx (standalone: %p)', async (version, standalone) => {
      const install = new Install({standalone: standalone});
      const buildxBin = await install.install(version, tmpDir);
      expect(fs.existsSync(buildxBin)).toBe(true);
    },
    100000
  );

  // TODO: add tests for arm
  // prettier-ignore
  test.each([
    ['win32', 'x64'],
    ['win32', 'arm64'],
    ['darwin', 'x64'],
    ['darwin', 'arm64'],
    ['linux', 'x64'],
    ['linux', 'arm64'],
    ['linux', 'ppc64'],
    ['linux', 's390x'],
  ])(
  'acquires buildx for %s/%s', async (os, arch) => {
      jest.spyOn(osm, 'platform').mockImplementation(() => os);
      jest.spyOn(osm, 'arch').mockImplementation(() => arch);
      const install = new Install();
      const buildxBin = await install.install('latest', tmpDir);
      expect(fs.existsSync(buildxBin)).toBe(true);
    },
    100000
  );
});

describe('getRelease', () => {
  it('returns latest buildx GitHub release', async () => {
    const release = await Install.getRelease('latest');
    expect(release).not.toBeNull();
    expect(release?.tag_name).not.toEqual('');
  });

  it('returns v0.10.1 buildx GitHub release', async () => {
    const release = await Install.getRelease('v0.10.1');
    expect(release).not.toBeNull();
    expect(release?.id).toEqual(90346950);
    expect(release?.tag_name).toEqual('v0.10.1');
    expect(release?.html_url).toEqual('https://github.com/docker/buildx/releases/tag/v0.10.1');
  });

  it('returns v0.2.2 buildx GitHub release', async () => {
    const release = await Install.getRelease('v0.2.2');
    expect(release).not.toBeNull();
    expect(release?.id).toEqual(17671545);
    expect(release?.tag_name).toEqual('v0.2.2');
    expect(release?.html_url).toEqual('https://github.com/docker/buildx/releases/tag/v0.2.2');
  });

  it('unknown release', async () => {
    await expect(Install.getRelease('foo')).rejects.toThrowError(new Error('Cannot find Buildx release foo in https://raw.githubusercontent.com/docker/buildx/master/.github/releases.json'));
  });
});
