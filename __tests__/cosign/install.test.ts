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

import {Install} from '../../src/cosign/install';

const tmpDir = fs.mkdtempSync(path.join(process.env.TEMP || os.tmpdir(), 'cosign-install-'));

afterEach(function () {
  rimraf.sync(tmpDir);
});

describe('download', () => {
  // prettier-ignore
  test.each([
    ['v2.6.1'],
    ['v3.0.1'],
    ['latest']
  ])(
  'acquires %p of cosign', async (version) => {
    const install = new Install();
    const toolPath = await install.download(version);
    expect(fs.existsSync(toolPath)).toBe(true);
    const cosignBin = await install.install(toolPath, tmpDir);
    expect(fs.existsSync(cosignBin)).toBe(true);
  }, 100000);

  // prettier-ignore
  test.each([
    // following versions are already cached to htc from previous test cases
    ['v2.6.1'],
    ['v3.0.1'],
  ])(
  'acquires %p of cosign with cache', async (version) => {
    const install = new Install();
    const toolPath = await install.download(version);
    expect(fs.existsSync(toolPath)).toBe(true);
  }, 100000);

  // prettier-ignore
  test.each([
    ['v2.5.3'],
    ['v2.6.0'],
  ])(
  'acquires %p of cosign without cache', async (version) => {
    const install = new Install();
    const toolPath = await install.download(version, true);
    expect(fs.existsSync(toolPath)).toBe(true);
  }, 100000);

  // TODO: add tests for arm
  // prettier-ignore
  test.each([
    ['win32', 'x64'],
    ['darwin', 'x64'],
    ['darwin', 'arm64'],
    ['linux', 'x64'],
    ['linux', 'arm64']
  ])(
  'acquires undock for %s/%s', async (os, arch) => {
    jest.spyOn(osm, 'platform').mockImplementation(() => os as NodeJS.Platform);
    jest.spyOn(osm, 'arch').mockImplementation(() => arch);
    const install = new Install();
    const cosignBin = await install.download('latest');
    expect(fs.existsSync(cosignBin)).toBe(true);
  }, 100000);
});

describe('getDownloadVersion', () => {
  it('returns latest download version', async () => {
    const version = await Install.getDownloadVersion('latest');
    expect(version.version).toEqual('latest');
    expect(version.downloadURL).toEqual('https://github.com/sigstore/cosign/releases/download/v%s/%s');
    expect(version.contentOpts).toEqual({
      owner: 'docker',
      repo: 'actions-toolkit',
      ref: 'main',
      path: '.github/cosign-releases.json'
    });
  });
  it('returns v3.0.2 download version', async () => {
    const version = await Install.getDownloadVersion('v3.0.2');
    expect(version.version).toEqual('v3.0.2');
    expect(version.downloadURL).toEqual('https://github.com/sigstore/cosign/releases/download/v%s/%s');
    expect(version.contentOpts).toEqual({
      owner: 'docker',
      repo: 'actions-toolkit',
      ref: 'main',
      path: '.github/cosign-releases.json'
    });
  });
});

describe('getRelease', () => {
  it('returns latest GitHub release', async () => {
    const version = await Install.getDownloadVersion('latest');
    const release = await Install.getRelease(version);
    expect(release).not.toBeNull();
    expect(release?.tag_name).not.toEqual('');
  });
  it('returns v3.0.2 GitHub release', async () => {
    const version = await Install.getDownloadVersion('v3.0.2');
    const release = await Install.getRelease(version);
    expect(release).not.toBeNull();
    expect(release?.id).toEqual(253720294);
    expect(release?.tag_name).toEqual('v3.0.2');
    expect(release?.html_url).toEqual('https://github.com/sigstore/cosign/releases/tag/v3.0.2');
  });
  it('unknown release', async () => {
    const version = await Install.getDownloadVersion('foo');
    await expect(Install.getRelease(version)).rejects.toThrow(new Error('Cannot find Cosign release foo in releases JSON'));
  });
});
