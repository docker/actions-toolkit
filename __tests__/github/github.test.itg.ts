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

import {describe, expect, it} from 'vitest';

import {GitHub} from '../../src/github/github.js';

describe('repoData', () => {
  it('returns docker/actions-toolkit', async () => {
    if (!process.env.GITHUB_TOKEN) {
      console.log(`GitHub token not available, skipping test`);
      return;
    }
    const originalEnv = process.env;
    process.env = {
      ...originalEnv,
      GITHUB_REPOSITORY: 'docker/actions-toolkit'
    };
    try {
      const github = new GitHub({token: process.env.GITHUB_TOKEN});
      const repo = await github.repoData();
      const fullName = repo.full_name ?? `${repo.owner?.login}/${repo.name}`;
      expect(fullName).toEqual('docker/actions-toolkit');
    } finally {
      process.env = originalEnv;
    }
  });
});
