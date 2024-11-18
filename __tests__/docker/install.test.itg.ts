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

import {describe, test, expect} from '@jest/globals';
import fs from 'fs';
import os from 'os';
import path from 'path';

import {Install, InstallSource, InstallSourceArchive, InstallSourceImage} from '../../src/docker/install';
import {Docker} from '../../src/docker/docker';
import {Exec} from '../../src/exec';

const tmpDir = () => fs.mkdtempSync(path.join(process.env.TEMP || os.tmpdir(), 'docker-install-itg-'));

describe('root', () => {
  // prettier-ignore
  test.each(getSources(true))(
    'install docker %s', async (source) => {
      await ensureNoSystemContainerd();
      const install = new Install({
        source: source,
        runDir: tmpDir(),
        contextName: 'foo',
        daemonConfig: `{"debug":true,"features":{"containerd-snapshotter":true}}`
      });
      await expect(tryInstall(install)).resolves.not.toThrow();
    }, 30 * 60 * 1000);
});

describe('rootless', () => {
  // prettier-ignore
  test.each(getSources(false))(
    'install %s', async (source) => {
      // Skip on non linux
      if (os.platform() !== 'linux') {
        return;
      }
      await ensureNoSystemContainerd();
      const install = new Install({
        source: source,
        runDir: tmpDir(),
        contextName: 'foo',
        daemonConfig: `{"debug":true}`,
        rootless: true
      });
      await expect(
        tryInstall(install, async () => {
          const out = await Docker.getExecOutput(['info', '-f', '{{json .SecurityOptions}}']);
          expect(out.exitCode).toBe(0);
          expect(out.stderr.trim()).toBe('');
          expect(out.stdout.trim()).toContain('rootless');
        })
      ).resolves.not.toThrow();
    },
    30 * 60 * 1000
  );
});

async function tryInstall(install: Install, extraCheck?: () => Promise<void>): Promise<void> {
  try {
    await install.download();
    await install.install();
    await Docker.printVersion();
    await Docker.printInfo();
    if (extraCheck) {
      await extraCheck();
    }
  } catch (error) {
    console.error(error);
    throw error;
  } finally {
    await install.tearDown();
  }
}

async function ensureNoSystemContainerd() {
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
}

function getSources(root: boolean): Array<InstallSource> {
  const dockerInstallType = process.env.DOCKER_INSTALL_TYPE;
  const dockerInstallVersion = process.env.DOCKER_INSTALL_VERSION;
  if (dockerInstallType && dockerInstallVersion) {
    if (dockerInstallType === 'archive') {
      // prettier-ignore
      return [
        { type: dockerInstallType, version: dockerInstallVersion, channel: 'stable'} as InstallSourceArchive
      ];
    } else {
      // prettier-ignore
      return [
        { type: dockerInstallType, tag: dockerInstallVersion} as InstallSourceImage
      ];
    }
  }
  if (root) {
    // prettier-ignore
    return [
      {type: 'image', tag: '27.3.1'} as InstallSourceImage,
      {type: 'image', tag: 'master'} as InstallSourceImage,
      {type: 'image', tag: 'latest'} as InstallSourceImage,
      {type: 'archive', version: 'v26.1.4', channel: 'stable'} as InstallSourceArchive,
      {type: 'archive', version: 'latest', channel: 'stable'} as InstallSourceArchive
    ];
  } else {
    // prettier-ignore
    return [
      {type: 'image', tag: 'latest'} as InstallSourceImage,
      {type: 'archive', version: 'latest', channel: 'stable'} as InstallSourceArchive
    ];
  }
}
