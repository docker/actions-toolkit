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
