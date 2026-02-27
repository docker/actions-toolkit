/**
 * Copyright 2025 actions-toolkit authors
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

import {describe, expect, test} from 'vitest';
import * as fs from 'fs';

import {Install} from '../../src/regclient/install.js';

describe('download', () => {
  // prettier-ignore
  test.each(['latest'])(
    'install regclient %s', async (version) => {
      await expect((async () => {
        const install = new Install();
        const toolPath = await install.download(version);
        if (!fs.existsSync(toolPath)) {
          throw new Error('toolPath does not exist');
        }
        const binPath = await install.install(toolPath);
        if (!fs.existsSync(binPath)) {
          throw new Error('binPath does not exist');
        }
      })()).resolves.not.toThrow();
    }, 60000);
});
