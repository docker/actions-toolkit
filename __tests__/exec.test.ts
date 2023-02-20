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

import {Exec} from '../src/exec';

beforeEach(() => {
  jest.clearAllMocks();
});

describe('exec', () => {
  it('returns docker version', async () => {
    const execSpy = jest.spyOn(Exec, 'exec');
    await Exec.exec('docker', ['version'], {
      ignoreReturnCode: true,
      silent: true
    });
    expect(execSpy).toHaveBeenCalledWith(`docker`, ['version'], {
      ignoreReturnCode: true,
      silent: true
    });
  });
});

describe('getExecOutput', () => {
  it('returns docker version', async () => {
    const execSpy = jest.spyOn(Exec, 'getExecOutput');
    await Exec.getExecOutput('docker', ['version'], {
      ignoreReturnCode: true,
      silent: true
    });
    expect(execSpy).toHaveBeenCalledWith(`docker`, ['version'], {
      ignoreReturnCode: true,
      silent: true
    });
  });
});
