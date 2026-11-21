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

import {afterEach, describe, expect, test, vi} from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import * as child_process from 'child_process';

import {mockPlatform} from '../.helpers/os.js';
import {Install} from '../../src/docker/install.js';
import {Docker} from '../../src/docker/docker.js';
import {Exec} from '../../src/exec.js';
import {Util} from '../../src/util.js';

vi.mock('child_process', async importOriginal => {
  const actual = await importOriginal<typeof child_process>();
  return {...actual, spawn: vi.fn(() => ({unref: vi.fn()}))};
});

describe('Linux daemon configuration', () => {
  const directories: string[] = [];

  afterEach(() => {
    vi.restoreAllMocks();
    for (const directory of directories.splice(0)) {
      fs.rmSync(directory, {recursive: true, force: true});
    }
  });

  test.each([false, true])('isolates runtime paths with rootless=%s', async rootless => {
    mockPlatform('linux');
    const runDir = fs.mkdtempSync(path.join(os.tmpdir(), 'docker-config-'));
    directories.push(runDir);
    const hostConfig = {
      hosts: ['unix:///var/run/docker.sock'],
      'data-root': '/data/docker',
      'exec-root': '/run/docker',
      pidfile: '/run/docker.pid',
      'registry-mirrors': ['https://registry.example.com'],
      debug: false
    };
    const existsSync = fs.existsSync.bind(fs);
    const readFileSync = fs.readFileSync.bind(fs);
    vi.spyOn(fs, 'existsSync').mockImplementation(file => file === '/etc/docker/daemon.json' || existsSync(file));
    vi.spyOn(fs, 'readFileSync').mockImplementation((...args) => {
      if (args[0] === '/etc/docker/daemon.json') {
        return JSON.stringify(hostConfig);
      }
      return readFileSync(...args);
    });
    vi.spyOn(Util, 'sleep').mockResolvedValue(undefined);
    vi.spyOn(Exec, 'getExecOutput').mockResolvedValue({exitCode: 0, stdout: '', stderr: ''});
    vi.spyOn(Docker, 'exec').mockResolvedValue(0);

    const install = new Install({runDir, rootless, daemonConfig: JSON.stringify({debug: true})});
    expect(await install.install()).toBe(`unix://${path.join(runDir, 'docker.sock')}`);
    expect(JSON.parse(fs.readFileSync(path.join(runDir, 'daemon.json'), 'utf8'))).toEqual({
      'registry-mirrors': ['https://registry.example.com'],
      debug: true
    });
    const command = vi.mocked(child_process.spawn).mock.calls[0][0];
    expect(command).toContain(`--data-root="${runDir}/data"`);
  });
});
