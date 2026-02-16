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

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {vi} from 'vitest';

const envTmpDir = process.env.DOCKER_ACTIONS_TOOLKIT_TMPDIR;
const tmpDir = envTmpDir || fs.mkdtempSync(path.join(os.tmpdir(), 'docker-actions-toolkit-'));

vi.mock('@actions/github');

process.env = Object.assign({}, process.env, {
  DOCKER_ACTIONS_TOOLKIT_TMPDIR: tmpDir,
  TEMP: tmpDir,
  GITHUB_REPOSITORY: 'docker/actions-toolkit',
  GITHUB_RUN_ATTEMPT: '2',
  GITHUB_RUN_ID: '2188748038',
  GITHUB_RUN_NUMBER: '15',
  RUNNER_TEMP: path.join(tmpDir, 'runner-temp'),
  RUNNER_TOOL_CACHE: path.join(tmpDir, 'runner-tool-cache')
});
