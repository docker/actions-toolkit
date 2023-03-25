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
import os from 'os';
import path from 'path';
import * as core from '@actions/core';
import * as httpm from '@actions/http-client';
import * as tc from '@actions/tool-cache';
import * as semver from 'semver';
import * as util from 'util';

import {Buildx} from './buildx';
import {Context} from '../context';
import {Exec} from '../exec';
import {Docker} from '../docker/docker';
import {Git} from '../git';

import {GitHubRelease} from '../types/github';

export interface InstallOpts {
  standalone?: boolean;
}

export class Install {
  private readonly _standalone: boolean | undefined;

  constructor(opts?: InstallOpts) {
    this._standalone = opts?.standalone;
  }

  public async download(version: string): Promise<string> {
    const release: GitHubRelease = await Install.getRelease(version);
    const fversion = release.tag_name.replace(/^v+|v+$/g, '');
    core.debug(`Install.download version: ${fversion}`);

    let toolPath: string;
    toolPath = tc.find('buildx', fversion, this.platform());
    if (!toolPath) {
      const c = semver.clean(fversion) || '';
      if (!semver.valid(c)) {
        throw new Error(`Invalid Buildx version "${fversion}".`);
      }
      toolPath = await this.fetchBinary(fversion);
    }
    core.debug(`Install.download toolPath: ${toolPath}`);

    return toolPath;
  }

  public async build(gitContext: string): Promise<string> {
    // eslint-disable-next-line prefer-const
    let [repo, ref] = gitContext.split('#');
    if (ref.length == 0) {
      ref = 'master';
    }

    let vspec: string;
    // TODO: include full ref as fingerprint. Use commit sha as best-effort in the meantime.
    if (ref.match(/^[0-9a-fA-F]{40}$/)) {
      vspec = ref;
    } else {
      vspec = await Git.remoteSha(repo, ref);
    }
    core.debug(`Install.build: tool version spec ${vspec}`);

    let toolPath: string;
    toolPath = tc.find('buildx', vspec);
    if (!toolPath) {
      const outputDir = path.join(Context.tmpDir(), 'build-cache');
      const buildCmd = await this.buildCommand(gitContext, outputDir);
      toolPath = await Exec.getExecOutput(buildCmd.command, buildCmd.args, {
        ignoreReturnCode: true
      }).then(res => {
        if (res.stderr.length > 0 && res.exitCode != 0) {
          core.warning(res.stderr.trim());
        }
        return tc.cacheFile(`${outputDir}/buildx`, os.platform() == 'win32' ? 'docker-buildx.exe' : 'docker-buildx', 'buildx', vspec, this.platform());
      });
    }

    return toolPath;
  }

  public async installStandalone(toolPath: string, dest?: string): Promise<string> {
    core.info('Standalone mode');
    dest = dest || Context.tmpDir();
    const toolBinPath = path.join(toolPath, os.platform() == 'win32' ? 'docker-buildx.exe' : 'docker-buildx');
    const binDir = path.join(dest, 'bin');
    if (!fs.existsSync(binDir)) {
      fs.mkdirSync(binDir, {recursive: true});
    }
    const filename: string = os.platform() == 'win32' ? 'buildx.exe' : 'buildx';
    const buildxPath: string = path.join(binDir, filename);
    fs.copyFileSync(toolBinPath, buildxPath);

    core.info('Fixing perms');
    fs.chmodSync(buildxPath, '0755');

    core.addPath(binDir);
    core.info('Added Buildx to PATH');

    core.info(`Binary path: ${buildxPath}`);
    return buildxPath;
  }

  public async installPlugin(toolPath: string, dest?: string): Promise<string> {
    core.info('Docker plugin mode');
    dest = dest || Docker.configDir;
    const toolBinPath = path.join(toolPath, os.platform() == 'win32' ? 'docker-buildx.exe' : 'docker-buildx');
    const pluginsDir: string = path.join(dest, 'cli-plugins');
    if (!fs.existsSync(pluginsDir)) {
      fs.mkdirSync(pluginsDir, {recursive: true});
    }
    const filename: string = os.platform() == 'win32' ? 'docker-buildx.exe' : 'docker-buildx';
    const pluginPath: string = path.join(pluginsDir, filename);
    fs.copyFileSync(toolBinPath, pluginPath);

    core.info('Fixing perms');
    fs.chmodSync(pluginPath, '0755');

    core.info(`Plugin path: ${pluginPath}`);
    return pluginPath;
  }

  private async buildCommand(gitContext: string, outputDir: string): Promise<{args: Array<string>; command: string}> {
    const buildxStandaloneFound = await new Buildx({standalone: true}).isAvailable();
    const buildxPluginFound = await new Buildx({standalone: false}).isAvailable();

    let buildStandalone = false;
    if ((await this.isStandalone()) && buildxStandaloneFound) {
      core.debug(`Install.buildCommand: Buildx standalone found, build with it`);
      buildStandalone = true;
    } else if (!(await this.isStandalone()) && buildxPluginFound) {
      core.debug(`Install.buildCommand: Buildx plugin found, build with it`);
      buildStandalone = false;
    } else if (buildxStandaloneFound) {
      core.debug(`Install.buildCommand: Buildx plugin not found, but standalone found so trying to build with it`);
      buildStandalone = true;
    } else if (buildxPluginFound) {
      core.debug(`Install.buildCommand: Buildx standalone not found, but plugin found so trying to build with it`);
      buildStandalone = false;
    } else {
      throw new Error(`Neither buildx standalone or plugin have been found to build from ref ${gitContext}`);
    }

    //prettier-ignore
    return await new Buildx({standalone: buildStandalone}).getCommand([
      'build',
      '--target', 'binaries',
      '--build-arg', 'BUILDKIT_CONTEXT_KEEP_GIT_DIR=1',
      '--output', `type=local,dest=${outputDir}`,
      gitContext
    ]);
  }

  private async isStandalone(): Promise<boolean> {
    const standalone = this._standalone ?? !(await Docker.isAvailable());
    core.debug(`Install.isStandalone: ${standalone}`);
    return standalone;
  }

  private async fetchBinary(version: string): Promise<string> {
    const targetFile: string = os.platform() == 'win32' ? 'docker-buildx.exe' : 'docker-buildx';
    const downloadURL = util.format('https://github.com/docker/buildx/releases/download/v%s/%s', version, this.filename(version));
    core.info(`Downloading ${downloadURL}`);
    const downloadPath = await tc.downloadTool(downloadURL);
    core.debug(`Install.fetchBinary downloadPath: ${downloadPath}`);
    return await tc.cacheFile(downloadPath, targetFile, 'buildx', version, this.platform());
  }

  private platform(): string {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const arm_version = (process.config.variables as any).arm_version;
    return `${os.platform()}-${os.arch()}${arm_version ? 'v' + arm_version : ''}`;
  }

  private filename(version: string): string {
    let arch: string;
    switch (os.arch()) {
      case 'x64': {
        arch = 'amd64';
        break;
      }
      case 'ppc64': {
        arch = 'ppc64le';
        break;
      }
      case 'arm': {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const arm_version = (process.config.variables as any).arm_version;
        arch = arm_version ? 'arm-v' + arm_version : 'arm';
        break;
      }
      default: {
        arch = os.arch();
        break;
      }
    }
    const platform: string = os.platform() == 'win32' ? 'windows' : os.platform();
    const ext: string = os.platform() == 'win32' ? '.exe' : '';
    return util.format('buildx-v%s.%s-%s%s', version, platform, arch, ext);
  }

  public static async getRelease(version: string): Promise<GitHubRelease> {
    const url = `https://raw.githubusercontent.com/docker/actions-toolkit/main/.github/buildx-releases.json`;
    const http: httpm.HttpClient = new httpm.HttpClient('docker-actions-toolkit');
    const resp: httpm.HttpClientResponse = await http.get(url);
    const body = await resp.readBody();
    const statusCode = resp.message.statusCode || 500;
    if (statusCode >= 400) {
      throw new Error(`Failed to get Buildx release ${version} from ${url} with status code ${statusCode}: ${body}`);
    }
    const releases = <Record<string, GitHubRelease>>JSON.parse(body);
    if (!releases[version]) {
      throw new Error(`Cannot find Buildx release ${version} in ${url}`);
    }
    return releases[version];
  }
}
