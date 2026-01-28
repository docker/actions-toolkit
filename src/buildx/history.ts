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

import fs from 'fs';
import path from 'path';
import * as core from '@actions/core';

import {Buildx} from './buildx';
import {Context} from '../context';
import {Exec} from '../exec';
import {GitHub} from '../github';
import {Util} from '../util';

import {ExportOpts, ExportResponse, InspectOpts, InspectResponse, Summaries} from '../types/buildx/history';

export interface HistoryOpts {
  buildx?: Buildx;
}

export class History {
  private readonly buildx: Buildx;

  constructor(opts?: HistoryOpts) {
    this.buildx = opts?.buildx || new Buildx();
  }

  public async getCommand(args: Array<string>) {
    return await this.buildx.getCommand(['history', ...args]);
  }

  public async getInspectCommand(args: Array<string>) {
    return await this.getCommand(['inspect', ...args]);
  }

  public async getExportCommand(args: Array<string>) {
    return await this.getCommand(['export', ...args]);
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

  public async export(opts: ExportOpts): Promise<ExportResponse> {
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

    if (await this.buildx.versionSatisfies('<0.24.0')) {
      // wait 3 seconds to ensure build records are finalized: https://github.com/moby/buildkit/pull/5109
      // not necessary since buildx 0.24.0: https://github.com/docker/buildx/pull/3152
      await Util.sleep(3);
    }

    const summaries: Summaries = {};
    if (!opts.noSummaries) {
      for (const ref of refs) {
        await this.inspect({
          ref: ref,
          builder: builderName
        }).then(res => {
          let errorLogs = '';
          if (res.Error && res.Status !== 'canceled') {
            if (res.Error.Message) {
              errorLogs = res.Error.Message;
            } else if (res.Error.Name && res.Error.Logs) {
              errorLogs = `=> ${res.Error.Name}\n${res.Error.Logs}`;
            }
          }
          summaries[ref] = {
            name: res.Name,
            status: res.Status,
            duration: Util.formatDuration(res.Duration),
            numCachedSteps: res.NumCachedSteps,
            numTotalSteps: res.NumTotalSteps,
            numCompletedSteps: res.NumCompletedSteps,
            defaultPlatform: res.Platform?.[0],
            error: errorLogs
          };
        });
      }
    }

    const dockerbuildPath = path.join(outDir, `${History.exportFilename(refs)}.dockerbuild`);

    const exportArgs = ['--builder', builderName, '--output', dockerbuildPath, ...refs];
    if (await this.buildx.versionSatisfies('>=0.24.0')) {
      exportArgs.push('--finalize');
    }

    const cmd = await this.getExportCommand(exportArgs);
    await Exec.getExecOutput(cmd.command, cmd.args);

    const dockerbuildStats = fs.statSync(dockerbuildPath);

    return {
      dockerbuildFilename: dockerbuildPath,
      dockerbuildSize: dockerbuildStats.size,
      builderName: builderName,
      nodeName: nodeName,
      refs: refs,
      summaries: summaries
    };
  }

  private static exportFilename(refs: Array<string>): string {
    let name = `${GitHub.context.repo.owner}~${GitHub.context.repo.repo}~${refs[0].substring(0, 6).toUpperCase()}`;
    if (refs.length > 1) {
      name += `+${refs.length - 1}`;
    }
    return name;
  }
}
