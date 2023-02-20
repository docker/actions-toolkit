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

import {GitHubActionsRuntimeToken, GitHubActionsRuntimeTokenAC, GitHubRepo} from './types/github';

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

  static get actionsRuntimeToken(): GitHubActionsRuntimeToken | undefined {
    const token = process.env['ACTIONS_RUNTIME_TOKEN'] || '';
    return token ? jwt_decode<GitHubActionsRuntimeToken>(token) : undefined;
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
}
