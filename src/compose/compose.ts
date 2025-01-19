/**
 * Copyright 2025 actions-toolkit authors
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

import * as core from '@actions/core';

import {Docker} from '../docker/docker';
import {Exec} from '../exec';

export interface ComposeOpts {
  standalone?: boolean;
}

export class Compose {
  private _version: string;
  private _versionOnce: boolean;
  private readonly _standalone: boolean | undefined;

  constructor(opts?: ComposeOpts) {
    this._standalone = opts?.standalone;
    this._version = '';
    this._versionOnce = false;
  }

  public async isStandalone(): Promise<boolean> {
    const standalone = this._standalone ?? !(await Docker.isAvailable());
    core.debug(`Compose.isStandalone: ${standalone}`);
    return standalone;
  }

  public async getCommand(args: Array<string>) {
    const standalone = await this.isStandalone();
    return {
      command: standalone ? 'compose' : 'docker',
      args: standalone ? args : ['compose', ...args]
    };
  }

  public async isAvailable(): Promise<boolean> {
    const cmd = await this.getCommand([]);

    const ok: boolean = await Exec.getExecOutput(cmd.command, cmd.args, {
      ignoreReturnCode: true,
      silent: true
    })
      .then(res => {
        if (res.stderr.length > 0 && res.exitCode != 0) {
          core.debug(`Compose.isAvailable cmd err: ${res.stderr.trim()}`);
          return false;
        }
        return res.exitCode == 0;
      })
      .catch(error => {
        core.debug(`Compose.isAvailable error: ${error}`);
        return false;
      });

    core.debug(`Compose.isAvailable: ${ok}`);
    return ok;
  }

  public async version(): Promise<string> {
    if (this._versionOnce) {
      return this._version;
    }
    this._versionOnce = true;
    const cmd = await this.getCommand(['version']);
    this._version = await Exec.getExecOutput(cmd.command, cmd.args, {
      ignoreReturnCode: true,
      silent: true
    }).then(res => {
      if (res.stderr.length > 0 && res.exitCode != 0) {
        throw new Error(res.stderr.trim());
      }
      return Compose.parseVersion(res.stdout.trim());
    });
    return this._version;
  }

  public async printVersion() {
    const cmd = await this.getCommand(['version']);
    await Exec.exec(cmd.command, cmd.args, {
      failOnStdErr: false
    });
  }

  public static parseVersion(stdout: string): string {
    const matches = /\sv?([0-9a-f]{7}|[0-9.]+)/.exec(stdout);
    if (!matches) {
      throw new Error(`Cannot parse compose version`);
    }
    return matches[1];
  }
}
