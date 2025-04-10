/**
 * Copyright 2024 actions-toolkit authors
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

import {ChildProcessByStdio, spawn} from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import {Readable, Writable} from 'stream';
import * as core from '@actions/core';

import {Buildx} from './buildx';
import {Context} from '../context';
import {Docker} from '../docker/docker';
import {Exec} from '../exec';
import {GitHub} from '../github';
import {Util} from '../util';

import {ExportBuildOpts, ExportBuildResponse, InspectOpts, InspectResponse, Summaries} from '../types/buildx/history';

export interface HistoryOpts {
  buildx?: Buildx;
}

export class History {
  private readonly buildx: Buildx;

  private static readonly EXPORT_BUILD_IMAGE_DEFAULT: string = 'docker.io/dockereng/export-build:latest';
  private static readonly EXPORT_BUILD_IMAGE_ENV: string = 'DOCKER_BUILD_EXPORT_BUILD_IMAGE';

  constructor(opts?: HistoryOpts) {
    this.buildx = opts?.buildx || new Buildx();
  }

  public async getCommand(args: Array<string>) {
    return await this.buildx.getCommand(['history', ...args]);
  }

  public async getInspectCommand(args: Array<string>) {
    return await this.getCommand(['inspect', ...args]);
  }

  public async inspect(opts: InspectOpts): Promise<InspectResponse> {
    const args: Array<string> = ['--format', 'json'];
    if (opts.builder) {
      args.push('--builder', opts.builder);
    }
    if (opts.ref) {
      args.push(opts.ref);
    }
    const cmd = await this.getInspectCommand(args);
    return await Exec.getExecOutput(cmd.command, cmd.args, {
      ignoreReturnCode: true,
      silent: true
    }).then(res => {
      if (res.stderr.length > 0 && res.exitCode != 0) {
        throw new Error(res.stderr.trim());
      }
      return <InspectResponse>JSON.parse(res.stdout);
    });
  }

  public async export(opts: ExportBuildOpts): Promise<ExportBuildResponse> {
    if (os.platform() === 'win32') {
      throw new Error('Exporting a build record is currently not supported on Windows');
    }
    if (!(await Docker.isAvailable())) {
      throw new Error('Docker is required to export a build record');
    }
    if (!(await Docker.isDaemonRunning())) {
      throw new Error('Docker daemon needs to be running to export a build record');
    }
    if (!(await this.buildx.versionSatisfies('>=0.13.0'))) {
      throw new Error('Buildx >= 0.13.0 is required to export a build record');
    }

    let builderName: string = '';
    let nodeName: string = '';
    const refs: Array<string> = [];
    for (const ref of opts.refs) {
      const refParts = ref.split('/');
      if (refParts.length != 3) {
        throw new Error(`Invalid build ref: ${ref}`);
      }
      refs.push(refParts[2]);

      // Set builder name and node name from the first ref if not already set.
      // We assume all refs are from the same builder and node.
      if (!builderName) {
        builderName = refParts[0];
      }
      if (!nodeName) {
        nodeName = refParts[1];
      }
    }
    if (refs.length === 0) {
      throw new Error('No build refs provided');
    }

    const outDir = path.join(Context.tmpDir(), 'export');
    core.info(`exporting build record to ${outDir}`);
    fs.mkdirSync(outDir, {recursive: true});

    // wait 3 seconds to ensure build records are finalized: https://github.com/moby/buildkit/pull/5109
    await Util.sleep(3);

    const buildxInFifoPath = Context.tmpName({
      template: 'buildx-in-XXXXXX.fifo',
      tmpdir: Context.tmpDir()
    });
    await Exec.exec('mkfifo', [buildxInFifoPath]);

    const buildxOutFifoPath = Context.tmpName({
      template: 'buildx-out-XXXXXX.fifo',
      tmpdir: Context.tmpDir()
    });
    await Exec.exec('mkfifo', [buildxOutFifoPath]);

    const buildxDialStdioCmd = await this.buildx.getCommand(['--builder', builderName, 'dial-stdio']);
    core.info(`[command]${buildxDialStdioCmd.command} ${buildxDialStdioCmd.args.join(' ')}`);
    const buildxDialStdioProc = spawn(buildxDialStdioCmd.command, buildxDialStdioCmd.args, {
      stdio: ['pipe', 'pipe', 'inherit'],
      detached: true
    });
    let buildxDialStdioKilled = false;
    fs.createReadStream(buildxInFifoPath).pipe(buildxDialStdioProc.stdin);
    buildxDialStdioProc.stdout.pipe(fs.createWriteStream(buildxOutFifoPath));
    buildxDialStdioProc.on('exit', (code, signal) => {
      buildxDialStdioKilled = true;
      if (signal) {
        core.info(`Process "buildx dial-stdio" was killed with signal ${signal}`);
      } else {
        core.info(`Process "buildx dial-stdio" exited with code ${code}`);
      }
    });

    const tmpDockerbuildFilename = path.join(outDir, 'rec.dockerbuild');
    const summaryFilename = path.join(outDir, 'summary.json');

    let dockerRunProc: ChildProcessByStdio<Writable, Readable, null> | undefined;
    let dockerRunProcKilled = false;
    await new Promise<void>((resolve, reject) => {
      const ebargs: Array<string> = ['--ref-state-dir=/buildx-refs', `--node=${builderName}/${nodeName}`];
      for (const ref of refs) {
        ebargs.push(`--ref=${ref}`);
      }
      if (typeof process.getuid === 'function') {
        ebargs.push(`--uid=${process.getuid()}`);
      }
      if (typeof process.getgid === 'function') {
        ebargs.push(`--gid=${process.getgid()}`);
      }
      // prettier-ignore
      const dockerRunArgs = [
        'run', '--rm', '-i',
        '-v', `${Buildx.refsDir}:/buildx-refs`,
        '-v', `${outDir}:/out`,
        opts.image || process.env[History.EXPORT_BUILD_IMAGE_ENV] || History.EXPORT_BUILD_IMAGE_DEFAULT,
        ...ebargs
      ]
      core.info(`[command]docker ${dockerRunArgs.join(' ')}`);
      dockerRunProc = spawn('docker', dockerRunArgs, {
        stdio: ['pipe', 'pipe', 'inherit'],
        env: {
          ...process.env,
          DOCKER_CONTENT_TRUST: 'false'
        }
      });
      fs.createReadStream(buildxOutFifoPath).pipe(dockerRunProc.stdin);
      dockerRunProc.stdout.pipe(fs.createWriteStream(buildxInFifoPath));
      dockerRunProc.on('close', code => {
        if (code === 0) {
          if (!fs.existsSync(tmpDockerbuildFilename)) {
            reject(new Error(`Failed to export build record: ${tmpDockerbuildFilename} not found`));
          } else {
            resolve();
          }
        } else {
          reject(new Error(`Process "docker run" closed with code ${code}`));
        }
      });
      dockerRunProc.on('error', err => {
        core.error(`Error executing "docker run": ${err}`);
        reject(err);
      });
      dockerRunProc.on('exit', (code, signal) => {
        dockerRunProcKilled = true;
        if (signal) {
          core.info(`Process "docker run" was killed with signal ${signal}`);
        } else {
          core.info(`Process "docker run" exited with code ${code}`);
        }
      });
    })
      .catch(err => {
        throw err;
      })
      .finally(() => {
        if (buildxDialStdioProc && !buildxDialStdioKilled) {
          core.debug('Force terminating "buildx dial-stdio" process');
          buildxDialStdioProc.kill('SIGKILL');
        }
        if (dockerRunProc && !dockerRunProcKilled) {
          core.debug('Force terminating "docker run" process');
          dockerRunProc.kill('SIGKILL');
        }
      });

    let dockerbuildFilename = `${GitHub.context.repo.owner}~${GitHub.context.repo.repo}~${refs[0].substring(0, 6).toUpperCase()}`;
    if (refs.length > 1) {
      dockerbuildFilename += `+${refs.length - 1}`;
    }

    const dockerbuildPath = path.join(outDir, `${dockerbuildFilename}.dockerbuild`);
    fs.renameSync(tmpDockerbuildFilename, dockerbuildPath);
    const dockerbuildStats = fs.statSync(dockerbuildPath);

    core.info(`Parsing ${summaryFilename}`);
    fs.statSync(summaryFilename);
    const summaries = <Summaries>JSON.parse(fs.readFileSync(summaryFilename, {encoding: 'utf-8'}));

    return {
      dockerbuildFilename: dockerbuildPath,
      dockerbuildSize: dockerbuildStats.size,
      summaries: summaries,
      builderName: builderName,
      nodeName: nodeName,
      refs: refs
    };
  }
}
