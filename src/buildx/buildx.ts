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

import * as exec from '@actions/exec';
import * as semver from 'semver';

import {Docker} from '../docker';
import {Context} from '../context';
import {Inputs} from './inputs';
import {Install} from './install';

export interface BuildxOpts {
  context: Context;
  standalone?: boolean;
}

export class Buildx {
  private readonly context: Context;
  private _version: string | undefined;

  public readonly inputs: Inputs;
  public readonly install: Install;
  public readonly standalone: boolean;

  constructor(opts: BuildxOpts) {
    this.context = opts.context;
    this.inputs = new Inputs(this.context);
    this.install = new Install({standalone: opts.standalone});
    this.standalone = opts?.standalone ?? !Docker.isAvailable;
  }

  public getCommand(args: Array<string>) {
    return {
      command: this.standalone ? 'buildx' : 'docker',
      args: this.standalone ? args : ['buildx', ...args]
    };
  }

  public async isAvailable(): Promise<boolean> {
    const cmd = this.getCommand([]);
    return await exec
      .getExecOutput(cmd.command, cmd.args, {
        ignoreReturnCode: true,
        silent: true
      })
      .then(res => {
        if (res.stderr.length > 0 && res.exitCode != 0) {
          return false;
        }
        return res.exitCode == 0;
      })
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      .catch(error => {
        return false;
      });
  }

  public async printInspect(name: string): Promise<void> {
    const cmd = this.getCommand(['inspect', name]);
    await exec.exec(cmd.command, cmd.args, {
      failOnStdErr: false
    });
  }

  get version() {
    return (async () => {
      if (!this._version) {
        const cmd = this.getCommand(['version']);
        this._version = await exec
          .getExecOutput(cmd.command, cmd.args, {
            ignoreReturnCode: true,
            silent: true
          })
          .then(res => {
            if (res.stderr.length > 0 && res.exitCode != 0) {
              throw new Error(res.stderr.trim());
            }
            return Buildx.parseVersion(res.stdout.trim());
          });
      }
      return this._version;
    })();
  }

  public async printVersion() {
    const cmd = this.getCommand(['version']);
    await exec.exec(cmd.command, cmd.args, {
      failOnStdErr: false
    });
  }

  public static parseVersion(stdout: string): string {
    const matches = /\sv?([0-9a-f]{7}|[0-9.]+)/.exec(stdout);
    if (!matches) {
      throw new Error(`Cannot parse buildx version`);
    }
    return matches[1];
  }

  public async versionSatisfies(range: string, version?: string): Promise<boolean> {
    const ver = version ?? (await this.version);
    if (!ver) {
      return false;
    }
    return semver.satisfies(ver, range) || /^[0-9a-f]{7}$/.exec(ver) !== null;
  }
}
