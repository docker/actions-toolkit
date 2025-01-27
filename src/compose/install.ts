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

import fs from 'fs';
import os from 'os';
import path from 'path';
import * as core from '@actions/core';
import * as httpm from '@actions/http-client';
import * as tc from '@actions/tool-cache';
import * as semver from 'semver';
import * as util from 'util';

import {Cache} from '../cache';
import {Context} from '../context';

import {DownloadVersion} from '../types/compose/compose';
import {GitHubRelease} from '../types/github';
import {Docker} from '../docker/docker';

export interface InstallOpts {
  standalone?: boolean;
}

export class Install {
  private readonly _standalone: boolean | undefined;

  constructor(opts?: InstallOpts) {
    this._standalone = opts?.standalone;
  }

  /*
   * Download compose binary from GitHub release
   * @param v: version semver version or latest
   * @param ghaNoCache: disable binary caching in GitHub Actions cache backend
   * @returns path to the compose binary
   */
  public async download(v: string, ghaNoCache?: boolean): Promise<string> {
    const version: DownloadVersion = await Install.getDownloadVersion(v);
    core.debug(`Install.download version: ${version.version}`);

    const release: GitHubRelease = await Install.getRelease(version);
    core.debug(`Install.download release tag name: ${release.tag_name}`);

    const vspec = await this.vspec(release.tag_name);
    core.debug(`Install.download vspec: ${vspec}`);

    const c = semver.clean(vspec) || '';
    if (!semver.valid(c)) {
      throw new Error(`Invalid Compose version "${vspec}".`);
    }

    const installCache = new Cache({
      htcName: version.key != 'official' ? `compose-dl-bin-${version.key}` : 'compose-dl-bin',
      htcVersion: vspec,
      baseCacheDir: path.join(os.homedir(), '.bin', 'docker-compose'),
      cacheFile: os.platform() == 'win32' ? 'docker-compose.exe' : 'docker-compose',
      ghaNoCache: ghaNoCache
    });

    const cacheFoundPath = await installCache.find();
    if (cacheFoundPath) {
      core.info(`Compose binary found in ${cacheFoundPath}`);
      return cacheFoundPath;
    }

    const downloadURL = util.format(version.downloadURL, vspec, this.filename());
    core.info(`Downloading ${downloadURL}`);

    const htcDownloadPath = await tc.downloadTool(downloadURL);
    core.debug(`Install.download htcDownloadPath: ${htcDownloadPath}`);

    const cacheSavePath = await installCache.save(htcDownloadPath);
    core.info(`Cached to ${cacheSavePath}`);
    return cacheSavePath;
  }

  public async installStandalone(binPath: string, dest?: string): Promise<string> {
    core.info('Standalone mode');
    dest = dest || Context.tmpDir();

    const binDir = path.join(dest, 'compose-bin-standalone');
    if (!fs.existsSync(binDir)) {
      fs.mkdirSync(binDir, {recursive: true});
    }
    const binName: string = os.platform() == 'win32' ? 'compose.exe' : 'compose';
    const composePath: string = path.join(binDir, binName);
    fs.copyFileSync(binPath, composePath);

    core.info('Fixing perms');
    fs.chmodSync(composePath, '0755');

    core.addPath(binDir);
    core.info('Added Compose to PATH');

    core.info(`Binary path: ${composePath}`);
    return composePath;
  }

  public async installPlugin(binPath: string, dest?: string): Promise<string> {
    core.info('Docker plugin mode');
    dest = dest || Docker.configDir;

    const pluginsDir: string = path.join(dest, 'cli-plugins');
    if (!fs.existsSync(pluginsDir)) {
      fs.mkdirSync(pluginsDir, {recursive: true});
    }
    const binName: string = os.platform() == 'win32' ? 'docker-compose.exe' : 'docker-compose';
    const pluginPath: string = path.join(pluginsDir, binName);
    fs.copyFileSync(binPath, pluginPath);

    core.info('Fixing perms');
    fs.chmodSync(pluginPath, '0755');

    core.info(`Plugin path: ${pluginPath}`);
    return pluginPath;
  }

  private async isStandalone(): Promise<boolean> {
    const standalone = this._standalone ?? !(await Docker.isAvailable());
    core.debug(`Install.isStandalone: ${standalone}`);
    return standalone;
  }

  private filename(): string {
    let arch: string;
    switch (os.arch()) {
      case 'x64': {
        arch = 'x86_64';
        break;
      }
      case 'ppc64': {
        arch = 'ppc64le';
        break;
      }
      case 'arm': {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const arm_version = (process.config.variables as any).arm_version;
        arch = arm_version ? 'armv' + arm_version : 'arm';
        break;
      }
      case 'arm64': {
        arch = 'aarch64';
        break;
      }
      default: {
        arch = os.arch();
        break;
      }
    }
    const platform: string = os.platform() == 'win32' ? 'windows' : os.platform();
    const ext: string = os.platform() == 'win32' ? '.exe' : '';
    return util.format('docker-compose-%s-%s%s', platform, arch, ext);
  }

  private async vspec(version: string): Promise<string> {
    const v = version.replace(/^v+|v+$/g, '');
    core.info(`Use ${v} version spec cache key for ${version}`);
    return v;
  }

  public static async getDownloadVersion(v: string): Promise<DownloadVersion> {
    let [repoKey, version] = v.split(':');
    if (!version) {
      version = repoKey;
      repoKey = 'official';
    }
    switch (repoKey) {
      case 'official': {
        return {
          key: repoKey,
          version: version,
          downloadURL: 'https://github.com/docker/compose/releases/download/v%s/%s',
          releasesURL: 'https://raw.githubusercontent.com/docker/actions-toolkit/main/.github/compose-releases.json'
        };
      }
      case 'cloud': {
        return {
          key: repoKey,
          version: version,
          downloadURL: 'https://github.com/docker/compose-desktop/releases/download/v%s/%s',
          releasesURL: 'https://raw.githubusercontent.com/docker/actions-toolkit/main/.github/compose-lab-releases.json'
        };
      }
      default: {
        throw new Error(`Cannot find compose version for ${v}`);
      }
    }
  }

  public static async getRelease(version: DownloadVersion): Promise<GitHubRelease> {
    const http: httpm.HttpClient = new httpm.HttpClient('docker-actions-toolkit');
    const resp: httpm.HttpClientResponse = await http.get(version.releasesURL);
    const body = await resp.readBody();
    const statusCode = resp.message.statusCode || 500;
    if (statusCode >= 400) {
      throw new Error(`Failed to get Compose releases from ${version.releasesURL} with status code ${statusCode}: ${body}`);
    }
    const releases = <Record<string, GitHubRelease>>JSON.parse(body);
    if (!releases[version.version]) {
      throw new Error(`Cannot find Compose release ${version.version} in ${version.releasesURL}`);
    }
    return releases[version.version];
  }
}
