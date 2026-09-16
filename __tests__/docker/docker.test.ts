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

import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import * as io from '@actions/io';
import {ExecOutput} from '@actions/exec';
import * as rimraf from 'rimraf';

import {mockHomedir} from '../.helpers/os.js';

import {Docker} from '../../src/docker/docker.js';
import {Cache} from '../../src/cache.js';

import {ConfigFile} from '../../src/types/docker/docker.js';

vi.mock('@actions/io', async () => {
  const actual = await vi.importActual<typeof import('@actions/io')>('@actions/io');
  return {
    ...actual,
    which: vi.fn()
  };
});

const fixturesDir = path.join(__dirname, '..', '.fixtures');
const tmpDir = fs.mkdtempSync(path.join(process.env.TEMP || os.tmpdir(), 'docker-docker-'));

afterEach(function () {
  rimraf.sync(tmpDir);
});

describe('configDir', () => {
  const originalEnv = process.env;
  beforeEach(() => {
    vi.resetModules();
    process.env = {
      ...originalEnv,
      DOCKER_CONFIG: '/var/docker/config'
    };
  });
  afterEach(() => {
    process.env = originalEnv;
  });
  it('returns default', async () => {
    process.env.DOCKER_CONFIG = '';
    mockHomedir(path.join('/tmp', 'home'));
    expect(Docker.configDir).toEqual(path.join('/tmp', 'home', '.docker'));
  });
  it('returns from env', async () => {
    expect(Docker.configDir).toEqual('/var/docker/config');
  });
});

describe('configFile', () => {
  const originalEnv = process.env;
  beforeEach(() => {
    vi.resetModules();
    if (!fs.existsSync(tmpDir)) {
      fs.mkdirSync(tmpDir, {recursive: true});
    }
    process.env = {
      ...originalEnv,
      DOCKER_CONFIG: tmpDir
    };
  });
  afterEach(() => {
    process.env = originalEnv;
  });
  it('auths', async () => {
    fs.copyFileSync(path.join(fixturesDir, 'docker-config-auths.json'), path.join(tmpDir, 'config.json'));
    expect(Docker.configFile()).toEqual({
      auths: {
        'https://index.docker.io/v1/': {
          auth: 'am9lam9lOmhlbGxv',
          email: 'user@example.com'
        }
      }
    } as unknown as ConfigFile);
  });
  it('proxies', async () => {
    fs.copyFileSync(path.join(fixturesDir, 'docker-config-proxies.json'), path.join(tmpDir, 'config.json'));
    expect(Docker.configFile()).toEqual({
      proxies: {
        default: {
          httpProxy: 'http://127.0.0.1:3128',
          httpsProxy: 'http://127.0.0.1:3128'
        }
      }
    } as unknown as ConfigFile);
  });
});

describe('isAvailable', () => {
  it('cli', async () => {
    const ioWhichSpy = vi.mocked(io.which).mockResolvedValue('/usr/bin/docker');
    await Docker.isAvailable();
    expect(ioWhichSpy).toHaveBeenCalledTimes(1);
    expect(ioWhichSpy).toHaveBeenCalledWith('docker', true);
  });
});

describe('exec', () => {
  it('returns docker version', async () => {
    const execSpy = vi.spyOn(Docker, 'exec');
    await Docker.exec(['version'], {
      ignoreReturnCode: true,
      silent: true
    });
    expect(execSpy).toHaveBeenCalledTimes(1);
    const callfunc = execSpy.mock.calls[0];
    expect(Object.keys(callfunc[1]?.env || {}).length).toBeGreaterThan(0);
    const env = callfunc[1]?.env;
    expect(env).toHaveProperty('DOCKER_CONTENT_TRUST');
    expect(env?.DOCKER_CONTENT_TRUST).toBe('false');
    if (callfunc[1]?.env) {
      // already checked env
      callfunc[1].env = undefined;
    }
    expect(callfunc).toEqual([
      ['version'],
      {
        ignoreReturnCode: true,
        silent: true
      }
    ]);
  });
});

describe('getExecOutput', () => {
  it('returns docker version', async () => {
    const execSpy = vi.spyOn(Docker, 'getExecOutput');
    await Docker.getExecOutput(['version'], {
      ignoreReturnCode: true,
      silent: true
    });
    expect(execSpy).toHaveBeenCalledTimes(1);
    const callfunc = execSpy.mock.calls[0];
    expect(Object.keys(callfunc[1]?.env || {}).length).toBeGreaterThan(0);
    const env = callfunc[1]?.env;
    expect(env).toHaveProperty('DOCKER_CONTENT_TRUST');
    expect(env?.DOCKER_CONTENT_TRUST).toBe('false');
    if (callfunc[1]?.env) {
      // already checked env
      callfunc[1].env = undefined;
    }
    expect(callfunc).toEqual([
      ['version'],
      {
        ignoreReturnCode: true,
        silent: true
      }
    ]);
  });
});

describe('getErrorMessage', () => {
  it.each([
    {name: 'empty output', stderr: '', expected: 'unknown error'},
    {name: 'whitespace-only output', stderr: ' \r\n\t\n', expected: 'unknown error'},
    {name: 'daemon error', stderr: 'Error response from daemon: pull access denied\n', expected: 'Error response from daemon: pull access denied'},
    {name: 'unprefixed error', stderr: 'invalid reference format\n', expected: 'invalid reference format'},
    {name: 'trailing blank lines', stderr: 'warning\n  failed to save image: permission denied  \n \t\n', expected: 'failed to save image: permission denied'},
    {name: 'CRLF output', stderr: 'warning\r\ninvalid tar header\r\n', expected: 'invalid tar header'},
    {name: 'carriage returns', stderr: 'progress\rinvalid tar header\r', expected: 'invalid tar header'},
    {name: 'terminal formatting', stderr: 'warning\n\u001b[31minvalid tar header\u001b[0m\n', expected: 'invalid tar header'},
    {name: 'formatting-only output', stderr: '\u001b[0m\n', expected: 'unknown error'},
    {name: 'no special ERROR prefix handling', stderr: 'ERROR: earlier message\ninvalid tar header\n', expected: 'invalid tar header'}
  ])('$name', ({stderr, expected}) => {
    expect(Docker.getErrorMessage(stderr)).toBe(expected);
  });
});

describe('pull', () => {
  const originalDockerConfig = process.env.DOCKER_CONFIG;

  beforeEach(() => {
    fs.mkdirSync(tmpDir, {recursive: true});
    process.env.DOCKER_CONFIG = path.join(tmpDir, 'docker-config');
  });

  afterEach(() => {
    process.env.DOCKER_CONFIG = originalDockerConfig;
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it.each([
    {endpoint: undefined, args: []},
    {endpoint: '', args: []},
    {endpoint: 'remote', args: ['--context', 'remote']},
    {endpoint: 'default', args: ['--context', 'default']},
    {endpoint: 'tcp://socket-proxy:2375', args: ['--host', 'tcp://socket-proxy:2375']},
    {endpoint: 'ssh://user@remote', args: ['--host', 'ssh://user@remote']},
    {endpoint: 'unix:///var/run/docker.sock', args: ['--host', 'unix:///var/run/docker.sock']}
  ])('uses endpoint $endpoint for cached images and retries', async ({endpoint, args}) => {
    vi.useFakeTimers();
    const originalEnv = {...process.env};
    const cachePath = path.join(tmpDir, 'image.tar');
    vi.spyOn(Cache.prototype, 'find').mockResolvedValue(cachePath);
    const saveSpy = vi.spyOn(Cache.prototype, 'save').mockResolvedValue(cachePath);
    let pulls = 0;
    const execSpy = vi.spyOn(Docker, 'getExecOutput').mockImplementation(async command => {
      if (command?.[0] === 'context') {
        return args[0] === '--context' ? execOutput(0, JSON.stringify([{Name: endpoint}]), '') : execOutput(1, '', 'context not found');
      }
      if (command?.includes('pull') && pulls++ === 0) {
        return execOutput(1, '', '503 Service Unavailable');
      }
      return execOutput(0, '', '');
    });

    const pull = Docker.pull('moby/buildkit:buildx-stable-1', true, endpoint);
    await vi.runAllTimersAsync();
    await pull;

    expect(execSpy.mock.calls.map(call => call[0])).toEqual([
      ...(endpoint ? [['context', 'inspect', '--format=json', endpoint]] : []),
      [...args, 'load', '-i', cachePath],
      [...args, 'pull', 'moby/buildkit:buildx-stable-1'],
      [...args, 'pull', 'moby/buildkit:buildx-stable-1'],
      [...args, 'save', '-o', expect.any(String), 'moby/buildkit:buildx-stable-1']
    ]);
    expect(saveSpy).toHaveBeenCalledExactlyOnceWith(execSpy.mock.calls.at(-1)?.[0]?.at(-2));
    expect(process.env).toEqual(originalEnv);
  });

  it('pulls from the endpoint without caching', async () => {
    const findSpy = vi.spyOn(Cache.prototype, 'find');
    const execSpy = vi
      .spyOn(Docker, 'getExecOutput')
      .mockResolvedValueOnce(execOutput(1, '', 'context not found'))
      .mockResolvedValue(execOutput(0, '', ''));

    await Docker.pull('moby/buildkit:buildx-stable-1', false, 'tcp://socket-proxy:2375');

    expect(execSpy.mock.calls.map(call => call[0])).toEqual([
      ['context', 'inspect', '--format=json', 'tcp://socket-proxy:2375'],
      ['--host', 'tcp://socket-proxy:2375', 'pull', 'moby/buildkit:buildx-stable-1']
    ]);
    expect(findSpy).not.toHaveBeenCalled();
  });

  it('retries transient registry errors', async () => {
    vi.useFakeTimers();
    const execSpy = vi
      .spyOn(Docker, 'getExecOutput')
      .mockResolvedValueOnce(
        execOutput(
          1,
          '',
          'Error response from daemon: Head "https://registry-1.docker.io/v2/tonistiigi/binfmt/manifests/latest": Get "https://auth.docker.io/token": net/http: request canceled while waiting for connection (Client.Timeout exceeded while awaiting headers)'
        )
      )
      .mockResolvedValueOnce(execOutput(1, '', 'Error response from daemon: Head "https://registry-1.docker.io/v2/tonistiigi/binfmt/manifests/latest": EOF'))
      .mockResolvedValueOnce(execOutput(1, '', 'Error response from daemon: received unexpected HTTP status: 503 Service Unavailable'))
      .mockResolvedValueOnce(execOutput(1, '', '\u001b[31mError response from daemon: connection reset by peer\u001b[0m\r\n \t\r\n'))
      .mockResolvedValueOnce(execOutput(0, 'latest: Pulling from tonistiigi/binfmt', ''));

    const pull = Docker.pull('tonistiigi/binfmt');
    await vi.runAllTimersAsync();
    await pull;
    expect(execSpy).toHaveBeenCalledTimes(5);
  });

  it('does not retry permanent pull errors', async () => {
    const execSpy = vi.spyOn(Docker, 'getExecOutput').mockResolvedValue(execOutput(1, '', 'Error response from daemon: pull access denied for doesnotexist'));
    await expect(Docker.pull('doesnotexist:foo')).rejects.toThrow('pull access denied for doesnotexist');
    expect(execSpy).toHaveBeenCalledTimes(1);
  });

  it('reports a clean pull error with trailing blank lines', async () => {
    const execSpy = vi.spyOn(Docker, 'getExecOutput').mockResolvedValue(execOutput(1, '', '\u001b[31mError response from daemon: pull access denied\u001b[0m\r\n \t\r\n'));
    await expect(Docker.pull('doesnotexist:foo')).rejects.toThrow(new Error('Error response from daemon: pull access denied'));
    expect(execSpy).toHaveBeenCalledTimes(1);
  });

  it('does not retry rate limit errors', async () => {
    const execSpy = vi.spyOn(Docker, 'getExecOutput').mockResolvedValue(execOutput(1, '', 'Error response from daemon: toomanyrequests: You have reached your pull rate limit'));
    await expect(Docker.pull('busybox')).rejects.toThrow('toomanyrequests');
    expect(execSpy).toHaveBeenCalledTimes(1);
  });
});

describe('context', () => {
  it('call docker context show', async () => {
    const execSpy = vi.spyOn(Docker, 'getExecOutput');
    await Docker.context().catch(() => {
      // noop
    });
    expect(execSpy).toHaveBeenCalledTimes(1);
    const callfunc = execSpy.mock.calls[0];
    if (callfunc && callfunc[1]) {
      // we don't want to check env opt
      callfunc[1].env = undefined;
    }
    expect(callfunc).toEqual([
      ['context', 'inspect', '--format', '{{.Name}}'],
      {
        ignoreReturnCode: true,
        silent: true
      }
    ]);
  });
});

describe('contextInspect', () => {
  it('call docker context inspect', async () => {
    const execSpy = vi.spyOn(Docker, 'getExecOutput');
    await Docker.contextInspect('foo').catch(() => {
      // noop
    });
    expect(execSpy).toHaveBeenCalledTimes(1);
    const callfunc = execSpy.mock.calls[0];
    if (callfunc && callfunc[1]) {
      // we don't want to check env opt
      callfunc[1].env = undefined;
    }
    expect(callfunc).toEqual([
      ['context', 'inspect', '--format=json', 'foo'],
      {
        ignoreReturnCode: true,
        silent: true
      }
    ]);
  });
});

describe('printVersion', () => {
  it('call docker version', async () => {
    const execSpy = vi.spyOn(Docker, 'exec');
    await Docker.printVersion().catch(() => {
      // noop
    });
    expect(execSpy).toHaveBeenCalledTimes(1);
    const callfunc = execSpy.mock.calls[0];
    if (callfunc && callfunc[1]) {
      // we don't want to check env opt
      callfunc[1].env = undefined;
    }
    expect(callfunc).toEqual([['version']]);
  });
});

describe('printInfo', () => {
  it('call docker info', async () => {
    const execSpy = vi.spyOn(Docker, 'exec');
    await Docker.printInfo().catch(() => {
      // noop
    });
    expect(execSpy).toHaveBeenCalledTimes(1);
    const callfunc = execSpy.mock.calls[0];
    if (callfunc && callfunc[1]) {
      // we don't want to check env opt
      callfunc[1].env = undefined;
    }
    expect(callfunc).toEqual([['info']]);
  });
});

const execOutput = (exitCode: number, stdout: string, stderr: string): ExecOutput => {
  return {
    exitCode: exitCode,
    stdout: stdout,
    stderr: stderr
  };
};
