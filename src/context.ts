import fs from 'fs';
import os from 'os';
import path from 'path';
import * as tmp from 'tmp';
import jwt_decode, {JwtPayload} from 'jwt-decode';
import {GitHub} from '@actions/github/lib/utils';
import * as github from '@actions/github';
import {components as OctoOpenApiTypes} from '@octokit/openapi-types';

export type ReposGetResponseData = OctoOpenApiTypes['schemas']['repository'];
export interface Jwt extends JwtPayload {
  ac?: string;
}

export class Context {
  public serverURL: string;
  public gitRef: string;
  public buildGitContext: string;
  public provenanceBuilderID: string;
  public octokit: InstanceType<typeof GitHub>;

  private readonly _tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'docker-actions-toolkit-')).split(path.sep).join(path.posix.sep);

  constructor(githubToken?: string) {
    this.gitRef = github.context.ref;
    if (github.context.sha && this.gitRef && !this.gitRef.startsWith('refs/')) {
      this.gitRef = `refs/heads/${github.context.ref}`;
    }
    if (github.context.sha && !this.gitRef.startsWith(`refs/pull/`)) {
      this.gitRef = github.context.sha;
    }
    this.serverURL = process.env.GITHUB_SERVER_URL || 'https://github.com';
    this.buildGitContext = `${this.serverURL}/${github.context.repo.owner}/${github.context.repo.repo}.git#${this.gitRef}`;
    this.provenanceBuilderID = `${this.serverURL}/${github.context.repo.owner}/${github.context.repo.repo}/actions/runs/${github.context.runId}`;
    this.octokit = github.getOctokit(`${githubToken}`);
  }

  public tmpDir(): string {
    return this._tmpDir;
  }

  public tmpName(options?: tmp.TmpNameOptions): string {
    return tmp.tmpNameSync(options);
  }

  public repoData(): Promise<ReposGetResponseData> {
    return this.octokit.rest.repos.get({...github.context.repo}).then(response => response.data as ReposGetResponseData);
  }

  public parseRuntimeToken(): Jwt {
    return jwt_decode<Jwt>(process.env['ACTIONS_RUNTIME_TOKEN'] || '');
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public fromPayload(path: string): any {
    return this.select(github.context.payload, path);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private select(obj: any, path: string): any {
    if (!obj) {
      return undefined;
    }
    const i = path.indexOf('.');
    if (i < 0) {
      return obj[path];
    }
    const key = path.slice(0, i);
    return this.select(obj[key], path.slice(i + 1));
  }
}
