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
import * as tc from '@actions/tool-cache';
import * as semver from 'semver';
import * as util from 'util';

import {Cache} from '../cache.js';
import {Context} from '../context.js';
import {GitHub} from '../github/github.js';

import {GitHubRelease} from '../types/github/github.js';
import {DownloadVersion} from '../types/regclient/regclient.js';

export interface InstallOpts {
  githubToken?: string;
}

export class Install {
  private readonly githubToken: string | undefined;

  constructor(opts?: InstallOpts) {
    this.githubToken = opts?.githubToken || process.env.GITHUB_TOKEN;
  }

  /*
   * Download regclient binary from GitHub release
   * @param v: version semver version or latest
   * @param ghaNoCache: disable binary caching in GitHub Actions cache backend
   * @returns path to the regclient binary
   */
  public async download(v: string, ghaNoCache?: boolean): Promise<string> {
    const version: DownloadVersion = await Install.getDownloadVersion(v);
    core.debug(`Install.download version: ${version.version}`);

    const release: GitHubRelease = await Install.getRelease(version, this.githubToken);
    core.debug(`Install.download release tag name: ${release.tag_name}`);

    const vspec = await this.vspec(release.tag_name);
    core.debug(`Install.download vspec: ${vspec}`);

    const c = semver.clean(vspec) || '';
    if (!semver.valid(c)) {
      throw new Error(`Invalid regclient version "${vspec}".`);
    }

    const installCache = new Cache({
      htcName: 'regctl-dl-bin',
      htcVersion: vspec,
      baseCacheDir: path.join(os.homedir(), '.bin'),
      cacheFile: os.platform() == 'win32' ? 'regctl.exe' : 'regctl',
      ghaNoCache: ghaNoCache
    });

    const cacheFoundPath = await installCache.find();
    if (cacheFoundPath) {
      core.info(`regctl binary found in ${cacheFoundPath}`);
      return cacheFoundPath;
    }

    const downloadURL = util.format(version.downloadURL, vspec, this.filename());
    core.info(`Downloading ${downloadURL}`);

    const htcDownloadPath = await tc.downloadTool(downloadURL, undefined, this.githubToken);
    core.debug(`Install.download htcDownloadPath: ${htcDownloadPath}`);

    const cacheSavePath = await installCache.save(htcDownloadPath);
    core.info(`Cached to ${cacheSavePath}`);
    return cacheSavePath;
  }

  public async install(binPath: string, dest?: string): Promise<string> {
    dest = dest || Context.tmpDir();

    const binDir = path.join(dest, 'regctl-bin');
    if (!fs.existsSync(binDir)) {
      fs.mkdirSync(binDir, {recursive: true});
    }
    const binName: string = os.platform() == 'win32' ? 'regctl.exe' : 'regctl';
    const regctlPath: string = path.join(binDir, binName);
    fs.copyFileSync(binPath, regctlPath);

    core.info('Fixing perms');
    fs.chmodSync(regctlPath, '0755');

    core.addPath(binDir);
    core.info('Added regctl to PATH');

    core.info(`Binary path: ${regctlPath}`);
    return regctlPath;
  }

  private filename(): string {
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
        arch = arm_version ? 'armv' + arm_version : 'arm';
        break;
      }
      default: {
        arch = os.arch();
        break;
      }
    }
    const platform: string = os.platform() == 'win32' ? 'windows' : os.platform();
    const ext: string = os.platform() == 'win32' ? '.exe' : '';
    return util.format('regctl-%s-%s%s', platform, arch, ext);
  }

  private async vspec(version: string): Promise<string> {
    const v = version.replace(/^v+|v+$/g, '');
    core.info(`Use ${v} version spec cache key for ${version}`);
    return v;
  }

  public static async getDownloadVersion(v: string): Promise<DownloadVersion> {
    return {
      version: v,
      downloadURL: 'https://github.com/regclient/regclient/releases/download/v%s/%s',
      contentOpts: {
        owner: 'docker',
        repo: 'actions-toolkit',
        ref: 'main',
        path: '.github/regclient-releases.json'
      }
    };
  }

  public static async getRelease(version: DownloadVersion, githubToken?: string): Promise<GitHubRelease> {
    const github = new GitHub({token: githubToken});
    const releases = await github.releases('regclient', version.contentOpts);
    if (!releases[version.version]) {
      throw new Error(`Cannot find regclient release ${version.version} in releases JSON`);
    }
    return releases[version.version];
  }
}
