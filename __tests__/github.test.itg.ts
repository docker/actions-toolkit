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

import {beforeEach, describe, expect, it, jest} from '@jest/globals';
import * as path from 'path';

import {GitHub} from '../src/github';

const fixturesDir = path.join(__dirname, 'fixtures');

const maybe = !process.env.GITHUB_ACTIONS || (process.env.GITHUB_ACTIONS === 'true' && process.env.ImageOS && process.env.ImageOS.startsWith('ubuntu')) ? describe : describe.skip;

beforeEach(() => {
  jest.clearAllMocks();
});

maybe('uploadArtifact', () => {
  it('uploads an artifact', async () => {
    const res = await GitHub.uploadArtifact({
      filename: path.join(fixturesDir, 'github-repo.json'),
      mimeType: 'application/json',
      retentionDays: 1
    });
    expect(res).toBeDefined();
    console.log('uploadArtifactResponse', res);
    expect(res?.url).toBeDefined();
  });
});
