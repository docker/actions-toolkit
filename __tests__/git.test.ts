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

import {Git} from '../src/git';
import {Exec} from '../src/exec';
import {ExecOutput} from '@actions/exec';

beforeEach(() => {
  jest.clearAllMocks();
  jest.restoreAllMocks();
});

describe('context', () => {
  it('returns mocked ref and sha', async () => {
    jest.spyOn(Exec, 'getExecOutput').mockImplementation((cmd, args): Promise<ExecOutput> => {
      const fullCmd = `${cmd} ${args?.join(' ')}`;
      let result = '';
      switch (fullCmd) {
        case 'git show --format=%H HEAD --quiet --':
          result = 'test-sha';
          break;
        case 'git branch --show-current':
          result = 'test';
          break;
        case 'git symbolic-ref HEAD':
          result = 'refs/heads/test';
          break;
      }
      return Promise.resolve({
        stdout: result,
        stderr: '',
        exitCode: 0
      });
    });
    const ctx = await Git.context();
    expect(ctx.ref).toEqual('refs/heads/test');
    expect(ctx.sha).toEqual('test-sha');
  });
});

describe('isInsideWorkTree', () => {
  it('have been called', async () => {
    const execSpy = jest.spyOn(Exec, 'getExecOutput');
    try {
      await Git.isInsideWorkTree();
    } catch (err) {
      // noop
    }
    expect(execSpy).toHaveBeenCalledWith(`git`, ['rev-parse', '--is-inside-work-tree'], {
      silent: true,
      ignoreReturnCode: true
    });
  });
});

describe('remoteSha', () => {
  it('returns sha using git ls-remote', async () => {
    expect(await Git.remoteSha('https://github.com/docker/buildx.git', 'refs/pull/648/head')).toEqual('f11797113e5a9b86bd976329c5dbb8a8bfdfadfa');
  });
  it('returns sha using github api', async () => {
    expect(await Git.remoteSha('https://github.com/docker/buildx.git', 'refs/pull/648/head', process.env.GITHUB_TOKEN)).toEqual('f11797113e5a9b86bd976329c5dbb8a8bfdfadfa');
  });
});

describe('remoteURL', () => {
  it('have been called', async () => {
    const execSpy = jest.spyOn(Exec, 'getExecOutput');
    try {
      await Git.remoteURL();
    } catch (err) {
      // noop
    }
    expect(execSpy).toHaveBeenCalledWith(`git`, ['remote', 'get-url', 'origin'], {
      silent: true,
      ignoreReturnCode: true
    });
  });
});

describe('ref', () => {
  it('returns mocked ref', async () => {
    jest.spyOn(Exec, 'getExecOutput').mockImplementation((cmd, args): Promise<ExecOutput> => {
      const fullCmd = `${cmd} ${args?.join(' ')}`;
      let result = '';
      switch (fullCmd) {
        case 'git branch --show-current':
          result = 'test';
          break;
        case 'git symbolic-ref HEAD':
          result = 'refs/heads/test';
          break;
      }
      return Promise.resolve({
        stdout: result,
        stderr: '',
        exitCode: 0
      });
    });

    const ref = await Git.ref();

    expect(ref).toEqual('refs/heads/test');
  });

  it('returns mocked detached tag ref', async () => {
    jest.spyOn(Exec, 'getExecOutput').mockImplementation((cmd, args): Promise<ExecOutput> => {
      const fullCmd = `${cmd} ${args?.join(' ')}`;
      let result = '';
      switch (fullCmd) {
        case 'git branch --show-current':
          result = '';
          break;
        case 'git show -s --pretty=%D':
          result = 'HEAD, tag: 8.0.0';
          break;
      }
      return Promise.resolve({
        stdout: result,
        stderr: '',
        exitCode: 0
      });
    });

    const ref = await Git.ref();

    expect(ref).toEqual('refs/tags/8.0.0');
  });

  it('returns mocked detached tag ref (shallow clone)', async () => {
    jest.spyOn(Exec, 'getExecOutput').mockImplementation((cmd, args): Promise<ExecOutput> => {
      const fullCmd = `${cmd} ${args?.join(' ')}`;
      let result = '';
      switch (fullCmd) {
        case 'git branch --show-current':
          result = '';
          break;
        case 'git show -s --pretty=%D':
          result = 'grafted, HEAD, tag: 8.0.0';
          break;
      }
      return Promise.resolve({
        stdout: result,
        stderr: '',
        exitCode: 0
      });
    });

    const ref = await Git.ref();

    expect(ref).toEqual('refs/tags/8.0.0');
  });

  it('returns mocked detached pull request merge ref (shallow clone)', async () => {
    jest.spyOn(Exec, 'getExecOutput').mockImplementation((cmd, args): Promise<ExecOutput> => {
      const fullCmd = `${cmd} ${args?.join(' ')}`;
      let result = '';
      switch (fullCmd) {
        case 'git branch --show-current':
          result = '';
          break;
        case 'git show -s --pretty=%D':
          result = 'grafted, HEAD, pull/221/merge';
          break;
      }
      return Promise.resolve({
        stdout: result,
        stderr: '',
        exitCode: 0
      });
    });

    const ref = await Git.ref();

    expect(ref).toEqual('refs/pull/221/merge');
  });

  it('should throws an error when detached HEAD ref is not supported', async () => {
    jest.spyOn(Exec, 'getExecOutput').mockImplementation((cmd, args): Promise<ExecOutput> => {
      const fullCmd = `${cmd} ${args?.join(' ')}`;
      let result = '';
      switch (fullCmd) {
        case 'git branch --show-current':
          result = '';
          break;
        case 'git show -s --pretty=%D':
          result = 'wrong, HEAD, tag: 8.0.0';
          break;
      }
      return Promise.resolve({
        stdout: result,
        stderr: '',
        exitCode: 0
      });
    });

    await expect(Git.ref()).rejects.toThrow('Cannot find detached HEAD ref in "wrong, HEAD, tag: 8.0.0"');
  });

  it('returns mocked detached branch ref', async () => {
    jest.spyOn(Exec, 'getExecOutput').mockImplementation((cmd, args): Promise<ExecOutput> => {
      const fullCmd = `${cmd} ${args?.join(' ')}`;
      let result = '';
      switch (fullCmd) {
        case 'git branch --show-current':
          result = '';
          break;
        case 'git show -s --pretty=%D':
          result = 'HEAD, origin/test, test';
          break;
      }
      return Promise.resolve({
        stdout: result,
        stderr: '',
        exitCode: 0
      });
    });

    const ref = await Git.ref();

    expect(ref).toEqual('refs/heads/test');
  });
});

describe('fullCommit', () => {
  it('have been called', async () => {
    const execSpy = jest.spyOn(Exec, 'getExecOutput');
    try {
      await Git.fullCommit();
    } catch (err) {
      // noop
    }
    expect(execSpy).toHaveBeenCalledWith(`git`, ['show', '--format=%H', 'HEAD', '--quiet', '--'], {
      silent: true,
      ignoreReturnCode: true
    });
  });
});

describe('shortCommit', () => {
  it('have been called', async () => {
    const execSpy = jest.spyOn(Exec, 'getExecOutput');
    try {
      await Git.shortCommit();
    } catch (err) {
      // noop
    }
    expect(execSpy).toHaveBeenCalledWith(`git`, ['show', '--format=%h', 'HEAD', '--quiet', '--'], {
      silent: true,
      ignoreReturnCode: true
    });
  });
});

describe('tag', () => {
  it('have been called', async () => {
    const execSpy = jest.spyOn(Exec, 'getExecOutput');
    try {
      await Git.tag();
    } catch (err) {
      // noop
    }
    expect(execSpy).toHaveBeenCalledWith(`git`, ['tag', '--points-at', 'HEAD', '--sort', '-version:creatordate'], {
      silent: true,
      ignoreReturnCode: true
    });
  });
});
