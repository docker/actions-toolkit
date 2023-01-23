import fs from 'fs';
import os from 'os';
import path from 'path';
import * as core from '@actions/core';
import * as exec from '@actions/exec';
import * as semver from 'semver';
import * as tmp from 'tmp';

import {Buildx} from './buildx';
import {Builder, BuilderInfo} from './builder';

export interface BuildKitOpts {
  buildx?: Buildx;
}

export class BuildKit {
  private buildx: Buildx;
  private containerNamePrefix = 'buildx_buildkit_';
  private tmpdir = fs.mkdtempSync(path.join(os.tmpdir(), 'docker-actions-toolkit-')).split(path.sep).join(path.posix.sep);

  constructor(opts?: BuildKitOpts) {
    this.buildx = opts?.buildx || new Buildx();
  }

  private async getBuilderInfo(name: string): Promise<BuilderInfo> {
    const builder = new Builder({buildx: this.buildx});
    return builder.inspect(name);
  }

  public async getVersion(builderName: string): Promise<string | undefined> {
    const builderInfo = await this.getBuilderInfo(builderName);
    if (builderInfo.nodes.length == 0) {
      // a builder always have on node, should not happen.
      return undefined;
    }
    // TODO: get version for all nodes
    const node = builderInfo.nodes[0];
    if (!node.buildkitVersion && node.name) {
      try {
        return await this.getVersionWithinImage(node.name);
      } catch (e) {
        core.warning(e);
      }
    }
    return node.buildkitVersion;
  }

  private async getVersionWithinImage(nodeName: string): Promise<string> {
    return exec
      .getExecOutput(`docker`, ['inspect', '--format', '{{.Config.Image}}', `${this.containerNamePrefix}${nodeName}`], {
        ignoreReturnCode: true,
        silent: true
      })
      .then(bkitimage => {
        if (bkitimage.exitCode == 0 && bkitimage.stdout.length > 0) {
          return exec
            .getExecOutput(`docker`, ['run', '--rm', bkitimage.stdout.trim(), '--version'], {
              ignoreReturnCode: true,
              silent: true
            })
            .then(bkitversion => {
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

  public async versionSatisfies(builderName: string, range: string): Promise<boolean> {
    const builderInfo = await this.getBuilderInfo(builderName);
    for (const node of builderInfo.nodes) {
      let bkversion = node.buildkitVersion;
      if (!bkversion) {
        try {
          bkversion = await this.getVersionWithinImage(node.name || '');
        } catch (e) {
          return false;
        }
      }
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

  public generateConfigInline(s: string): string {
    return this.generateConfig(s, false);
  }

  public generateConfigFile(s: string): string {
    return this.generateConfig(s, true);
  }

  private generateConfig(s: string, file: boolean): string {
    if (file) {
      if (!fs.existsSync(s)) {
        throw new Error(`config file ${s} not found`);
      }
      s = fs.readFileSync(s, {encoding: 'utf-8'});
    }
    const configFile = this.tmpName({tmpdir: this.tmpDir()});
    fs.writeFileSync(configFile, s);
    return configFile;
  }

  private tmpDir() {
    return this.tmpdir;
  }

  private tmpName(options?: tmp.TmpNameOptions): string {
    return tmp.tmpNameSync(options);
  }
}
