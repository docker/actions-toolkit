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

import {GitHubRelease} from '../types/github';

export interface InstallOpts {
  standalone?: boolean;
}

export class Install {
  private readonly opts: InstallOpts;

  constructor(opts?: InstallOpts) {
    this.opts = opts || {};
  }

  public async install(version: string, dest: string): Promise<string> {
    const release: GitHubRelease = await Install.getRelease(version);
    const fversion = release.tag_name.replace(/^v+|v+$/g, '');
    let toolPath: string;
    toolPath = tc.find('buildx', fversion, this.platform());
    if (!toolPath) {
      const c = semver.clean(fversion) || '';
      if (!semver.valid(c)) {
        throw new Error(`Invalid Buildx version "${fversion}".`);
      }
      toolPath = await this.download(fversion);
    }
    if (this.opts.standalone) {
      return this.setStandalone(toolPath, dest);
    }
    return this.setPlugin(toolPath, dest);
  }

  private async setStandalone(toolPath: string, dest: string): Promise<string> {
    const toolBinPath = path.join(toolPath, os.platform() == 'win32' ? 'docker-buildx.exe' : 'docker-buildx');
    const binDir = path.join(dest, 'bin');
    if (!fs.existsSync(binDir)) {
      fs.mkdirSync(binDir, {recursive: true});
    }
    const filename: string = os.platform() == 'win32' ? 'buildx.exe' : 'buildx';
    const buildxPath: string = path.join(binDir, filename);
    fs.copyFileSync(toolBinPath, buildxPath);
    fs.chmodSync(buildxPath, '0755');
    core.addPath(binDir);
    return buildxPath;
  }

  private async setPlugin(toolPath: string, dest: string): Promise<string> {
    const toolBinPath = path.join(toolPath, os.platform() == 'win32' ? 'docker-buildx.exe' : 'docker-buildx');
    const pluginsDir: string = path.join(dest, 'cli-plugins');
    if (!fs.existsSync(pluginsDir)) {
      fs.mkdirSync(pluginsDir, {recursive: true});
    }
    const filename: string = os.platform() == 'win32' ? 'docker-buildx.exe' : 'docker-buildx';
    const pluginPath: string = path.join(pluginsDir, filename);
    fs.copyFileSync(toolBinPath, pluginPath);
    fs.chmodSync(pluginPath, '0755');
    return pluginPath;
  }

  private async download(version: string): Promise<string> {
    const targetFile: string = os.platform() == 'win32' ? 'docker-buildx.exe' : 'docker-buildx';
    const downloadURL = util.format('https://github.com/docker/buildx/releases/download/v%s/%s', version, this.filename(version));
    const downloadPath = await tc.downloadTool(downloadURL);
    core.debug(`downloadURL: ${downloadURL}`);
    core.debug(`downloadPath: ${downloadPath}`);
    return await tc.cacheFile(downloadPath, targetFile, 'buildx', version);
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
