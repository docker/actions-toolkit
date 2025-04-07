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
import * as core from '@actions/core';
import {parse} from 'csv-parse/sync';

import {Buildx} from './buildx';
import {Context} from '../context';
import {GitHub} from '../github';
import {Util} from '../util';

import {BuildMetadata} from '../types/buildx/build';
import {VertexWarning} from '../types/buildkit/client';
import {ProvenancePredicate} from '../types/intoto/slsa_provenance/v0.2/provenance';

export interface BuildOpts {
  buildx?: Buildx;
}

export interface ResolveSecretsOpts {
  asFile?: boolean;
  redact?: boolean;
}

export class Build {
  private readonly buildx: Buildx;
  private readonly iidFilename: string;
  private readonly metadataFilename: string;

  constructor(opts?: BuildOpts) {
    this.buildx = opts?.buildx || new Buildx();
    this.iidFilename = `build-iidfile-${Util.generateRandomString()}.txt`;
    this.metadataFilename = `build-metadata-${Util.generateRandomString()}.json`;
  }

  public getImageIDFilePath(): string {
    return path.join(Context.tmpDir(), this.iidFilename);
  }

  public resolveImageID(): string | undefined {
    const iidFile = this.getImageIDFilePath();
    if (!fs.existsSync(iidFile)) {
      return undefined;
    }
    return fs.readFileSync(iidFile, {encoding: 'utf-8'}).trim();
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

  public resolveRef(metadata?: BuildMetadata): string | undefined {
    if (!metadata) {
      metadata = this.resolveMetadata();
      if (!metadata) {
        return undefined;
      }
    }
    if ('buildx.build.ref' in metadata) {
      return metadata['buildx.build.ref'];
    }
    return undefined;
  }

  public resolveProvenance(metadata?: BuildMetadata): ProvenancePredicate | undefined {
    if (!metadata) {
      metadata = this.resolveMetadata();
      if (!metadata) {
        return undefined;
      }
    }
    if ('buildx.build.provenance' in metadata) {
      return metadata['buildx.build.provenance'] as ProvenancePredicate;
    }
    return undefined;
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

  public resolveDigest(metadata?: BuildMetadata): string | undefined {
    if (!metadata) {
      metadata = this.resolveMetadata();
      if (!metadata) {
        return undefined;
      }
    }
    if ('containerimage.digest' in metadata) {
      return metadata['containerimage.digest'];
    }
    return undefined;
  }

  public static resolveSecretString(kvp: string): string {
    const [key, file] = Build.resolveSecret(kvp, {
      redact: true
    });
    return `id=${key},src=${file}`;
  }

  public static resolveSecretFile(kvp: string): string {
    const [key, file] = Build.resolveSecret(kvp, {
      asFile: true
    });
    return `id=${key},src=${file}`;
  }

  public static resolveSecretEnv(kvp: string): string {
    const [key, value] = Build.parseSecretKvp(kvp);
    return `id=${key},env=${value}`;
  }

  public static resolveSecret(kvp: string, opts?: ResolveSecretsOpts): [string, string] {
    const [key, value] = Build.parseSecretKvp(kvp, opts?.redact);
    const secretFile = Context.tmpName({tmpdir: Context.tmpDir()});
    if (opts?.asFile) {
      if (!fs.existsSync(value)) {
        throw new Error(`secret file ${value} not found`);
      }
      fs.copyFileSync(value, secretFile);
    } else {
      fs.writeFileSync(secretFile, value);
    }
    return [key, secretFile];
  }

  public static getProvenanceInput(name: string): string {
    const input = core.getInput(name);
    if (!input) {
      // if input is not set returns empty string
      return input;
    }
    try {
      return core.getBooleanInput(name) ? `builder-id=${GitHub.workflowRunURL(true)}` : 'false';
    } catch (err) {
      // not a valid boolean, so we assume it's a string
      return Build.resolveProvenanceAttrs(input);
    }
  }

  public static resolveProvenanceAttrs(input: string): string {
    if (!input) {
      return `builder-id=${GitHub.workflowRunURL(true)}`;
    }
    // parse attributes from input
    const fields = parse(input, {
      relaxColumnCount: true,
      skipEmptyLines: true
    })[0];
    // check if builder-id attribute exists in the input
    for (const field of fields) {
      const parts = field
        .toString()
        .split(/(?<=^[^=]+?)=/)
        .map(item => item.trim());
      if (parts[0] == 'builder-id') {
        return input;
      }
    }
    // if not add builder-id attribute
    return `${input},builder-id=${GitHub.workflowRunURL(true)}`;
  }

  public static resolveCacheToAttrs(input: string, githubToken?: string): string {
    if (!input) {
      return input;
    }

    let cacheType = 'registry';
    let ghaCacheRepository = '';
    let ghaCacheGHToken = '';

    const fields = parse(input, {
      relaxColumnCount: true,
      skipEmptyLines: true
    })[0];
    for (const field of fields) {
      const parts = field
        .toString()
        .split(/(?<=^[^=]+?)=/)
        .map(item => item.trim());
      if (parts[0] === 'type') {
        cacheType = parts[1];
      } else if (parts[0] === 'repository') {
        ghaCacheRepository = parts[1];
      } else if (parts[0] === 'ghtoken') {
        ghaCacheGHToken = parts[1];
      }
    }

    if (cacheType === 'gha') {
      if (!ghaCacheRepository) {
        input = `${input},repository=${GitHub.repository}`;
      }
      if (!ghaCacheGHToken && githubToken) {
        input = `${input},ghtoken=${githubToken}`;
      }
    }

    return input;
  }

  public static hasLocalExporter(exporters: string[]): boolean {
    return Build.hasExporterType('local', exporters);
  }

  public static hasTarExporter(exporters: string[]): boolean {
    return Build.hasExporterType('tar', exporters);
  }

  public static hasDockerExporter(exporters: string[], load?: boolean): boolean {
    return load || Build.hasExporterType('docker', exporters);
  }

  public static hasExporterType(name: string, exporters: string[]): boolean {
    const records = parse(exporters.join(`\n`), {
      delimiter: ',',
      trim: true,
      columns: false,
      relaxColumnCount: true
    });
    for (const record of records) {
      if (record.length == 1 && !record[0].startsWith('type=')) {
        // Local if no type is defined
        // https://github.com/docker/buildx/blob/d2bf42f8b4784d83fde17acb3ed84703ddc2156b/build/output.go#L29-L43
        return name == 'local';
      }
      for (const [key, value] of record.map(chunk => chunk.split('=').map(item => item.trim()))) {
        if (key == 'type' && value == name) {
          return true;
        }
      }
    }
    return false;
  }

  public static hasAttestationType(name: string, attrs: string): boolean {
    const records = parse(attrs, {
      delimiter: ',',
      trim: true,
      columns: false,
      relaxColumnCount: true
    });
    for (const record of records) {
      for (const [key, value] of record.map((chunk: string) => chunk.split('=').map(item => item.trim()))) {
        if (key == 'type' && value == name) {
          return true;
        }
      }
    }
    return false;
  }

  public static resolveAttestationAttrs(attrs: string): string {
    const records = parse(attrs, {
      delimiter: ',',
      trim: true,
      columns: false,
      relaxColumnCount: true
    });
    const res: Array<string> = [];
    for (const record of records) {
      for (const attr of record) {
        try {
          // https://github.com/docker/buildx/blob/8abef5908705e49f7ba88ef8c957e1127b597a2a/util/buildflags/attests.go#L13-L21
          const v = Util.parseBool(attr);
          res.push(`disabled=${!v}`);
        } catch (err) {
          res.push(attr);
        }
      }
    }
    return res.join(',');
  }

  public static hasGitAuthTokenSecret(secrets: string[]): boolean {
    for (const secret of secrets) {
      if (secret.startsWith('GIT_AUTH_TOKEN=')) {
        return true;
      }
    }
    return false;
  }

  public static parseSecretKvp(kvp: string, redact?: boolean): [string, string] {
    const delimiterIndex = kvp.indexOf('=');
    const key = kvp.substring(0, delimiterIndex);
    const value = kvp.substring(delimiterIndex + 1);
    if (key.length == 0 || value.length == 0) {
      throw new Error(`${kvp} is not a valid secret`);
    }
    if (redact) {
      core.setSecret(value);
    }
    return [key, value];
  }
}
