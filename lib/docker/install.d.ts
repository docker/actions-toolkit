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
import { Regctl } from '../regclient/regctl';
import { Undock } from '../undock/undock';
import { GitHubRelease } from '../types/github';
export interface InstallSourceImage {
    type: 'image';
    tag: string;
}
export interface InstallSourceArchive {
    type: 'archive';
    version: string;
    channel: string;
}
export type InstallSource = InstallSourceImage | InstallSourceArchive;
export interface InstallOpts {
    source?: InstallSource;
    runDir: string;
    contextName?: string;
    daemonConfig?: string;
    rootless?: boolean;
    localTCPPort?: number;
    regctl?: Regctl;
    undock?: Undock;
    githubToken?: string;
}
interface LimaImage {
    location: string;
    arch: string;
    digest?: string;
}
export declare class Install {
    private readonly runDir;
    private readonly source;
    private readonly contextName;
    private readonly daemonConfig?;
    private readonly rootless;
    private readonly localTCPPort?;
    private readonly regctl;
    private readonly undock;
    private readonly githubToken?;
    private _version;
    private _toolDir;
    private gitCommit;
    private readonly limaInstanceName;
    constructor(opts: InstallOpts);
    get toolDir(): string;
    download(): Promise<string>;
    private downloadSourceImage;
    private downloadSourceArchive;
    install(): Promise<string>;
    private installDarwin;
    private installLinux;
    private installWindows;
    tearDown(): Promise<void>;
    private tearDownDarwin;
    private tearDownLinux;
    private tearDownWindows;
    private downloadURL;
    private static platformOS;
    private static platformArch;
    private static limaInstalled;
    private static qemuBin;
    private static qemuInstalled;
    static getRelease(version: string, githubToken?: string): Promise<GitHubRelease>;
    static limaCustomImages(): LimaImage[];
    private imageConfig;
}
export {};
