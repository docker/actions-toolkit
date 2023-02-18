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
  private static instance?: Docker;
  static getInstance = (): Docker => (Docker.instance = Docker.instance ?? new Docker());

  private _available: boolean | undefined;

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  private constructor() {}

  static get configDir(): string {
    return process.env.DOCKER_CONFIG || path.join(os.homedir(), '.docker');
  }

  public async isAvailable(): Promise<boolean> {
    if (this._available === undefined) {
      await exec
        .getExecOutput('docker', undefined, {
          ignoreReturnCode: true,
          silent: true
        })
        .then(res => {
          if (res.stderr.length > 0 && res.exitCode != 0) {
            core.debug(`Docker.available error: ${res.stderr}`);
            this._available = false;
          } else {
            core.debug(`Docker.available ok`);
            this._available = res.exitCode == 0;
          }
        })
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        .catch(error => {
          core.debug(`Docker.available failed: ${error}`);
          this._available = false;
        });
    }
    core.debug(`Docker.available: ${this._available}`);
    return this._available ?? false;
  }

  public static async printVersion(standalone?: boolean): Promise<void> {
    const noDocker = standalone ?? !(await Docker.getInstance().isAvailable());
    if (noDocker) {
      core.debug('Docker.printVersion: Docker is not available, skipping.');
      return;
    }
    await exec.exec('docker', ['version'], {
      failOnStdErr: false
    });
  }

  public static async printInfo(standalone?: boolean): Promise<void> {
    const noDocker = standalone ?? !(await Docker.getInstance().isAvailable());
    if (noDocker) {
      core.debug('Docker.printInfo: Docker is not available, skipping.');
      return;
    }
    await exec.exec('docker', ['info'], {
      failOnStdErr: false
    });
  }
}
