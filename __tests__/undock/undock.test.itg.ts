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

import {describe, expect, it} from 'vitest';
import fs from 'fs';
import os from 'os';

import {Undock} from '../../src/undock/undock.js';
import {Install as UndockInstall} from '../../src/undock/install.js';

describe('run', () => {
  it('extracts moby/moby-bin:26.1.5', async () => {
    const install = new UndockInstall();
    const toolPath = await install.download('latest');
    if (!fs.existsSync(toolPath)) {
      throw new Error('toolPath does not exist');
    }
    const binPath = await install.install(toolPath);
    if (!fs.existsSync(binPath)) {
      throw new Error('binPath does not exist');
    }

    const undock = new Undock();
    await expect(
      (async () => {
        // prettier-ignore
        await undock.run({
          source: 'docker/buildx-bin:0.23.0',
          dist: os.tmpdir()
        });
      })()
    ).resolves.not.toThrow();
  }, 500000);
});
