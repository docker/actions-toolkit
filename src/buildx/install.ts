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

import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';
import * as core from '@actions/core';
import * as httpm from '@actions/http-client';
import * as tc from '@actions/tool-cache';
import * as cache from '@actions/cache';
import * as semver from 'semver';
import * as util from 'util';
import type {GitHub as Octokit} from '@actions/github/lib/utils';

import {Buildx} from './buildx';
import {Context} from '../context';
import {Exec} from '../exec';
import {Docker} from '../docker/docker';
import {Git} from '../git';
import {Util} from '../util';

import {GitHubRelease, OctokitRelease} from '../types/github';

export interface InstallOpts {
  standalone?: boolean;
  gitAuthToken?: string;
  octokit?: InstanceType<typeof Octokit>;
}

interface ReleaseLocation {
  owner: string;
  repo: string;
  tag: string;
}

export class Install {
  private readonly _standalone: boolean | undefined;
  private readonly _gitAuthToken: string | undefined;
  private readonly _octokit: InstanceType<typeof Octokit> | undefined;

  constructor(opts?: InstallOpts) {
    this._standalone = opts?.standalone;
    this._gitAuthToken = opts?.gitAuthToken;
    this._octokit = opts?.octokit;
  }

  /*
   * Download buildx binary from GitHub release
   * @param version semver version, latest, or a tagged release url
   *    of the form 'https://github.com/docker/buildx/releases/tag/v0.11.1' or
   *    'https://github.com/docker/buildx/releases/latest'
   * @returns path to the buildx binary
   */
  public async download(version: string): Promise<string> {
    const releaseLocation = Install.releaseLocationFromUrl(version);
    let vspec = '';
    let downloadURL = '';
    if (releaseLocation) {
      const release = await this.getReleaseFromAPI(releaseLocation);

      const fversion = release.tag_name.replace(/^v+|v+$/g, '');
      core.debug(`Install.download release ${releaseLocation.owner}/${releaseLocation.repo}: ${release.tag_name}`);

      const expectedFilename = this.filename(fversion);
      const asset = release.assets.find(asset => asset.name == expectedFilename);
      if (!asset) {
        throw new Error(`Could not find asset "${expectedFilename}" in release: ${release.tag_name}`);
      }

      vspec = await this.vspec(`https://github.com/${releaseLocation.owner}/${releaseLocation.repo}.git#${release.tag_name}`);
      downloadURL = asset.url;
    } else {
      const release: GitHubRelease = await Install.getReleaseFromJSON(version);
      core.debug(`Install.download release tag name: ${release.tag_name}`);

      vspec = await this.vspec(release.tag_name);
      downloadURL = util.format('https://github.com/docker/buildx/releases/download/v%s/%s', vspec, this.filename(vspec));

      const c = semver.clean(vspec) || '';
      if (!semver.valid(c)) {
        throw new Error(`Invalid Buildx version "${vspec}".`);
      }
    }

    core.debug(`Install.download vspec: ${vspec}`);

    const installCache = new InstallCache('buildx-dl-bin', vspec);

    const cacheFoundPath = await installCache.find();
    if (cacheFoundPath) {
      core.info(`Buildx binary found in ${cacheFoundPath}`);
      return cacheFoundPath;
    }

    core.info(`Downloading ${downloadURL}`);

    let auth: string | undefined = undefined;
    if (this._gitAuthToken) {
      auth = `Bearer ${this._gitAuthToken}`;
    }
    const htcDownloadPath = await tc.downloadTool(downloadURL, undefined, auth, {
      // Headers required when downloading binaries from the github api.
      Accept: 'application/octet-stream',
      'X-GitHub-Api-Version': '2022-11-28'
    });
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

    const installCache = new InstallCache('buildx-build-bin', vspec);

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
    const hash = crypto.createHash('sha256').update(key).digest('hex');
    core.info(`Use ${hash} version spec cache key for ${key}`);
    return hash;
  }

  private async getReleaseFromAPI(location: ReleaseLocation): Promise<OctokitRelease> {
    const octokit = this._octokit;
    if (!octokit) {
      throw new Error(`GitHub API not available`);
    }

    const {owner, repo, tag} = location;
    try {
      const release = await (tag == 'latest'
        ? octokit.rest.repos.getLatestRelease({owner, repo})
        : octokit.rest.repos.getReleaseByTag({
            owner,
            repo,
            tag
          }));
      return release.data;
    } catch (e) {
      throw new Error(`fetch release failed. release: ${JSON.stringify({owner, repo, tag})}. Error: ${e}`);
    }
  }

  // Checks if url is of the form 'https://github.com/docker/buildx/releases/tag/v0.11.1'.
  public static async isReleaseUrl(url: string): Promise<boolean> {
    return !!(await this.releaseLocationFromUrl(url));
  }

  // Deconstructs url of the form 'https://github.com/docker/buildx/releases/tag/v0.11.1'.
  private static releaseLocationFromUrl(url: string): ReleaseLocation | null {
    if (!url.startsWith('https://github.com/')) {
      return null;
    }

    const path = Util.trimPrefix(url, 'https://github.com/');
    const pathParts = path.split('/');
    const isReleaseTagUrl = pathParts.length == 5 && pathParts[2] == 'releases' && pathParts[3] == 'tag';
    if (isReleaseTagUrl) {
      return {owner: pathParts[0], repo: pathParts[1], tag: pathParts[4]};
    }
    const isReleaseLatestUrl = pathParts.length == 4 && pathParts[2] == 'releases' && pathParts[3] == 'latest';
    if (isReleaseLatestUrl) {
      return {owner: pathParts[0], repo: pathParts[1], tag: 'latest'};
    }
    return null;
  }

  // Fetches release info from a pre-generated json file.
  // Deprecated: use getReleaseFromJSON(version).
  public static async getRelease(version: string): Promise<GitHubRelease> {
    return Install.getReleaseFromJSON(version);
  }

  // Fetches release info from a pre-generated json file.
  public static async getReleaseFromJSON(version: string): Promise<GitHubRelease> {
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

class InstallCache {
  private readonly htcName: string;
  private readonly htcVersion: string;
  private readonly ghaCacheKey: string;
  private readonly cacheDir: string;
  private readonly cacheFile: string;
  private readonly cachePath: string;

  constructor(htcName: string, htcVersion: string) {
    this.htcName = htcName;
    this.htcVersion = htcVersion;
    this.ghaCacheKey = util.format('%s-%s-%s', this.htcName, this.htcVersion, this.platform());
    this.cacheDir = path.join(Buildx.configDir, '.bin', htcVersion, this.platform());
    this.cacheFile = os.platform() == 'win32' ? 'docker-buildx.exe' : 'docker-buildx';
    this.cachePath = path.join(this.cacheDir, this.cacheFile);
    if (!fs.existsSync(this.cacheDir)) {
      fs.mkdirSync(this.cacheDir, {recursive: true});
    }
  }

  public async save(file: string): Promise<string> {
    core.debug(`InstallCache.save ${file}`);
    const cachePath = this.copyToCache(file);

    const htcPath = await tc.cacheDir(this.cacheDir, this.htcName, this.htcVersion, this.platform());
    core.debug(`InstallCache.save cached to hosted tool cache ${htcPath}`);

    if (cache.isFeatureAvailable()) {
      core.debug(`InstallCache.save caching ${this.ghaCacheKey} to GitHub Actions cache`);
      await cache.saveCache([this.cacheDir], this.ghaCacheKey);
    }

    return cachePath;
  }

  public async find(): Promise<string> {
    let htcPath = tc.find(this.htcName, this.htcVersion, this.platform());
    if (htcPath) {
      core.info(`Restored from hosted tool cache ${htcPath}`);
      return this.copyToCache(`${htcPath}/${this.cacheFile}`);
    }

    if (cache.isFeatureAvailable()) {
      core.debug(`GitHub Actions cache feature available`);
      if (await cache.restoreCache([this.cacheDir], this.ghaCacheKey)) {
        core.info(`Restored ${this.ghaCacheKey} from GitHub Actions cache`);
        htcPath = await tc.cacheDir(this.cacheDir, this.htcName, this.htcVersion, this.platform());
        core.info(`Restored to hosted tool cache ${htcPath}`);
        return this.copyToCache(`${htcPath}/${this.cacheFile}`);
      }
    } else {
      core.info(`GitHub Actions cache feature not available`);
    }

    return '';
  }

  private copyToCache(file: string): string {
    core.debug(`Copying ${file} to ${this.cachePath}`);
    fs.copyFileSync(file, this.cachePath);
    fs.chmodSync(this.cachePath, '0755');
    return this.cachePath;
  }

  private platform(): string {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const arm_version = (process.config.variables as any).arm_version;
    return `${os.platform()}-${os.arch()}${arm_version ? 'v' + arm_version : ''}`;
  }
}
