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
import {parse} from 'csv-parse/sync';

import {Buildx} from './buildx';
import {Context} from '../context';
import {Exec} from '../exec';
import {Util} from '../util';

import {ExecOptions} from '@actions/exec';
import {AttestEntry, BakeDefinition, CacheEntry, ExportEntry, SecretEntry, SSHEntry} from '../types/buildx/bake';
import {BuildMetadata} from '../types/buildx/build';
import {VertexWarning} from '../types/buildkit/client';

export interface BakeOpts {
  buildx?: Buildx;
}

export interface BakeCmdOpts {
  allow?: Array<string>;
  call?: string;
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

  public resolveMetadata(): BuildMetadata | undefined {
    const metadataFile = this.getMetadataFilePath();
    if (!fs.existsSync(metadataFile)) {
      return undefined;
    }
    const content = fs.readFileSync(metadataFile, {encoding: 'utf-8'}).trim();
    if (content === 'null') {
      return undefined;
    }
    return <BuildMetadata>JSON.parse(content);
  }

  public resolveRefs(metadata?: BuildMetadata): Array<string> | undefined {
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
    return refs.length > 0 ? refs : undefined;
  }

  public resolveWarnings(metadata?: BuildMetadata): Array<VertexWarning> | undefined {
    if (!metadata) {
      metadata = this.resolveMetadata();
      if (!metadata) {
        return undefined;
      }
    }
    if ('buildx.build.warnings' in metadata) {
      return metadata['buildx.build.warnings'] as Array<VertexWarning>;
    }
    return undefined;
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
    if (cmdOpts.allow) {
      for (const allow of cmdOpts.allow) {
        args.push('--allow', allow);
      }
    }
    if (cmdOpts.call) {
      args.push('--call', cmdOpts.call);
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
    const definition = <BakeDefinition>JSON.parse(dt);

    // convert to composable attributes: https://github.com/docker/buildx/pull/2758
    for (const name in definition.target) {
      const target = definition.target[name];
      if (target['attest'] && Array.isArray(target['attest'])) {
        target['attest'] = target['attest'].map((item: string | AttestEntry): AttestEntry => {
          return Bake.parseAttestEntry(item);
        });
      }
      if (target['cache-from'] && Array.isArray(target['cache-from'])) {
        target['cache-from'] = target['cache-from'].map((item: string | CacheEntry): CacheEntry => {
          return Bake.parseCacheEntry(item);
        });
      }
      if (target['cache-to'] && Array.isArray(target['cache-to'])) {
        target['cache-to'] = target['cache-to'].map((item: string | CacheEntry): CacheEntry => {
          return Bake.parseCacheEntry(item);
        });
      }
      if (target['output'] && Array.isArray(target['output'])) {
        target['output'] = target['output'].map((item: string | ExportEntry): ExportEntry => {
          return Bake.parseExportEntry(item);
        });
      }
      if (target['secret'] && Array.isArray(target['secret'])) {
        target['secret'] = target['secret'].map((item: string | SecretEntry): SecretEntry => {
          return Bake.parseSecretEntry(item);
        });
      }
      if (target['ssh'] && Array.isArray(target['ssh'])) {
        target['ssh'] = target['ssh'].map((item: string | SSHEntry): SSHEntry => {
          return Bake.parseSSHEntry(item);
        });
      }
    }

    return definition;
  }

  private static parseAttestEntry(item: AttestEntry | string): AttestEntry {
    if (typeof item !== 'string') {
      return item;
    }

    const attestEntry: AttestEntry = {type: ''};
    const fields = parse(item, {
      relaxColumnCount: true,
      skipEmptyLines: true
    })[0];

    for (const field of fields) {
      const [key, value] = field
        .toString()
        .split(/(?<=^[^=]+?)=/)
        .map((item: string) => item.trim());
      switch (key) {
        case 'type':
          attestEntry.type = value;
          break;
        default:
          attestEntry[key] = value;
      }
    }

    return attestEntry;
  }

  private static parseCacheEntry(item: CacheEntry | string): CacheEntry {
    if (typeof item !== 'string') {
      return item;
    }

    const cacheEntry: CacheEntry = {type: ''};
    const fields = parse(item, {
      relaxColumnCount: true,
      skipEmptyLines: true
    })[0];

    if (fields.length === 1 && !fields[0].includes('=')) {
      cacheEntry.type = 'registry';
      cacheEntry.ref = fields[0];
      return cacheEntry;
    }

    for (const field of fields) {
      const [key, value] = field
        .toString()
        .split(/(?<=^[^=]+?)=/)
        .map((item: string) => item.trim());
      switch (key) {
        case 'type':
          cacheEntry.type = value;
          break;
        default:
          cacheEntry[key] = value;
      }
    }

    return cacheEntry;
  }

  private static parseExportEntry(item: ExportEntry | string): ExportEntry {
    if (typeof item !== 'string') {
      return item;
    }

    const exportEntry: ExportEntry = {type: ''};
    const fields = parse(item, {
      relaxColumnCount: true,
      skipEmptyLines: true
    })[0];

    if (fields.length === 1 && fields[0] === item && !item.startsWith('type=')) {
      if (item !== '-') {
        exportEntry.type = 'local';
        exportEntry.dest = item;
        return exportEntry;
      }
      exportEntry.type = 'tar';
      exportEntry.dest = item;
      return exportEntry;
    }

    for (const field of fields) {
      const [key, value] = field
        .toString()
        .split(/(?<=^[^=]+?)=/)
        .map((item: string) => item.trim());
      switch (key) {
        case 'type':
          exportEntry.type = value;
          break;
        default:
          exportEntry[key] = value;
      }
    }

    return exportEntry;
  }

  private static parseSecretEntry(item: SecretEntry | string): SecretEntry {
    if (typeof item !== 'string') {
      return item;
    }

    const secretEntry: SecretEntry = {};
    const fields = parse(item, {
      relaxColumnCount: true,
      skipEmptyLines: true
    })[0];

    let typ = '';
    for (const field of fields) {
      const [key, value] = field
        .toString()
        .split(/(?<=^[^=]+?)=/)
        .map((item: string) => item.trim());
      switch (key) {
        case 'type':
          typ = value;
          break;
        case 'id':
          secretEntry.id = value;
          break;
        case 'source':
        case 'src':
          secretEntry.src = value;
          break;
        case 'env':
          break;
      }
    }
    if (typ === 'env' && !secretEntry.env) {
      secretEntry.env = secretEntry.src;
      secretEntry.src = undefined;
    }
    return secretEntry;
  }

  private static parseSSHEntry(item: SSHEntry | string): SSHEntry {
    if (typeof item !== 'string') {
      return item;
    }

    const sshEntry: SSHEntry = {};
    const [key, value] = item.split('=', 2);
    sshEntry.id = key;
    if (value) {
      sshEntry.paths = value.split(',');
    }

    return sshEntry;
  }

  public static hasLocalExporter(def: BakeDefinition): boolean {
    return Bake.hasExporterType('local', Bake.exporters(def));
  }

  public static hasTarExporter(def: BakeDefinition): boolean {
    return Bake.hasExporterType('tar', Bake.exporters(def));
  }

  public static hasDockerExporter(def: BakeDefinition, load?: boolean): boolean {
    return load || Bake.hasExporterType('docker', Bake.exporters(def));
  }

  public static hasExporterType(name: string, exporters: Array<ExportEntry>): boolean {
    for (const exporter of exporters) {
      if (exporter.type == name) {
        return true;
      }
    }
    return false;
  }

  private static exporters(def: BakeDefinition): Array<ExportEntry> {
    const exporters = new Array<ExportEntry>();
    for (const key in def.target) {
      const target = def.target[key];
      if (target.output) {
        for (const output of target.output) {
          exporters.push(Bake.parseExportEntry(output));
        }
      }
    }
    return exporters;
  }
}
