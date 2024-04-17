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
import * as fs from 'fs';
import * as path from 'path';

import {Buildx} from '../../src/buildx/buildx';
import {LintResults} from '../../src/types/buildkit';

const fixturesDir = path.join(__dirname, '..', 'fixtures');

const maybe = !process.env.GITHUB_ACTIONS || (process.env.GITHUB_ACTIONS === 'true' && process.env.ImageOS && process.env.ImageOS.startsWith('ubuntu')) ? describe : describe.skip;

beforeEach(() => {
  jest.clearAllMocks();
});

maybe('lint', () => {
  it('runs lint', async () => {
    const buildx = new Buildx();
    const buildCmd = await buildx.getCommand(['build', '-f', path.join(fixturesDir, 'lint.Dockerfile'), fixturesDir]);
    const res = await buildx.lint(buildCmd.command, buildCmd.args);
    expect(res).toBeDefined();
    const expected = <LintResults>JSON.parse(fs.readFileSync(path.join(fixturesDir, 'buildkit-lint-results.json'), {encoding: 'utf-8'}).trim());
    expect(res?.warnings).toEqual(expected.warnings);
  });
});
