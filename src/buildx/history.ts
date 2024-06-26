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
import {Readable, Writable} from 'node:stream';
import os from 'os';
import path from 'path';
import * as core from '@actions/core';

import {Buildx} from './buildx';
import {Context} from '../context';
import {Docker} from '../docker/docker';
import {Exec} from '../exec';
import {GitHub} from '../github';

import {ExportRecordOpts, ExportRecordResponse, Summaries} from '../types/buildx/history';

export interface HistoryOpts {
  buildx?: Buildx;
}

export class History {
  private readonly buildx: Buildx;

  private static readonly EXPORT_TOOL_IMAGE: string = 'docker.io/dockereng/export-build:latest';

  constructor(opts?: HistoryOpts) {
    this.buildx = opts?.buildx || new Buildx();
  }

  public async export(opts: ExportRecordOpts): Promise<ExportRecordResponse> {
    if (os.platform() === 'win32') {
      throw new Error('Exporting a build record is currently not supported on Windows');
    }
    if (!(await Docker.isAvailable())) {
      throw new Error('Docker is required to export a build record');
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

    const buildxCmd = await this.buildx.getCommand(['--builder', builderName, 'dial-stdio']);
    const buildxDialStdioProc = History.spawn(buildxCmd.command, buildxCmd.args);
    fs.createReadStream(buildxInFifoPath).pipe(buildxDialStdioProc.stdin);
    buildxDialStdioProc.stdout.pipe(fs.createWriteStream(buildxOutFifoPath));

    const tmpDockerbuildFilename = path.join(outDir, 'rec.dockerbuild');
    const summaryFilename = path.join(outDir, 'summary.json');

    const exportBuild = async (resolve, reject) => {
      const ebargs: Array<string> = [`--output=/out`, `--node=${builderName}/${nodeName}`];
      if (fs.existsSync(Buildx.refsDir)) {
        ebargs.push('--ref-state-dir=/buildx-refs');
      }
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
      const ctnExportBuildID = await Exec.getExecOutput(`docker`, [
        'create', '-i',
        opts.image || History.EXPORT_TOOL_IMAGE,
        ...ebargs
      ], {
        ignoreReturnCode: true
      }).then(res => {
        if (res.stderr.length > 0 && res.exitCode != 0) {
          reject(new Error(`Error executing "docker create": ${res.stderr.trim()}`));
        }
        core.info(`Export build container created with ID "${res.stdout.trim()}"`);
        return res.stdout.trim();
      });

      try {
        if (fs.existsSync(Buildx.refsDir)) {
          await Exec.getExecOutput(`docker`, ['cp', Buildx.refsDir, `${ctnExportBuildID}:/buildx-refs`], {
            ignoreReturnCode: true
          }).then(res => {
            if (res.stderr.length > 0 && res.exitCode != 0) {
              reject(new Error(`Error executing "docker cp": ${res.stderr.trim()}`));
            }
          });
        }

        const dockerStartProc = History.spawn('docker', ['start', '-a', ctnExportBuildID]);
        fs.createReadStream(buildxOutFifoPath).pipe(dockerStartProc.stdin);
        dockerStartProc.stdout.pipe(fs.createWriteStream(buildxInFifoPath));
        dockerStartProc.on('close', async code => {
          if (code === 0) {
            await Exec.getExecOutput(`docker`, ['cp', `${ctnExportBuildID}:/out`, outDir], {
              ignoreReturnCode: true
            }).then(res => {
              if (res.stderr.length > 0 && res.exitCode != 0) {
                reject(new Error(`Error executing "docker cp": ${res.stderr.trim()}`));
              }
            });
            if (!fs.existsSync(tmpDockerbuildFilename)) {
              reject(new Error(`Failed to export build record: ${tmpDockerbuildFilename} not found`));
            } else {
              resolve();
            }
          } else {
            reject(new Error(`Process "docker start" exited with code ${code}`));
          }
        });
        dockerStartProc.on('error', err => {
          core.error(`Error executing "docker start": ${err}`);
          reject(err);
        });
      } finally {
        await Exec.getExecOutput(`docker`, ['rm', '-f', ctnExportBuildID], {
          ignoreReturnCode: true
        }).then(res => {
          if (res.stderr.length > 0 && res.exitCode != 0) {
            reject(new Error(`Error executing "docker rm": ${res.stderr.trim()}`));
          }
        });
      }
    };

    await new Promise<void>(exportBuild).catch(err => {
      throw err;
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

  private static spawn(command: string, args?: ReadonlyArray<string>): ChildProcessByStdio<Writable, Readable, null> {
    core.info(`[command]${command}${args ? ` ${args.join(' ')}` : ''}`);
    return spawn(command, args || [], {
      stdio: ['pipe', 'pipe', 'inherit']
    });
  }
}
