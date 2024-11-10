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
import {Octokit} from '@octokit/core';
import {restEndpointMethods} from '@octokit/plugin-rest-endpoint-methods';

import {Exec} from './exec';
import {GitHub} from './github';
import {Context} from '@actions/github/lib/context';

import {Context as GitContext} from './types/git';

export class Git {
  public static async context(): Promise<GitContext> {
    const ctx = new Context();
    ctx.ref = await Git.ref();
    ctx.sha = await Git.fullCommit();
    return ctx;
  }

  public static async isInsideWorkTree(): Promise<boolean> {
    return await Git.exec(['rev-parse', '--is-inside-work-tree'])
      .then(out => {
        return out === 'true';
      })
      .catch(() => {
        return false;
      });
  }

  public static async remoteSha(repo: string, ref: string, token?: string): Promise<string> {
    const repoMatch = repo.match(/github.com\/([^/]+)\/([^/]+?)(?:\.git)?(\/|$)/);
    // if we have a token and this is a GitHub repo we can use the GitHub API
    if (token && repoMatch) {
      core.setSecret(token);
      const octokit = new (Octokit.plugin(restEndpointMethods).defaults({
        baseUrl: GitHub.apiURL
      }))({auth: token});
      const [owner, repoName] = repoMatch.slice(1, 3);
      try {
        return (
          await octokit.rest.repos.listCommits({
            owner: owner,
            repo: repoName,
            sha: ref,
            per_page: 1
          })
        ).data[0].sha;
      } catch (e) {
        throw new Error(`Cannot find remote ref for ${repo}#${ref}: ${e.message}`);
      }
    }
    // otherwise we fall back to git ls-remote
    return await Git.exec(['ls-remote', repo, ref]).then(out => {
      const [rsha] = out.split(/[\s\t]/);
      if (rsha.length == 0) {
        throw new Error(`Cannot find remote ref for ${repo}#${ref}`);
      }
      return rsha;
    });
  }

  public static async remoteURL(): Promise<string> {
    return await Git.exec(['remote', 'get-url', 'origin']).then(rurl => {
      if (rurl.length == 0) {
        return Git.exec(['remote', 'get-url', 'upstream']).then(rurl => {
          if (rurl.length == 0) {
            throw new Error(`Cannot find remote URL for origin or upstream`);
          }
          return rurl;
        });
      }
      return rurl;
    });
  }

  public static async ref(): Promise<string> {
    const isHeadDetached = await Git.isHeadDetached();
    if (isHeadDetached) {
      return await Git.getDetachedRef();
    }

    return await Git.exec(['symbolic-ref', 'HEAD']);
  }

  public static async fullCommit(): Promise<string> {
    return await Git.exec(['show', '--format=%H', 'HEAD', '--quiet', '--']);
  }

  public static async shortCommit(): Promise<string> {
    return await Git.exec(['show', '--format=%h', 'HEAD', '--quiet', '--']);
  }

  public static async tag(): Promise<string> {
    return await Git.exec(['tag', '--points-at', 'HEAD', '--sort', '-version:creatordate']).then(tags => {
      if (tags.length == 0) {
        return Git.exec(['describe', '--tags', '--abbrev=0']);
      }
      return tags.split('\n')[0];
    });
  }

  private static async isHeadDetached(): Promise<boolean> {
    return await Git.exec(['branch', '--show-current']).then(res => {
      return res.length == 0;
    });
  }

  private static async getDetachedRef(): Promise<string> {
    const res = await Git.exec(['show', '-s', '--pretty=%D']);

    // Can be "HEAD, <tagname>" or "grafted, HEAD, <tagname>"
    const refMatch = res.match(/^(grafted, )?HEAD, (.*)$/);

    if (!refMatch || !refMatch[2]) {
      throw new Error(`Cannot find detached HEAD ref in "${res}"`);
    }

    const ref = refMatch[2].trim();

    // Tag refs are formatted as "tag: <tagname>"
    if (ref.startsWith('tag: ')) {
      return `refs/tags/${ref.split(':')[1].trim()}`;
    }

    // Branch refs are formatted as "<origin>/<branch-name>, <branch-name>"
    const branchMatch = ref.match(/^[^/]+\/[^/]+, (.+)$/);
    if (branchMatch) {
      return `refs/heads/${branchMatch[1].trim()}`;
    }

    // Pull request merge refs are formatted as "pull/<number>/<state>"
    const prMatch = ref.match(/^pull\/\d+\/(head|merge)$/);
    if (prMatch) {
      return `refs/${ref}`;
    }

    throw new Error(`Unsupported detached HEAD ref in "${res}"`);
  }

  private static async exec(args: string[] = []): Promise<string> {
    return await Exec.getExecOutput(`git`, args, {
      ignoreReturnCode: true,
      silent: true
    }).then(res => {
      if (res.stderr.length > 0 && res.exitCode != 0) {
        throw new Error(res.stderr);
      }
      return res.stdout.trim();
    });
  }

  public static async commitDate(ref: string, gitDir: string | undefined = undefined): Promise<Date> {
    const args = ['show', '-s', '--format="%ci"', ref];
    if (gitDir !== undefined) {
      args.push('--');
      args.push(gitDir);
    }

    return new Date(await Git.exec(args));
  }
}
