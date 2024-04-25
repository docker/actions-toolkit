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

import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import {CreateArtifactRequest, FinalizeArtifactRequest, StringValue} from '@actions/artifact/lib/generated';
import {internalArtifactTwirpClient} from '@actions/artifact/lib/internal/shared/artifact-twirp-client';
import {getBackendIdsFromToken} from '@actions/artifact/lib/internal/shared/util';
import {getExpiration} from '@actions/artifact/lib/internal/upload/retention';
import {InvalidResponseError, NetworkError} from '@actions/artifact';
import * as core from '@actions/core';
import * as github from '@actions/github';
import {GitHub as Octokit} from '@actions/github/lib/utils';
import {Context} from '@actions/github/lib/context';
import {TransferProgressEvent} from '@azure/core-http';
import {BlobClient, BlobHTTPHeaders} from '@azure/storage-blob';
import {jwtDecode, JwtPayload} from 'jwt-decode';

import {GitHubActionsRuntimeToken, GitHubActionsRuntimeTokenAC, GitHubRepo, UploadArtifactOpts, UploadArtifactResponse} from './types/github';

export interface GitHubOpts {
  token?: string;
}

export class GitHub {
  public readonly octokit: InstanceType<typeof Octokit>;

  constructor(opts?: GitHubOpts) {
    this.octokit = github.getOctokit(`${opts?.token}`);
  }

  public repoData(): Promise<GitHubRepo> {
    return this.octokit.rest.repos.get({...github.context.repo}).then(response => response.data as GitHubRepo);
  }

  static get context(): Context {
    return github.context;
  }

  static get serverURL(): string {
    return process.env.GITHUB_SERVER_URL || 'https://github.com';
  }

  static get apiURL(): string {
    return process.env.GITHUB_API_URL || 'https://api.github.com';
  }

  static get workflowRunURL(): string {
    return `${GitHub.serverURL}/${github.context.repo.owner}/${github.context.repo.repo}/actions/runs/${github.context.runId}`;
  }

  static get actionsRuntimeToken(): GitHubActionsRuntimeToken | undefined {
    const token = process.env['ACTIONS_RUNTIME_TOKEN'] || '';
    return token ? (jwtDecode<JwtPayload>(token) as GitHubActionsRuntimeToken) : undefined;
  }

  public static async printActionsRuntimeTokenACs() {
    let jwt: GitHubActionsRuntimeToken | undefined;
    try {
      jwt = GitHub.actionsRuntimeToken;
    } catch (e) {
      throw new Error(`Cannot parse GitHub Actions Runtime Token: ${e.message}`);
    }
    if (!jwt) {
      throw new Error(`ACTIONS_RUNTIME_TOKEN not set`);
    }
    try {
      <Array<GitHubActionsRuntimeTokenAC>>JSON.parse(`${jwt.ac}`).forEach(ac => {
        let permission: string;
        switch (ac.Permission) {
          case 1:
            permission = 'read';
            break;
          case 2:
            permission = 'write';
            break;
          case 3:
            permission = 'read/write';
            break;
          default:
            permission = `unimplemented (${ac.Permission})`;
        }
        core.info(`${ac.Scope}: ${permission}`);
      });
    } catch (e) {
      throw new Error(`Cannot parse GitHub Actions Runtime Token ACs: ${e.message}`);
    }
  }

  public static async uploadArtifact(opts: UploadArtifactOpts): Promise<UploadArtifactResponse> {
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

    const artifactURL = `${GitHub.workflowRunURL}/artifacts/${artifactId}`;
    core.info(`Artifact download URL: ${artifactURL}`);

    return {
      id: Number(artifactId),
      filename: artifactName,
      size: uploadByteCount,
      url: artifactURL
    };
  }
}
