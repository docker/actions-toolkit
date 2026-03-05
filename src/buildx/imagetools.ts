/**
 * Copyright 2025 actions-toolkit authors
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
import {Buildx} from './buildx.js';
import {Context} from '../context.js';
import {Exec} from '../exec.js';

import {CreateOpts, CreateResponse, CreateResult, Manifest as ImageToolsManifest} from '../types/buildx/imagetools.js';
import {Image} from '../types/oci/config.js';
import {Descriptor, Platform} from '../types/oci/descriptor.js';
import {Digest} from '../types/oci/digest.js';

export interface ImageToolsOpts {
  buildx?: Buildx;
}

export class ImageTools {
  private readonly buildx: Buildx;

  constructor(opts?: ImageToolsOpts) {
    this.buildx = opts?.buildx || new Buildx();
  }

  public async getCommand(args: Array<string>) {
    return await this.buildx.getCommand(['imagetools', ...args]);
  }

  public async getInspectCommand(args: Array<string>) {
    return await this.getCommand(['inspect', ...args]);
  }

  public async getCreateCommand(args: Array<string>) {
    return await this.getCommand(['create', ...args]);
  }

  public async inspectImage(name: string): Promise<Record<string, Image> | Image> {
    const cmd = await this.getInspectCommand([name, '--format', '{{json .Image}}']);
    return await Exec.getExecOutput(cmd.command, cmd.args, {
      ignoreReturnCode: true,
      silent: true
    }).then(res => {
      if (res.stderr.length > 0 && res.exitCode != 0) {
        throw new Error(res.stderr.trim());
      }
      const parsedOutput = JSON.parse(res.stdout);
      if (typeof parsedOutput === 'object' && !Array.isArray(parsedOutput) && parsedOutput !== null) {
        if (Object.prototype.hasOwnProperty.call(parsedOutput, 'config')) {
          return <Image>parsedOutput;
        } else {
          return <Record<string, Image>>parsedOutput;
        }
      }
      throw new Error('Unexpected output format');
    });
  }

  public async inspectManifest(name: string): Promise<ImageToolsManifest | Descriptor> {
    const cmd = await this.getInspectCommand([name, '--format', '{{json .Manifest}}']);
    return await Exec.getExecOutput(cmd.command, cmd.args, {
      ignoreReturnCode: true,
      silent: true
    }).then(res => {
      if (res.stderr.length > 0 && res.exitCode != 0) {
        throw new Error(res.stderr.trim());
      }
      const parsedOutput = JSON.parse(res.stdout);
      if (typeof parsedOutput === 'object' && !Array.isArray(parsedOutput) && parsedOutput !== null) {
        if (Object.prototype.hasOwnProperty.call(parsedOutput, 'manifests')) {
          return <ImageToolsManifest>parsedOutput;
        } else {
          return <Descriptor>parsedOutput;
        }
      }
      throw new Error('Unexpected output format');
    });
  }

  public async attestationDescriptors(name: string, platform?: Platform): Promise<Array<Descriptor>> {
    const manifest = await this.inspectManifest(name);

    if (typeof manifest !== 'object' || manifest === null || !('manifests' in manifest) || !Array.isArray(manifest.manifests)) {
      throw new Error(`No descriptor found for ${name}`);
    }

    const attestations = manifest.manifests.filter(m => m.annotations?.['vnd.docker.reference.type'] === 'attestation-manifest');
    if (!platform) {
      return attestations;
    }

    const manifestByDigest = new Map<string, Descriptor>();
    for (const m of manifest.manifests) {
      if (m.digest) {
        manifestByDigest.set(m.digest, m);
      }
    }

    return attestations.filter(attestation => {
      const refDigest = attestation.annotations?.['vnd.docker.reference.digest'];
      if (!refDigest) {
        return false;
      }
      const referencedManifest = manifestByDigest.get(refDigest);
      if (!referencedManifest) {
        return false;
      }
      return referencedManifest.platform?.os === platform.os && referencedManifest.platform?.architecture === platform.architecture && (referencedManifest.platform?.variant ?? '') === (platform.variant ?? '');
    });
  }

  public async attestationDigests(name: string, platform?: Platform): Promise<Array<Digest>> {
    return (await this.attestationDescriptors(name, platform)).map(attestation => attestation.digest);
  }

  public async create(opts: CreateOpts): Promise<CreateResult | undefined> {
    const args: Array<string> = [];

    const metadataFile = Context.tmpName({tmpdir: Context.tmpDir(), template: 'imagetools-metadata-XXXXXX'});
    const fileSources: Array<string> = [];
    const sources: Array<string> = [];
    for (const source of opts.sources) {
      if (source.startsWith('cwd://')) {
        const fileSource = source.substring('cwd://'.length);
        if (fileSource.length > 0) {
          fileSources.push(fileSource);
        }
        continue;
      }
      sources.push(source);
    }
    if (opts.tags) {
      for (const tag of opts.tags) {
        args.push('--tag', tag);
      }
    }
    if (opts.platforms) {
      for (const platform of opts.platforms) {
        args.push('--platform', platform);
      }
    }
    if (opts.dryRun) {
      args.push('--dry-run');
    } else {
      args.push('--metadata-file', metadataFile);
    }
    for (const fileSource of fileSources) {
      args.push('--file', fileSource);
    }
    for (const source of sources) {
      args.push(source);
    }

    const cmd = await this.getCreateCommand(args);
    return await Exec.getExecOutput(cmd.command, cmd.args, {
      ignoreReturnCode: true,
      silent: true
    }).then(res => {
      if (res.stderr.length > 0 && res.exitCode != 0) {
        throw new Error(res.stderr.trim());
      }
      if (!opts.dryRun) {
        if (!fs.existsSync(metadataFile)) {
          return undefined;
        }
        const dt = fs.readFileSync(metadataFile, {encoding: 'utf-8'}).trim();
        if (dt === '' || dt === 'null') {
          return undefined;
        }
        const response = <CreateResponse>JSON.parse(dt);
        const descriptor = response['containerimage.descriptor'];
        if (!descriptor) {
          return undefined;
        }
        return {
          digest: response['containerimage.digest'] || descriptor.digest,
          descriptor: descriptor,
          imageNames: response['image.name'] ? response['image.name'].split(',').map(name => name.trim()) : []
        };
      }
    });
  }
}
