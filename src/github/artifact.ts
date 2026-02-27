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

import fs from 'fs';
import path from 'path';
import {DefaultArtifactClient, InvalidResponseError} from '@actions/artifact';
import * as core from '@actions/core';

import {UploadOpts, UploadResponse} from '../types/github/artifact.js';
import {GitHub} from './github.js';

export class GitHubArtifact {
  public static async upload(opts: UploadOpts): Promise<UploadResponse> {
    if (GitHub.isGHES) {
      throw new Error('@actions/artifact v2.0.0+ is currently not supported on GHES.');
    }

    const artifactName = path.basename(opts.filename);
    const artifactClient = new DefaultArtifactClient();

    core.info(`Uploading ${artifactName} as an artifact`);
    const rootDirectory = path.dirname(opts.filename);
    const response = await artifactClient.uploadArtifact(artifactName, [opts.filename], rootDirectory, {
      retentionDays: opts.retentionDays,
      skipArchive: true
    });
    if (!response.id) {
      throw new InvalidResponseError('Cannot upload artifact');
    }

    const size = response.size ?? fs.statSync(opts.filename).size;
    const artifactURL = `${GitHub.workflowRunURL()}/artifacts/${response.id}`;
    core.info(`Artifact download URL: ${artifactURL}`);

    return {
      id: response.id,
      filename: artifactName,
      digest: response.digest || '',
      size,
      url: artifactURL
    };
  }
}
