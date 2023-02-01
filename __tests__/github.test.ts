import {describe, expect, jest, it, beforeEach, afterEach} from '@jest/globals';
import * as fs from 'fs';
import * as path from 'path';

import {GitHub, GitHubRepo} from '../src/github';

beforeEach(() => {
  jest.clearAllMocks();
});

import * as repoFixture from './fixtures/repo.json';
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
    expect(GitHub.actionsRuntimeToken).toEqual({});
  });
  it('fixture', async () => {
    process.env.ACTIONS_RUNTIME_TOKEN = fs.readFileSync(path.join(__dirname, 'fixtures', 'runtimeToken.txt')).toString().trim();
    const runtimeToken = GitHub.actionsRuntimeToken;
    expect(runtimeToken.ac).toEqual('[{"Scope":"refs/heads/master","Permission":3}]');
    expect(runtimeToken.iss).toEqual('vstoken.actions.githubusercontent.com');
  });
});
