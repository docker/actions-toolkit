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
import { GitHub as Octokit } from '@actions/github/lib/utils';
import { Context } from '@actions/github/lib/context';
import { BuildSummaryOpts, GitHubActionsRuntimeToken, GitHubContentOpts, GitHubRelease, GitHubRepo, UploadArtifactOpts, UploadArtifactResponse } from './types/github';
export interface GitHubOpts {
    token?: string;
}
export declare class GitHub {
    private readonly githubToken?;
    readonly octokit: InstanceType<typeof Octokit>;
    constructor(opts?: GitHubOpts);
    repoData(): Promise<GitHubRepo>;
    releases(name: string, opts: GitHubContentOpts): Promise<Record<string, GitHubRelease>>;
    static get context(): Context;
    static get serverURL(): string;
    static get apiURL(): string;
    static get isGHES(): boolean;
    static get repository(): string;
    static get workspace(): string;
    static get runId(): number;
    static get runAttempt(): number;
    static workflowRunURL(setAttempts?: boolean): string;
    static get actionsRuntimeToken(): GitHubActionsRuntimeToken | undefined;
    static printActionsRuntimeTokenACs(): Promise<void>;
    static uploadArtifact(opts: UploadArtifactOpts): Promise<UploadArtifactResponse>;
    static writeBuildSummary(opts: BuildSummaryOpts): Promise<void>;
    private static formatDBCBuildURL;
}
