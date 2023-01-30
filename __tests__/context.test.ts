import fs from 'fs';
import path from 'path';
import rimraf from 'rimraf';
import {describe, expect, jest, it, beforeEach, afterEach} from '@jest/globals';

import {Context} from '../src/context';

const tmpDir = path.join('/tmp/.docker-actions-toolkit-jest').split(path.sep).join(path.posix.sep);
const tmpName = path.join(tmpDir, '.tmpname-jest').split(path.sep).join(path.posix.sep);

jest.spyOn(Context.prototype, 'tmpDir').mockImplementation((): string => {
  if (!fs.existsSync(tmpDir)) {
    fs.mkdirSync(tmpDir, {recursive: true});
  }
  return tmpDir;
});
jest.spyOn(Context.prototype, 'tmpName').mockImplementation((): string => {
  return tmpName;
});

beforeEach(() => {
  jest.clearAllMocks();
});

afterEach(() => {
  rimraf.sync(tmpDir);
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
