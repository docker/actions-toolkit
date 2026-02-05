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

import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import {CreateArtifactRequest, FinalizeArtifactRequest, StringValue} from '@actions/artifact/lib/generated';
import {internalArtifactTwirpClient} from '@actions/artifact/lib/internal/shared/artifact-twirp-client';
import {getBackendIdsFromToken} from '@actions/artifact/lib/internal/shared/util';
import {getExpiration} from '@actions/artifact/lib/internal/upload/retention';
import {InvalidResponseError, NetworkError} from '@actions/artifact';
import * as core from '@actions/core';
import {TransferProgressEvent} from '@azure/core-rest-pipeline';
import {BlobClient, BlobHTTPHeaders} from '@azure/storage-blob';

import {UploadOpts, UploadResponse} from '../types/github/artifact.js';
import {GitHub} from './github';

export class GitHubArtifact {
  public static async upload(opts: UploadOpts): Promise<UploadResponse> {
    if (GitHub.isGHES) {
      throw new Error('@actions/artifact v2.0.0+ is currently not supported on GHES.');
    }

    const artifactName = path.basename(opts.filename);
    const backendIds = getBackendIdsFromToken();
    const artifactClient = internalArtifactTwirpClient();

    core.info(`Uploading ${artifactName} to blob storage`);

    const createArtifactReq: CreateArtifactRequest = {
      workflowRunBackendId: backendIds.workflowRunBackendId,
      workflowJobRunBackendId: backendIds.workflowJobRunBackendId,
      name: artifactName,
      version: 4
    };

    const expiresAt = getExpiration(opts?.retentionDays);
    if (expiresAt) {
      createArtifactReq.expiresAt = expiresAt;
    }

    const createArtifactResp = await artifactClient.CreateArtifact(createArtifactReq);
    if (!createArtifactResp.ok) {
      throw new InvalidResponseError('cannot create artifact client');
    }

    let uploadByteCount = 0;
    const blobClient = new BlobClient(createArtifactResp.signedUploadUrl);
    const blockBlobClient = blobClient.getBlockBlobClient();

    const headers: BlobHTTPHeaders = {
      blobContentDisposition: `attachment; filename="${artifactName}"`
    };
    if (opts.mimeType) {
      headers.blobContentType = opts.mimeType;
    }
    core.debug(`Upload headers: ${JSON.stringify(headers)}`);

    try {
      core.info('Beginning upload of artifact content to blob storage');
      await blockBlobClient.uploadFile(opts.filename, {
        blobHTTPHeaders: headers,
        onProgress: (progress: TransferProgressEvent): void => {
          core.info(`Uploaded bytes ${progress.loadedBytes}`);
          uploadByteCount = progress.loadedBytes;
        }
      });
    } catch (error) {
      if (NetworkError.isNetworkErrorCode(error?.code)) {
        throw new NetworkError(error?.code);
      }
      throw error;
    }

    core.info('Finished uploading artifact content to blob storage!');

    const sha256Hash = crypto.createHash('sha256').update(fs.readFileSync(opts.filename)).digest('hex');
    core.info(`SHA256 hash of uploaded artifact is ${sha256Hash}`);

    const finalizeArtifactReq: FinalizeArtifactRequest = {
      workflowRunBackendId: backendIds.workflowRunBackendId,
      workflowJobRunBackendId: backendIds.workflowJobRunBackendId,
      name: artifactName,
      size: uploadByteCount ? uploadByteCount.toString() : '0'
    };

    if (sha256Hash) {
      finalizeArtifactReq.hash = StringValue.create({
        value: `sha256:${sha256Hash}`
      });
    }

    core.info(`Finalizing artifact upload`);
    const finalizeArtifactResp = await artifactClient.FinalizeArtifact(finalizeArtifactReq);
    if (!finalizeArtifactResp.ok) {
      throw new InvalidResponseError('Cannot finalize artifact upload');
    }

    const artifactId = BigInt(finalizeArtifactResp.artifactId);
    core.info(`Artifact successfully finalized (${artifactId})`);

    const artifactURL = `${GitHub.workflowRunURL()}/artifacts/${artifactId}`;
    core.info(`Artifact download URL: ${artifactURL}`);

    return {
      id: Number(artifactId),
      filename: artifactName,
      size: uploadByteCount,
      url: artifactURL
    };
  }
}
