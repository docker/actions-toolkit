import {describe, expect, jest, it, beforeEach, afterEach} from '@jest/globals';

import {GitHub, GitHubRepo} from '../src/github';

beforeEach(() => {
  jest.clearAllMocks();
});

import * as repoFixture from './fixtures/repo.json';
jest.spyOn(GitHub.prototype, 'repoData').mockImplementation((): Promise<GitHubRepo> => {
  return <Promise<GitHubRepo>>(repoFixture as unknown);
});

describe('context', () => {
  it('returns repository name from payload', async () => {
    const github = new GitHub();
    expect(github.context.payload.repository?.name).toEqual('test-docker-action');
  });
  it('is repository private', async () => {
    const github = new GitHub();
    expect(github.context.payload.repository?.private).toEqual(true);
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
    const github = new GitHub();
    expect(github.serverURL).toEqual('https://github.com');
  });
  it('returns from env', async () => {
    const github = new GitHub();
    expect(github.serverURL).toEqual('https://foo.github.com');
  });
});

describe('repoData', () => {
  it('returns GitHub repository', async () => {
    const github = new GitHub();
    expect((await github.repoData()).name).toEqual('Hello-World');
  });
});
