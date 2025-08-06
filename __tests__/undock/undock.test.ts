/**
 * Copyright 2024 actions-toolkit authors
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

import fs from 'fs';
import os from 'os';
import path from 'path';
import {describe, expect, it, jest, test} from '@jest/globals';
import * as semver from 'semver';

import {Exec} from '../../src/exec';
import {Undock} from '../../src/undock/undock';

const tmpDir = fs.mkdtempSync(path.join(process.env.TEMP || os.tmpdir(), 'undock-undock-'));

describe('run', () => {
  it('extracts moby/moby-bin:26.1.5', async () => {
    const undock = new Undock();
    await expect(
      (async () => {
        // prettier-ignore
        await undock.run({
          source: 'moby/moby-bin:26.1.5',
          dist: tmpDir,
          all: true
        });
      })()
    ).resolves.not.toThrow();
  }, 500000);
});

describe('isAvailable', () => {
  it('checks undock is available', async () => {
    const execSpy = jest.spyOn(Exec, 'getExecOutput');
    const undock = new Undock();
    await undock.isAvailable();
    // eslint-disable-next-line jest/no-standalone-expect
    expect(execSpy).toHaveBeenCalledWith(`undock`, [], {
      silent: true,
      ignoreReturnCode: true
    });
  });
});

describe('printVersion', () => {
  it('prints undock version', async () => {
    const execSpy = jest.spyOn(Exec, 'exec');
    const undock = new Undock();
    await undock.printVersion();
    expect(execSpy).toHaveBeenCalledWith(`undock`, ['--version'], {
      failOnStdErr: false
    });
  });
});

describe('version', () => {
  it('valid', async () => {
    const undock = new Undock();
    expect(semver.valid(await undock.version())).not.toBeUndefined();
  });
});

describe('versionSatisfies', () => {
  test.each([
    ['v0.4.1', '>=0.3.2', true],
    ['v0.8.0', '>0.6.0', true],
    ['v0.8.0', '<0.3.0', false]
  ])('given %p', async (version, range, expected) => {
    const undock = new Undock();
    expect(await undock.versionSatisfies(range, version)).toBe(expected);
  });
});
