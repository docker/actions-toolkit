import {describe, expect, jest, it, beforeEach} from '@jest/globals';
import {Context} from '@actions/github/lib/context';

import {GitHub, Payload, ReposGetResponseData} from '../src/github';

beforeEach(() => {
  jest.clearAllMocks();
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

describe('gitContext', () => {
  it('returns refs/heads/master', async () => {
    expect(GitHub.getInstance().gitContext()).toEqual('https://github.com/docker/test-docker-action.git#refs/heads/master');
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
