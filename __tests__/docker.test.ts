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
