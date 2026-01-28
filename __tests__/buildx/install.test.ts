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

import {describe, expect, it, test, afterEach} from '@jest/globals';
import fs from 'fs';
import os from 'os';
import path from 'path';
import * as rimraf from 'rimraf';

import {mockArch, mockPlatform} from '../.helpers/os';

import {Install} from '../../src/buildx/install';

const tmpDir = fs.mkdtempSync(path.join(process.env.TEMP || os.tmpdir(), 'buildx-install-'));

afterEach(function () {
  rimraf.sync(tmpDir);
});

describe('download', () => {
  // prettier-ignore
  test.each([
    ['v0.9.0', false],
    ['v0.10.5', true],
    ['latest', true]
  ])(
  'acquires %p of buildx (standalone: %p)', async (version, standalone) => {
    const install = new Install({standalone: standalone});
    const toolPath = await install.download(version);
    expect(fs.existsSync(toolPath)).toBe(true);
    let buildxBin: string;
    if (standalone) {
      buildxBin = await install.installStandalone(toolPath, tmpDir);
    } else {
      buildxBin = await install.installPlugin(toolPath, tmpDir);
    }
    expect(fs.existsSync(buildxBin)).toBe(true);
  }, 100000);

  // prettier-ignore
  test.each([
    // following versions are already cached to htc from previous test cases
    ['v0.9.0'],
    ['v0.10.5'],
  ])(
  'acquires %p of buildx with cache', async (version) => {
    const install = new Install({standalone: false});
    const toolPath = await install.download(version);
    expect(fs.existsSync(toolPath)).toBe(true);
  }, 100000);

  // prettier-ignore
  test.each([
    ['v0.11.2'],
    ['v0.12.0'],
  ])(
  'acquires %p of buildx without cache', async (version) => {
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
  'acquires buildx for %s/%s', async (os, arch) => {
    mockPlatform(os as NodeJS.Platform);
    mockArch(arch);
    const install = new Install();
    const buildxBin = await install.download('latest');
    expect(fs.existsSync(buildxBin)).toBe(true);
  }, 100000);
});

describe('build', () => {
  it.skip('builds refs/pull/648/head', async () => {
    const install = new Install();
    const toolPath = await install.build('https://github.com/docker/buildx.git#refs/pull/648/head');
    expect(fs.existsSync(toolPath)).toBe(true);
    const buildxBin = await install.installStandalone(toolPath, tmpDir);
    expect(fs.existsSync(buildxBin)).toBe(true);
  }, 100000);

  it.skip('builds 67bd6f4dc82a9cd96f34133dab3f6f7af803bb14', async () => {
    const install = new Install();
    const toolPath = await install.build('https://github.com/docker/buildx.git#67bd6f4dc82a9cd96f34133dab3f6f7af803bb14');
    expect(fs.existsSync(toolPath)).toBe(true);
    const buildxBin = await install.installPlugin(toolPath, tmpDir);
    expect(fs.existsSync(buildxBin)).toBe(true);
  }, 100000);
});

describe('getDownloadVersion', () => {
  it('returns official latest download version', async () => {
    const version = await Install.getDownloadVersion('latest');
    expect(version.key).toEqual('official');
    expect(version.version).toEqual('latest');
    expect(version.downloadURL).toEqual('https://github.com/docker/buildx/releases/download/v%s/%s');
    expect(version.contentOpts).toEqual({
      owner: 'docker',
      repo: 'actions-toolkit',
      ref: 'main',
      path: '.github/buildx-releases.json'
    });
  });

  it('returns official v0.10.1 download version', async () => {
    const version = await Install.getDownloadVersion('v0.10.1');
    expect(version.key).toEqual('official');
    expect(version.version).toEqual('v0.10.1');
    expect(version.downloadURL).toEqual('https://github.com/docker/buildx/releases/download/v%s/%s');
    expect(version.contentOpts).toEqual({
      owner: 'docker',
      repo: 'actions-toolkit',
      ref: 'main',
      path: '.github/buildx-releases.json'
    });
  });

  it('returns cloud latest download version', async () => {
    const version = await Install.getDownloadVersion('cloud:latest');
    expect(version.key).toEqual('cloud');
    expect(version.version).toEqual('latest');
    expect(version.downloadURL).toEqual('https://github.com/docker/buildx-desktop/releases/download/v%s/%s');
    expect(version.contentOpts).toEqual({
      owner: 'docker',
      repo: 'actions-toolkit',
      ref: 'main',
      path: '.github/buildx-lab-releases.json'
    });
  });

  it('returns cloud v0.11.2-desktop.2 download version', async () => {
    const version = await Install.getDownloadVersion('cloud:v0.11.2-desktop.2');
    expect(version.key).toEqual('cloud');
    expect(version.version).toEqual('v0.11.2-desktop.2');
    expect(version.downloadURL).toEqual('https://github.com/docker/buildx-desktop/releases/download/v%s/%s');
    expect(version.contentOpts).toEqual({
      owner: 'docker',
      repo: 'actions-toolkit',
      ref: 'main',
      path: '.github/buildx-lab-releases.json'
    });
  });

  it('returns cloud for lab version', async () => {
    const version = await Install.getDownloadVersion('lab:latest');
    expect(version.key).toEqual('cloud');
    expect(version.version).toEqual('latest');
    expect(version.downloadURL).toEqual('https://github.com/docker/buildx-desktop/releases/download/v%s/%s');
    expect(version.contentOpts).toEqual({
      owner: 'docker',
      repo: 'actions-toolkit',
      ref: 'main',
      path: '.github/buildx-lab-releases.json'
    });
  });

  it('unknown repo', async () => {
    await expect(Install.getDownloadVersion('foo:bar')).rejects.toThrow(new Error('Cannot find buildx version for foo:bar'));
  });
});

describe('getRelease', () => {
  it('returns latest official GitHub release', async () => {
    const version = await Install.getDownloadVersion('latest');
    const release = await Install.getRelease(version);
    expect(release).not.toBeNull();
    expect(release?.tag_name).not.toEqual('');
  });

  it('returns v0.10.1 official GitHub release', async () => {
    const version = await Install.getDownloadVersion('v0.10.1');
    const release = await Install.getRelease(version);
    expect(release).not.toBeNull();
    expect(release?.id).toEqual(90346950);
    expect(release?.tag_name).toEqual('v0.10.1');
    expect(release?.html_url).toEqual('https://github.com/docker/buildx/releases/tag/v0.10.1');
  });

  it('returns v0.11.2-desktop.2 cloud GitHub release', async () => {
    const version = await Install.getDownloadVersion('cloud:v0.11.2-desktop.2');
    const release = await Install.getRelease(version);
    expect(release).not.toBeNull();
    expect(release?.id).toEqual(118213369);
    expect(release?.tag_name).toEqual('v0.11.2-desktop.2');
    expect(release?.html_url).toEqual('https://github.com/docker/buildx-desktop/releases/tag/v0.11.2-desktop.2');
  });

  it('unknown release', async () => {
    const version = await Install.getDownloadVersion('foo');
    await expect(Install.getRelease(version)).rejects.toThrow(new Error('Cannot find Buildx release foo in releases JSON'));
  });
});
