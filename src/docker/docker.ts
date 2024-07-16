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
import {ExecOptions, ExecOutput} from '@actions/exec';
import * as io from '@actions/io';

import {Context} from '../context';
import {Cache} from '../cache';
import {Exec} from '../exec';
import {Util} from '../util';

import {ConfigFile, ContextInfo} from '../types/docker/docker';

export class Docker {
  static get configDir(): string {
    return process.env.DOCKER_CONFIG || path.join(os.homedir(), '.docker');
  }

  public static configFile(): ConfigFile | undefined {
    const f = path.join(Docker.configDir, 'config.json');
    if (!fs.existsSync(f)) {
      return undefined;
    }
    return <ConfigFile>JSON.parse(fs.readFileSync(f, {encoding: 'utf-8'}));
  }

  public static async isAvailable(): Promise<boolean> {
    return await io
      .which('docker', true)
      .then(res => {
        core.debug(`Docker.isAvailable ok: ${res}`);
        return true;
      })
      .catch(error => {
        core.debug(`Docker.isAvailable error: ${error}`);
        return false;
      });
  }

  public static async exec(args?: string[], options?: ExecOptions): Promise<number> {
    return Exec.exec('docker', args, Docker.execOptions(options));
  }

  public static async getExecOutput(args?: string[], options?: ExecOptions): Promise<ExecOutput> {
    return Exec.getExecOutput('docker', args, Docker.execOptions(options));
  }

  private static execOptions(options?: ExecOptions): ExecOptions {
    if (!options) {
      options = {};
    }
    if (!options.env) {
      options.env = Object.assign({}, process.env, {
        DOCKER_CONTENT_TRUST: 'false'
      }) as {
        [key: string]: string;
      };
    } else {
      options.env.DOCKER_CONTENT_TRUST = 'false';
    }
    return options;
  }

  public static async context(name?: string): Promise<string> {
    const args = ['context', 'inspect', '--format', '{{.Name}}'];
    if (name) {
      args.push(name);
    }
    return await Docker.getExecOutput(args, {
      ignoreReturnCode: true,
      silent: true
    }).then(res => {
      if (res.stderr.length > 0 && res.exitCode != 0) {
        throw new Error(res.stderr);
      }
      return res.stdout.trim();
    });
  }

  public static async contextInspect(name?: string): Promise<ContextInfo> {
    const args = ['context', 'inspect', '--format=json'];
    if (name) {
      args.push(name);
    }
    return await Docker.getExecOutput(args, {
      ignoreReturnCode: true,
      silent: true
    }).then(res => {
      if (res.stderr.length > 0 && res.exitCode != 0) {
        throw new Error(res.stderr.trim());
      }
      return (<Array<ContextInfo>>JSON.parse(res.stdout.trim()))[0];
    });
  }

  public static async printVersion(): Promise<void> {
    await Docker.exec(['version']);
  }

  public static async printInfo(): Promise<void> {
    await Docker.exec(['info']);
  }

  public static parseRepoTag(image: string): {repository: string; tag: string} {
    let sepPos: number;
    const digestPos = image.indexOf('@');
    const colonPos = image.lastIndexOf(':');
    if (digestPos >= 0) {
      // priority on digest
      sepPos = digestPos;
    } else if (colonPos >= 0) {
      sepPos = colonPos;
    } else {
      return {
        repository: image,
        tag: 'latest'
      };
    }
    const tag = image.slice(sepPos + 1);
    if (tag.indexOf('/') === -1) {
      return {
        repository: image.slice(0, sepPos),
        tag: tag
      };
    }
    return {
      repository: image,
      tag: 'latest'
    };
  }

  public static async pull(image: string, cache?: boolean): Promise<void> {
    const parsedImage = Docker.parseRepoTag(image);
    const repoSanitized = parsedImage.repository.replace(/[^a-zA-Z0-9.]+/g, '--');
    const tagSanitized = parsedImage.tag.replace(/[^a-zA-Z0-9.]+/g, '--');

    const imageCache = new Cache({
      htcName: repoSanitized,
      htcVersion: tagSanitized,
      baseCacheDir: path.join(Docker.configDir, '.cache', 'images', repoSanitized),
      cacheFile: 'image.tar'
    });

    let cacheFoundPath: string | undefined;
    if (cache) {
      cacheFoundPath = await imageCache.find();
      if (cacheFoundPath) {
        core.info(`Image found from cache in ${cacheFoundPath}`);
        await Docker.getExecOutput(['load', '-i', cacheFoundPath], {
          ignoreReturnCode: true
        }).then(res => {
          if (res.stderr.length > 0 && res.exitCode != 0) {
            core.warning(`Failed to load image from cache: ${res.stderr.match(/(.*)\s*$/)?.[0]?.trim() ?? 'unknown error'}`);
          }
        });
      }
    }

    let pulled = true;
    await Docker.getExecOutput(['pull', image], {
      ignoreReturnCode: true
    }).then(res => {
      if (res.stderr.length > 0 && res.exitCode != 0) {
        pulled = false;
        const err = res.stderr.match(/(.*)\s*$/)?.[0]?.trim() ?? 'unknown error';
        if (cacheFoundPath) {
          core.warning(`Failed to pull image, using one from cache: ${err}`);
        } else {
          throw new Error(err);
        }
      }
    });

    if (cache && pulled) {
      const imageTarPath = path.join(Context.tmpDir(), `${Util.hash(image)}.tar`);
      await Docker.getExecOutput(['save', '-o', imageTarPath, image], {
        ignoreReturnCode: true
      }).then(async res => {
        if (res.stderr.length > 0 && res.exitCode != 0) {
          core.warning(`Failed to save image: ${res.stderr.match(/(.*)\s*$/)?.[0]?.trim() ?? 'unknown error'}`);
        } else {
          const cachePath = await imageCache.save(imageTarPath);
          core.info(`Image cached to ${cachePath}`);
        }
      });
    }
  }
}
