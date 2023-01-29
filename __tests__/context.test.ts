import fs from 'fs';
import path from 'path';
import rimraf from 'rimraf';
import {describe, expect, jest, it, beforeEach, afterEach} from '@jest/globals';

import {Context, ReposGetResponseData} from '../src/context';

const tmpDir = path.join('/tmp/.docker-actions-toolkit-jest').split(path.sep).join(path.posix.sep);
const tmpName = path.join(tmpDir, '.tmpname-jest').split(path.sep).join(path.posix.sep);

beforeEach(() => {
  jest.clearAllMocks();
});

jest.spyOn(Context.prototype as any, 'tmpDir').mockImplementation((): string => {
  if (!fs.existsSync(tmpDir)) {
    fs.mkdirSync(tmpDir, {recursive: true});
  }
  return tmpDir;
});
jest.spyOn(Context.prototype as any, 'tmpName').mockImplementation((): string => {
  return tmpName;
});

beforeEach(() => {
  jest.clearAllMocks();
});

afterEach(() => {
  rimraf.sync(tmpDir);
});

import * as repoFixture from './fixtures/repo.json';
jest.spyOn(Context.prototype as any, 'repoData').mockImplementation((): Promise<ReposGetResponseData> => {
  return <Promise<ReposGetResponseData>>(repoFixture as unknown);
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
    const context = new Context();
    expect(context.serverURL).toEqual('https://github.com');
  });
  it('returns from env', async () => {
    const context = new Context();
    expect(context.serverURL).toEqual('https://foo.github.com');
  });
});

describe('gitContext', () => {
  it('returns refs/heads/master', async () => {
    const context = new Context();
    expect(context.buildGitContext).toEqual('https://github.com/docker/actions-toolkit.git#refs/heads/master');
  });
});

describe('provenanceBuilderID', () => {
  it('returns 123', async () => {
    const context = new Context();
    expect(context.provenanceBuilderID).toEqual('https://github.com/docker/actions-toolkit/actions/runs/123');
  });
});

describe('repo', () => {
  it('returns GitHub repository', async () => {
    const context = new Context();
    expect((await context.repoData()).name).toEqual('Hello-World');
  });
});

describe('fromPayload', () => {
  it('returns repository name from payload', async () => {
    const context = new Context();
    expect(await context.fromPayload('repository.name')).toEqual('test-docker-action');
  });
});
