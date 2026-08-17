/**
 * Copyright 2026 actions-toolkit authors
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

import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import * as cache from '@actions/cache';
import * as tc from '@actions/tool-cache';

import {Cache} from '../src/cache.js';

vi.mock('@actions/cache', () => ({
  isFeatureAvailable: vi.fn(),
  restoreCache: vi.fn(),
  saveCache: vi.fn()
}));

vi.mock('@actions/tool-cache', () => ({
  cacheDir: vi.fn(),
  find: vi.fn()
}));

const cacheFile = 'docker-buildx';
const htcName = 'buildx-dl-bin';
const htcVersion = '1.2.3';

let tmpDir: string;
let baseCacheDir: string;

beforeEach(() => {
  vi.clearAllMocks();
  tmpDir = fs.mkdtempSync(path.join(process.env.TEMP || os.tmpdir(), 'cache-'));
  baseCacheDir = path.join(tmpDir, '.cache');

  vi.mocked(cache.isFeatureAvailable).mockReturnValue(true);
  vi.mocked(cache.restoreCache).mockResolvedValue(undefined);
  vi.mocked(cache.saveCache).mockResolvedValue(1);
  vi.mocked(tc.find).mockReturnValue('');
  vi.mocked(tc.cacheDir).mockResolvedValue(path.join(tmpDir, 'hosted-tool-cache'));
});

afterEach(() => {
  fs.rmSync(tmpDir, {recursive: true, force: true});
});

describe('cache', () => {
  it('returns the restored GitHub Actions cache file when hosted tool cache seeding succeeds', async () => {
    vi.mocked(cache.restoreCache).mockImplementation(async paths => {
      fs.writeFileSync(path.join(paths[0], cacheFile), 'buildx');
      return 'cache-key';
    });

    const c = new Cache({
      htcName,
      htcVersion,
      baseCacheDir,
      cacheFile
    });

    const restoredPath = await c.find();

    expect(restoredPath).toEqual(expectedCachePath());
    expect(fs.readFileSync(restoredPath, 'utf8')).toEqual('buildx');
    expect(tc.cacheDir).toHaveBeenCalledWith(expectedCacheDir(), htcName, htcVersion, cachePlatform());
  });

  it('returns the restored GitHub Actions cache file when hosted tool cache seeding fails', async () => {
    vi.mocked(cache.restoreCache).mockImplementation(async paths => {
      fs.writeFileSync(path.join(paths[0], cacheFile), 'buildx');
      return 'cache-key';
    });
    vi.mocked(tc.cacheDir).mockRejectedValue(new Error('hosted tool cache unavailable'));

    const c = new Cache({
      htcName,
      htcVersion,
      baseCacheDir,
      cacheFile
    });

    const restoredPath = await c.find();

    expect(restoredPath).toEqual(expectedCachePath());
    expect(fs.readFileSync(restoredPath, 'utf8')).toEqual('buildx');
  });

  it('returns empty when the restored GitHub Actions cache file is missing', async () => {
    vi.mocked(cache.restoreCache).mockResolvedValue('cache-key');

    const c = new Cache({
      htcName,
      htcVersion,
      baseCacheDir,
      cacheFile
    });

    const restoredPath = await c.find();

    expect(restoredPath).toEqual('');
    expect(tc.cacheDir).not.toHaveBeenCalled();
  });

  it('saves the local cache file when hosted tool cache seeding fails', async () => {
    vi.mocked(tc.cacheDir).mockRejectedValue(new Error('hosted tool cache unavailable'));
    const sourcePath = path.join(tmpDir, 'source-buildx');
    fs.writeFileSync(sourcePath, 'buildx');

    const c = new Cache({
      htcName,
      htcVersion,
      baseCacheDir,
      cacheFile
    });

    const savedPath = await c.save(sourcePath, true);

    expect(savedPath).toEqual(expectedCachePath());
    expect(fs.readFileSync(savedPath, 'utf8')).toEqual('buildx');
    expect(cache.saveCache).toHaveBeenCalledWith([expectedCacheDir()], `${htcName}-${htcVersion}-${cachePlatform()}`);
  });
});

function expectedCacheDir(): string {
  return path.join(baseCacheDir, htcVersion, cachePlatform());
}

function expectedCachePath(): string {
  return path.join(expectedCacheDir(), cacheFile);
}

function cachePlatform(): string {
  const arm_version = (process.config.variables as {arm_version?: string}).arm_version;
  return `${os.platform()}-${os.arch()}${arm_version ? 'v' + arm_version : ''}`;
}
