import jwt_decode, {JwtPayload} from 'jwt-decode';
import * as github from '@actions/github';
import {Context} from '@actions/github/lib/context';
import {components as OctoOpenApiTypes} from '@octokit/openapi-types';
import {WebhookPayload} from '@actions/github/lib/interfaces';

export type Payload = WebhookPayload;
export type ReposGetResponseData = OctoOpenApiTypes['schemas']['repository'];

interface Jwt extends JwtPayload {
  ac?: string;
}

export class GitHub {
  private static instance?: GitHub;
  static getInstance = (): GitHub => (GitHub.instance = GitHub.instance ?? new GitHub());
  private static _serverURL: string;
  private static _gitContext: string;
  private static _provenanceBuilderID: string;

  private constructor() {
    let ref = this.ref();
    if (github.context.sha && ref && !ref.startsWith('refs/')) {
      ref = `refs/heads/${this.ref()}`;
    }
    if (github.context.sha && !ref.startsWith(`refs/pull/`)) {
      ref = github.context.sha;
    }
    GitHub._serverURL = process.env.GITHUB_SERVER_URL || 'https://github.com';
    GitHub._gitContext = `${GitHub._serverURL}/${github.context.repo.owner}/${github.context.repo.repo}.git#${ref}`;
    GitHub._provenanceBuilderID = `${GitHub._serverURL}/${github.context.repo.owner}/${github.context.repo.repo}/actions/runs/${github.context.runId}`;
  }

  public reset() {
    GitHub.instance = undefined;
  }

  public context(): Context {
    return github.context;
  }

  private ref(): string {
    return github.context.ref;
  }

  public serverURL() {
    return GitHub._serverURL;
  }

  public gitContext() {
    return GitHub._gitContext;
  }

  public provenanceBuilderID() {
    return GitHub._provenanceBuilderID;
  }

  private payload(): Payload {
    return github.context.payload;
  }

  public repo(token: string): Promise<ReposGetResponseData> {
    return github
      .getOctokit(token)
      .rest.repos.get({...github.context.repo})
      .then(response => response.data as ReposGetResponseData);
  }

  public parseRuntimeToken(): Jwt {
    return jwt_decode<Jwt>(process.env['ACTIONS_RUNTIME_TOKEN'] || '');
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public fromPayload(path: string): any {
    return this.select(this.payload(), path);
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
