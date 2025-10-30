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

import {describe, expect, jest, test} from '@jest/globals';
import * as fs from 'fs';

import {Install} from '../../src/buildx/install';

const maybe = !process.env.GITHUB_ACTIONS || (process.env.GITHUB_ACTIONS === 'true' && process.env.ImageOS && process.env.ImageOS.startsWith('ubuntu')) ? describe : describe.skip;

// needs GitHub REST API to get releases JSON
jest.unmock('@actions/github');

maybe('download', () => {
  // prettier-ignore
  test.each(['latest'])(
    'install buildx %s', async (version) => {
      await expect((async () => {
        const install = new Install({
          standalone: true
        });
        const toolPath = await install.download(version);
        if (!fs.existsSync(toolPath)) {
          throw new Error('toolPath does not exist');
        }
        const binPath = await install.installStandalone(toolPath);
        if (!fs.existsSync(binPath)) {
          throw new Error('binPath does not exist');
        }
      })()).resolves.not.toThrow();
    }, 60000);
});
