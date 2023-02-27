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

import fs from 'fs';
import os from 'os';
import path from 'path';
import * as core from '@actions/core';
import * as io from '@actions/io';
import * as tc from '@actions/tool-cache';
import * as util from 'util';

import * as scripts from '../scripts';
import {Context} from '../context';
import {Exec} from '../exec';
import {Util} from '../util';

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
      extractFolder = await tc.extractTar(downloadPath, path.join(Context.tmpDir(), 'docker'));
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

  public async install(toolDir: string): Promise<void> {
    switch (os.platform()) {
      case 'darwin': {
        await this.installDarwin(toolDir);
        break;
      }
      case 'linux': {
        await this.installLinux(toolDir);
        break;
      }
      case 'win32': {
        await this.installWindows(toolDir);
        break;
      }
      default: {
        throw new Error(`Unsupported platform: ${os.platform()}`);
      }
    }
  }

  private async installDarwin(toolDir: string): Promise<void> {
    if (!(await Install.colimaInstalled())) {
      await core.group('Installing colima', async () => {
        await Exec.exec('brew', ['install', 'colima']);
      });
    }
    // colima is already started on the runner so env var added in download
    // method is not expanded to the running process.
    const envs = Object.assign({}, process.env, {
      PATH: `${toolDir}:${process.env.PATH}`
    }) as {
      [key: string]: string;
    };
    await core.group('Starting colima', async () => {
      await Exec.exec('colima', ['start', '--runtime', 'docker', '--mount-type', '9p'], {env: envs});
    });
  }

  private async installLinux(toolDir: string): Promise<void> {
    core.addPath(toolDir);
    core.info('Added Docker to PATH');
  }

  private async installWindows(toolDir: string): Promise<void> {
    const dockerHost = 'npipe:////./pipe/setup_docker_action';
    const setupCmd = await Util.powershellCommand(scripts.setupDockerPowershell, {
      ToolDir: toolDir,
      TmpDir: Context.tmpDir(),
      DockerHost: dockerHost
    });
    await core.group('Install Docker daemon service', async () => {
      await Exec.exec(setupCmd.command, setupCmd.args);
    });
    await core.group('Create Docker context', async () => {
      await Exec.exec('docker', ['context', 'create', 'setup-docker-action', '--docker', `host=${dockerHost}`]);
      await Exec.exec('docker', ['context', 'use', 'setup-docker-action']);
    });
  }

  private downloadURL(version: string, channel: string): string {
    let platformOS, platformArch: string;
    switch (os.platform()) {
      case 'darwin': {
        platformOS = 'mac';
        break;
      }
      case 'linux': {
        platformOS = 'linux';
        break;
      }
      case 'win32': {
        platformOS = 'win';
        break;
      }
      default: {
        platformOS = os.platform();
        break;
      }
    }
    switch (os.arch()) {
      case 'x64': {
        platformArch = 'x86_64';
        break;
      }
      case 'ppc64': {
        platformArch = 'ppc64le';
        break;
      }
      case 'arm': {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const arm_version = (process.config.variables as any).arm_version;
        switch (arm_version) {
          case 6: {
            platformArch = 'armel';
            break;
          }
          case 7: {
            platformArch = 'armhf';
            break;
          }
          default: {
            platformArch = `v${arm_version}`;
            break;
          }
        }
        break;
      }
      default: {
        platformArch = os.arch();
        break;
      }
    }
    const ext = platformOS === 'win' ? '.zip' : '.tgz';
    return util.format('https://download.docker.com/%s/static/%s/%s/docker-%s%s', platformOS, channel, platformArch, version, ext);
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
