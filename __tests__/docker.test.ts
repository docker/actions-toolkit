import {describe, expect, it, jest} from '@jest/globals';
import * as exec from '@actions/exec';

import {Docker} from '../src/docker';

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
  it('standard', () => {
    const execSpy = jest.spyOn(exec, 'exec');
    Docker.printVersion(false);
    expect(execSpy).toHaveBeenCalledWith(`docker`, ['version'], {
      failOnStdErr: false
    });
  });
  it('standalone', () => {
    const execSpy = jest.spyOn(exec, 'exec');
    Docker.printVersion(true);
    expect(execSpy).not.toHaveBeenCalledWith(`docker`, ['version'], {
      failOnStdErr: false
    });
  });
});

describe('printInfo', () => {
  it('standard', () => {
    const execSpy = jest.spyOn(exec, 'exec');
    Docker.printInfo(false);
    expect(execSpy).toHaveBeenCalledWith(`docker`, ['info'], {
      failOnStdErr: false
    });
  });
  it('standalone', () => {
    const execSpy = jest.spyOn(exec, 'exec');
    Docker.printInfo(true);
    expect(execSpy).not.toHaveBeenCalledWith(`docker`, ['info'], {
      failOnStdErr: false
    });
  });
});
