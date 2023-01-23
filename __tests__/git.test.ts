import {beforeEach, describe, expect, it, jest} from '@jest/globals';
import * as git from '../src/git';

beforeEach(() => {
  jest.clearAllMocks();
});

describe('git', () => {
  it('returns git remote ref', async () => {
    const ref: string = await git.getRemoteSha('https://github.com/docker/buildx.git', 'refs/pull/648/head');
    expect(ref).toEqual('f11797113e5a9b86bd976329c5dbb8a8bfdfadfa');
  }, 100000);
});
