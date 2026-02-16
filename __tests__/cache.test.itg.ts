/**
 * Copyright 2024 actions-toolkit authors
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

import {describe, expect, it} from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';

import {Cache} from '../src/cache';
import {Util} from '../src/util';

const fixturesDir = path.join(__dirname, '.fixtures');
const tmpDir = fs.mkdtempSync(path.join(process.env.TEMP || os.tmpdir(), 'cache-itg-'));

describe('cache', () => {
  it('caches github-repo', async () => {
    const r = Util.generateRandomString();
    const htcName = `cache-test-github-repo-${r}`;
    const c = new Cache({
      htcName: htcName,
      htcVersion: `v1.0.0+${r}`,
      baseCacheDir: path.join(tmpDir, '.cache-test'),
      cacheFile: 'github-repo.json'
    });
    expect(await c.save(path.join(fixturesDir, 'github-repo.json'), true)).not.toEqual('');
    expect(await c.find()).not.toEqual('');
  });

  it('caches github-repo with post state', async () => {
    const r = Util.generateRandomString();
    const htcName = `cache-test-github-repo-${r}`;
    const c = new Cache({
      htcName: htcName,
      htcVersion: `v1.0.0+${r}`,
      baseCacheDir: path.join(tmpDir, '.cache-test'),
      cacheFile: 'github-repo.json'
    });
    expect(await c.save(path.join(fixturesDir, 'github-repo.json'))).not.toEqual('');
    expect(await Cache.post()).not.toBeNull();
    expect(await c.find()).not.toEqual('');
  });
});
