/**
 * Copyright 2025 actions-toolkit authors
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

import {describe, expect, it, vi, test, afterEach} from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import * as rimraf from 'rimraf';
import * as semver from 'semver';

import {Context} from '../../src/context';
import {Exec} from '../../src/exec';

import {Compose} from '../../src/compose/compose';

const tmpDir = fs.mkdtempSync(path.join(process.env.TEMP || os.tmpdir(), 'compose-compose-'));
const tmpName = path.join(tmpDir, '.tmpname-vi');

vi.spyOn(Context, 'tmpDir').mockImplementation((): string => {
  fs.mkdirSync(tmpDir, {recursive: true});
  return tmpDir;
});

vi.spyOn(Context, 'tmpName').mockImplementation((): string => {
  return tmpName;
});

afterEach(() => {
  rimraf.sync(tmpDir);
});

describe('isAvailable', () => {
  it('docker cli', async () => {
    const execSpy = vi.spyOn(Exec, 'getExecOutput');
    const compose = new Compose({
      standalone: false
    });
    await compose.isAvailable();
    expect(execSpy).toHaveBeenCalledWith(`docker`, ['compose'], {
      silent: true,
      ignoreReturnCode: true
    });
  });
  it('standalone', async () => {
    const execSpy = vi.spyOn(Exec, 'getExecOutput');
    const compose = new Compose({
      standalone: true
    });
    await compose.isAvailable();
    expect(execSpy).toHaveBeenCalledWith(`compose`, [], {
      silent: true,
      ignoreReturnCode: true
    });
  });
});

describe('printVersion', () => {
  it('docker cli', async () => {
    const execSpy = vi.spyOn(Exec, 'exec');
    const compose = new Compose({
      standalone: false
    });
    await compose.printVersion();
    expect(execSpy).toHaveBeenCalledWith(`docker`, ['compose', 'version'], {
      failOnStdErr: false
    });
  });
  it('standalone', async () => {
    const execSpy = vi.spyOn(Exec, 'exec');
    const compose = new Compose({
      standalone: true
    });
    await compose.printVersion();
    expect(execSpy).toHaveBeenCalledWith(`compose`, ['version'], {
      failOnStdErr: false
    });
  });
});

describe('version', () => {
  it('valid', async () => {
    const compose = new Compose();
    expect(semver.valid(await compose.version())).not.toBeUndefined();
  });
});

describe('parseVersion', () => {
  // prettier-ignore
  test.each([
    ['Docker Compose version v2.31.0', '2.31.0'],
  ])('given %p', async (stdout, expected) => {
    expect(Compose.parseVersion(stdout)).toEqual(expected);
  });
});
