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
import * as exec from '@actions/exec';

import {Docker} from '../src/docker';

beforeEach(() => {
  jest.clearAllMocks();
});

describe('isAvailable', () => {
  it('cli', () => {
    const execSpy = jest.spyOn(exec, 'getExecOutput');
    Docker.isAvailable();
    // eslint-disable-next-line jest/no-standalone-expect
    expect(execSpy).toHaveBeenCalledWith(`docker`, undefined, {
      silent: true,
      ignoreReturnCode: true
    });
  });
});

describe('printVersion', () => {
  it('docker cli', () => {
    const execSpy = jest.spyOn(exec, 'exec');
    Docker.printVersion(false).catch(() => {
      // noop
    });
    expect(execSpy).toHaveBeenCalledWith(`docker`, ['version'], {
      failOnStdErr: false
    });
  });
  it('standalone', () => {
    const execSpy = jest.spyOn(exec, 'exec');
    Docker.printVersion(true).catch(() => {
      // noop
    });
    expect(execSpy).not.toHaveBeenCalledWith(`docker`, ['version'], {
      failOnStdErr: false
    });
  });
});

describe('printInfo', () => {
  it('docker cli', () => {
    const execSpy = jest.spyOn(exec, 'exec');
    Docker.printInfo(false).catch(() => {
      // noop
    });
    expect(execSpy).toHaveBeenCalledWith(`docker`, ['info'], {
      failOnStdErr: false
    });
  });
  it('standalone', () => {
    const execSpy = jest.spyOn(exec, 'exec');
    Docker.printInfo(true).catch(() => {
      // noop
    });
    expect(execSpy).not.toHaveBeenCalledWith(`docker`, ['info'], {
      failOnStdErr: false
    });
  });
});
