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

import * as core from '@actions/core';
import * as github from '@actions/github';
import * as httpm from '@actions/http-client';
import {jwtDecode, JwtPayload} from 'jwt-decode';

import {GitHubActionsRuntimeToken, GitHubActionsRuntimeTokenAC, GitHubContentOpts, GitHubRelease, GitHubRepo} from '../types/github/github.js';

export interface GitHubOpts {
  token?: string;
}

export class GitHub {
  private readonly githubToken?: string;
  public readonly octokit: ReturnType<typeof github.getOctokit>;

  constructor(opts?: GitHubOpts) {
    this.githubToken = opts?.token || process.env.GITHUB_TOKEN;
    this.octokit = github.getOctokit(`${this.githubToken}`);
  }

  public repoData(): Promise<GitHubRepo> {
    return this.octokit.rest.repos.get({...github.context.repo}).then(response => response.data as GitHubRepo);
  }

  public async releases(name: string, opts: GitHubContentOpts): Promise<Record<string, GitHubRelease>> {
    let releases: Record<string, GitHubRelease>;
    try {
      // try without token first
      releases = await this.releasesRaw(name, opts);
    } catch (error) {
      if (!this.githubToken) {
        throw error;
      }
      // try with token
      releases = await this.releasesRaw(name, opts, this.githubToken);
    }
    return releases;
  }

  public async releasesRaw(name: string, opts: GitHubContentOpts, token?: string): Promise<Record<string, GitHubRelease>> {
    const url = `https://raw.githubusercontent.com/${opts.owner}/${opts.repo}/${opts.ref}/${opts.path}`;
    const http: httpm.HttpClient = new httpm.HttpClient('docker-actions-toolkit');
    // prettier-ignore
    const httpResp: httpm.HttpClientResponse = await http.get(url, token ? {
      Authorization: `token ${token}`
    } : undefined);
    const dt = await httpResp.readBody();
    const statusCode = httpResp.message.statusCode || 500;
    if (statusCode >= 400) {
      throw new Error(`Failed to get ${name} releases from ${url} with status code ${statusCode}: ${dt}`);
    }
    return <Record<string, GitHubRelease>>JSON.parse(dt);
  }

  static get context(): typeof github.context {
    return github.context;
  }

  static get serverURL(): string {
    return process.env.GITHUB_SERVER_URL || 'https://github.com';
  }

  static get apiURL(): string {
    return process.env.GITHUB_API_URL || 'https://api.github.com';
  }

  // Can't use the isGhes() func from @actions/artifact due to @actions/artifact/lib/internal/shared/config
  // being internal since ESM-only packages do not support internal exports.
  // https://github.com/actions/toolkit/blob/8351a5d84d862813d1bb8bdeef87b215f8a946f9/packages/artifact/src/internal/shared/config.ts#L27
  static get isGHES(): boolean {
    const ghURL = new URL(GitHub.serverURL);
    const hostname = ghURL.hostname.trimEnd().toUpperCase();
    const isGitHubHost = hostname === 'GITHUB.COM';
    const isGitHubEnterpriseCloudHost = hostname.endsWith('.GHE.COM');
    const isLocalHost = hostname.endsWith('.LOCALHOST');
    return !isGitHubHost && !isGitHubEnterpriseCloudHost && !isLocalHost;
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
}
