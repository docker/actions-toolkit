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

import {describe, expect, it} from '@jest/globals';
import fs from 'fs';
import os from 'os';
import path from 'path';

import {GitHubArtifact} from '../../src/github/artifact';
import {Util} from '../../src/util';

const fixturesDir = path.join(__dirname, '..', '.fixtures');
const tmpDir = fs.mkdtempSync(path.join(process.env.TEMP || os.tmpdir(), 'github-itg-'));

const maybe = !process.env.GITHUB_ACTIONS || (process.env.GITHUB_ACTIONS === 'true' && process.env.ImageOS && process.env.ImageOS.startsWith('ubuntu')) ? describe : describe.skip;

maybe('upload', () => {
  it('uploads an artifact', async () => {
    const filename = path.join(tmpDir, `github-repo-${Util.generateRandomString()}.json`);
    fs.copyFileSync(path.join(fixturesDir, `github-repo.json`), filename);
    const res = await GitHubArtifact.upload({
      filename: filename,
      mimeType: 'application/json',
      retentionDays: 1
    });
    expect(res).toBeDefined();
    console.log('uploadArtifactResponse', res);
    expect(res?.url).toBeDefined();
  });
});
