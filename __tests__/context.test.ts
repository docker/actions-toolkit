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

import * as fs from 'fs';
import * as path from 'path';
import * as rimraf from 'rimraf';
import {describe, expect, jest, it, afterEach} from '@jest/globals';

import {Context} from '../src/context';

// prettier-ignore
const tmpDir = path.join(process.env.TEMP || '/tmp', 'context-jest');
const tmpName = path.join(tmpDir, '.tmpname-jest');

jest.spyOn(Context, 'tmpDir').mockImplementation((): string => {
  if (!fs.existsSync(tmpDir)) {
    fs.mkdirSync(tmpDir, {recursive: true});
  }
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

describe('gitContext', () => {
  it('returns refs/heads/master', async () => {
    expect(Context.gitContext()).toEqual('https://github.com/docker/actions-toolkit.git#refs/heads/master');
  });
});
