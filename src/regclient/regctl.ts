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
import * as semver from 'semver';

import {Exec} from '../exec';

import {Manifest} from '../types/oci/manifest';

export interface RegctlOpts {
  binPath?: string;
}

export interface RegctlBlobGetOpts {
  repository: string;
  digest: string;
}

export interface RegctlManifestGetOpts {
  image: string;
  platform?: string;
}

export class Regctl {
  private readonly binPath: string;
  private _version: string;
  private _versionOnce: boolean;

  constructor(opts?: RegctlOpts) {
    this.binPath = opts?.binPath || 'regctl';
    this._version = '';
    this._versionOnce = false;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public async blobGet(opts: RegctlBlobGetOpts): Promise<any> {
    return await Exec.getExecOutput(this.binPath, ['blob', 'get', opts.repository, opts.digest], {
      ignoreReturnCode: true,
      silent: true
    }).then(res => {
      if (res.stderr.length > 0 && res.exitCode != 0) {
        throw new Error(res.stderr.trim());
      }
      return res.stdout;
    });
  }

  public async manifestGet(opts: RegctlManifestGetOpts): Promise<Manifest> {
    return await Exec.getExecOutput(this.binPath, ['manifest', 'get', opts.image, `--platform=${opts.platform ?? 'local'}`, `--format={{json .}}`], {
      ignoreReturnCode: true,
      silent: true
    }).then(res => {
      if (res.stderr.length > 0 && res.exitCode != 0) {
        throw new Error(res.stderr.trim());
      }
      return <Manifest>JSON.parse(res.stdout.trim());
    });
  }

  public async isAvailable(): Promise<boolean> {
    const ok: boolean = await Exec.getExecOutput(this.binPath, [], {
      ignoreReturnCode: true,
      silent: true
    })
      .then(res => {
        if (res.stderr.length > 0 && res.exitCode != 0) {
          core.debug(`Regctl.isAvailable cmd err: ${res.stderr.trim()}`);
          return false;
        }
        return res.exitCode == 0;
      })
      .catch(error => {
        core.debug(`Regctl.isAvailable error: ${error}`);
        return false;
      });

    core.debug(`Regctl.isAvailable: ${ok}`);
    return ok;
  }

  public async version(): Promise<string> {
    if (this._versionOnce) {
      return this._version;
    }
    this._versionOnce = true;
    this._version = await Exec.getExecOutput(this.binPath, ['version', '--format', '{{.VCSTag}}'], {
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
    await Exec.exec(this.binPath, ['version'], {
      failOnStdErr: false
    });
  }

  public async versionSatisfies(range: string, version?: string): Promise<boolean> {
    const ver = version ?? (await this.version());
    if (!ver) {
      core.debug(`Regctl.versionSatisfies false: undefined version`);
      return false;
    }
    const res = semver.satisfies(ver, range) || /^[0-9a-f]{7}$/.exec(ver) !== null;
    core.debug(`Regctl.versionSatisfies ${ver} statisfies ${range}: ${res}`);
    return res;
  }
}
