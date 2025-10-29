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

import {describe, expect, jest, it, test} from '@jest/globals';

import {GitHub} from '../src/github';

// needs GitHub REST API to get releases JSON
jest.unmock('@actions/github');

describe('releases', () => {
  it('returns Undock releases JSON', async () => {
    const github = new GitHub();
    const releases = await github.releases('Undock', {
      owner: 'docker',
      repo: 'actions-toolkit',
      ref: 'main',
      path: '.github/undock-releases.json'
    });
    expect(releases).toBeDefined();
    expect(Object.keys(releases).length).toBeGreaterThan(0);
  });
});

describe('releasesRaw', () => {
  // prettier-ignore
  test.each([
    ['.github/buildx-lab-releases.json'],
    ['.github/buildx-releases.json'],
    ['.github/compose-lab-releases.json'],
    ['.github/compose-releases.json'],
    ['.github/docker-releases.json'],
    ['.github/regclient-releases.json'],
    ['.github/undock-releases.json'],
  ])('returns %p using GitHub CDN', async (path: string) => {
    const github = new GitHub();
    const releases = await github.releasesRaw('Undock', {
      owner: 'docker',
      repo: 'actions-toolkit',
      ref: 'main',
      path: path
    });
    expect(releases).toBeDefined();
    expect(Object.keys(releases).length).toBeGreaterThan(0);
  });
});

describe('releasesAPI', () => {
  it('returns Undock releases JSON using GitHub API', async () => {
    const github = new GitHub();
    const releases = await github.releasesAPI('Undock', {
      owner: 'docker',
      repo: 'actions-toolkit',
      ref: 'main',
      path: '.github/undock-releases.json'
    });
    expect(releases).toBeDefined();
    expect(Object.keys(releases).length).toBeGreaterThan(0);
  });
});
