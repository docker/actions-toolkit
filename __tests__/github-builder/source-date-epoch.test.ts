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

import {beforeEach, describe, expect, it, vi} from 'vitest';
import * as github from '@actions/github';

import {SourceDateEpoch} from '../../src/github-builder/source-date-epoch.js';

vi.mock('@actions/github', () => ({
  context: {
    repo: {owner: 'example', repo: 'app'},
    sha: 'event-merge-sha',
    ref: 'refs/pull/12/merge',
    payload: {pull_request: {head: {sha: 'head-sha'}}}
  },
  getOctokit: vi.fn()
}));

describe('SourceDateEpoch.resolve', () => {
  const getCommit = vi.fn();

  beforeEach(() => {
    getCommit.mockReset();
    vi.mocked(github.getOctokit).mockReturnValue({rest: {repos: {getCommit}}} as unknown as ReturnType<typeof github.getOctokit>);
  });

  it.each([
    {input: '0', epoch: '0', created: '1970-01-01T00:00:00.000Z'},
    {input: '000123', epoch: '123', created: '1970-01-01T00:02:03.000Z'},
    {input: '1704067200', epoch: '1704067200', created: '2024-01-01T00:00:00.000Z'},
    {input: ' 1704067200\n', epoch: '1704067200', created: '2024-01-01T00:00:00.000Z'},
    {input: '253402300799', epoch: '253402300799', created: '9999-12-31T23:59:59.000Z'}
  ])('resolves $input without GitHub access', async ({input, epoch, created}) => {
    await expect(SourceDateEpoch.resolve(input)).resolves.toEqual({epoch, created});
    expect(github.getOctokit).not.toHaveBeenCalled();
  });

  it.each(['', ' ', '-1', '+1', '1.5', '1e3', '0x10', 'NaN', 'Infinity', 'context', '253402300800', '8640000000001', '9007199254740993', '1\nOUTPUT=bad'])('rejects invalid input %j without GitHub access', async input => {
    await expect(SourceDateEpoch.resolve(input)).rejects.toThrow('source-date-epoch must be commit or a non-negative Unix timestamp through year 9999');
    expect(github.getOctokit).not.toHaveBeenCalled();
  });

  it('uses the event SHA and committer time, not the PR head or author time', async () => {
    getCommit.mockResolvedValue({data: {commit: {committer: {date: '2024-01-01T00:00:00Z'}, author: {date: '2000-01-01T00:00:00Z'}}}});

    await expect(SourceDateEpoch.resolve('commit', {token: 'custom-token'})).resolves.toEqual({epoch: '1704067200', created: '2024-01-01T00:00:00.000Z'});
    expect(github.getOctokit).toHaveBeenCalledWith('custom-token');
    expect(getCommit).toHaveBeenCalledExactlyOnceWith({owner: 'example', repo: 'app', ref: 'event-merge-sha'});
  });

  it.each([null, {}, {date: 'invalid'}, {date: '1969-12-31T23:59:59Z'}])('rejects an unusable commit timestamp %j', async committer => {
    getCommit.mockResolvedValue({data: {commit: {committer}}});
    await expect(SourceDateEpoch.resolve('commit')).rejects.toThrow('source-date-epoch must be commit or a non-negative Unix timestamp through year 9999');
  });

  it('propagates GitHub errors instead of substituting the current time', async () => {
    const error = new Error('Commit not found');
    getCommit.mockRejectedValue(error);
    await expect(SourceDateEpoch.resolve('commit')).rejects.toBe(error);
  });
});
