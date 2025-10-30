/**
 * Copyright 2025 actions-toolkit authors
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
import { Buildx } from '../buildx/buildx';
import { DownloadVersion } from '../types/cosign/cosign';
import { GitHubRelease } from '../types/github';
export interface InstallOpts {
    githubToken?: string;
    buildx?: Buildx;
}
export declare class Install {
    private readonly githubToken;
    private readonly buildx;
    constructor(opts?: InstallOpts);
    download(v: string, ghaNoCache?: boolean, skipState?: boolean): Promise<string>;
    build(gitContext: string, ghaNoCache?: boolean, skipState?: boolean): Promise<string>;
    install(binPath: string, dest?: string): Promise<string>;
    private buildCommand;
    private filename;
    private vspec;
    static getDownloadVersion(v: string): Promise<DownloadVersion>;
    static getRelease(version: DownloadVersion, githubToken?: string): Promise<GitHubRelease>;
}
