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
import {OCI} from '../oci/oci';

import {ExportRecordOpts, ExportRecordResponse, LoadRecordOpts, Summaries} from '../types/buildx/history';
import {Index} from '../types/oci';
import {MEDIATYPE_IMAGE_INDEX_V1, MEDIATYPE_IMAGE_MANIFEST_V1} from '../types/oci/mediatype';
import {Archive} from '../types/oci/oci';
import {BuildRecord} from '../types/buildx/buildx';
import {Descriptor} from '../types/oci/descriptor';
import {MEDIATYPE_PAYLOAD as MEDIATYPE_INTOTO_PAYLOAD, MEDIATYPE_PREDICATE} from '../types/intoto/intoto';
import {ProvenancePredicate} from '../types/intoto/slsa_provenance/v0.2/provenance';
import {ANNOTATION_REF_KEY, MEDIATYPE_HISTORY_RECORD_V0, MEDIATYPE_SOLVE_STATUS_V0} from '../types/buildkit/buildkit';
import {SolveStatus} from '../types/buildkit/client';

export interface HistoryOpts {
  buildx?: Buildx;
}

export class History {
  private readonly buildx: Buildx;

  private static readonly EXPORT_TOOL_IMAGE: string = 'docker.io/dockereng/export-build:latest';

  constructor(opts?: HistoryOpts) {
    this.buildx = opts?.buildx || new Buildx();
  }

  public static async load(opts: LoadRecordOpts): Promise<Record<string, BuildRecord>> {
    const ociArchive = await OCI.loadArchive({
      file: opts.file
    });
    return History.readRecords(ociArchive.root.index, ociArchive);
  }

  private static readRecords(index: Index, archive: Archive): Record<string, BuildRecord> {
    const res: Record<string, BuildRecord> = {};
    index.manifests.forEach(desc => {
      switch (desc.mediaType) {
        case MEDIATYPE_IMAGE_MANIFEST_V1: {
          const record = History.readRecord(desc, archive);
          res[record.Ref] = record;
          break;
        }
        case MEDIATYPE_IMAGE_INDEX_V1: {
          if (!Object.prototype.hasOwnProperty.call(archive.indexes, desc.digest)) {
            throw new Error(`Missing index: ${desc.digest}`);
          }
          const records = History.readRecords(archive.indexes[desc.digest], archive);
          for (const ref in records) {
            if (!Object.prototype.hasOwnProperty.call(records, ref)) {
              continue;
            }
            res[ref] = records[ref];
          }
          break;
        }
      }
    });
    return res;
  }

  private static readRecord(desc: Descriptor, archive: Archive): BuildRecord {
    if (!Object.prototype.hasOwnProperty.call(archive.manifests, desc.digest)) {
      throw new Error(`Missing manifest: ${desc.digest}`);
    }
    const manifest = archive.manifests[desc.digest];
    if (manifest.config.mediaType !== MEDIATYPE_HISTORY_RECORD_V0) {
      throw new Error(`Unexpected config media type: ${manifest.config.mediaType}`);
    }
    if (!Object.prototype.hasOwnProperty.call(archive.blobs, manifest.config.digest)) {
      throw new Error(`Missing config blob: ${manifest.config.digest}`);
    }
    const record = <BuildRecord>JSON.parse(archive.blobs[manifest.config.digest]);
    if (manifest.annotations && ANNOTATION_REF_KEY in manifest.annotations) {
      if (record.Ref !== manifest.annotations[ANNOTATION_REF_KEY]) {
        throw new Error(`Mismatched ref ${desc.digest}: ${record.Ref} != ${manifest.annotations[ANNOTATION_REF_KEY]}`);
      }
    }
    manifest.layers.forEach(layer => {
      switch (layer.mediaType) {
        case MEDIATYPE_SOLVE_STATUS_V0: {
          if (!Object.prototype.hasOwnProperty.call(archive.blobs, layer.digest)) {
            throw new Error(`Missing blob: ${layer.digest}`);
          }
          record.solveStatus = <SolveStatus>JSON.parse(archive.blobs[layer.digest]);
          break;
        }
        case MEDIATYPE_INTOTO_PAYLOAD: {
          if (!Object.prototype.hasOwnProperty.call(archive.blobs, layer.digest)) {
            throw new Error(`Missing blob: ${layer.digest}`);
          }
          if (layer.annotations && MEDIATYPE_PREDICATE in layer.annotations && layer.annotations[MEDIATYPE_PREDICATE].startsWith('https://slsa.dev/provenance/')) {
            record.provenance = <ProvenancePredicate>JSON.parse(archive.blobs[layer.digest]);
          }
          break;
        }
      }
    });
    return record;
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
      const dockerRunProc = History.spawn('docker', [
        'run', '--rm', '-i',
        '-v', `${Buildx.refsDir}:/buildx-refs`,
        '-v', `${outDir}:/out`,
        opts.image || History.EXPORT_TOOL_IMAGE,
        ...ebargs
      ]);
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
          reject(new Error(`Process "docker run" exited with code ${code}`));
        }
      });
      dockerRunProc.on('error', err => {
        core.error(`Error executing buildx dial-stdio: ${err}`);
        reject(err);
      });
    }).catch(err => {
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
