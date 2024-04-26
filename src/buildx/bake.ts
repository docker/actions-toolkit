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
import path from 'path';

import {Build} from './build';
import {Buildx} from './buildx';
import {Context} from '../context';
import {Exec} from '../exec';
import {Util} from '../util';

import {ExecOptions} from '@actions/exec';
import {BakeDefinition, BakeMetadata} from '../types/bake';

export interface BakeOpts {
  buildx?: Buildx;
}

export interface BakeCmdOpts {
  files?: Array<string>;
  load?: boolean;
  noCache?: boolean;
  overrides?: Array<string>;
  provenance?: string;
  push?: boolean;
  sbom?: string;
  source?: string;
  targets?: Array<string>;

  githubToken?: string; // for auth with remote definitions on private repos
}

export class Bake {
  private readonly buildx: Buildx;
  private readonly metadataFilename: string;

  constructor(opts?: BakeOpts) {
    this.buildx = opts?.buildx || new Buildx();
    this.metadataFilename = `bake-metadata-${Util.generateRandomString()}.json`;
  }

  public getMetadataFilePath(): string {
    return path.join(Context.tmpDir(), this.metadataFilename);
  }

  public resolveMetadata(): BakeMetadata | undefined {
    const metadataFile = this.getMetadataFilePath();
    if (!fs.existsSync(metadataFile)) {
      return undefined;
    }
    const content = fs.readFileSync(metadataFile, {encoding: 'utf-8'}).trim();
    if (content === 'null') {
      return undefined;
    }
    return <BakeMetadata>JSON.parse(content);
  }

  public resolveRefs(metadata?: BakeMetadata): Array<string> | undefined {
    if (!metadata) {
      metadata = this.resolveMetadata();
      if (!metadata) {
        return undefined;
      }
    }
    const refs = new Array<string>();
    for (const key in metadata) {
      if ('buildx.build.ref' in metadata[key]) {
        refs.push(metadata[key]['buildx.build.ref']);
      }
    }
    return refs;
  }

  public async getDefinition(cmdOpts: BakeCmdOpts, execOptions?: ExecOptions): Promise<BakeDefinition> {
    execOptions = execOptions || {ignoreReturnCode: true};
    execOptions.ignoreReturnCode = true;
    if (cmdOpts.githubToken) {
      execOptions.env = Object.assign({}, process.env, {
        BUILDX_BAKE_GIT_AUTH_TOKEN: cmdOpts.githubToken
      }) as {
        [key: string]: string;
      };
    }

    const args = ['bake'];

    let remoteDef: string | undefined;
    const files: Array<string> = [];
    const sources = [...(cmdOpts.files || []), cmdOpts.source];
    if (sources) {
      for (const source of sources.map(v => (v ? v.trim() : ''))) {
        if (source.length == 0) {
          continue;
        }
        if (!Util.isValidRef(source)) {
          files.push(source);
          continue;
        }
        if (remoteDef) {
          throw new Error(`Only one remote bake definition can be defined`);
        }
        remoteDef = source;
      }
    }
    if (remoteDef) {
      args.push(remoteDef);
    }
    for (const file of files) {
      args.push('--file', file);
    }
    if (cmdOpts.overrides) {
      for (const override of cmdOpts.overrides) {
        args.push('--set', override);
      }
    }
    if (cmdOpts.load) {
      args.push('--load');
    }
    if (cmdOpts.noCache) {
      args.push('--no-cache');
    }
    if (cmdOpts.provenance) {
      args.push('--provenance', cmdOpts.provenance);
    }
    if (cmdOpts.push) {
      args.push('--push');
    }
    if (cmdOpts.sbom) {
      args.push('--sbom', cmdOpts.sbom);
    }

    const printCmd = await this.buildx.getCommand([...args, '--print', ...(cmdOpts.targets || [])]);
    return await Exec.getExecOutput(printCmd.command, printCmd.args, execOptions).then(res => {
      if (res.stderr.length > 0 && res.exitCode != 0) {
        throw new Error(`cannot parse bake definitions: ${res.stderr.match(/(.*)\s*$/)?.[0]?.trim() ?? 'unknown error'}`);
      }
      return Bake.parseDefinition(res.stdout.trim());
    });
  }

  public static parseDefinition(dt: string): BakeDefinition {
    return <BakeDefinition>JSON.parse(dt);
  }

  public static hasLocalExporter(def: BakeDefinition): boolean {
    return Build.hasExporterType('local', Bake.exporters(def));
  }

  public static hasTarExporter(def: BakeDefinition): boolean {
    return Build.hasExporterType('tar', Bake.exporters(def));
  }

  public static hasDockerExporter(def: BakeDefinition, load?: boolean): boolean {
    return load || Build.hasExporterType('docker', Bake.exporters(def));
  }

  private static exporters(def: BakeDefinition): Array<string> {
    const exporters = new Array<string>();
    for (const key in def.target) {
      const target = def.target[key];
      if (target.output) {
        exporters.push(...target.output);
      }
    }
    return exporters;
  }
}
