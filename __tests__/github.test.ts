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

import {describe, expect, jest, it, beforeEach, afterEach, test} from '@jest/globals';
import * as fs from 'fs';
import * as path from 'path';
import * as core from '@actions/core';

import {GitHub} from '../src/github';
import {GitHubRepo} from '../src/types/github';

import repoFixture from './.fixtures/github-repo.json';

describe('repoData', () => {
  it('returns GitHub repo data', async () => {
    jest.spyOn(GitHub.prototype, 'repoData').mockImplementation((): Promise<GitHubRepo> => {
      return <Promise<GitHubRepo>>(repoFixture as unknown);
    });
    const github = new GitHub();
    expect((await github.repoData()).name).toEqual('Hello-World');
  });
});

describe('repoData (api)', () => {
  it('returns docker/actions-toolkit', async () => {
    if (!process.env.GITHUB_TOKEN) {
      return;
    }

    const originalEnv = process.env;
    process.env = {
      ...originalEnv,
      GITHUB_REPOSITORY: 'docker/actions-toolkit'
    };

    try {
      jest.resetModules();
      jest.unmock('@actions/github');
      const {GitHub} = await import('../src/github');
      const github = new GitHub({token: process.env.GITHUB_TOKEN});
      const repo = await github.repoData();
      const fullName = repo.full_name ?? `${repo.owner?.login}/${repo.name}`;
      expect(fullName).toEqual('docker/actions-toolkit');
    } finally {
      process.env = originalEnv;
    }
  });
});

describe('context', () => {
  it('returns repository name from payload', async () => {
    expect(GitHub.context.payload.repository?.name).toEqual('test-docker-action');
  });
  it('is repository private', async () => {
    expect(GitHub.context.payload.repository?.private).toEqual(true);
  });
});

describe('releases', () => {
  // prettier-ignore
  test.each([
    ['.github/buildx-lab-releases.json'],
    ['.github/buildx-releases.json'],
    ['.github/compose-lab-releases.json'],
    ['.github/compose-releases.json'],
    ['.github/docker-releases.json'],
    ['.github/regclient-releases.json'],
    ['.github/undock-releases.json'],
  ])('returns %p', async (path: string) => {
    const github = new GitHub();
    const releases = await github.releases('App', {
      owner: 'docker',
      repo: 'actions-toolkit',
      ref: 'main',
      path: path
    });
    expect(releases).toBeDefined();
    expect(Object.keys(releases).length).toBeGreaterThan(0);
  });
});

describe('serverURL', () => {
  const originalEnv = process.env;
  beforeEach(() => {
    jest.resetModules();
    process.env = {
      ...originalEnv,
      GITHUB_SERVER_URL: 'https://foo.github.com'
    };
  });
  afterEach(() => {
    process.env = originalEnv;
  });
  it('returns default', async () => {
    process.env.GITHUB_SERVER_URL = '';
    expect(GitHub.serverURL).toEqual('https://github.com');
  });
  it('returns from env', async () => {
    expect(GitHub.serverURL).toEqual('https://foo.github.com');
  });
});

describe('apiURL', () => {
  const originalEnv = process.env;
  beforeEach(() => {
    jest.resetModules();
    process.env = {
      ...originalEnv,
      GITHUB_API_URL: 'https://bar.github.com'
    };
  });
  afterEach(() => {
    process.env = originalEnv;
  });
  it('returns default', async () => {
    process.env.GITHUB_API_URL = '';
    expect(GitHub.apiURL).toEqual('https://api.github.com');
  });
  it('returns from env', async () => {
    expect(GitHub.apiURL).toEqual('https://bar.github.com');
  });
});

describe('repository', () => {
  it('returns GitHub repository', async () => {
    expect(GitHub.repository).toEqual('docker/actions-toolkit');
  });
});

describe('workflowRunURL', () => {
  it('returns 2188748038', async () => {
    expect(GitHub.workflowRunURL()).toEqual('https://github.com/docker/actions-toolkit/actions/runs/2188748038');
  });
  it('returns 2188748038 with attempts 2', async () => {
    expect(GitHub.workflowRunURL(true)).toEqual('https://github.com/docker/actions-toolkit/actions/runs/2188748038/attempts/2');
  });
});

describe('actionsRuntimeToken', () => {
  const originalEnv = process.env;
  beforeEach(() => {
    jest.resetModules();
    process.env = {
      ...originalEnv
    };
  });
  afterEach(() => {
    process.env = originalEnv;
  });
  it('empty', async () => {
    process.env.ACTIONS_RUNTIME_TOKEN = '';
    expect(GitHub.actionsRuntimeToken).toBeUndefined();
  });
  it('malformed', async () => {
    process.env.ACTIONS_RUNTIME_TOKEN = 'foo';
    expect(() => {
      // eslint-disable-next-line @typescript-eslint/no-unused-expressions
      GitHub.actionsRuntimeToken;
    }).toThrow();
  });
  it('fixture', async () => {
    process.env.ACTIONS_RUNTIME_TOKEN = fs
      .readFileSync(path.join(__dirname, '.fixtures', 'runtimeToken.txt'))
      .toString()
      .trim();
    const runtimeToken = GitHub.actionsRuntimeToken;
    expect(runtimeToken?.ac).toEqual('[{"Scope":"refs/heads/master","Permission":3}]');
    expect(runtimeToken?.iss).toEqual('vstoken.actions.githubusercontent.com');
  });
});

describe('printActionsRuntimeTokenACs', () => {
  const originalEnv = process.env;
  beforeEach(() => {
    jest.resetModules();
    process.env = {
      ...originalEnv
    };
  });
  afterEach(() => {
    process.env = originalEnv;
  });
  it('empty', async () => {
    process.env.ACTIONS_RUNTIME_TOKEN = '';
    await expect(GitHub.printActionsRuntimeTokenACs()).rejects.toThrow(new Error('ACTIONS_RUNTIME_TOKEN not set'));
  });
  it('malformed', async () => {
    process.env.ACTIONS_RUNTIME_TOKEN = 'foo';
    await expect(GitHub.printActionsRuntimeTokenACs()).rejects.toThrow(new Error('Cannot parse GitHub Actions Runtime Token: Invalid token specified: missing part #2'));
  });
  it('refs/heads/master', async () => {
    const infoSpy = jest.spyOn(core, 'info');
    process.env.ACTIONS_RUNTIME_TOKEN = fs
      .readFileSync(path.join(__dirname, '.fixtures', 'runtimeToken.txt'))
      .toString()
      .trim();
    await GitHub.printActionsRuntimeTokenACs();
    expect(infoSpy).toHaveBeenCalledTimes(1);
    expect(infoSpy).toHaveBeenCalledWith(`refs/heads/master: read/write`);
  });
});
