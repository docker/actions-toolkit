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
import os from 'os';
import path from 'path';
import * as tmp from 'tmp';
import * as github from '@actions/github';

import {GitHub} from './github';

export class Context {
  private static readonly _tmpDir = fs.mkdtempSync(path.join(Context.ensureDirExists(process.env.RUNNER_TEMP || os.tmpdir()), 'docker-actions-toolkit-'));

  private static ensureDirExists(dir: string): string {
    fs.mkdirSync(dir, {recursive: true});
    return dir;
  }

  public static tmpDir(): string {
    return Context._tmpDir;
  }

  public static tmpName(options?: tmp.TmpNameOptions): string {
    return tmp.tmpNameSync(options);
  }

  public static gitRef(): string {
    let gitRef = github.context.ref;
    if (github.context.sha && gitRef && !gitRef.startsWith('refs/')) {
      gitRef = `refs/heads/${github.context.ref}`;
    }
    if (github.context.sha && !gitRef.startsWith(`refs/pull/`)) {
      gitRef = github.context.sha;
    }
    return gitRef;
  }

  public static gitContext(): string {
    return `${GitHub.serverURL}/${github.context.repo.owner}/${github.context.repo.repo}.git#${Context.gitRef()}`;
  }

  public static provenanceBuilderID(): string {
    return `${GitHub.serverURL}/${github.context.repo.owner}/${github.context.repo.repo}/actions/runs/${github.context.runId}`;
  }
}
