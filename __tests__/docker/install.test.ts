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

import {describe, expect, jest, test, beforeEach, afterEach, it} from '@jest/globals';
import fs from 'fs';
import os from 'os';
import path from 'path';
import * as rimraf from 'rimraf';
import osm = require('os');

import {Install, InstallSourceArchive, InstallSourceImage} from '../../src/docker/install';

const tmpDir = fs.mkdtempSync(path.join(process.env.TEMP || os.tmpdir(), 'docker-install-'));

// needs GitHub REST API to get releases JSON
jest.unmock('@actions/github');

afterEach(function () {
  rimraf.sync(tmpDir);
});

const archive = (version: string, channel: string): InstallSourceArchive => {
  return {
    type: 'archive',
    version: version,
    channel: channel
  };
};

const image = (tag: string): InstallSourceImage => {
  return {
    type: 'image',
    tag: tag
  };
};

describe('download', () => {
  // prettier-ignore
  test.each([
    [archive('v19.03.14', 'stable'), 'linux'],
    [archive('v20.10.22', 'stable'), 'linux'],
    [archive('v20.10.22', 'stable'), 'darwin'],
    [archive('v20.10.22', 'stable'), 'win32'],
    [archive('v29.0.0-rc.1', 'test'), 'linux'],

    [image('master'), 'linux'],
    [image('master'), 'win32'],

    [image('27.3.1'), 'linux'],
    [image('27.3.1'), 'win32'],
  ])(
  'acquires %p of docker (%s)', async (source, platformOS) => {
    jest.spyOn(osm, 'platform').mockImplementation(() => platformOS as NodeJS.Platform);
    jest.spyOn(osm, 'arch').mockImplementation(() => 'x64');
    const install = new Install({
      source: source,
      runDir: tmpDir
    });
    const toolPath = await install.download();
    expect(fs.existsSync(toolPath)).toBe(true);
  }, 100000);
});

describe('getRelease', () => {
  it('returns latest docker GitHub release', async () => {
    const release = await Install.getRelease('latest');
    expect(release).not.toBeNull();
    expect(release?.tag_name).not.toEqual('');
  });

  it('returns v23.0.0 docker GitHub release', async () => {
    const release = await Install.getRelease('v23.0.0');
    expect(release).not.toBeNull();
    expect(release?.id).toEqual(91109643);
    expect(release?.tag_name).toEqual('v23.0.0');
    expect(release?.html_url).toEqual('https://github.com/moby/moby/releases/tag/v23.0.0');
  });

  it('returns v29.0.0-rc.1 docker GitHub release', async () => {
    const release = await Install.getRelease('v29.0.0-rc.1');
    expect(release).not.toBeNull();
    expect(release?.id).toEqual(252020476);
    expect(release?.tag_name).toEqual('docker-v29.0.0-rc.1');
    expect(release?.html_url).toEqual('https://github.com/moby/moby/releases/tag/docker-v29.0.0-rc.1');
  });

  it('unknown release', async () => {
    await expect(Install.getRelease('foo')).rejects.toThrow(new Error('Cannot find Docker release foo in releases JSON'));
  });
});

describe('limaImage', () => {
  const originalEnv = process.env;
  beforeEach(() => {
    jest.resetModules();
    process.env = {
      ...originalEnv,
      LIMA_IMAGES: `x86_64:https://cloud-images.ubuntu.com/releases/23.10/release-20231011/ubuntu-23.10-server-cloudimg-amd64.img@sha256:f6529be56da3429a56e4f5ef202bf4958201bc63f8541e478caa6e8eb712e635
aarch64:https://cloud-images.ubuntu.com/releases/23.10/release-20231011/ubuntu-23.10-server-cloudimg-arm64.img`
    };
  });
  afterEach(() => {
    process.env = originalEnv;
  });
  it('returns custom images', async () => {
    expect(Install.limaCustomImages()).toEqual([
      {
        location: 'https://cloud-images.ubuntu.com/releases/23.10/release-20231011/ubuntu-23.10-server-cloudimg-amd64.img',
        arch: 'x86_64',
        digest: 'sha256:f6529be56da3429a56e4f5ef202bf4958201bc63f8541e478caa6e8eb712e635'
      },
      {
        location: 'https://cloud-images.ubuntu.com/releases/23.10/release-20231011/ubuntu-23.10-server-cloudimg-arm64.img',
        arch: 'aarch64',
        digest: ''
      }
    ]);
  });
});
