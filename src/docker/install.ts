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
import * as core from '@actions/core';
import * as io from '@actions/io';
import * as tc from '@actions/tool-cache';

import {Context} from '../context.js';
import {Docker} from './docker.js';
import {Exec} from '../exec.js';
import {GitHub} from '../github/github.js';
import {Regctl} from '../regclient/regctl.js';
import {Undock} from '../undock/undock.js';
import {Util} from '../util.js';

import {limaYamlData, dockerServiceLogsPs1, setupDockerWinPs1} from './assets.js';

import {GitHubRelease} from '../types/github/github.js';
import {Image} from '../types/oci/config.js';

export interface InstallSourceImage {
  type: 'image';
  tag: string;
}

export interface InstallSourceArchive {
  type: 'archive';
  version: string;
  channel: string;
}

export type InstallSource = InstallSourceImage | InstallSourceArchive;

export interface InstallOpts {
  source?: InstallSource;

  // ...
  runDir: string;
  contextName?: string;
  daemonConfig?: string;
  rootless?: boolean;
  localTCPPort?: number;

  regctl?: Regctl;
  undock?: Undock;

  githubToken?: string;
}

interface LimaImage {
  location: string;
  arch: string;
  digest?: string;
}

export class Install {
  private readonly runDir: string;
  private readonly source: InstallSource;
  private readonly contextName: string;
  private readonly daemonConfig?: string;
  private readonly rootless: boolean;
  private readonly localTCPPort?: number;
  private readonly regctl: Regctl;
  private readonly undock: Undock;
  private readonly githubToken?: string;

  private _version: string | undefined;
  private _toolDir: string | undefined;

  private gitCommit: string | undefined;

  private readonly limaInstanceName = 'docker-actions-toolkit';

  constructor(opts: InstallOpts) {
    this.runDir = opts.runDir;
    this.source = opts.source || {
      type: 'archive',
      version: 'latest',
      channel: 'stable'
    };
    this.contextName = opts.contextName || 'setup-docker-action';
    this.daemonConfig = opts.daemonConfig;
    this.rootless = opts.rootless || false;
    this.localTCPPort = opts.localTCPPort;
    this.regctl = opts.regctl || new Regctl();
    this.undock = opts.undock || new Undock();
    this.githubToken = opts.githubToken || process.env.GITHUB_TOKEN;
  }

  get toolDir(): string {
    return this._toolDir || Context.tmpDir();
  }

  public async download(): Promise<string> {
    let extractFolder: string;
    let cacheKey: string;
    const platform = os.platform();

    switch (this.source.type) {
      case 'image': {
        this._version = this.source.tag;
        cacheKey = `docker-image`;
        extractFolder = await this.downloadSourceImage(platform);
        break;
      }
      case 'archive': {
        const version = this.source.version;
        const channel = this.source.channel;
        cacheKey = `docker-archive-${channel}`;
        this._version = version;

        core.info(`Downloading Docker ${version} from ${this.source.channel} at download.docker.com`);
        extractFolder = await this.downloadSourceArchive('docker', this.source);
        if (this.rootless) {
          core.info(`Downloading Docker rootless extras ${version} from ${this.source.channel} at download.docker.com`);
          const extrasFolder = await this.downloadSourceArchive('docker-rootless-extras', this.source);
          fs.readdirSync(extrasFolder).forEach(file => {
            const src = path.join(extrasFolder, file);
            const dest = path.join(extractFolder, file);
            fs.copyFileSync(src, dest);
          });
        }
        break;
      }
    }

    core.info('Fixing perms');
    fs.readdir(path.join(extractFolder), function (err, files) {
      if (err) {
        throw err;
      }
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      files.forEach(function (file, index) {
        if (!Util.isDirectory(path.join(extractFolder, file))) {
          fs.chmodSync(path.join(extractFolder, file), '0755');
        }
      });
    });

    const tooldir = await tc.cacheDir(extractFolder, cacheKey, this._version.replace(/(0+)([1-9]+)/, '$2'));
    core.addPath(tooldir);
    core.info('Added Docker to PATH');

    this._toolDir = tooldir;
    return tooldir;
  }

  private async downloadSourceImage(platform: string): Promise<string> {
    const dest = path.join(Context.tmpDir(), 'docker-install-image');
    const cliImage = `dockereng/cli-bin:${this._version}`;
    const engineImage = `moby/moby-bin:${this._version}`;

    core.info(`Downloading Docker CLI from ${cliImage}`);
    await this.undock.run({
      source: cliImage,
      dist: dest
    });

    if (['win32', 'linux'].includes(platform)) {
      core.info(`Downloading Docker engine from ${engineImage}`);
      await this.undock.run({
        source: engineImage,
        dist: dest
      });
    } else if (platform == 'darwin') {
      // On macOS, the docker daemon binary will be downloaded inside the lima VM.
      // However, we will get the exact git revision from the image config
      // to get the matching systemd unit files. There's no macOS image for
      // moby/moby-bin - a linux daemon is run inside lima.
      try {
        const engineImageConfig = await this.imageConfig(engineImage, 'linux/arm64');
        core.debug(`docker.Install.downloadSourceImage engineImageConfig: ${JSON.stringify(engineImageConfig)}`);
        this.gitCommit = engineImageConfig.config?.Labels?.['org.opencontainers.image.revision'];
        if (!this.gitCommit) {
          throw new Error(`No git revision can be determined from the image`);
        }
      } catch (e) {
        core.warning(e);
        this.gitCommit = 'master';
      }

      core.debug(`docker.Install.downloadSourceImage gitCommit: ${this.gitCommit}`);
    } else {
      core.warning(`Docker engine not supported on ${platform}, only the Docker cli will be available`);
    }

    return dest;
  }

  private async downloadSourceArchive(component: 'docker' | 'docker-rootless-extras', src: InstallSourceArchive): Promise<string> {
    const release: GitHubRelease = await Install.getRelease(src.version, this.githubToken);
    this._version = release.tag_name.replace(/^(docker-)?v+/, '');
    core.debug(`docker.Install.downloadSourceArchive version: ${this._version}`);

    const downloadURL = this.downloadURL(component, this._version, src.channel);
    core.info(`Downloading ${downloadURL}`);

    const downloadPath = await tc.downloadTool(downloadURL);
    core.debug(`docker.Install.downloadSourceArchive downloadPath: ${downloadPath}`);

    let extractFolder;
    if (os.platform() == 'win32') {
      extractFolder = await tc.extractZip(downloadPath, extractFolder);
    } else {
      extractFolder = await tc.extractTar(downloadPath, extractFolder);
    }
    if (Util.isDirectory(path.join(extractFolder, component))) {
      extractFolder = path.join(extractFolder, component);
    }
    core.debug(`docker.Install.downloadSourceArchive extractFolder: ${extractFolder}`);
    return extractFolder;
  }

  public async install(): Promise<string> {
    if (!this.toolDir) {
      throw new Error('toolDir must be set. Run download first.');
    }
    if (!this.runDir) {
      throw new Error('runDir must be set');
    }

    const platform = os.platform();
    if (this.rootless && platform != 'linux') {
      // TODO: Support on macOS (via lima)
      throw new Error(`rootless is only supported on linux`);
    }
    switch (platform) {
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
    if (this.source.type == 'image' && !this.gitCommit) {
      throw new Error('gitCommit must be set. Run download first.');
    }
    const src = this.source;
    const limaDir = path.join(os.homedir(), '.lima', this.limaInstanceName);
    await io.mkdirP(limaDir);
    const dockerHost = `unix://${limaDir}/docker.sock`;

    if (!(await Install.limaInstalled())) {
      await this.brewInstall('lima');
    }

    await core.group('Lima version', async () => {
      await Exec.exec('lima', ['--version']);
    });

    await core.group('Creating lima config', async () => {
      let limaDaemonConfig = {};
      if (this.daemonConfig) {
        limaDaemonConfig = JSON.parse(this.daemonConfig);
      }
      handlebars.registerHelper('stringify', function (obj) {
        return new handlebars.SafeString(JSON.stringify(obj));
      });
      const srcArchive = src as InstallSourceArchive;
      const limaCfg = handlebars.compile(limaYamlData)({
        customImages: Install.limaCustomImages(),
        daemonConfig: limaDaemonConfig,
        dockerSock: `${limaDir}/docker.sock`,
        localTCPPort: this.localTCPPort,
        gitCommit: this.gitCommit,
        srcType: src.type,
        srcArchiveVersion: this._version, // Use the resolved version (e.g. latest -> 27.4.0)
        srcArchiveChannel: srcArchive.channel,
        srcImageTag: (src as InstallSourceImage).tag
      });
      core.info(`Writing lima config to ${path.join(limaDir, 'lima.yaml')}`);
      fs.writeFileSync(path.join(limaDir, 'lima.yaml'), limaCfg);
      core.info(limaCfg);
    });

    if (!(await Install.qemuInstalled())) {
      await this.brewInstall('qemu');
    }
    const qemuBin = await Install.qemuBin();
    await core.group('QEMU version', async () => {
      await Exec.exec(qemuBin, ['--version']);
    });

    // lima might already be started on the runner so env var added in download
    // method is not expanded to the running process.
    const envs = Object.assign({}, process.env, {
      PATH: `${this.toolDir}:${process.env.PATH}`
    }) as {
      [key: string]: string;
    };

    await core.group('Starting lima instance', async () => {
      const limaStartArgs = ['start', `--name=${this.limaInstanceName}`, `--timeout=${process.env.LIMA_START_TIMEOUT ?? '15m'}`];
      if (process.env.LIMA_START_ARGS) {
        limaStartArgs.push(process.env.LIMA_START_ARGS);
      }
      try {
        await Exec.exec(`limactl ${limaStartArgs.join(' ')}`, [], {env: envs});
      } catch (e) {
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
      PATH: `${this.toolDir}:${process.env.PATH}`,
      XDG_RUNTIME_DIR: (this.rootless && this.runDir) || undefined
    }) as {
      [key: string]: string;
    };

    await core.group('Start Docker daemon', async () => {
      const bashPath: string = await io.which('bash', true);
      let dockerPath = `${this.toolDir}/dockerd`;
      if (this.rootless) {
        dockerPath = `${this.toolDir}/dockerd-rootless.sh`;
        if (fs.existsSync('/proc/sys/kernel/apparmor_restrict_unprivileged_userns')) {
          await Exec.exec('sudo', ['sh', '-c', 'echo 0 > /proc/sys/kernel/apparmor_restrict_unprivileged_userns']);
        }
      }
      let cmd = `${dockerPath} --host="${dockerHost}" --config-file="${daemonConfigPath}" --exec-root="${this.runDir}/execroot" --data-root="${this.runDir}/data" --pidfile="${this.runDir}/docker.pid"`;
      if (this.localTCPPort) {
        cmd += ` --host="tcp://127.0.0.1:${this.localTCPPort}"`;
      }
      core.info(`[command] ${cmd}`); // https://github.com/actions/toolkit/blob/3d652d3133965f63309e4b2e1c8852cdbdcb3833/packages/exec/src/toolrunner.ts#L47
      let sudo = 'sudo';
      if (this.rootless) {
        sudo += ' -u \\#1001';
      }
      const proc = await child_process.spawn(
        // We can't use Exec.exec here because we need to detach the process to
        // avoid killing it when the action finishes running. Even if detached,
        // we also need to run dockerd in a subshell and unref the process so
        // GitHub Action doesn't wait for it to finish.
        `${sudo} env "PATH=$PATH" "XDG_RUNTIME_DIR=$XDG_RUNTIME_DIR" ${bashPath} << EOF
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
    const dockerHostSocket = 'npipe:////./pipe/setup_docker_action';

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

    const params = {
      ToolDir: this.toolDir,
      RunDir: this.runDir,
      DockerHostSocket: dockerHostSocket,
      DaemonConfig: daemonConfigStr
    };
    if (this.localTCPPort) {
      params['DockerHostTCP'] = `tcp://127.0.0.1:${this.localTCPPort}`;
    }

    await core.group('Install Docker daemon service', async () => {
      const setupCmd = await Util.powershellCommand(setupDockerWinPs1(), params);
      await Exec.exec(setupCmd.command, setupCmd.args);
      const logCmd = await Util.powershellCommand(dockerServiceLogsPs1());
      await Exec.exec(logCmd.command, logCmd.args);
    });

    await core.group('Create Docker context', async () => {
      await Docker.exec(['context', 'create', this.contextName, '--docker', `host=${dockerHostSocket}`]);
      await Docker.exec(['context', 'use', this.contextName]);
    });

    return dockerHostSocket;
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

    await core.group(`Cleaning up toolDir`, async () => {
      if (!this._toolDir) {
        return;
      }
      fs.rmSync(this._toolDir, {recursive: true, force: true});
    });
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
    await core.group('Stopping Docker daemon service', async () => {
      await Exec.exec('powershell', ['-Command', `Stop-Service -Name docker -Force`]);
    });
  }

  private downloadURL(component: 'docker' | 'docker-rootless-extras', version: string, channel: string): string {
    const platformOS = Install.platformOS();
    const platformArch = Install.platformArch();
    const ext = platformOS === 'win' ? '.zip' : '.tgz';
    return `https://download.docker.com/${platformOS}/static/${channel}/${platformArch}/${component}-${version}${ext}`;
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
        core.debug(`docker.Install.limaInstalled ok: ${res}`);
        return true;
      })
      .catch(error => {
        core.debug(`docker.Install.limaInstalled error: ${error}`);
        return false;
      });
  }

  private static async qemuBin(): Promise<string> {
    switch (os.arch()) {
      case 'x64': {
        return `qemu-system-x86_64`;
      }
      case 'arm64': {
        return `qemu-system-aarch64`;
      }
      default: {
        return `qemu-system-${os.arch()}`;
      }
    }
  }

  private static async qemuInstalled(): Promise<boolean> {
    return await io
      .which(await Install.qemuBin(), true)
      .then(res => {
        core.debug(`docker.Install.qemuInstalled ok: ${res}`);
        return true;
      })
      .catch(error => {
        core.debug(`docker.Install.qemuInstalled error: ${error}`);
        return false;
      });
  }

  public static async getRelease(version: string, githubToken?: string): Promise<GitHubRelease> {
    const github = new GitHub({token: githubToken});
    const releases = await github.releases('Docker', {
      owner: 'docker',
      repo: 'actions-toolkit',
      ref: 'main',
      path: '.github/docker-releases.json'
    });
    if (!releases[version]) {
      if (!releases['v' + version]) {
        throw new Error(`Cannot find Docker release ${version} in releases JSON`);
      }
      return releases['v' + version];
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

  private async imageConfig(image: string, platform?: string): Promise<Image> {
    const manifest = await this.regctl.manifestGet({
      image: image,
      platform: platform
    });
    const configDigest = manifest?.config?.digest;
    if (!configDigest) {
      throw new Error(`No config digest found for image ${image}`);
    }
    const blob = await this.regctl.blobGet({
      repository: image,
      digest: configDigest
    });
    return <Image>JSON.parse(blob);
  }

  private async brewInstall(packageName: string, revision?: string): Promise<void> {
    // avoid brew to auto update and upgrade unrelated packages.
    const envs = Object.assign({}, process.env, {
      HOMEBREW_NO_AUTO_UPDATE: '1',
      HOMEBREW_NO_INSTALL_UPGRADE: '1',
      HOMEBREW_NO_INSTALL_CLEANUP: '1'
    }) as {
      [key: string]: string;
    };

    await core.group(`Installing ${packageName}`, async () => {
      if (!revision) {
        await Exec.exec('brew', ['install', packageName]);
      } else {
        const dockerTap = 'docker-actions-toolkit/tap';
        const hasDockerTap = await Exec.getExecOutput('brew', ['tap'], {
          ignoreReturnCode: true,
          silent: true,
          env: envs
        }).then(res => {
          if (res.stderr.length > 0 && res.exitCode != 0) {
            throw new Error(res.stderr);
          }
          for (const line of res.stdout.trim().split('\n')) {
            if (line.includes(dockerTap)) {
              return true;
            }
          }
          return false;
        });
        if (!hasDockerTap) {
          await Exec.exec('brew', ['tap-new', dockerTap], {env: envs});
        }
        const brewRepoTapPath = await Exec.getExecOutput('brew', ['--repo', dockerTap], {
          ignoreReturnCode: true,
          silent: true,
          env: envs
        }).then(res => {
          if (res.stderr.length > 0 && res.exitCode != 0) {
            throw new Error(res.stderr);
          }
          return res.stdout.trim();
        });
        const formulaURL = `https://raw.githubusercontent.com/Homebrew/homebrew-core/${revision}/Formula/${packageName.charAt(0)}/${packageName}.rb`;
        await tc.downloadTool(formulaURL, path.join(brewRepoTapPath, 'Formula', `${packageName}.rb`));
        const hasFormulaInstalled = await Exec.getExecOutput('brew', ['ls', '-1'], {
          ignoreReturnCode: true,
          silent: true,
          env: envs
        }).then(res => {
          if (res.stderr.length > 0 && res.exitCode != 0) {
            throw new Error(res.stderr);
          }
          for (const line of res.stdout.trim().split('\n')) {
            if (line.trim() == packageName) {
              return true;
            }
          }
          return false;
        });
        if (hasFormulaInstalled) {
          await Exec.exec('brew', ['uninstall', packageName, '--ignore-dependencies'], {env: envs});
        }
        await Exec.exec('brew', ['install', `${dockerTap}/${packageName}`], {env: envs});
      }
    });
  }
}
