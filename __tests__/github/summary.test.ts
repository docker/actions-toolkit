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

import {afterEach, describe, expect, test, vi} from 'vitest';
import * as core from '@actions/core';

import {GitHubSummary} from '../../src/github/summary.js';

afterEach(() => {
  core.summary.emptyBuffer();
  vi.restoreAllMocks();
});

describe('writeBuildSummary', () => {
  test.each([1, 11])('escapes a build error with %i lines', async lines => {
    const error = Array(lines).fill('unknown instruction: <tag> & value').join('\n');
    const encodedError = Array(lines).fill('unknown instruction: &#x3C;tag&#x3E; &#x26; value').join('\n');
    const write = vi.spyOn(core.summary, 'write').mockResolvedValue(core.summary);

    await GitHubSummary.writeBuildSummary({
      exportRes: {
        dockerbuildFilename: 'build.dockerbuild',
        dockerbuildSize: 0,
        builderName: 'builder',
        nodeName: 'node',
        refs: ['buildref'],
        summaries: {
          buildref: {
            name: 'build',
            status: 'failed',
            duration: '1s',
            numCachedSteps: 0,
            numTotalSteps: 1,
            numCompletedSteps: 0,
            error
          }
        }
      }
    });

    expect(write).toHaveBeenCalledOnce();
    expect(core.summary.stringify()).toContain(`<pre lang="text"><code>${encodedError}</code></pre>`);
    expect(core.summary.stringify().includes('<details><summary><strong>Error</strong></summary>')).toBe(lines > 10);
  });
});
