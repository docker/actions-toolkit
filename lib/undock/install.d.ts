/**
 * Copyright 2024 actions-toolkit authors
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
import { GitHubRelease } from '../types/github';
import { DownloadVersion } from '../types/undock/undock';
export interface InstallOpts {
    githubToken?: string;
}
export declare class Install {
    private readonly githubToken;
    constructor(opts?: InstallOpts);
    download(v: string, ghaNoCache?: boolean): Promise<string>;
    install(binPath: string, dest?: string): Promise<string>;
    private filename;
    private vspec;
    static getDownloadVersion(v: string): Promise<DownloadVersion>;
    static getRelease(version: DownloadVersion, githubToken?: string): Promise<GitHubRelease>;
}
