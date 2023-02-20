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

import {describe, expect, jest, it, beforeEach, afterEach} from '@jest/globals';
import * as fs from 'fs';
import * as path from 'path';
import * as core from '@actions/core';

import {GitHub} from '../src/github';
import {GitHubRepo} from '../src/types/github';

beforeEach(() => {
  jest.clearAllMocks();
});

import repoFixture from './fixtures/github-repo.json';
jest.spyOn(GitHub.prototype, 'repoData').mockImplementation((): Promise<GitHubRepo> => {
  return <Promise<GitHubRepo>>(repoFixture as unknown);
});

describe('repoData', () => {
  it('returns GitHub repository', async () => {
    const github = new GitHub();
    expect((await github.repoData()).name).toEqual('Hello-World');
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
      GitHub.actionsRuntimeToken;
    }).toThrowError();
  });
  it('fixture', async () => {
    process.env.ACTIONS_RUNTIME_TOKEN = fs.readFileSync(path.join(__dirname, 'fixtures', 'runtimeToken.txt')).toString().trim();
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
    await expect(GitHub.printActionsRuntimeTokenACs()).rejects.toThrowError(new Error('ACTIONS_RUNTIME_TOKEN not set'));
  });
  it('malformed', async () => {
    process.env.ACTIONS_RUNTIME_TOKEN = 'foo';
    await expect(GitHub.printActionsRuntimeTokenACs()).rejects.toThrowError(new Error("Cannot parse GitHub Actions Runtime Token: Invalid token specified: Cannot read properties of undefined (reading 'replace')"));
  });
  it('refs/heads/master', async () => {
    const infoSpy = jest.spyOn(core, 'info');
    process.env.ACTIONS_RUNTIME_TOKEN = fs.readFileSync(path.join(__dirname, 'fixtures', 'runtimeToken.txt')).toString().trim();
    await GitHub.printActionsRuntimeTokenACs();
    expect(infoSpy).toHaveBeenCalledTimes(1);
    expect(infoSpy).toHaveBeenCalledWith(`refs/heads/master: read/write`);
  });
});
