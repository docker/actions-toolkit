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

import {Exec} from './exec';
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

  public static async remoteSha(repo: string, ref: string): Promise<string> {
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
    return await Git.exec(['symbolic-ref', 'HEAD']).catch(() => {
      // if it fails (for example in a detached HEAD state), falls back to
      // using git tag or describe to get the exact matching tag name.
      return Git.tag().then(tag => {
        return `refs/tags/${tag}`;
      });
    });
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
}
