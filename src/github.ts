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
import * as core from '@actions/core';
import * as github from '@actions/github';
import {Context} from '@actions/github/lib/context';
import jwt_decode from 'jwt-decode';

import {GitHubActionsRuntimeToken, GitHubRepo} from './types/github';

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

  public static async printActionsRuntimeToken() {
    const actionsRuntimeToken = process.env['ACTIONS_RUNTIME_TOKEN'];
    if (actionsRuntimeToken) {
      core.info(JSON.stringify(JSON.parse(GitHub.actionsRuntimeToken.ac as string), undefined, 2));
    } else {
      core.info(`ACTIONS_RUNTIME_TOKEN not set`);
    }
  }
}
