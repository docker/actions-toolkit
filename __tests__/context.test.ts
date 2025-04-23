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

import {describe, expect, jest, it, afterEach, beforeEach, test} from '@jest/globals';
import fs from 'fs';
import os from 'os';
import path from 'path';
import * as rimraf from 'rimraf';

import {Context} from '../src/context';

const tmpDir = fs.mkdtempSync(path.join(process.env.TEMP || os.tmpdir(), 'context-'));
const tmpName = path.join(tmpDir, '.tmpname-jest');

jest.spyOn(Context, 'tmpDir').mockImplementation((): string => {
  fs.mkdirSync(tmpDir, {recursive: true});
  return tmpDir;
});

jest.spyOn(Context, 'tmpName').mockImplementation((): string => {
  return tmpName;
});

afterEach(() => {
  rimraf.sync(tmpDir);
});

describe('gitRef', () => {
  it('returns refs/heads/master', async () => {
    expect(Context.gitRef()).toEqual('refs/heads/master');
  });
});

describe('parseGitRef', () => {
  const originalEnv = process.env;
  beforeEach(() => {
    jest.resetModules();
    process.env = {
      ...originalEnv,
      DOCKER_GIT_CONTEXT_PR_HEAD_REF: ''
    };
  });
  afterEach(() => {
    process.env = originalEnv;
  });
  // prettier-ignore
  test.each([
    ['refs/heads/master', false, 'refs/heads/master'],
    ['master', false, 'master'],
    ['refs/pull/15/merge', false, 'refs/pull/15/merge'],
    ['refs/tags/v1.0.0', false, 'refs/tags/v1.0.0'],
    ['refs/pull/15/merge', true, 'refs/pull/15/head'],
    ['', false, '860c1904a1ce19322e91ac35af1ab07466440c37'],
  ])('given %p and %p, should return %p', async (ref: string, prHeadRef: boolean, expected: string) => {
    process.env.DOCKER_DEFAULT_GIT_CONTEXT_PR_HEAD_REF = prHeadRef ? 'true' : '';
    expect(Context.parseGitRef(ref, '860c1904a1ce19322e91ac35af1ab07466440c37')).toEqual(expected);
  });
});

describe('gitContext', () => {
  it('returns refs/heads/master', async () => {
    expect(Context.gitContext()).toEqual('https://github.com/docker/actions-toolkit.git#refs/heads/master');
  });
});
