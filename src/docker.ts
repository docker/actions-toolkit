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

import os from 'os';
import path from 'path';
import * as core from '@actions/core';
import * as exec from '@actions/exec';

export class Docker {
  static get configDir(): string {
    return process.env.DOCKER_CONFIG || path.join(os.homedir(), '.docker');
  }

  static get isAvailable(): boolean {
    let dockerAvailable = false;
    exec
      .getExecOutput('docker', undefined, {
        ignoreReturnCode: true,
        silent: true
      })
      .then(res => {
        if (res.stderr.length > 0 && res.exitCode != 0) {
          core.debug(`Docker.isAvailable error: ${res.stderr}`);
          dockerAvailable = false;
        } else {
          core.debug(`Docker.isAvailable ok`);
          dockerAvailable = res.exitCode == 0;
        }
      })
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      .catch(error => {
        core.debug(`Docker.isAvailable failed: ${error}`);
        dockerAvailable = false;
      });
    return dockerAvailable;
  }

  public static async printVersion(standalone?: boolean): Promise<void> {
    const noDocker = standalone ?? !Docker.isAvailable;
    if (noDocker) {
      core.debug('Docker.printVersion: Docker is not available, skipping.');
      return;
    }
    await exec.exec('docker', ['version'], {
      failOnStdErr: false
    });
  }

  public static async printInfo(standalone?: boolean): Promise<void> {
    const noDocker = standalone ?? !Docker.isAvailable;
    if (noDocker) {
      core.debug('Docker.printInfo: Docker is not available, skipping.');
      return;
    }
    await exec.exec('docker', ['info'], {
      failOnStdErr: false
    });
  }
}
