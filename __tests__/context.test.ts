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

import {describe, expect, it, afterEach} from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import * as rimraf from 'rimraf';

import {Context} from '../src/context.js';

const tmpDir = fs.mkdtempSync(path.join(process.env.TEMP || os.tmpdir(), 'context-'));

afterEach(() => {
  rimraf.sync(tmpDir);
  fs.mkdirSync(tmpDir, {recursive: true});
});

describe('tmpDir', () => {
  it('returns an existing directory and keeps it stable', () => {
    const dir = Context.tmpDir();
    expect(fs.existsSync(dir)).toBe(true);
    expect(fs.statSync(dir).isDirectory()).toBe(true);
    expect(Context.tmpDir()).toEqual(dir);
  });
});

describe('tmpName', () => {
  it('returns a path for the provided tmpdir and template', () => {
    const name = Context.tmpName({
      tmpdir: tmpDir,
      template: '.tmpname-XXXXXX'
    });
    expect(path.dirname(name)).toEqual(tmpDir);
    expect(path.basename(name)).toMatch(/^\.tmpname-/);
    expect(fs.existsSync(name)).toBe(false);
  });

  it('returns different paths on consecutive calls', () => {
    const first = Context.tmpName({tmpdir: tmpDir, template: '.tmpname-XXXXXX'});
    const second = Context.tmpName({tmpdir: tmpDir, template: '.tmpname-XXXXXX'});
    expect(first).not.toEqual(second);
  });
});
