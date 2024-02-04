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
import {Cache} from '../cache';
import {Context} from '../context';
import {Exec} from '../exec';
import {Docker} from '../docker/docker';
import {Git} from '../git';
import {Util} from '../util';

import {DownloadVersion} from '../types/buildx';
import {GitHubRelease} from '../types/github';

export interface InstallOpts {
  standalone?: boolean;
}

export class Install {
  private readonly _standalone: boolean | undefined;

  constructor(opts?: InstallOpts) {
    this._standalone = opts?.standalone;
  }

  /*
   * Download buildx binary from GitHub release
   * @param version semver version or latest
   * @returns path to the buildx binary
   */
  public async download(v: string): Promise<string> {
    const version: DownloadVersion = await Install.getDownloadVersion(v);
    core.debug(`Install.download version: ${version.version}`);

    const release: GitHubRelease = await Install.getRelease(version);
    core.debug(`Install.download release tag name: ${release.tag_name}`);

    const vspec = await this.vspec(release.tag_name);
    core.debug(`Install.download vspec: ${vspec}`);

    const c = semver.clean(vspec) || '';
    if (!semver.valid(c)) {
      throw new Error(`Invalid Buildx version "${vspec}".`);
    }

    const installCache = new Cache({
      htcName: version.key != 'official' ? `buildx-dl-bin-${version.key}` : 'buildx-dl-bin',
      htcVersion: vspec,
      baseCacheDir: path.join(Buildx.configDir, '.bin'),
      cacheFile: os.platform() == 'win32' ? 'docker-buildx.exe' : 'docker-buildx'
    });

    const cacheFoundPath = await installCache.find();
    if (cacheFoundPath) {
      core.info(`Buildx binary found in ${cacheFoundPath}`);
      return cacheFoundPath;
    }

    const downloadURL = util.format(version.downloadURL, vspec, this.filename(vspec));
    core.info(`Downloading ${downloadURL}`);

    const htcDownloadPath = await tc.downloadTool(downloadURL);
    core.debug(`Install.download htcDownloadPath: ${htcDownloadPath}`);

    const cacheSavePath = await installCache.save(htcDownloadPath);
    core.info(`Cached to ${cacheSavePath}`);
    return cacheSavePath;
  }

  /*
   * Build buildx binary from source
   * @param gitContext git repo context
   * @returns path to the buildx binary
   */
  public async build(gitContext: string): Promise<string> {
    const vspec = await this.vspec(gitContext);
    core.debug(`Install.build vspec: ${vspec}`);

    const installCache = new Cache({
      htcName: 'buildx-build-bin',
      htcVersion: vspec,
      baseCacheDir: path.join(Buildx.configDir, '.bin'),
      cacheFile: os.platform() == 'win32' ? 'docker-buildx.exe' : 'docker-buildx'
    });

    const cacheFoundPath = await installCache.find();
    if (cacheFoundPath) {
      core.info(`Buildx binary found in ${cacheFoundPath}`);
      return cacheFoundPath;
    }

    const outputDir = path.join(Context.tmpDir(), 'buildx-build-cache');
    const buildCmd = await this.buildCommand(gitContext, outputDir);

    const buildBinPath = await Exec.getExecOutput(buildCmd.command, buildCmd.args, {
      ignoreReturnCode: true
    }).then(res => {
      if (res.stderr.length > 0 && res.exitCode != 0) {
        throw new Error(`build failed with: ${res.stderr.match(/(.*)\s*$/)?.[0]?.trim() ?? 'unknown error'}`);
      }
      return `${outputDir}/buildx`;
    });

    const cacheSavePath = await installCache.save(buildBinPath);
    core.info(`Cached to ${cacheSavePath}`);
    return cacheSavePath;
  }

  public async installStandalone(binPath: string, dest?: string): Promise<string> {
    core.info('Standalone mode');
    dest = dest || Context.tmpDir();

    const binDir = path.join(dest, 'buildx-bin-standalone');
    if (!fs.existsSync(binDir)) {
      fs.mkdirSync(binDir, {recursive: true});
    }
    const binName: string = os.platform() == 'win32' ? 'buildx.exe' : 'buildx';
    const buildxPath: string = path.join(binDir, binName);
    fs.copyFileSync(binPath, buildxPath);

    core.info('Fixing perms');
    fs.chmodSync(buildxPath, '0755');

    core.addPath(binDir);
    core.info('Added Buildx to PATH');

    core.info(`Binary path: ${buildxPath}`);
    return buildxPath;
  }

  public async installPlugin(binPath: string, dest?: string): Promise<string> {
    core.info('Docker plugin mode');
    dest = dest || Docker.configDir;

    const pluginsDir: string = path.join(dest, 'cli-plugins');
    if (!fs.existsSync(pluginsDir)) {
      fs.mkdirSync(pluginsDir, {recursive: true});
    }
    const binName: string = os.platform() == 'win32' ? 'docker-buildx.exe' : 'docker-buildx';
    const pluginPath: string = path.join(pluginsDir, binName);
    fs.copyFileSync(binPath, pluginPath);

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

    const args = ['build', '--target', 'binaries', '--platform', 'local', '--build-arg', 'BUILDKIT_CONTEXT_KEEP_GIT_DIR=1', '--output', `type=local,dest=${outputDir}`];
    if (process.env.GIT_AUTH_TOKEN) {
      args.push('--secret', 'id=GIT_AUTH_TOKEN');
    }
    args.push(gitContext);

    //prettier-ignore
    return await new Buildx({standalone: buildStandalone}).getCommand(args);
  }

  private async isStandalone(): Promise<boolean> {
    const standalone = this._standalone ?? !(await Docker.isAvailable());
    core.debug(`Install.isStandalone: ${standalone}`);
    return standalone;
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

  /*
   * Get version spec (fingerprint) for cache key. If versionOrRef is a valid
   * Git context, then return the SHA of the ref along the repo and owner and
   * create a hash of it. Otherwise, return the versionOrRef (semver) as is
   * without the 'v' prefix.
   */
  private async vspec(versionOrRef: string): Promise<string> {
    if (!Util.isValidRef(versionOrRef)) {
      const v = versionOrRef.replace(/^v+|v+$/g, '');
      core.info(`Use ${v} version spec cache key for ${versionOrRef}`);
      return v;
    }

    // eslint-disable-next-line prefer-const
    let [baseURL, ref] = versionOrRef.split('#');
    if (ref.length == 0) {
      ref = 'master';
    }

    let sha: string;
    if (ref.match(/^[0-9a-fA-F]{40}$/)) {
      sha = ref;
    } else {
      sha = await Git.remoteSha(baseURL, ref, process.env.GIT_AUTH_TOKEN);
    }

    const [owner, repo] = baseURL.substring('https://github.com/'.length).split('/');
    const key = `${owner}/${Util.trimSuffix(repo, '.git')}/${sha}`;
    const hash = Util.hash(key);
    core.info(`Use ${hash} version spec cache key for ${key}`);
    return hash;
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
          downloadURL: 'https://github.com/docker/buildx/releases/download/v%s/%s',
          releasesURL: 'https://raw.githubusercontent.com/docker/actions-toolkit/main/.github/buildx-releases.json'
        };
      }
      case 'lab': {
        return {
          key: repoKey,
          version: version,
          downloadURL: 'https://github.com/docker/buildx-desktop/releases/download/v%s/%s',
          releasesURL: 'https://raw.githubusercontent.com/docker/actions-toolkit/main/.github/buildx-lab-releases.json'
        };
      }
      default: {
        throw new Error(`Cannot find buildx version for ${v}`);
      }
    }
  }

  public static async getRelease(version: DownloadVersion): Promise<GitHubRelease> {
    const http: httpm.HttpClient = new httpm.HttpClient('docker-actions-toolkit');
    const resp: httpm.HttpClientResponse = await http.get(version.releasesURL);
    const body = await resp.readBody();
    const statusCode = resp.message.statusCode || 500;
    if (statusCode >= 400) {
      throw new Error(`Failed to get Buildx releases from ${version.releasesURL} with status code ${statusCode}: ${body}`);
    }
    const releases = <Record<string, GitHubRelease>>JSON.parse(body);
    if (!releases[version.version]) {
      throw new Error(`Cannot find Buildx release ${version.version} in ${version.releasesURL}`);
    }
    return releases[version.version];
  }
}
