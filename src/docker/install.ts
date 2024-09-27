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
import fsp from 'fs/promises';
import os from 'os';
import path from 'path';
import retry from 'async-retry';
import * as handlebars from 'handlebars';
import * as semver from 'semver';
import * as util from 'util';
import * as core from '@actions/core';
import * as httpm from '@actions/http-client';
import * as io from '@actions/io';
import * as tc from '@actions/tool-cache';

import {Context} from '../context';
import {Docker} from './docker';
import {Exec} from '../exec';
import {Util} from '../util';
import {limaYamlData, dockerServiceLogsPs1, setupDockerWinPs1} from './assets';
import {GitHubRelease} from '../types/github';

export interface InstallOpts {
  version?: string;
  channel?: string;
  runDir: string;
  contextName?: string;
  daemonConfig?: string;
}

interface LimaImage {
  location: string;
  arch: string;
  digest?: string;
}

export class Install {
  private readonly runDir: string;
  private readonly version: string;
  private readonly channel: string;
  private readonly contextName: string;
  private readonly daemonConfig?: string;
  private _version: string | undefined;
  private _toolDir: string | undefined;

  private readonly limaInstanceName = 'docker-actions-toolkit';

  constructor(opts: InstallOpts) {
    this.runDir = opts.runDir;
    this.version = opts.version || 'latest';
    this.channel = opts.channel || 'stable';
    this.contextName = opts.contextName || 'setup-docker-action';
    this.daemonConfig = opts.daemonConfig;
  }

  get toolDir(): string {
    return this._toolDir || Context.tmpDir();
  }

  public async download(): Promise<string> {
    const release: GitHubRelease = await Install.getRelease(this.version);
    this._version = release.tag_name.replace(/^v+|v+$/g, '');
    core.debug(`docker.Install.download version: ${this._version}`);

    const downloadURL = this.downloadURL(this._version, this.channel);
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

    const tooldir = await tc.cacheDir(extractFolder, `docker-${this.channel}`, this._version.replace(/(0+)([1-9]+)/, '$2'));
    core.addPath(tooldir);
    core.info('Added Docker to PATH');

    this._toolDir = tooldir;
    return tooldir;
  }

  public async install(): Promise<string> {
    if (!this.toolDir) {
      throw new Error('toolDir must be set. Run download first.');
    }
    if (!this.runDir) {
      throw new Error('runDir must be set');
    }
    switch (os.platform()) {
      case 'darwin': {
        return await this.installDarwin();
      }
      case 'linux': {
        return await this.installLinux();
      }
      case 'win32': {
        return await this.installWindows();
      }
      default: {
        throw new Error(`Unsupported platform: ${os.platform()}`);
      }
    }
  }

  private async installDarwin(): Promise<string> {
    const limaDir = path.join(os.homedir(), '.lima', this.limaInstanceName);
    await io.mkdirP(limaDir);
    const dockerHost = `unix://${limaDir}/docker.sock`;

    // fallback to a version requiring QEMU with colima
    let macosVersion = '12.0.0';
    await core.group('macOS version', async () => {
      macosVersion = await Exec.getExecOutput(`sw_vers`, ['-productVersion'], {
        ignoreReturnCode: true,
        silent: true
      }).then(res => {
        if (res.exitCode == 0 && res.stdout.length > 0) {
          return res.stdout.trim();
        }
        core.info(`sw_vers failed to get macOS version. Using ${macosVersion} as fallback.`);
        return macosVersion;
      });
      core.info(macosVersion);
    });

    // avoid brew to auto update and upgrade unrelated packages.
    let envs = Object.assign({}, process.env, {
      HOMEBREW_NO_AUTO_UPDATE: '1',
      HOMEBREW_NO_INSTALLED_DEPENDENTS_CHECK: '1'
    }) as {
      [key: string]: string;
    };

    if (!(await Install.limaInstalled())) {
      await core.group('Installing lima', async () => {
        await Exec.exec('brew', ['install', 'lima'], {env: envs});
      });
    }

    await core.group('Lima version', async () => {
      await Exec.exec('lima', ['--version'], {env: envs});
    });

    let limaVmType = 'vz';
    let limaMountType = 'virtiofs';
    if (semver.satisfies(macosVersion, '<13.0.0')) {
      limaVmType = 'qemu';
      limaMountType = '9p';
    }

    await core.group('Creating lima config', async () => {
      let limaDaemonConfig = {};
      if (this.daemonConfig) {
        limaDaemonConfig = JSON.parse(this.daemonConfig);
      }
      handlebars.registerHelper('stringify', function (obj) {
        return new handlebars.SafeString(JSON.stringify(obj));
      });
      const limaCfg = handlebars.compile(limaYamlData)({
        vmType: limaVmType,
        customImages: Install.limaCustomImages(),
        mountType: limaMountType,
        daemonConfig: limaDaemonConfig,
        dockerSock: `${limaDir}/docker.sock`,
        dockerBinVersion: this._version,
        dockerBinChannel: this.channel
      });
      core.info(`Writing lima config to ${path.join(limaDir, 'lima.yaml')}`);
      fs.writeFileSync(path.join(limaDir, 'lima.yaml'), limaCfg);
      core.info(limaCfg);
    });

    const qemuArch = await Install.qemuArch();
    await core.group('QEMU version', async () => {
      await Exec.exec(`qemu-system-${qemuArch} --version`);
    });

    // lima might already be started on the runner so env var added in download
    // method is not expanded to the running process.
    envs = Object.assign({}, envs, {
      PATH: `${this.toolDir}:${process.env.PATH}`
    }) as {
      [key: string]: string;
    };

    await core.group('Starting lima instance', async () => {
      const limaStartTimeout = process.env.LIMA_START_TIMEOUT ? parseInt(process.env.LIMA_START_TIMEOUT) : 2 * 60 * 1000;
      const limaStartArgs = ['start', `--name=${this.limaInstanceName}`];
      if (process.env.LIMA_START_ARGS) {
        limaStartArgs.push(process.env.LIMA_START_ARGS);
      }
      try {
        const startPromise = new Promise<void>((resolve, reject) => {
          core.info(`Executing: limactl ${limaStartArgs.join(' ')}`);
          const proc = child_process.spawn(`limactl ${limaStartArgs.join(' ')}`, {
            env: envs
          });
          proc.on('close', code => {
            if (code === 0) {
              core.info('limactl command completed successfully');
              resolve();
            } else {
              core.error(`limactl command failed with code ${code}`);
              reject(new Error(`limactl command failed with code ${code}`));
            }
          });

          proc.on('error', err => {
            core.error(`limactl command error: ${err.message}`);
            reject(err);
          });
        });

        const timeoutPromise = new Promise<void>((_, reject) => {
          setTimeout(() => {
            core.error('Timeout reached');
            reject(new Error('Timeout reached'));
          }, limaStartTimeout);
        });

        await Promise.race([startPromise, timeoutPromise]);
      } catch (e) {
        core.error(`Error starting lima instance: ${e.message}`);
        fsp
          .readdir(limaDir)
          .then(files => {
            files
              .filter(f => path.extname(f) === '.log')
              .forEach(f => {
                const logfile = path.join(limaDir, f);
                const logcontent = fs.readFileSync(logfile, {encoding: 'utf8'}).trim();
                if (logcontent.length > 0) {
                  core.info(`### ${logfile}:\n${logcontent}`);
                }
              });
          })
          .catch(() => {
            // ignore
          });
        await Exec.exec(`limactl delete ${this.limaInstanceName}`, [], {env: envs});
        throw e;
      }
    });

    await core.group('Create Docker context', async () => {
      await Docker.exec(['context', 'create', this.contextName, '--docker', `host=${dockerHost}`]);
      await Docker.exec(['context', 'use', this.contextName]);
    });

    return dockerHost;
  }

  private async installLinux(): Promise<string> {
    const dockerHost = `unix://${path.join(this.runDir, 'docker.sock')}`;
    await io.mkdirP(this.runDir);

    const daemonConfigPath = path.join(this.runDir, 'daemon.json');
    await fs.writeFileSync(daemonConfigPath, '{}');

    let daemonConfig = undefined;
    const daemonConfigDefaultPath = '/etc/docker/daemon.json';
    if (fs.existsSync(daemonConfigDefaultPath)) {
      await core.group('Default Docker daemon config found', async () => {
        core.info(JSON.stringify(JSON.parse(fs.readFileSync(daemonConfigDefaultPath, {encoding: 'utf8'})), null, 2));
      });
      daemonConfig = JSON.parse(fs.readFileSync(daemonConfigDefaultPath, {encoding: 'utf8'}));
    }
    if (this.daemonConfig) {
      daemonConfig = Object.assign(daemonConfig || {}, JSON.parse(this.daemonConfig));
    }

    if (daemonConfig) {
      const daemonConfigStr = JSON.stringify(daemonConfig, null, 2);
      await core.group('Writing Docker daemon config', async () => {
        fs.writeFileSync(daemonConfigPath, daemonConfigStr);
        core.info(daemonConfigStr);
      });
    }

    const envs = Object.assign({}, process.env, {
      PATH: `${this.toolDir}:${process.env.PATH}`
    }) as {
      [key: string]: string;
    };

    await core.group('Start Docker daemon', async () => {
      const bashPath: string = await io.which('bash', true);
      const cmd = `${this.toolDir}/dockerd --host="${dockerHost}" --config-file="${daemonConfigPath}" --exec-root="${this.runDir}/execroot" --data-root="${this.runDir}/data" --pidfile="${this.runDir}/docker.pid" --userland-proxy=false`;
      core.info(`[command] ${cmd}`); // https://github.com/actions/toolkit/blob/3d652d3133965f63309e4b2e1c8852cdbdcb3833/packages/exec/src/toolrunner.ts#L47
      const proc = await child_process.spawn(
        // We can't use Exec.exec here because we need to detach the process to
        // avoid killing it when the action finishes running. Even if detached,
        // we also need to run dockerd in a subshell and unref the process so
        // GitHub Action doesn't wait for it to finish.
        `sudo env "PATH=$PATH" ${bashPath} << EOF
( ${cmd} 2>&1 | tee "${this.runDir}/dockerd.log" ) &
EOF`,
        [],
        {
          env: envs,
          detached: true,
          shell: true,
          stdio: ['ignore', process.stdout, process.stderr]
        }
      );
      proc.unref();
      await Util.sleep(3);
      const retries = 10;
      await retry(
        async bail => {
          try {
            await Exec.getExecOutput(`docker version`, undefined, {
              silent: true,
              env: Object.assign({}, envs, {
                DOCKER_HOST: dockerHost,
                DOCKER_CONTENT_TRUST: 'false'
              }) as {
                [key: string]: string;
              }
            });
          } catch (e) {
            bail(e);
          }
        },
        {
          retries: retries,
          minTimeout: 1000,
          onRetry: (err, i) => {
            core.info(`${err}. Retrying (${i}/${retries})...`);
          }
        }
      );
      core.info(`Docker daemon started started successfully`);
    });

    await core.group('Create Docker context', async () => {
      await Docker.exec(['context', 'create', this.contextName, '--docker', `host=${dockerHost}`]);
      await Docker.exec(['context', 'use', this.contextName]);
    });

    return dockerHost;
  }

  private async installWindows(): Promise<string> {
    const dockerHost = 'npipe:////./pipe/setup_docker_action';

    let daemonConfig = undefined;
    const daemonConfigPath = path.join(this.runDir, 'daemon.json');
    if (fs.existsSync(daemonConfigPath)) {
      await core.group('Default Docker daemon config found', async () => {
        core.info(JSON.stringify(JSON.parse(fs.readFileSync(daemonConfigPath, {encoding: 'utf8'})), null, 2));
      });
      daemonConfig = JSON.parse(fs.readFileSync(daemonConfigPath, {encoding: 'utf8'}));
    }
    if (this.daemonConfig) {
      daemonConfig = Object.assign(daemonConfig || {}, JSON.parse(this.daemonConfig));
    }

    let daemonConfigStr = '{}';
    if (daemonConfig) {
      daemonConfigStr = JSON.stringify(daemonConfig, null, 2);
      await core.group('Docker daemon config', async () => {
        core.info(daemonConfigStr);
      });
    }

    await core.group('Install Docker daemon service', async () => {
      const setupCmd = await Util.powershellCommand(setupDockerWinPs1(), {
        ToolDir: this.toolDir,
        RunDir: this.runDir,
        DockerHost: dockerHost,
        DaemonConfig: daemonConfigStr
      });
      await Exec.exec(setupCmd.command, setupCmd.args);
      const logCmd = await Util.powershellCommand(dockerServiceLogsPs1());
      await Exec.exec(logCmd.command, logCmd.args);
    });

    await core.group('Create Docker context', async () => {
      await Docker.exec(['context', 'create', this.contextName, '--docker', `host=${dockerHost}`]);
      await Docker.exec(['context', 'use', this.contextName]);
    });

    return dockerHost;
  }

  public async tearDown(): Promise<void> {
    if (!this.runDir) {
      throw new Error('runDir must be set');
    }
    switch (os.platform()) {
      case 'darwin': {
        await this.tearDownDarwin();
        break;
      }
      case 'linux': {
        await this.tearDownLinux();
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

  private async tearDownDarwin(): Promise<void> {
    await core.group('Docker daemon logs', async () => {
      await Exec.exec('limactl', ['shell', '--tty=false', this.limaInstanceName, 'sudo', 'journalctl', '-u', 'docker.service', '-l', '--no-pager']).catch(() => {
        core.warning(`Failed to get Docker daemon logs`);
      });
    });
    await core.group('Stopping lima instance', async () => {
      await Exec.exec('limactl', ['stop', '--tty=false', this.limaInstanceName, '--force']);
    });
    await core.group('Removing lima instance', async () => {
      await Exec.exec('limactl', ['delete', '--tty=false', this.limaInstanceName, '--force']);
    });
    await core.group('Removing Docker context', async () => {
      await Docker.exec(['context', 'rm', '-f', this.contextName]);
    });
    await core.group(`Cleaning up runDir`, async () => {
      await Exec.exec('sudo', ['rm', '-rf', this.runDir]);
    });
  }

  private async tearDownLinux(): Promise<void> {
    await core.group('Docker daemon logs', async () => {
      core.info(fs.readFileSync(path.join(this.runDir, 'dockerd.log'), {encoding: 'utf8'}));
    });
    await core.group('Stopping Docker daemon', async () => {
      await Exec.exec('sudo', ['kill', '-s', 'SIGTERM', fs.readFileSync(path.join(this.runDir, 'docker.pid')).toString().trim()]);
      await Util.sleep(5);
    });
    await core.group('Removing Docker context', async () => {
      await Docker.exec(['context', 'rm', '-f', this.contextName]);
    });
    await core.group(`Cleaning up runDir`, async () => {
      await Exec.exec('sudo', ['rm', '-rf', this.runDir], {
        ignoreReturnCode: true,
        failOnStdErr: false
      });
    });
  }

  private async tearDownWindows(): Promise<void> {
    await core.group('Docker daemon logs', async () => {
      const logCmd = await Util.powershellCommand(dockerServiceLogsPs1());
      await Exec.exec(logCmd.command, logCmd.args);
    });
    await core.group('Removing Docker context', async () => {
      await Docker.exec(['context', 'rm', '-f', this.contextName]);
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
      case 'arm64': {
        return 'aarch64';
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

  private static async limaInstalled(): Promise<boolean> {
    return await io
      .which('lima', true)
      .then(res => {
        core.debug(`docker.Install.limaAvailable ok: ${res}`);
        return true;
      })
      .catch(error => {
        core.debug(`docker.Install.limaAvailable error: ${error}`);
        return false;
      });
  }

  private static async qemuArch(): Promise<string> {
    switch (os.arch()) {
      case 'x64': {
        return 'x86_64';
      }
      case 'arm64': {
        return 'aarch64';
      }
      default: {
        return os.arch();
      }
    }
  }

  public static async getRelease(version: string): Promise<GitHubRelease> {
    const url = `https://raw.githubusercontent.com/docker/actions-toolkit/main/.github/docker-releases.json`;
    const http: httpm.HttpClient = new httpm.HttpClient('docker-actions-toolkit');
    const resp: httpm.HttpClientResponse = await http.get(url);
    const body = await resp.readBody();
    const statusCode = resp.message.statusCode || 500;
    if (statusCode >= 400) {
      throw new Error(`Failed to get Docker release ${version} from ${url} with status code ${statusCode}: ${body}`);
    }
    const releases = <Record<string, GitHubRelease>>JSON.parse(body);
    if (!releases[version]) {
      throw new Error(`Cannot find Docker release ${version} in ${url}`);
    }
    return releases[version];
  }

  public static limaCustomImages(): LimaImage[] {
    const res: LimaImage[] = [];
    const env = process.env.LIMA_IMAGES;
    if (!env) {
      return res;
    }
    for (const input of Util.getList(env, {ignoreComma: true, comment: '#'})) {
      const archIndex = input.indexOf(':');
      const arch = input.substring(0, archIndex).trim();
      const digestIndex = input.indexOf('@');
      const location = input.substring(archIndex + 1, digestIndex !== -1 ? digestIndex : undefined).trim();
      const digest = digestIndex !== -1 ? input.substring(digestIndex + 1).trim() : '';
      res.push({
        location: location,
        arch: arch,
        digest: digest
      });
    }
    return res;
  }
}
