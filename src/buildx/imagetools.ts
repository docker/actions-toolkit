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

import {Buildx} from './buildx';
import {Exec} from '../exec';

import {Manifest as ImageToolsManifest} from '../types/buildx/imagetools';
import {Image} from '../types/oci/config';
import {Descriptor} from '../types/oci/descriptor';
import {Digest} from '../types/oci/digest';

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

  public async attestationDescriptors(name: string): Promise<Array<Descriptor>> {
    const manifest = await this.inspectManifest(name);
    if (typeof manifest === 'object' && manifest !== null && 'manifests' in manifest && Array.isArray(manifest.manifests)) {
      return manifest.manifests.filter(m => m.annotations && m.annotations['vnd.docker.reference.type'] === 'attestation-manifest');
    }
    throw new Error(`No attestation descriptors found for ${name}`);
  }

  public async attestationDigests(name: string): Promise<Array<Digest>> {
    return (await this.attestationDescriptors(name)).map(attestation => attestation.digest);
  }
}
