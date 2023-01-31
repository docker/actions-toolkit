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
