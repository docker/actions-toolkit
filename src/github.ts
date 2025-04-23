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
import he from 'he';
import jsyaml from 'js-yaml';
import os from 'os';
import path from 'path';
import {CreateArtifactRequest, FinalizeArtifactRequest, StringValue} from '@actions/artifact/lib/generated';
import {internalArtifactTwirpClient} from '@actions/artifact/lib/internal/shared/artifact-twirp-client';
import {isGhes} from '@actions/artifact/lib/internal/shared/config';
import {getBackendIdsFromToken} from '@actions/artifact/lib/internal/shared/util';
import {getExpiration} from '@actions/artifact/lib/internal/upload/retention';
import {InvalidResponseError, NetworkError} from '@actions/artifact';
import * as core from '@actions/core';
import {SummaryTableCell} from '@actions/core/lib/summary';
import * as github from '@actions/github';
import {GitHub as Octokit} from '@actions/github/lib/utils';
import {Context} from '@actions/github/lib/context';
import {TransferProgressEvent} from '@azure/core-http';
import {BlobClient, BlobHTTPHeaders} from '@azure/storage-blob';
import {jwtDecode, JwtPayload} from 'jwt-decode';

import {Util} from './util';

import {BuildSummaryOpts, GitHubActionsRuntimeToken, GitHubActionsRuntimeTokenAC, GitHubRepo, UploadArtifactOpts, UploadArtifactResponse} from './types/github';

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

  static get isGHES(): boolean {
    // FIXME: we are using the function from GitHub artifact module but should
    //  be within core module when available.
    return isGhes();
  }

  static get repository(): string {
    return `${github.context.repo.owner}/${github.context.repo.repo}`;
  }

  static get workspace(): string {
    return process.env.GITHUB_WORKSPACE || process.cwd();
  }

  static get runId(): number {
    return process.env.GITHUB_RUN_ID ? +process.env.GITHUB_RUN_ID : github.context.runId;
  }

  static get runAttempt(): number {
    // TODO: runAttempt is not yet part of github.context but will be in a
    //  future release of @actions/github package: https://github.com/actions/toolkit/commit/faa425440f86f9c16587a19dfb59491253a2c92a
    return process.env.GITHUB_RUN_ATTEMPT ? +process.env.GITHUB_RUN_ATTEMPT : 1;
  }

  public static workflowRunURL(setAttempts?: boolean): string {
    return `${GitHub.serverURL}/${GitHub.repository}/actions/runs/${GitHub.runId}${setAttempts ? `/attempts/${GitHub.runAttempt}` : ''}`;
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

  public static async writeBuildSummary(opts: BuildSummaryOpts): Promise<void> {
    // can't use original core.summary.addLink due to the need to make
    // EOL optional
    const addLink = function (text: string, url: string, addEOL = false): string {
      return `<a href="${url}">${text}</a>` + (addEOL ? os.EOL : '');
    };

    const refsSize = Object.keys(opts.exportRes.refs).length;

    const sum = core.summary.addHeading('Docker Build summary', 2);

    if (opts.uploadRes) {
      // we just need the last two parts of the URL as they are always relative
      // to the workflow run URL otherwise URL could be broken if GitHub
      // repository name is part of a secret value used in the workflow. e.g.:
      //  artifact: https://github.com/docker/actions-toolkit/actions/runs/9552208295/artifacts/1609622746
      //  workflow: https://github.com/docker/actions-toolkit/actions/runs/9552208295
      // https://github.com/docker/actions-toolkit/issues/367
      const artifactRelativeURL = `./${GitHub.runId}/${opts.uploadRes.url.split('/').slice(-2).join('/')}`;

      // prettier-ignore
      sum.addRaw(`<p>`)
        .addRaw(`For a detailed look at the build, download the following build record archive and import it into Docker Desktop's Builds view. `)
        .addBreak()
        .addRaw(`Build records include details such as timing, dependencies, results, logs, traces, and other information about a build. `)
        .addRaw(addLink('Learn more', 'https://www.docker.com/blog/new-beta-feature-deep-dive-into-github-actions-docker-builds-with-docker-desktop/?utm_source=github&utm_medium=actions'))
      .addRaw('</p>')
      .addRaw(`<p>`)
        .addRaw(`:arrow_down: ${addLink(`<strong>${Util.stringToUnicodeEntities(opts.uploadRes.filename)}</strong>`, artifactRelativeURL)} (${Util.formatFileSize(opts.uploadRes.size)} - includes <strong>${refsSize} build record${refsSize > 1 ? 's' : ''}</strong>)`)
      .addRaw(`</p>`);
    } else {
      // prettier-ignore
      sum.addRaw(`<p>`)
        .addRaw(`The following table provides a brief summary of your build.`)
        .addBreak()
        .addRaw(`For a detailed look at the build, including timing, dependencies, results, logs, traces, and other information, consider enabling the export of the build record so you can import it into Docker Desktop's Builds view. `)
        .addRaw(addLink('Learn more', 'https://www.docker.com/blog/new-beta-feature-deep-dive-into-github-actions-docker-builds-with-docker-desktop/?utm_source=github&utm_medium=actions'))
      .addRaw(`</p>`);
    }

    // Feedback survey
    sum.addRaw(`<p>`).addRaw(`Find this useful? `).addRaw(addLink('Let us know', 'https://docs.docker.com/feedback/gha-build-summary')).addRaw('</p>');

    if (opts.exportRes.summaries) {
      // Preview
      sum.addRaw('<p>');
      const summaryTableData: Array<Array<SummaryTableCell>> = [
        [
          {header: true, data: 'ID'},
          {header: true, data: 'Name'},
          {header: true, data: 'Status'},
          {header: true, data: 'Cached'},
          {header: true, data: 'Duration'}
        ]
      ];
      let buildError: string | undefined;
      for (const ref in opts.exportRes.summaries) {
        if (Object.prototype.hasOwnProperty.call(opts.exportRes.summaries, ref)) {
          const summary = opts.exportRes.summaries[ref];
          // prettier-ignore
          summaryTableData.push([
          {data: `<code>${ref.substring(0, 6).toUpperCase()}</code>`},
          {data: `<strong>${Util.stringToUnicodeEntities(summary.name)}</strong>`},
          {data: `${summary.status === 'completed' ? ':white_check_mark:' : summary.status === 'canceled' ? ':no_entry_sign:' : ':x:'} ${summary.status}`},
          {data: `${summary.numCachedSteps > 0 ? Math.round((summary.numCachedSteps / summary.numTotalSteps) * 100) : 0}%`},
          {data: summary.duration}
        ]);
          if (summary.error) {
            buildError = summary.error;
          }
        }
      }
      sum.addTable([...summaryTableData]);
      sum.addRaw(`</p>`);

      // Build error
      if (buildError) {
        sum.addRaw(`<blockquote>`);
        if (Util.countLines(buildError) > 10) {
          // prettier-ignore
          sum
          .addRaw(`<details><summary><strong>Error</strong></summary>`)
            .addCodeBlock(he.encode(buildError), 'text')
          .addRaw(`</details>`);
        } else {
          // prettier-ignore
          sum
          .addRaw(`<strong>Error</strong>`)
          .addBreak()
          .addRaw(`<p>`)
            .addCodeBlock(he.encode(buildError), 'text')
          .addRaw(`</p>`);
        }
        sum.addRaw(`</blockquote>`);
      }
    }

    // Build inputs
    if (opts.inputs) {
      // prettier-ignore
      sum.addRaw(`<details><summary><strong>Build inputs</strong></summary>`)
        .addCodeBlock(
          jsyaml.dump(opts.inputs, {
            indent: 2,
            lineWidth: -1
          }), 'yaml'
        )
        .addRaw(`</details>`);
    }

    // Bake definition
    if (opts.bakeDefinition) {
      // prettier-ignore
      sum.addRaw(`<details><summary><strong>Bake definition</strong></summary>`)
        .addCodeBlock(JSON.stringify(opts.bakeDefinition, null, 2), 'json')
        .addRaw(`</details>`);
    }

    core.info(`Writing summary`);
    await sum.addSeparator().write();
  }
}
