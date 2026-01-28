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

import * as core from '@actions/core';
import * as semver from 'semver';

import {Buildx} from '../buildx/buildx.js';
import {Builder} from '../buildx/builder.js';
import {Docker} from '../docker/docker.js';
import {Config} from './config.js';

import {BuilderInfo, NodeInfo} from '../types/buildx/builder.js';

export interface BuildKitOpts {
  buildx?: Buildx;
}

export class BuildKit {
  private readonly buildx: Buildx;

  public readonly config: Config;

  constructor(opts?: BuildKitOpts) {
    this.config = new Config();
    this.buildx = opts?.buildx || new Buildx();
  }

  public async getVersion(node: NodeInfo): Promise<string | undefined> {
    if (!node.buildkit && node.name) {
      try {
        return await this.getVersionWithinImage(node.name);
      } catch (e) {
        core.warning(e);
      }
    }
    return node.buildkit;
  }

  private async getVersionWithinImage(nodeName: string): Promise<string> {
    core.debug(`BuildKit.getVersionWithinImage nodeName: ${nodeName}`);
    return Docker.getExecOutput(['inspect', '--format', '{{.Config.Image}}', `${Buildx.containerNamePrefix}${nodeName}`], {
      ignoreReturnCode: true,
      silent: true
    }).then(bkitimage => {
      if (bkitimage.exitCode == 0 && bkitimage.stdout.length > 0) {
        core.debug(`BuildKit.getVersionWithinImage image: ${bkitimage.stdout.trim()}`);
        return Docker.getExecOutput(['run', '--rm', bkitimage.stdout.trim(), '--version'], {
          ignoreReturnCode: true,
          silent: true
        }).then(bkitversion => {
          if (bkitversion.exitCode == 0 && bkitversion.stdout.length > 0) {
            return `${bkitimage.stdout.trim()} => ${bkitversion.stdout.trim()}`;
          } else if (bkitversion.stderr.length > 0) {
            throw new Error(bkitimage.stderr.trim());
          }
          return bkitversion.stdout.trim();
        });
      } else if (bkitimage.stderr.length > 0) {
        throw new Error(bkitimage.stderr.trim());
      }
      return bkitimage.stdout.trim();
    });
  }

  public async versionSatisfies(builderName: string, range: string, builderInfo?: BuilderInfo): Promise<boolean> {
    if (!builderInfo) {
      builderInfo = await new Builder({buildx: this.buildx}).inspect(builderName);
    }
    for (const node of builderInfo.nodes) {
      let bkversion = node.buildkit;
      core.debug(`BuildKit.versionSatisfies ${bkversion}: ${range}`);
      if (!bkversion) {
        try {
          bkversion = await this.getVersionWithinImage(node.name || '');
        } catch {
          core.debug(`BuildKit.versionSatisfies ${node.name}: can't get version`);
          return false;
        }
      }
      core.debug(`BuildKit.versionSatisfies ${node.name}: version ${bkversion}`);
      // BuildKit version reported by moby is in the format of `v0.11.0-moby`
      if (builderInfo.driver == 'docker' && !bkversion.endsWith('-moby')) {
        return false;
      }
      if (!semver.satisfies(bkversion.replace(/-moby$/, ''), range)) {
        return false;
      }
    }
    return true;
  }
}
