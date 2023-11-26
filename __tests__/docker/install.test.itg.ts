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

import {jest, describe, expect, test, beforeEach, afterEach} from '@jest/globals';
import path from 'path';
import * as core from '@actions/core';

import {Install} from '../../src/docker/install';
import {Docker} from '../../src/docker/docker';

// prettier-ignore
const tmpDir = path.join(process.env.TEMP || '/tmp', 'docker-install-jest');

describe('install', () => {
  const originalEnv = process.env;
  beforeEach(() => {
    jest.resetModules();
    process.env = {
      ...originalEnv,
      SIGN_QEMU_BINARY: '1',
      COLIMA_START_ARGS: '--cpu 4 --memory 8 --disk 32'
    };
  });
  afterEach(() => {
    process.env = originalEnv;
  });
  // prettier-ignore
  test.each(['v24.0.4'])(
    'install docker %s', async (version) => {
      await expect((async () => {
        const install = new Install({
          version: version,
          runDir: tmpDir,
          contextName: 'foo',
          daemonConfig: `{"debug":true,"features":{"containerd-snapshotter":true}}`
        });
        await core.group('Downloading docker', async () => {
          await install.download();
        });
        await install.install();
        await core.group('Docker version', async () => {
          await Docker.printVersion();
        });
        await core.group('Docker info', async () => {
          await Docker.printInfo();
        });
        await install.tearDown();
      })()).resolves.not.toThrow();
    }, 1200000);
});
