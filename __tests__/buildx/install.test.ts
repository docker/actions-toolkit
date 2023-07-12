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

import {describe, expect, it, jest, test, beforeEach, afterEach} from '@jest/globals';
import * as fs from 'fs';
import * as path from 'path';
import * as rimraf from 'rimraf';
import osm = require('os');

import {Install} from '../../src/buildx/install';

import release_0_9_0 = require('./release-v0.9.0.json');

// prettier-ignore
const tmpDir = path.join(process.env.TEMP || '/tmp', 'buildx-jest');
let octokit;

beforeEach(() => {
  jest.clearAllMocks();
  octokit = {
    rest: {
      repos: {
        getLatestRelease: jest.fn().mockImplementation(() => {
          return {data: release_0_9_0};
        }),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        getReleaseByTag: jest.fn().mockImplementation((args: any) => {
          if (args.tag == 'v0.9.0') {
            return {data: release_0_9_0};
          }
          throw new Error(`Unknown release: ${args.tag}`);
        })
      }
    }
  };
});

afterEach(function () {
  rimraf.sync(tmpDir);
});

describe('download', () => {
  // prettier-ignore
  test.each([
    ['v0.9.0', false],
    ['v0.10.5', true],
    ['latest', true],
    ['https://github.com/docker/buildx/releases/tag/v0.9.0', true],
    ['https://github.com/docker/buildx/releases/latest', true],
  ])(
  'acquires %p of buildx (standalone: %p)', async (version, standalone) => {
      const install = new Install({octokit, standalone: standalone});
      const toolPath = await install.download(version);
      expect(fs.existsSync(toolPath)).toBe(true);
      let buildxBin: string;
      if (standalone) {
        buildxBin = await install.installStandalone(toolPath, tmpDir);
      } else {
        buildxBin = await install.installPlugin(toolPath, tmpDir);
      }
      expect(fs.existsSync(buildxBin)).toBe(true);
    },
    100000
  );

  // prettier-ignore
  test.each([
    // following versions are already cached to htc from previous test cases
    ['v0.9.0'],
    ['v0.10.5'],
  ])(
  'acquires %p of buildx with cache', async (version) => {
    const install = new Install({octokit, standalone: false});
    const toolPath = await install.download(version);
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
  'acquires buildx for %s/%s', async (os, arch) => {
      jest.spyOn(osm, 'platform').mockImplementation(() => os as NodeJS.Platform);
      jest.spyOn(osm, 'arch').mockImplementation(() => arch);
      const install = new Install({octokit});
      const buildxBin = await install.download('latest');
      expect(fs.existsSync(buildxBin)).toBe(true);
    },
    100000
  );

  it('returns latest buildx GitHub release', async () => {
    const release = await Install.getRelease('latest');
    expect(release).not.toBeNull();
    expect(release?.tag_name).not.toEqual('');
  });
});

describe('build', () => {
  // eslint-disable-next-line jest/no-disabled-tests
  it.skip('builds refs/pull/648/head', async () => {
    const install = new Install({octokit});
    const toolPath = await install.build('https://github.com/docker/buildx.git#refs/pull/648/head');
    expect(fs.existsSync(toolPath)).toBe(true);
    const buildxBin = await install.installStandalone(toolPath, tmpDir);
    expect(fs.existsSync(buildxBin)).toBe(true);
  }, 100000);

  // eslint-disable-next-line jest/no-disabled-tests
  it.skip('builds 67bd6f4dc82a9cd96f34133dab3f6f7af803bb14', async () => {
    const install = new Install({octokit});
    const toolPath = await install.build('https://github.com/docker/buildx.git#67bd6f4dc82a9cd96f34133dab3f6f7af803bb14');
    expect(fs.existsSync(toolPath)).toBe(true);
    const buildxBin = await install.installPlugin(toolPath, tmpDir);
    expect(fs.existsSync(buildxBin)).toBe(true);
  }, 100000);
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
    await expect(Install.getRelease('foo')).rejects.toThrow(new Error('Cannot find Buildx release foo in https://raw.githubusercontent.com/docker/actions-toolkit/main/.github/buildx-releases.json'));
  });
});
