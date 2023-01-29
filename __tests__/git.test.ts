import {beforeEach, describe, expect, it, jest} from '@jest/globals';

import {Git} from '../src/git';

beforeEach(() => {
  jest.clearAllMocks();
});

describe('git', () => {
  it('returns git remote ref', async () => {
    try {
      expect(await Git.getRemoteSha('https://github.com/docker/buildx.git', 'refs/pull/648/head')).toEqual('f11797113e5a9b86bd976329c5dbb8a8bfdfadfa');
    } catch (e) {
      // eslint-disable-next-line jest/no-conditional-expect
      expect(e).toEqual(null);
    }
  });
});
