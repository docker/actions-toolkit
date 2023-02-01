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
import * as semver from 'semver';

import {BuildKit} from '../src/buildkit';
import {Builder, BuilderInfo} from '../src/builder';
import {Context} from '../src/context';

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

jest.spyOn(Builder.prototype, 'inspect').mockImplementation(async (): Promise<BuilderInfo> => {
  return {
    name: 'builder2',
    driver: 'docker-container',
    lastActivity: new Date('2023-01-16 09:45:23 +0000 UTC'),
    nodes: [
      {
        buildkitVersion: 'v0.11.0',
        buildkitdFlags: '--debug --allow-insecure-entitlement security.insecure --allow-insecure-entitlement network.host',
        driverOpts: ['BUILDKIT_STEP_LOG_MAX_SIZE=10485760', 'BUILDKIT_STEP_LOG_MAX_SPEED=10485760', 'JAEGER_TRACE=localhost:6831', 'image=moby/buildkit:latest', 'network=host'],
        endpoint: 'unix:///var/run/docker.sock',
        name: 'builder20',
        platforms: 'linux/amd64,linux/amd64/v2,linux/amd64/v3,linux/arm64,linux/riscv64,linux/ppc64le,linux/s390x,linux/386,linux/mips64le,linux/mips64,linux/arm/v7,linux/arm/v6',
        status: 'running'
      }
    ]
  };
});

describe('getVersion', () => {
  it('valid', async () => {
    const buildkit = new BuildKit({
      context: new Context()
    });
    const version = await buildkit.getVersion('builder2');
    expect(semver.valid(version)).not.toBeNull();
  });
});

describe('satisfies', () => {
  test.each([
    ['builder2', '>=0.10.0', true],
    ['builder2', '>0.11.0', false]
  ])('given %p', async (builderName, range, expected) => {
    const buildkit = new BuildKit({
      context: new Context()
    });
    expect(await buildkit.versionSatisfies(builderName, range)).toBe(expected);
  });
});

describe('generateConfig', () => {
  test.each([
    ['debug = true', false, 'debug = true', null],
    [`notfound.toml`, true, '', new Error('config file notfound.toml not found')],
    [
      `${path.join(__dirname, 'fixtures', 'buildkitd.toml').split(path.sep).join(path.posix.sep)}`,
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
        config = buildkit.generateConfigFile(val);
      } else {
        config = buildkit.generateConfigInline(val);
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
