/**
 * Copyright 2026 actions-toolkit authors
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

import {stringify} from 'csv-stringify/sync';

export interface BuildOutputOpts {
  output: string;
  images?: Array<string>;
  push?: boolean;
  localExportDir?: string;
  compression?: 'uncompressed' | 'gzip' | 'estargz' | 'zstd';
  compressionLevel?: number;
  forceCompression?: boolean;
}

export class BuildOutput {
  /**
   * Constructs the github-builder exporter for Buildx build or Bake.
   * Bake callers prefix the result with "*.output=". Compression options only
   * apply to image output; omitted options retain BuildKit's defaults.
   * BuildKit validates compression levels for the selected algorithm.
   */
  public static resolve(opts: BuildOutputOpts): string {
    let fields: Array<string>;
    switch (opts.output) {
      case 'image':
        if (!opts.images?.length) {
          throw new Error('meta-images is required when output is image');
        }
        fields = ['type=image', `name=${opts.images.join(',')}`, 'oci-artifact=true', 'push-by-digest=true', 'name-canonical=true', `push=${opts.push ?? false}`];
        if (opts.compression) {
          fields.push(`compression=${opts.compression}`);
        }
        if (opts.compressionLevel !== undefined) {
          fields.push(`compression-level=${opts.compressionLevel}`);
        }
        if (opts.forceCompression !== undefined) {
          fields.push(`force-compression=${opts.forceCompression}`);
        }
        break;
      case 'local':
        if (!opts.localExportDir) {
          throw new Error('localExportDir is required when output is local');
        }
        fields = ['type=local', 'platform-split=true', `dest=${opts.localExportDir}`];
        break;
      default:
        throw new Error(`Invalid output: ${opts.output}`);
    }
    return stringify([fields], {eof: false});
  }
}
