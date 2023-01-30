import fs from 'fs';
import os from 'os';
import path from 'path';
import * as tmp from 'tmp';
import * as github from '@actions/github';

import {GitHub} from './github';

export class Context {
  public gitRef: string;
  public buildGitContext: string;
  public provenanceBuilderID: string;

  private readonly _tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'docker-actions-toolkit-')).split(path.sep).join(path.posix.sep);

  constructor() {
    this.gitRef = github.context.ref;
    if (github.context.sha && this.gitRef && !this.gitRef.startsWith('refs/')) {
      this.gitRef = `refs/heads/${github.context.ref}`;
    }
    if (github.context.sha && !this.gitRef.startsWith(`refs/pull/`)) {
      this.gitRef = github.context.sha;
    }
    this.buildGitContext = `${GitHub.serverURL}/${github.context.repo.owner}/${github.context.repo.repo}.git#${this.gitRef}`;
    this.provenanceBuilderID = `${GitHub.serverURL}/${github.context.repo.owner}/${github.context.repo.repo}/actions/runs/${github.context.runId}`;
  }

  public tmpDir(): string {
    return this._tmpDir;
  }

  public tmpName(options?: tmp.TmpNameOptions): string {
    return tmp.tmpNameSync(options);
  }
}
