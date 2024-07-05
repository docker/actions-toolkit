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

import fs from 'fs';
import path from 'path';
import * as core from '@actions/core';
import * as semver from 'semver';

import {Docker} from '../docker/docker';
import {Exec} from '../exec';

import {Cert, LocalRefsOpts, LocalRefsResponse, LocalState} from '../types/buildx/buildx';

export interface BuildxOpts {
  standalone?: boolean;
}

export class Buildx {
  private _version: string;
  private _versionOnce: boolean;
  private readonly _standalone: boolean | undefined;

  public static readonly containerNamePrefix = 'buildx_buildkit_';

  constructor(opts?: BuildxOpts) {
    this._standalone = opts?.standalone;
    this._version = '';
    this._versionOnce = false;
  }

  static get configDir(): string {
    return process.env.BUILDX_CONFIG || path.join(Docker.configDir, 'buildx');
  }

  static get refsDir(): string {
    return path.join(Buildx.configDir, 'refs');
  }

  static get refsGroupDir(): string {
    return path.join(Buildx.refsDir, '__group__');
  }

  static get certsDir(): string {
    return path.join(Buildx.configDir, 'certs');
  }

  public async isStandalone(): Promise<boolean> {
    const standalone = this._standalone ?? !(await Docker.isAvailable());
    core.debug(`Buildx.isStandalone: ${standalone}`);
    return standalone;
  }

  public async getCommand(args: Array<string>) {
    const standalone = await this.isStandalone();
    return {
      command: standalone ? 'buildx' : 'docker',
      args: standalone ? args : ['buildx', ...args]
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
          core.debug(`Buildx.isAvailable cmd err: ${res.stderr.trim()}`);
          return false;
        }
        return res.exitCode == 0;
      })
      .catch(error => {
        core.debug(`Buildx.isAvailable error: ${error}`);
        return false;
      });

    core.debug(`Buildx.isAvailable: ${ok}`);
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
      return Buildx.parseVersion(res.stdout.trim());
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
      throw new Error(`Cannot parse buildx version`);
    }
    return matches[1];
  }

  public async versionSatisfies(range: string, version?: string): Promise<boolean> {
    const ver = version ?? (await this.version());
    if (!ver) {
      core.debug(`Buildx.versionSatisfies false: undefined version`);
      return false;
    }
    const res = semver.satisfies(ver, range) || /^[0-9a-f]{7}$/.exec(ver) !== null;
    core.debug(`Buildx.versionSatisfies ${ver} statisfies ${range}: ${res}`);
    return res;
  }

  public static resolveCertsDriverOpts(driver: string, endpoint: string, cert: Cert): Array<string> {
    let url: URL;
    try {
      url = new URL(endpoint);
    } catch (e) {
      return [];
    }
    if (url.protocol != 'tcp:') {
      return [];
    }
    const driverOpts: Array<string> = [];
    if (Object.keys(cert).length == 0) {
      return driverOpts;
    }
    let host = url.hostname;
    if (url.port.length > 0) {
      host += `-${url.port}`;
    }
    if (cert.cacert !== undefined) {
      const cacertpath = path.join(Buildx.certsDir, `cacert_${host}.pem`);
      fs.writeFileSync(cacertpath, cert.cacert);
      driverOpts.push(`cacert=${cacertpath}`);
    }
    if (cert.cert !== undefined) {
      const certpath = path.join(Buildx.certsDir, `cert_${host}.pem`);
      fs.writeFileSync(certpath, cert.cert);
      driverOpts.push(`cert=${certpath}`);
    }
    if (cert.key !== undefined) {
      const keypath = path.join(Buildx.certsDir, `key_${host}.pem`);
      fs.writeFileSync(keypath, cert.key);
      driverOpts.push(`key=${keypath}`);
    }
    if (driver != 'remote') {
      return [];
    }
    return driverOpts;
  }

  public static localState(dir: string, ref: string): LocalState {
    const [builderName, nodeName, id] = ref.split('/');
    if (!builderName || !nodeName || !id) {
      throw new Error(`Invalid build reference: ${ref}`);
    }
    const lsPath = path.join(dir, builderName, nodeName, id);
    if (!fs.existsSync(lsPath)) {
      throw new Error(`Local state not found in ${lsPath}`);
    }
    return Buildx.fixLocalState(<LocalState>JSON.parse(fs.readFileSync(lsPath, 'utf8')));
  }

  // https://github.com/docker/buildx/pull/2560
  private static fixLocalState(ls: LocalState): LocalState {
    const fnTrimToValidContext = function (inp: string): [string, string, boolean] {
      const match = inp.match(/(.*)(https?:\/{1,2}\S+|ssh:\/\/\S+|git:\/\/\S+)/i);
      if (match && match.length == 3) {
        const trimed = match[1];
        let url = match[2];
        if (url.startsWith('https:/') && !url.startsWith('https://')) {
          url = url.replace('https:/', 'https://');
        }
        if (url.startsWith('http:/') && !url.startsWith('http://')) {
          url = url.replace('http:/', 'http://');
        }
        if (url.startsWith('ssh:/') && !url.startsWith('ssh://')) {
          url = url.replace('https:/', 'ssh://');
        }
        if (url.startsWith('git:/') && !url.startsWith('git://')) {
          url = url.replace('https:/', 'git://');
        }
        return [url, trimed, true];
      }
      return [inp, '', false];
    };

    const [contextPath, trimedPath, isURL] = fnTrimToValidContext(ls.LocalPath);
    if (isURL) {
      ls.LocalPath = contextPath;
      if (ls.DockerfilePath.indexOf(trimedPath) === 0) {
        ls.DockerfilePath = ls.DockerfilePath.substring(trimedPath.length);
      }
    }
    ls.LocalPath = ls.LocalPath.endsWith('/-') ? '-' : ls.LocalPath;
    ls.DockerfilePath = ls.DockerfilePath.endsWith('/-') ? '-' : ls.DockerfilePath;
    return ls;
  }

  public static refs(opts: LocalRefsOpts, refs: LocalRefsResponse = {}): LocalRefsResponse {
    const {dir, builderName, nodeName, since} = opts;

    let dirpath = path.resolve(dir);
    if (opts.builderName) {
      dirpath = path.join(dirpath, opts.builderName);
    }
    if (opts.nodeName) {
      dirpath = path.join(dirpath, opts.nodeName);
    }
    if (!fs.existsSync(dirpath)) {
      return refs;
    }

    const files = fs.readdirSync(dirpath);
    for (const file of files) {
      const filePath = path.join(dirpath, file);
      const stat = fs.statSync(filePath);
      if (stat.isDirectory()) {
        const nopts: LocalRefsOpts = {...opts};
        if (!builderName) {
          if (file === '__group__') {
            continue;
          }
          nopts.builderName = file;
        } else if (!nodeName) {
          nopts.nodeName = file;
        }
        Buildx.refs(nopts, refs);
      } else {
        if (since && stat.mtime < since) {
          continue;
        }
        const localState = Buildx.fixLocalState(<LocalState>JSON.parse(fs.readFileSync(filePath, 'utf8')));
        const ref = `${builderName}/${nodeName}/${file}`;
        refs[ref] = localState;
      }
    }

    return refs;
  }
}
