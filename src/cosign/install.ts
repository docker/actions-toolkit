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
import {bundleFromJSON, SerializedBundle} from '@sigstore/bundle';
import * as tuf from '@sigstore/tuf';
import {toSignedEntity, toTrustMaterial, Verifier} from '@sigstore/verify';
import * as semver from 'semver';
import * as util from 'util';

import {Buildx} from '../buildx/buildx';
import {Cache} from '../cache';
import {Context} from '../context';
import {Exec} from '../exec';
import {Git} from '../git';
import {GitHub} from '../github';
import {Util} from '../util';

import {DownloadVersion} from '../types/cosign/cosign';
import {GitHubRelease} from '../types/github';
import {dockerfileContent} from './dockerfile';

export interface DownloadOpts {
  version: string;
  ghaNoCache?: boolean;
  skipState?: boolean;
  verifySignature?: boolean;
}

export interface InstallOpts {
  githubToken?: string;
  buildx?: Buildx;
}

export class Install {
  private readonly githubToken: string | undefined;
  private readonly buildx: Buildx;

  constructor(opts?: InstallOpts) {
    this.githubToken = opts?.githubToken || process.env.GITHUB_TOKEN;
    this.buildx = opts?.buildx || new Buildx();
  }

  public async download(opts: DownloadOpts): Promise<string> {
    const version: DownloadVersion = await Install.getDownloadVersion(opts.version);
    core.debug(`Install.download version: ${version.version}`);

    const release: GitHubRelease = await Install.getRelease(version, this.githubToken);
    core.debug(`Install.download release tag name: ${release.tag_name}`);

    const vspec = await this.vspec(release.tag_name);
    core.debug(`Install.download vspec: ${vspec}`);

    const c = semver.clean(vspec) || '';
    if (!semver.valid(c)) {
      throw new Error(`Invalid Cosign version "${vspec}".`);
    }

    const installCache = new Cache({
      htcName: 'cosign-dl-bin',
      htcVersion: vspec,
      baseCacheDir: path.join(os.homedir(), '.bin'),
      cacheFile: os.platform() == 'win32' ? 'cosign.exe' : 'cosign',
      ghaNoCache: opts.ghaNoCache
    });

    const cacheFoundPath = await installCache.find();
    if (cacheFoundPath) {
      core.info(`Cosign binary found in ${cacheFoundPath}`);
      return cacheFoundPath;
    }

    const downloadURL = util.format(version.downloadURL, vspec, this.filename());
    core.info(`Downloading ${downloadURL}`);

    const htcDownloadPath = await tc.downloadTool(downloadURL, undefined, this.githubToken);
    core.debug(`Install.download htcDownloadPath: ${htcDownloadPath}`);

    if (opts.verifySignature && semver.satisfies(vspec, '>=3.0.1')) {
      await this.verifySignature(htcDownloadPath, downloadURL);
    }

    const cacheSavePath = await installCache.save(htcDownloadPath, opts.skipState);
    core.info(`Cached to ${cacheSavePath}`);
    return cacheSavePath;
  }

  public async build(gitContext: string, ghaNoCache?: boolean, skipState?: boolean): Promise<string> {
    const vspec = await this.vspec(gitContext);
    core.debug(`Install.build vspec: ${vspec}`);

    const installCache = new Cache({
      htcName: 'cosign-build-bin',
      htcVersion: vspec,
      baseCacheDir: path.join(os.homedir(), '.bin'),
      cacheFile: os.platform() == 'win32' ? 'cosign.exe' : 'cosign',
      ghaNoCache: ghaNoCache
    });

    const cacheFoundPath = await installCache.find();
    if (cacheFoundPath) {
      core.info(`Cosign binary found in ${cacheFoundPath}`);
      return cacheFoundPath;
    }

    const outputDir = path.join(Context.tmpDir(), 'cosign-build-cache');
    const buildCmd = await this.buildCommand(gitContext, outputDir);

    const buildBinPath = await Exec.getExecOutput(buildCmd.command, buildCmd.args, {
      ignoreReturnCode: true,
      input: Buffer.from(dockerfileContent)
    }).then(res => {
      if (res.stderr.length > 0 && res.exitCode != 0) {
        throw new Error(`build failed with: ${res.stderr.match(/(.*)\s*$/)?.[0]?.trim() ?? 'unknown error'}`);
      }
      return `${outputDir}/cosign`;
    });

    const cacheSavePath = await installCache.save(buildBinPath, skipState);
    core.info(`Cached to ${cacheSavePath}`);
    return cacheSavePath;
  }

  public async install(binPath: string, dest?: string): Promise<string> {
    dest = dest || Context.tmpDir();

    const binDir = path.join(dest, 'cosign-bin');
    if (!fs.existsSync(binDir)) {
      fs.mkdirSync(binDir, {recursive: true});
    }
    const binName: string = os.platform() == 'win32' ? 'cosign.exe' : 'cosign';
    const cosignPath: string = path.join(binDir, binName);
    fs.copyFileSync(binPath, cosignPath);

    core.info('Fixing perms');
    fs.chmodSync(cosignPath, '0755');

    core.addPath(binDir);
    core.info('Added Cosign to PATH');

    core.info(`Binary path: ${cosignPath}`);
    return cosignPath;
  }

  private async buildCommand(gitContext: string, outputDir: string): Promise<{args: Array<string>; command: string}> {
    const buildxStandaloneFound = await new Buildx({standalone: true}).isAvailable();
    const buildxPluginFound = await new Buildx({standalone: false}).isAvailable();

    let buildStandalone = false;
    if ((await this.buildx.isStandalone()) && buildxStandaloneFound) {
      core.debug(`Install.buildCommand: Buildx standalone found, build with it`);
      buildStandalone = true;
    } else if (!(await this.buildx.isStandalone()) && buildxPluginFound) {
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

    const args = ['build', '--platform', 'local', '--build-arg', 'BUILDKIT_CONTEXT_KEEP_GIT_DIR=1', '--output', `type=local,dest=${outputDir}`];
    if (process.env.GIT_AUTH_TOKEN) {
      args.push('--secret', 'id=GIT_AUTH_TOKEN');
    }
    args.push('-f-', gitContext);

    // prettier-ignore
    return await new Buildx({standalone: buildStandalone}).getCommand(args);
  }

  private async verifySignature(cosignBinPath: string, downloadURL: string): Promise<void> {
    const bundleURL = `${downloadURL}.sigstore.json`;
    core.info(`Downloading keyless verification bundle at ${bundleURL}`);
    const bundlePath = await tc.downloadTool(bundleURL, undefined, this.githubToken);
    core.debug(`Install.verifySignature bundlePath: ${bundlePath}`);

    core.info(`Verifying keyless verification bundle signature`);
    const parsedBundle = JSON.parse(fs.readFileSync(bundlePath, 'utf-8')) as SerializedBundle;
    const bundle = bundleFromJSON(parsedBundle);

    core.info(`Fetching Sigstore TUF trusted root metadata`);
    const trustedRoot = await tuf.getTrustedRoot();
    const trustMaterial = toTrustMaterial(trustedRoot);

    try {
      core.info(`Verifying cosign binary signature`);
      const signedEntity = toSignedEntity(bundle, fs.readFileSync(cosignBinPath));
      const verifier = new Verifier(trustMaterial);
      const signer = verifier.verify(signedEntity, {
        subjectAlternativeName: 'keyless@projectsigstore.iam.gserviceaccount.com',
        extensions: {issuer: 'https://accounts.google.com'}
      });
      core.debug(`Install.verifySignature signer: ${JSON.stringify(signer)}`);
      core.info(`Cosign binary signature verified!`);
    } catch (err) {
      throw new Error(`Failed to verify cosign binary signature: ${err}`);
    }
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
      default: {
        arch = os.arch();
        break;
      }
    }
    const platform: string = os.platform() == 'win32' ? 'windows' : os.platform();
    const ext: string = os.platform() == 'win32' ? '.exe' : '';
    return util.format('cosign-%s-%s%s', platform, arch, ext);
  }

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
    return {
      version: v,
      downloadURL: 'https://github.com/sigstore/cosign/releases/download/v%s/%s',
      contentOpts: {
        owner: 'docker',
        repo: 'actions-toolkit',
        ref: 'main',
        path: '.github/cosign-releases.json'
      }
    };
  }

  public static async getRelease(version: DownloadVersion, githubToken?: string): Promise<GitHubRelease> {
    const github = new GitHub({token: githubToken});
    const releases = await github.releases('Cosign', version.contentOpts);
    if (!releases[version.version]) {
      throw new Error(`Cannot find Cosign release ${version.version} in releases JSON`);
    }
    return releases[version.version];
  }
}
