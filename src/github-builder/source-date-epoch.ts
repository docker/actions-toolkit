/**
 * Copyright 2026 actions-toolkit authors
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

import {GitHub, GitHubOpts} from '../github/github.js';

export class SourceDateEpoch {
  /**
   * Resolves a non-negative Unix timestamp through year 9999, or the event
   * commit's committer time for "commit". Empty input is invalid; callers should
   * skip resolution when reproducible timestamps are disabled.
   */
  public static async resolve(input: string, opts?: GitHubOpts): Promise<{epoch: string; created: string}> {
    let value = input.trim();
    if (value === 'commit') {
      const {data} = await new GitHub(opts).octokit.rest.repos.getCommit({
        ...GitHub.context.repo,
        ref: GitHub.context.sha
      });
      value = String(Date.parse(data.commit.committer?.date || '') / 1000);
    }

    const epoch = Number(value);
    const date = new Date(epoch * 1000);
    if (!/^\d+$/.test(value) || !Number.isSafeInteger(epoch) || Number.isNaN(date.getTime()) || date.getUTCFullYear() > 9999) {
      throw new Error('source-date-epoch must be commit or a non-negative Unix timestamp through year 9999');
    }
    return {epoch: String(epoch), created: date.toISOString()};
  }
}
