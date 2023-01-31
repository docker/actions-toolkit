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
  public static readonly serverURL: string = process.env.GITHUB_SERVER_URL || 'https://github.com';
  public readonly octokit: InstanceType<typeof Octokit>;

  constructor(opts?: GitHubOpts) {
    this.octokit = github.getOctokit(`${opts?.token}`);
  }

  get context(): Context {
    return github.context;
  }

  get serverURL(): string {
    return process.env.GITHUB_SERVER_URL || 'https://github.com';
  }

  get actionsRuntimeToken(): GitHubActionsRuntimeToken {
    const token = process.env['ACTIONS_RUNTIME_TOKEN'] || '';
    return token ? jwt_decode<GitHubActionsRuntimeToken>(token) : {};
  }

  public repoData(): Promise<GitHubRepo> {
    return this.octokit.rest.repos.get({...github.context.repo}).then(response => response.data as GitHubRepo);
  }
}
