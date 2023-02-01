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
import {describe, expect, jest, it, beforeEach, afterEach} from '@jest/globals';

import {Context} from '../src/context';

// prettier-ignore
const tmpDir = path.join(process.env.TEMP || '/tmp', 'context-jest').split(path.sep).join(path.posix.sep);
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
