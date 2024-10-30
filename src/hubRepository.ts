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

import * as httpm from '@actions/http-client';
import {Index} from './types/oci';
import os from 'os';
import * as core from '@actions/core';
import {Manifest} from './types/oci/manifest';
import * as tc from '@actions/tool-cache';
import fs from 'fs';
import {MEDIATYPE_IMAGE_CONFIG_V1, MEDIATYPE_IMAGE_INDEX_V1, MEDIATYPE_IMAGE_MANIFEST_V1} from './types/oci/mediatype';
import {MEDIATYPE_IMAGE_CONFIG_V1 as DOCKER_MEDIATYPE_IMAGE_CONFIG_V1, MEDIATYPE_IMAGE_MANIFEST_LIST_V2, MEDIATYPE_IMAGE_MANIFEST_V2} from './types/docker/mediatype';
import {DockerHub} from './dockerhub';

export class HubRepository {
  private repo: string;
  private token: string;
  private static readonly http: httpm.HttpClient = new httpm.HttpClient('setup-docker-action');

  private constructor(repository: string, token: string) {
    this.repo = repository;
    this.token = token;
  }

  public static async build(repository: string): Promise<HubRepository> {
    const token = await this.getToken(repository);
    return new HubRepository(repository, token);
  }

  public async getPlatformManifest(tagOrDigest: string, os?: string): Promise<Manifest> {
    const index = await this.getManifest<Index>(tagOrDigest);
    if (index.mediaType != MEDIATYPE_IMAGE_INDEX_V1 && index.mediaType != MEDIATYPE_IMAGE_MANIFEST_LIST_V2) {
      core.error(`Unsupported image media type: ${index.mediaType}`);
      throw new Error(`Unsupported image media type: ${index.mediaType}`);
    }
    const digest = HubRepository.getPlatformManifestDigest(index, os);
    return await this.getManifest<Manifest>(digest);
  }

  // Unpacks the image layers and returns the path to the extracted image.
  // Only OCI indexes/manifest list are supported for now.
  public async extractImage(tag: string, destDir?: string): Promise<string> {
    const manifest = await this.getPlatformManifest(tag);

    const paths = manifest.layers.map(async layer => {
      const url = this.blobUrl(layer.digest);

      return await tc.downloadTool(url, undefined, undefined, {
        authorization: `Bearer ${this.token}`
      });
    });

    let files = await Promise.all(paths);
    let extractFolder: string;
    if (!destDir) {
      extractFolder = await tc.extractTar(files[0]);
      files = files.slice(1);
    } else {
      extractFolder = destDir;
    }

    await Promise.all(
      files.map(async file => {
        return await tc.extractTar(file, extractFolder);
      })
    );

    fs.readdirSync(extractFolder).forEach(file => {
      core.info(`extractImage(${this.repo}:${tag}) file: ${file}`);
    });

    return extractFolder;
  }

  private static async getToken(repo: string): Promise<string> {
    const url = `https://auth.docker.io/token?service=registry.docker.io&scope=repository:${repo}:pull`;

    const resp = await this.http.get(url);
    const body = await resp.readBody();
    const statusCode = resp.message.statusCode || 500;
    if (statusCode != 200) {
      throw DockerHub.parseError(resp, body);
    }

    const json = JSON.parse(body);
    return json.token;
  }

  private blobUrl(digest: string): string {
    return `https://registry-1.docker.io/v2/${this.repo}/blobs/${digest}`;
  }

  public async getManifest<T>(tagOrDigest: string): Promise<T> {
    return await this.registryGet<T>(tagOrDigest, 'manifests', [MEDIATYPE_IMAGE_INDEX_V1, MEDIATYPE_IMAGE_MANIFEST_LIST_V2, MEDIATYPE_IMAGE_MANIFEST_V1, MEDIATYPE_IMAGE_MANIFEST_V2]);
  }

  public async getJSONBlob<T>(tagOrDigest: string): Promise<T> {
    return await this.registryGet<T>(tagOrDigest, 'blobs', [MEDIATYPE_IMAGE_CONFIG_V1, DOCKER_MEDIATYPE_IMAGE_CONFIG_V1]);
  }

  private async registryGet<T>(tagOrDigest: string, endpoint: 'manifests' | 'blobs', accept: Array<string>): Promise<T> {
    const url = `https://registry-1.docker.io/v2/${this.repo}/${endpoint}/${tagOrDigest}`;

    const headers = {
      Authorization: `Bearer ${this.token}`,
      Accept: accept.join(', ')
    };

    const resp = await HubRepository.http.get(url, headers);
    const body = await resp.readBody();
    const statusCode = resp.message.statusCode || 500;
    if (statusCode != 200) {
      core.error(`registryGet(${this.repo}:${tagOrDigest}) failed: ${statusCode} ${body}`);
      throw DockerHub.parseError(resp, body);
    }

    return <T>JSON.parse(body);
  }

  private static getPlatformManifestDigest(index: Index, osOverride?: string): string {
    // This doesn't handle all possible platforms normalizations, but it's good enough for now.
    let pos: string = osOverride || os.platform();
    if (pos == 'win32') {
      pos = 'windows';
    }
    let arch = os.arch();
    if (arch == 'x64') {
      arch = 'amd64';
    }
    let variant = '';
    if (arch == 'arm') {
      variant = 'v7';
    }

    const manifest = index.manifests.find(m => {
      if (!m.platform) {
        return false;
      }
      if (m.platform.os != pos) {
        core.debug(`Skipping manifest ${m.digest} because of os: ${m.platform.os} != ${pos}`);
        return false;
      }
      if (m.platform.architecture != arch) {
        core.debug(`Skipping manifest ${m.digest} because of arch: ${m.platform.architecture} != ${arch}`);
        return false;
      }
      if ((m.platform.variant || '') != variant) {
        core.debug(`Skipping manifest ${m.digest} because of variant: ${m.platform.variant} != ${variant}`);
        return false;
      }

      return true;
    });
    if (!manifest) {
      core.error(`Cannot find manifest for ${pos}/${arch}/${variant}`);
      throw new Error(`Cannot find manifest for ${pos}/${arch}/${variant}`);
    }

    return manifest.digest;
  }
}
