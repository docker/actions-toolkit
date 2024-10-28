/**
 * Copyright 2024 actions-toolkit authors
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

import {describe, expect, it, jest, test, afterEach} from '@jest/globals';
import fs from 'fs';
import os from 'os';
import path from 'path';
import * as rimraf from 'rimraf';
import osm = require('os');

import {Install} from '../../src/undock/install';

const tmpDir = fs.mkdtempSync(path.join(process.env.TEMP || os.tmpdir(), 'undock-install-'));

afterEach(function () {
  rimraf.sync(tmpDir);
});

describe('download', () => {
  // prettier-ignore
  test.each([
    ['v0.4.0'],
    ['v0.7.0'],
    ['latest']
  ])(
  'acquires %p of undock (standalone: %p)', async (version) => {
      const install = new Install();
      const toolPath = await install.download(version);
      expect(fs.existsSync(toolPath)).toBe(true);
      const undockBin = await install.install(toolPath, tmpDir);
      expect(fs.existsSync(undockBin)).toBe(true);
    },
    100000
  );

  // prettier-ignore
  test.each([
    // following versions are already cached to htc from previous test cases
    ['v0.4.0'],
    ['v0.7.0'],
  ])(
  'acquires %p of undock with cache', async (version) => {
    const install = new Install();
    const toolPath = await install.download(version);
    expect(fs.existsSync(toolPath)).toBe(true);
  });

  // prettier-ignore
  test.each([
    ['v0.5.0'],
    ['v0.6.0'],
  ])(
  'acquires %p of undock without cache', async (version) => {
    const install = new Install();
    const toolPath = await install.download(version, true);
    expect(fs.existsSync(toolPath)).toBe(true);
  });

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
  'acquires undock for %s/%s', async (os, arch) => {
      jest.spyOn(osm, 'platform').mockImplementation(() => os as NodeJS.Platform);
      jest.spyOn(osm, 'arch').mockImplementation(() => arch);
      const install = new Install();
      const undockBin = await install.download('latest');
      expect(fs.existsSync(undockBin)).toBe(true);
    },
    100000
  );
});

describe('getDownloadVersion', () => {
  it('returns latest download version', async () => {
    const version = await Install.getDownloadVersion('latest');
    expect(version.version).toEqual('latest');
    expect(version.downloadURL).toEqual('https://github.com/crazy-max/undock/releases/download/v%s/%s');
    expect(version.releasesURL).toEqual('https://raw.githubusercontent.com/docker/actions-toolkit/main/.github/undock-releases.json');
  });
  it('returns v0.6.0 download version', async () => {
    const version = await Install.getDownloadVersion('v0.6.0');
    expect(version.version).toEqual('v0.6.0');
    expect(version.downloadURL).toEqual('https://github.com/crazy-max/undock/releases/download/v%s/%s');
    expect(version.releasesURL).toEqual('https://raw.githubusercontent.com/docker/actions-toolkit/main/.github/undock-releases.json');
  });
});

describe('getRelease', () => {
  it('returns latest GitHub release', async () => {
    const version = await Install.getDownloadVersion('latest');
    const release = await Install.getRelease(version);
    expect(release).not.toBeNull();
    expect(release?.tag_name).not.toEqual('');
  });
  it('returns v0.6.0 GitHub release', async () => {
    const version = await Install.getDownloadVersion('v0.6.0');
    const release = await Install.getRelease(version);
    expect(release).not.toBeNull();
    expect(release?.id).toEqual(121362767);
    expect(release?.tag_name).toEqual('v0.6.0');
    expect(release?.html_url).toEqual('https://github.com/crazy-max/undock/releases/tag/v0.6.0');
  });
  it('unknown release', async () => {
    const version = await Install.getDownloadVersion('foo');
    await expect(Install.getRelease(version)).rejects.toThrow(new Error('Cannot find Undock release foo in https://raw.githubusercontent.com/docker/actions-toolkit/main/.github/undock-releases.json'));
  });
});
