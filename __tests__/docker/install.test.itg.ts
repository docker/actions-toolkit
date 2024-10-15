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
import fs from 'fs';
import os from 'os';
import path from 'path';

import {Install} from '../../src/docker/install';
import {Docker} from '../../src/docker/docker';
import {Exec} from '../../src/exec';

const tmpDir = fs.mkdtempSync(path.join(process.env.TEMP || os.tmpdir(), 'docker-install-itg-'));

describe('install', () => {
  const originalEnv = process.env;
  beforeEach(() => {
    jest.resetModules();
    process.env = {
      ...originalEnv,
      LIMA_START_ARGS: '--cpus 4 --memory 8',
      LIMA_IMAGES: `x86_64:https://cloud.debian.org/images/cloud/bookworm/20231013-1532/debian-12-genericcloud-amd64-20231013-1532.qcow2@sha512:6b55e88b027c14da1b55c85a25a9f7069d4560a8fdb2d948c986a585db469728a06d2c528303e34bb62d8b2984def38fd9ddfc00965846ff6e05b01d6e883bfe
aarch64:https://cloud.debian.org/images/cloud/bookworm/20231013-1532/debian-12-genericcloud-arm64-20231013-1532.qcow2`
    };
  });
  afterEach(() => {
    process.env = originalEnv;
  });
  // prettier-ignore
  test.each(['v26.1.4'])(
    'install docker %s', async (version) => {
      if (process.env.ImageOS && process.env.ImageOS.startsWith('ubuntu')) {
        // Remove containerd first on ubuntu runners to make sure it takes
        // ones packaged with docker
        await Exec.exec('sudo', ['apt-get', 'remove', '-y', 'containerd.io'], {
          env: Object.assign({}, process.env, {
            DEBIAN_FRONTEND: 'noninteractive'
          }) as {
            [key: string]: string;
          }
        });
      }
      await expect((async () => {
        const install = new Install({
          source: {
            type: 'archive',
            version: version,
            channel: 'stable',
          },
          runDir: tmpDir,
          contextName: 'foo',
          daemonConfig: `{"debug":true,"features":{"containerd-snapshotter":true}}`
        });
        await install.download();
        await install.install();
        await Docker.printVersion();
        await Docker.printInfo();
        await install.tearDown();
      })()).resolves.not.toThrow();
    }, 1200000);
});
