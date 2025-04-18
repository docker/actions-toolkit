/**
 * Copyright 2025 actions-toolkit authors
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

import {Install} from '../../src/compose/install';

const tmpDir = fs.mkdtempSync(path.join(process.env.TEMP || os.tmpdir(), 'compose-install-'));

afterEach(function () {
  rimraf.sync(tmpDir);
});

describe('download', () => {
  // prettier-ignore
  test.each([
    ['v2.31.0', false],
    ['v2.32.4', true],
    ['latest', true]
  ])(
  'acquires %p of compose (standalone: %p)', async (version, standalone) => {
    const install = new Install({standalone: standalone});
    const toolPath = await install.download(version);
    expect(fs.existsSync(toolPath)).toBe(true);
    let composeBin: string;
    if (standalone) {
      composeBin = await install.installStandalone(toolPath, tmpDir);
    } else {
      composeBin = await install.installPlugin(toolPath, tmpDir);
    }
    expect(fs.existsSync(composeBin)).toBe(true);
  }, 100000);

  // prettier-ignore
  test.each([
    // following versions are already cached to htc from previous test cases
    ['v2.31.0'],
    ['v2.32.4'],
  ])(
  'acquires %p of compose with cache', async (version) => {
    const install = new Install({standalone: false});
    const toolPath = await install.download(version);
    expect(fs.existsSync(toolPath)).toBe(true);
  }, 100000);

  // prettier-ignore
  test.each([
    ['v2.27.1'],
    ['v2.28.0'],
  ])(
  'acquires %p of compose without cache', async (version) => {
    const install = new Install({standalone: false});
    const toolPath = await install.download(version, true);
    expect(fs.existsSync(toolPath)).toBe(true);
  }, 100000);

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
  'acquires compose for %s/%s', async (os, arch) => {
    jest.spyOn(osm, 'platform').mockImplementation(() => os as NodeJS.Platform);
    jest.spyOn(osm, 'arch').mockImplementation(() => arch);
    const install = new Install();
    const composeBin = await install.download('latest');
    expect(fs.existsSync(composeBin)).toBe(true);
  }, 100000);
});

describe('getDownloadVersion', () => {
  it('returns official latest download version', async () => {
    const version = await Install.getDownloadVersion('latest');
    expect(version.key).toEqual('official');
    expect(version.version).toEqual('latest');
    expect(version.downloadURL).toEqual('https://github.com/docker/compose/releases/download/v%s/%s');
    expect(version.releasesURL).toEqual('https://raw.githubusercontent.com/docker/actions-toolkit/main/.github/compose-releases.json');
  });
  it('returns official v2.24.3 download version', async () => {
    const version = await Install.getDownloadVersion('v2.24.3');
    expect(version.key).toEqual('official');
    expect(version.version).toEqual('v2.24.3');
    expect(version.downloadURL).toEqual('https://github.com/docker/compose/releases/download/v%s/%s');
    expect(version.releasesURL).toEqual('https://raw.githubusercontent.com/docker/actions-toolkit/main/.github/compose-releases.json');
  });
  it('returns cloud latest download version', async () => {
    const version = await Install.getDownloadVersion('cloud:latest');
    expect(version.key).toEqual('cloud');
    expect(version.version).toEqual('latest');
    expect(version.downloadURL).toEqual('https://github.com/docker/compose-desktop/releases/download/v%s/%s');
    expect(version.releasesURL).toEqual('https://raw.githubusercontent.com/docker/actions-toolkit/main/.github/compose-lab-releases.json');
  });
  it('returns cloud v2.27.1-desktop.1 download version', async () => {
    const version = await Install.getDownloadVersion('cloud:v2.27.1-desktop.1');
    expect(version.key).toEqual('cloud');
    expect(version.version).toEqual('v2.27.1-desktop.1');
    expect(version.downloadURL).toEqual('https://github.com/docker/compose-desktop/releases/download/v%s/%s');
    expect(version.releasesURL).toEqual('https://raw.githubusercontent.com/docker/actions-toolkit/main/.github/compose-lab-releases.json');
  });
  it('unknown repo', async () => {
    await expect(Install.getDownloadVersion('foo:bar')).rejects.toThrow(new Error('Cannot find compose version for foo:bar'));
  });
});

describe('getRelease', () => {
  it('returns latest official GitHub release', async () => {
    const version = await Install.getDownloadVersion('latest');
    const release = await Install.getRelease(version);
    expect(release).not.toBeNull();
    expect(release?.tag_name).not.toEqual('');
  });
  it('returns v2.24.3 official GitHub release', async () => {
    const version = await Install.getDownloadVersion('v2.24.3');
    const release = await Install.getRelease(version);
    expect(release).not.toBeNull();
    expect(release?.id).toEqual(138380726);
    expect(release?.tag_name).toEqual('v2.24.3');
    expect(release?.html_url).toEqual('https://github.com/docker/compose/releases/tag/v2.24.3');
  });
  it('returns v2.27.1-desktop.1 cloud GitHub release', async () => {
    const version = await Install.getDownloadVersion('cloud:v2.27.1-desktop.1');
    const release = await Install.getRelease(version);
    expect(release).not.toBeNull();
    expect(release?.id).toEqual(157591108);
    expect(release?.tag_name).toEqual('v2.27.1-desktop.1');
    expect(release?.html_url).toEqual('https://github.com/docker/compose-desktop/releases/tag/v2.27.1-desktop.1');
  });
  it('unknown release', async () => {
    const version = await Install.getDownloadVersion('foo');
    await expect(Install.getRelease(version)).rejects.toThrow(new Error('Cannot find Compose release foo in https://raw.githubusercontent.com/docker/actions-toolkit/main/.github/compose-releases.json'));
  });
});
