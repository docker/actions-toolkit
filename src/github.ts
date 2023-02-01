import {GitHub as Octokit} from '@actions/github/lib/utils';
import * as github from '@actions/github';
import {components as OctoOpenApiTypes} from '@octokit/openapi-types';
import jwt_decode, {JwtPayload} from 'jwt-decode';
import {Context} from '@actions/github/lib/context';

export type GitHubRepo = OctoOpenApiTypes['schemas']['repository'];

export interface GitHubActionsRuntimeToken extends JwtPayload {
  ac?: string;
}

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

  static get actionsRuntimeToken(): GitHubActionsRuntimeToken {
    const token = process.env['ACTIONS_RUNTIME_TOKEN'] || '';
    return token ? jwt_decode<GitHubActionsRuntimeToken>(token) : {};
  }
}
