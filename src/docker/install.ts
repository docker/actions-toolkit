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

import * as child_process from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import retry from 'async-retry';
import * as handlebars from 'handlebars';
import * as util from 'util';
import * as core from '@actions/core';
import * as io from '@actions/io';
import * as tc from '@actions/tool-cache';

import {Exec} from '../exec';
import {Util} from '../util';
import {colimaYamlData, dockerServiceLogsPs1, setupDockerLinuxSh, setupDockerWinPs1} from './assets';

export class Install {
  public async download(version: string, channel?: string): Promise<string> {
    channel = channel || 'stable';
    const downloadURL = this.downloadURL(version, channel);

    core.info(`Downloading ${downloadURL}`);
    const downloadPath = await tc.downloadTool(downloadURL);
    core.debug(`docker.Install.download downloadPath: ${downloadPath}`);

    let extractFolder: string;
    if (os.platform() == 'win32') {
      extractFolder = await tc.extractZip(downloadPath);
    } else {
      extractFolder = await tc.extractTar(downloadPath);
    }
    if (Util.isDirectory(path.join(extractFolder, 'docker'))) {
      extractFolder = path.join(extractFolder, 'docker');
    }
    core.debug(`docker.Install.download extractFolder: ${extractFolder}`);

    core.info('Fixing perms');
    fs.readdir(path.join(extractFolder), function (err, files) {
      if (err) {
        throw err;
      }
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      files.forEach(function (file, index) {
        fs.chmodSync(path.join(extractFolder, file), '0755');
      });
    });

    const tooldir = await tc.cacheDir(extractFolder, `docker-${channel}`, version.replace(/(0+)([1-9]+)/, '$2'));
    core.addPath(tooldir);
    core.info('Added Docker to PATH');
    return tooldir;
  }

  public async install(toolDir: string, runDir: string, version: string, channel?: string): Promise<void> {
    if (toolDir.length == 0) {
      throw new Error('toolDir must be set');
    }
    if (runDir.length == 0) {
      throw new Error('runDir must be set');
    }
    channel = channel || 'stable';
    switch (os.platform()) {
      case 'darwin': {
        await this.installDarwin(toolDir, version, channel);
        break;
      }
      case 'linux': {
        await this.installLinux(toolDir, runDir);
        break;
      }
      case 'win32': {
        await this.installWindows(toolDir, runDir);
        break;
      }
      default: {
        throw new Error(`Unsupported platform: ${os.platform()}`);
      }
    }
  }

  private async installDarwin(toolDir: string, version: string, channel?: string): Promise<void> {
    const colimaDir = path.join(os.homedir(), '.colima', 'default'); // TODO: create a custom colima profile to avoid overlap with other actions
    await io.mkdirP(colimaDir);
    const dockerHost = `unix://${colimaDir}/docker.sock`;

    if (!(await Install.colimaInstalled())) {
      await core.group('Installing colima', async () => {
        await Exec.exec('brew', ['install', 'colima']);
      });
    }

    await core.group('Creating colima config', async () => {
      const colimaCfg = handlebars.compile(colimaYamlData)({
        hostArch: Install.platformArch(),
        dockerVersion: version,
        dockerChannel: channel
      });
      core.info(`Writing colima config to ${path.join(colimaDir, 'colima.yaml')}`);
      fs.writeFileSync(path.join(colimaDir, 'colima.yaml'), colimaCfg);
      core.info(colimaCfg);
    });

    // colima is already started on the runner so env var added in download
    // method is not expanded to the running process.
    const envs = Object.assign({}, process.env, {
      PATH: `${toolDir}:${process.env.PATH}`
    }) as {
      [key: string]: string;
    };
    await core.group('Starting colima', async () => {
      await Exec.exec('colima', ['start', '--very-verbose'], {env: envs});
    });

    await core.group('Create Docker context', async () => {
      await Exec.exec('docker', ['context', 'create', 'setup-docker-action', '--docker', `host=${dockerHost}`]);
      await Exec.exec('docker', ['context', 'use', 'setup-docker-action']);
    });
  }

  private async installLinux(toolDir: string, runDir: string): Promise<void> {
    const dockerHost = `unix://${path.join(runDir, 'docker.sock')}`;
    await io.mkdirP(runDir);

    await core.group('Start Docker daemon', async () => {
      const bashPath: string = await io.which('bash', true);
      const proc = await child_process.spawn(`sudo -E ${bashPath} ${setupDockerLinuxSh()}`, [], {
        detached: true,
        shell: true,
        stdio: ['ignore', process.stdout, process.stderr],
        env: Object.assign({}, process.env, {
          TOOLDIR: toolDir,
          RUNDIR: runDir,
          DOCKER_HOST: dockerHost
        }) as {
          [key: string]: string;
        }
      });
      proc.unref();
      await retry(
        async bail => {
          await Exec.getExecOutput(`docker version`, undefined, {
            ignoreReturnCode: true,
            silent: true,
            env: Object.assign({}, process.env, {
              DOCKER_HOST: dockerHost
            }) as {
              [key: string]: string;
            }
          })
            .then(res => {
              if (res.stderr.length > 0 && res.exitCode != 0) {
                bail(new Error(res.stderr));
                return false;
              }
              return res.exitCode == 0;
            })
            .catch(error => {
              bail(error);
              return false;
            });
        },
        {
          retries: 5
        }
      );
      core.info(`Docker daemon started started successfully`);
    });

    await core.group('Create Docker context', async () => {
      await Exec.exec('docker', ['context', 'create', 'setup-docker-action', '--docker', `host=${dockerHost}`]);
      await Exec.exec('docker', ['context', 'use', 'setup-docker-action']);
    });
  }

  private async installWindows(toolDir: string, runDir: string): Promise<void> {
    const dockerHost = 'npipe:////./pipe/setup_docker_action';

    await core.group('Install Docker daemon service', async () => {
      const setupCmd = await Util.powershellCommand(setupDockerWinPs1(), {
        ToolDir: toolDir,
        RunDir: runDir,
        DockerHost: dockerHost
      });
      await Exec.exec(setupCmd.command, setupCmd.args);
      const logCmd = await Util.powershellCommand(dockerServiceLogsPs1());
      await Exec.exec(logCmd.command, logCmd.args);
    });

    await core.group('Create Docker context', async () => {
      await Exec.exec('docker', ['context', 'create', 'setup-docker-action', '--docker', `host=${dockerHost}`]);
      await Exec.exec('docker', ['context', 'use', 'setup-docker-action']);
    });
  }

  public async tearDown(runDir: string): Promise<void> {
    switch (os.platform()) {
      case 'darwin': {
        await this.tearDownDarwin(runDir);
        break;
      }
      case 'linux': {
        await this.tearDownLinux(runDir);
        break;
      }
      case 'win32': {
        await this.tearDownWindows();
        break;
      }
      default: {
        throw new Error(`Unsupported platform: ${os.platform()}`);
      }
    }
  }

  private async tearDownDarwin(runDir: string): Promise<void> {
    await core.group('Docker daemon logs', async () => {
      await Exec.exec('colima', ['exec', '--', 'cat', '/var/log/docker.log']);
    });
    await core.group('Stopping colima', async () => {
      await Exec.exec('colima', ['stop', '--very-verbose']);
    });
    await core.group('Removing Docker context', async () => {
      await Exec.exec('docker', ['context', 'rm', '-f', 'setup-docker-action']);
    });
    await core.group(`Cleaning up runDir`, async () => {
      await Exec.exec('sudo', ['rm', '-rf', runDir]);
    });
  }

  private async tearDownLinux(runDir: string): Promise<void> {
    await core.group('Docker daemon logs', async () => {
      core.info(fs.readFileSync(path.join(runDir, 'dockerd.log'), {encoding: 'utf8'}));
    });
    await core.group('Stopping Docker daemon', async () => {
      await Exec.exec('sudo', ['kill', fs.readFileSync(path.join(runDir, 'docker.pid')).toString().trim()]);
    });
    await core.group('Removing Docker context', async () => {
      await Exec.exec('docker', ['context', 'rm', '-f', 'setup-docker-action']);
    });
    await core.group(`Cleaning up runDir`, async () => {
      await Exec.exec('sudo', ['rm', '-rf', runDir]);
    });
  }

  private async tearDownWindows(): Promise<void> {
    await core.group('Docker daemon logs', async () => {
      const logCmd = await Util.powershellCommand(dockerServiceLogsPs1());
      await Exec.exec(logCmd.command, logCmd.args);
    });
    await core.group('Removing Docker context', async () => {
      await Exec.exec('docker', ['context', 'rm', '-f', 'setup-docker-action']);
    });
  }

  private downloadURL(version: string, channel: string): string {
    const platformOS = Install.platformOS();
    const platformArch = Install.platformArch();
    const ext = platformOS === 'win' ? '.zip' : '.tgz';
    return util.format('https://download.docker.com/%s/static/%s/%s/docker-%s%s', platformOS, channel, platformArch, version, ext);
  }

  private static platformOS(): string {
    switch (os.platform()) {
      case 'darwin': {
        return 'mac';
      }
      case 'linux': {
        return 'linux';
      }
      case 'win32': {
        return 'win';
      }
      default: {
        return os.platform();
      }
    }
  }

  private static platformArch(): string {
    switch (os.arch()) {
      case 'x64': {
        return 'x86_64';
      }
      case 'ppc64': {
        return 'ppc64le';
      }
      case 'arm': {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const arm_version = (process.config.variables as any).arm_version;
        switch (arm_version) {
          case 6: {
            return 'armel';
          }
          case 7: {
            return 'armhf';
          }
          default: {
            return `v${arm_version}`;
          }
        }
      }
      default: {
        return os.arch();
      }
    }
  }

  private static async colimaInstalled(): Promise<boolean> {
    return await io
      .which('colima', true)
      .then(res => {
        core.debug(`docker.Install.colimaAvailable ok: ${res}`);
        return true;
      })
      .catch(error => {
        core.debug(`docker.Install.colimaAvailable error: ${error}`);
        return false;
      });
  }
}
