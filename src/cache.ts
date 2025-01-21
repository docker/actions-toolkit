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
import * as tc from '@actions/tool-cache';
import * as cache from '@actions/cache';
import * as util from 'util';

export interface CacheOpts {
  htcName: string;
  htcVersion: string;
  baseCacheDir: string;
  cacheFile: string;
  ghaNoCache?: boolean;
}

export interface CachePostState {
  dir: string;
  key: string;
}

export class Cache {
  private readonly opts: CacheOpts;
  private readonly ghaCacheKey: string;
  private readonly ghaNoCache?: boolean;
  private readonly cacheDir: string;
  private readonly cachePath: string;

  private static readonly POST_CACHE_KEY = 'postCache';

  constructor(opts: CacheOpts) {
    this.opts = opts;
    this.ghaCacheKey = util.format('%s-%s-%s', this.opts.htcName, this.opts.htcVersion, this.platform());
    this.ghaNoCache = this.opts.ghaNoCache;
    this.cacheDir = path.join(this.opts.baseCacheDir, this.opts.htcVersion, this.platform());
    this.cachePath = path.join(this.cacheDir, this.opts.cacheFile);
    if (!fs.existsSync(this.cacheDir)) {
      fs.mkdirSync(this.cacheDir, {recursive: true});
    }
  }

  public async save(file: string, skipState?: boolean): Promise<string> {
    core.debug(`Cache.save ${file}`);
    const cachePath = this.copyToCache(file);

    const htcPath = await tc.cacheDir(this.cacheDir, this.opts.htcName, this.opts.htcVersion, this.platform());
    core.debug(`Cache.save cached to hosted tool cache ${htcPath}`);

    if (!this.ghaNoCache && cache.isFeatureAvailable()) {
      if (skipState) {
        core.debug(`Cache.save caching ${this.ghaCacheKey} to GitHub Actions cache`);
        await cache.saveCache([this.cacheDir], this.ghaCacheKey);
      } else {
        core.debug(`Cache.save sending ${this.ghaCacheKey} to post state`);
        core.saveState(
          Cache.POST_CACHE_KEY,
          JSON.stringify({
            dir: this.cacheDir,
            key: this.ghaCacheKey
          } as CachePostState)
        );
      }
    }

    return cachePath;
  }

  public async find(): Promise<string> {
    let htcPath = tc.find(this.opts.htcName, this.opts.htcVersion, this.platform());
    if (htcPath) {
      core.info(`Restored from hosted tool cache ${htcPath}`);
      return this.copyToCache(`${htcPath}/${this.opts.cacheFile}`);
    }

    if (!this.ghaNoCache && cache.isFeatureAvailable()) {
      core.debug(`GitHub Actions cache feature available`);
      if (await cache.restoreCache([this.cacheDir], this.ghaCacheKey)) {
        core.info(`Restored ${this.ghaCacheKey} from GitHub Actions cache`);
        htcPath = await tc.cacheDir(this.cacheDir, this.opts.htcName, this.opts.htcVersion, this.platform());
        core.info(`Cached to hosted tool cache ${htcPath}`);
        return this.copyToCache(`${htcPath}/${this.opts.cacheFile}`);
      }
    } else if (this.ghaNoCache) {
      core.info(`GitHub Actions cache disabled`);
    } else {
      core.info(`GitHub Actions cache feature not available`);
    }

    return '';
  }

  public static async post(): Promise<CachePostState | undefined> {
    const state = core.getState(Cache.POST_CACHE_KEY);
    if (!state) {
      core.info(`State not set`);
      return Promise.resolve(undefined);
    }
    let cacheState: CachePostState;
    try {
      cacheState = <CachePostState>JSON.parse(state);
    } catch (e) {
      throw new Error(`Failed to parse cache post state: ${e}`);
    }
    if (!cacheState.dir || !cacheState.key) {
      throw new Error(`Invalid cache post state: ${state}`);
    }
    core.info(`Caching ${cacheState.key} to GitHub Actions cache`);
    await cache.saveCache([cacheState.dir], cacheState.key);
    return cacheState;
  }

  private copyToCache(file: string): string {
    core.debug(`Copying ${file} to ${this.cachePath}`);
    fs.copyFileSync(file, this.cachePath);
    return this.cachePath;
  }

  private platform(): string {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const arm_version = (process.config.variables as any).arm_version;
    return `${os.platform()}-${os.arch()}${arm_version ? 'v' + arm_version : ''}`;
  }
}
