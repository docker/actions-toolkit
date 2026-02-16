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

import {describe, expect, it, test} from 'vitest';

import {Docker} from '../../src/docker/docker';

const maybe = !process.env.GITHUB_ACTIONS || (process.env.GITHUB_ACTIONS === 'true' && process.env.ImageOS && process.env.ImageOS.startsWith('ubuntu')) ? describe : describe.skip;

maybe('isDaemonRunning', () => {
  it('checks if daemon is running', async () => {
    expect(await Docker.isDaemonRunning()).toBe(true);
  });
});

maybe('pull', () => {
  // prettier-ignore
  test.each([
    [
      'busybox',
      undefined,
    ],
    [
      'busybox:1.36',
      undefined,
    ],
    [
      'busybox@sha256:7ae8447f3a7f5bccaa765926f25fc038e425cf1b2be6748727bbea9a13102094',
      undefined,
    ],
    [
      'doesnotexist:foo',
      `pull access denied for doesnotexist`,
    ],
  ])('pulling %p', async (image: string, err: string | undefined) => {
      try {
        await Docker.pull(image, true);
        if (err !== undefined) {
          throw new Error('Expected an error to be thrown');
        }
      } catch (e) {
        if (err === undefined) {
          throw new Error(`Expected no error, but got: ${e.message}`);
        }
        // eslint-disable-next-line vitest/no-conditional-expect
        expect(e.message).toContain(err);
      }
    }, 600000);
});

maybe('contextInspect', () => {
  it('inspect default context', async () => {
    const contextInfo = await Docker.contextInspect();
    expect(contextInfo).toBeDefined();
    console.log('contextInfo', contextInfo);
    expect(contextInfo?.Name).toBeDefined();
    expect(contextInfo?.Endpoints).toBeDefined();
    expect(Object.keys(contextInfo?.Endpoints).length).toBeGreaterThan(0);
  });
});
