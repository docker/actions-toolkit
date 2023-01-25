import {describe, expect, jest, it, beforeEach, afterEach} from '@jest/globals';

import {Context} from '@actions/github/lib/context';
import {GitHub, Payload, ReposGetResponseData} from '../src/github';

beforeEach(() => {
  jest.clearAllMocks();
  GitHub.getInstance().reset();
});

jest.spyOn(GitHub.prototype, 'context').mockImplementation((): Context => {
  return new Context();
});

import * as repoFixture from './fixtures/repo.json';
jest.spyOn(GitHub.prototype, 'repo').mockImplementation((): Promise<ReposGetResponseData> => {
  return <Promise<ReposGetResponseData>>(repoFixture as unknown);
});

import * as payloadFixture from './fixtures/github-payload.json';
jest.spyOn(GitHub.prototype as any, 'payload').mockImplementation((): Promise<Payload> => {
  return <Promise<Payload>>(payloadFixture as unknown);
});
jest.spyOn(GitHub.prototype as any, 'ref').mockImplementation((): string => {
  return 'refs/heads/master';
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
    expect(GitHub.getInstance().serverURL()).toEqual('https://github.com');
  });
  it('returns from env', async () => {
    expect(GitHub.getInstance().serverURL()).toEqual('https://foo.github.com');
  });
});

describe('gitContext', () => {
  it('returns refs/heads/master', async () => {
    expect(GitHub.getInstance().gitContext()).toEqual('https://github.com/docker/test-docker-action.git#refs/heads/master');
  });
});

describe('provenanceBuilderID', () => {
  it('returns 123', async () => {
    expect(GitHub.getInstance().provenanceBuilderID()).toEqual('https://github.com/docker/test-docker-action/actions/runs/123');
  });
});

describe('repo', () => {
  it('returns GitHub repository', async () => {
    const repo = await GitHub.getInstance().repo(process.env.GITHUB_TOKEN || '');
    expect(repo.name).toEqual('Hello-World');
  });
});

describe('fromPayload', () => {
  it('returns repository name from payload', async () => {
    const repoName = await GitHub.getInstance().fromPayload('repository.name');
    expect(repoName).toEqual('test-docker-action');
  });
});
