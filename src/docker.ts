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
import * as io from '@actions/io';
import {Exec} from './exec';

export class Docker {
  static get configDir(): string {
    return process.env.DOCKER_CONFIG || path.join(os.homedir(), '.docker');
  }

  public static async isAvailable(): Promise<boolean> {
    return await io
      .which('docker', true)
      .then(res => {
        core.debug(`Docker.isAvailable ok: ${res}`);
        return true;
      })
      .catch(error => {
        core.debug(`Docker.isAvailable error: ${error}`);
        return false;
      });
  }

  public static async context(): Promise<string> {
    return await Exec.getExecOutput(`docker`, ['context', 'show'], {
      ignoreReturnCode: true,
      silent: true
    }).then(res => {
      if (res.stderr.length > 0 && res.exitCode != 0) {
        throw new Error(res.stderr);
      }
      return res.stdout.trim();
    });
  }

  public static async printVersion(): Promise<void> {
    await Exec.exec('docker', ['version']);
  }

  public static async printInfo(): Promise<void> {
    await Exec.exec('docker', ['info']);
  }
}
