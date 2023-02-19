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

  public static async isAvailable(): Promise<boolean> {
    const ok: boolean = await exec
      .getExecOutput('docker', undefined, {
        ignoreReturnCode: true,
        silent: true
      })
      .then(res => {
        if (res.stderr.length > 0 && res.exitCode != 0) {
          core.debug(`Docker.isAvailable cmd err: ${res.stderr}`);
          return false;
        }
        return res.exitCode == 0;
      })
      .catch(error => {
        core.debug(`Docker.isAvailable error: ${error}`);
        return false;
      });

    core.debug(`Docker.isAvailable: ${ok}`);
    return ok;
  }

  public static async printVersion(): Promise<void> {
    await exec.exec('docker', ['version']);
  }

  public static async printInfo(): Promise<void> {
    await exec.exec('docker', ['info']);
  }
}
