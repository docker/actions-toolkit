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
import gunzip from 'gunzip-maybe';
import * as path from 'path';
import {Readable} from 'stream';
import * as tar from 'tar-stream';

import {Archive, LoadArchiveOpts} from '../types/oci/oci';
import {Index} from '../types/oci';
import {Manifest} from '../types/oci/manifest';
import {Image} from '../types/oci/config';
import {IMAGE_BLOBS_DIR_V1, IMAGE_INDEX_FILE_V1, IMAGE_LAYOUT_FILE_V1, ImageLayout} from '../types/oci/layout';
import {MEDIATYPE_IMAGE_INDEX_V1, MEDIATYPE_IMAGE_MANIFEST_V1} from '../types/oci/mediatype';

export class OCI {
  public static loadArchive(opts: LoadArchiveOpts): Promise<Archive> {
    return new Promise<Archive>((resolve, reject) => {
      const tarex: tar.Extract = tar.extract();

      let rootIndex: Index;
      let rootLayout: ImageLayout;
      const indexes: Record<string, Index> = {};
      const manifests: Record<string, Manifest> = {};
      const images: Record<string, Image> = {};
      const blobs: Record<string, unknown> = {};

      tarex.on('entry', async (header, stream, next) => {
        if (header.type === 'file') {
          const filename = path.normalize(header.name);
          if (filename === IMAGE_INDEX_FILE_V1) {
            rootIndex = await OCI.streamToJson<Index>(stream);
          } else if (filename === IMAGE_LAYOUT_FILE_V1) {
            rootLayout = await OCI.streamToJson<ImageLayout>(stream);
          } else if (filename.startsWith(path.join(IMAGE_BLOBS_DIR_V1, path.sep))) {
            const blob = await OCI.extractBlob(stream);
            const digest = `${filename.split(path.sep)[1]}:${filename.split(path.sep)[filename.split(path.sep).length - 1]}`;
            if (OCI.isIndex(blob)) {
              indexes[digest] = <Index>JSON.parse(blob);
            } else if (OCI.isManifest(blob)) {
              manifests[digest] = <Manifest>JSON.parse(blob);
            } else if (OCI.isImage(blob)) {
              images[digest] = <Image>JSON.parse(blob);
            } else {
              blobs[digest] = blob;
            }
          } else {
            reject(new Error(`Invalid OCI archive: unexpected file ${filename}`));
          }
        }
        stream.resume();
        next();
      });

      tarex.on('finish', () => {
        if (!rootIndex || !rootLayout) {
          reject(new Error('Invalid OCI archive: missing index or layout'));
        }
        resolve({
          root: {
            index: rootIndex,
            layout: rootLayout
          },
          indexes: indexes,
          manifests: manifests,
          images: images,
          blobs: blobs
        } as Archive);
      });

      tarex.on('error', error => {
        reject(error);
      });

      fs.createReadStream(opts.file).pipe(gunzip()).pipe(tarex);
    });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private static isIndex(blob: any): boolean {
    try {
      const index = <Index>JSON.parse(blob);
      return index.mediaType === MEDIATYPE_IMAGE_INDEX_V1;
    } catch {
      return false;
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private static isManifest(blob: any): boolean {
    try {
      const manifest = <Manifest>JSON.parse(blob);
      return manifest.mediaType === MEDIATYPE_IMAGE_MANIFEST_V1 && manifest.layers.length > 0;
    } catch {
      return false;
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private static isImage(blob: any): boolean {
    try {
      const image = <Image>JSON.parse(blob);
      return image.rootfs.type !== '';
    } catch {
      return false;
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private static extractBlob(stream: Readable): Promise<any> {
    return new Promise<unknown>((resolve, reject) => {
      const chunks: Buffer[] = [];
      const dstream = stream.pipe(gunzip());
      dstream.on('data', chunk => {
        chunks.push(chunk);
      });
      dstream.on('end', () => {
        resolve(Buffer.concat(chunks).toString('utf8'));
      });
      dstream.on('error', async error => {
        reject(error);
      });
    });
  }

  private static async streamToJson<T>(stream: Readable): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const chunks: string[] = [];
      let bytes = 0;
      stream.on('data', chunk => {
        bytes += chunk.length;
        if (bytes <= 2 * 1024 * 1024) {
          chunks.push(chunk.toString('utf8'));
        } else {
          reject(new Error('The data stream exceeds the size limit for JSON parsing.'));
        }
      });
      stream.on('end', () => {
        try {
          resolve(JSON.parse(chunks.join('')));
        } catch (error) {
          reject(error);
        }
      });
      stream.on('error', async error => {
        reject(error);
      });
    });
  }
}
