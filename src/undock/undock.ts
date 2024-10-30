/**
 * Copyright 2024 actions-toolkit authors
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
import * as semver from 'semver';

import {Exec} from '../exec';

export interface UndockOpts {
  binPath?: string;
}

export interface UndockRunOpts {
  source: string;
  dist: string;
  logLevel?: string;
  logCaller?: boolean;
  cacheDir?: string;
  platform?: string;
  all?: boolean;
  include?: Array<string>;
  insecure?: boolean;
  rmDist?: boolean;
  wrap?: boolean;
}

export class Undock {
  private readonly binPath: string;
  private _version: string;
  private _versionOnce: boolean;

  constructor(opts?: UndockOpts) {
    this.binPath = opts?.binPath || 'undock';
    this._version = '';
    this._versionOnce = false;
  }

  public async run(opts: UndockRunOpts): Promise<void> {
    if (!opts.source) {
      throw new Error('source is required');
    }
    if (!opts.dist) {
      throw new Error('dist is required');
    }
    const args: Array<string> = [];
    if (opts.logLevel) {
      args.push(`--log-level=${opts.logLevel}`);
    }
    if (opts.logCaller) {
      args.push('--log-caller');
    }
    if (opts.cacheDir) {
      args.push(`--cachedir=${opts.cacheDir}`);
    }
    if (opts.platform) {
      args.push(`--platform=${opts.platform}`);
    }
    if (opts.all) {
      args.push('--all');
    }
    if (opts.include) {
      opts.include.forEach(i => {
        args.push(`--include=${i}`);
      });
    }
    if (opts.insecure) {
      args.push('--insecure');
    }
    if (opts.rmDist) {
      args.push('--rm-dist');
    }
    if (opts.wrap) {
      args.push('--wrap');
    }
    args.push(opts.source, opts.dist);
    await Exec.exec(this.binPath, args, {
      failOnStdErr: false
    });
  }

  public async isAvailable(): Promise<boolean> {
    const ok: boolean = await Exec.getExecOutput(this.binPath, [], {
      ignoreReturnCode: true,
      silent: true
    })
      .then(res => {
        if (res.stderr.length > 0 && res.exitCode != 0) {
          core.debug(`Undock.isAvailable cmd err: ${res.stderr.trim()}`);
          return false;
        }
        return res.exitCode == 0;
      })
      .catch(error => {
        core.debug(`Undock.isAvailable error: ${error}`);
        return false;
      });

    core.debug(`Undock.isAvailable: ${ok}`);
    return ok;
  }

  public async version(): Promise<string> {
    if (this._versionOnce) {
      return this._version;
    }
    this._versionOnce = true;
    this._version = await Exec.getExecOutput(this.binPath, ['--version'], {
      ignoreReturnCode: true,
      silent: true
    }).then(res => {
      if (res.stderr.length > 0 && res.exitCode != 0) {
        throw new Error(res.stderr.trim());
      }
      return res.stdout.trim();
    });
    return this._version;
  }

  public async printVersion() {
    await Exec.exec(this.binPath, ['--version'], {
      failOnStdErr: false
    });
  }

  public async versionSatisfies(range: string, version?: string): Promise<boolean> {
    const ver = version ?? (await this.version());
    if (!ver) {
      core.debug(`Undock.versionSatisfies false: undefined version`);
      return false;
    }
    const res = semver.satisfies(ver, range) || /^[0-9a-f]{7}$/.exec(ver) !== null;
    core.debug(`Undock.versionSatisfies ${ver} statisfies ${range}: ${res}`);
    return res;
  }
}
