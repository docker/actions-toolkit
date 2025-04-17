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

import {describe, expect, it, jest, test} from '@jest/globals';
import * as semver from 'semver';

import {Exec} from '../../src/exec';
import {Regctl} from '../../src/regclient/regctl';

describe('isAvailable', () => {
  it('checks regctl is available', async () => {
    const execSpy = jest.spyOn(Exec, 'getExecOutput');
    const regctl = new Regctl();
    await regctl.isAvailable();
    // eslint-disable-next-line jest/no-standalone-expect
    expect(execSpy).toHaveBeenCalledWith(`regctl`, [], {
      silent: true,
      ignoreReturnCode: true
    });
  });
});

describe('printVersion', () => {
  it('prints regctl version', async () => {
    const execSpy = jest.spyOn(Exec, 'exec');
    const regctl = new Regctl();
    await regctl.printVersion();
    expect(execSpy).toHaveBeenCalledWith(`regctl`, ['version'], {
      failOnStdErr: false
    });
  });
});

describe('version', () => {
  it('valid', async () => {
    const regctl = new Regctl();
    expect(semver.valid(await regctl.version())).not.toBeUndefined();
  });
});

describe('versionSatisfies', () => {
  test.each([
    ['v0.8.2', '>=0.6.0', true],
    ['v0.8.0', '>0.6.0', true],
    ['v0.8.0', '<0.3.0', false]
  ])('given %p', async (version, range, expected) => {
    const regctl = new Regctl();
    expect(await regctl.versionSatisfies(range, version)).toBe(expected);
  });
});
