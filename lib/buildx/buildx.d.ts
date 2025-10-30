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
import { VertexWarning } from '../types/buildkit/client';
import { Cert, LocalRefsOpts, LocalRefsResponse, LocalState } from '../types/buildx/buildx';
import { GitHubAnnotation } from '../types/github';
export interface BuildxOpts {
    standalone?: boolean;
}
export declare class Buildx {
    private _version;
    private _versionOnce;
    private readonly _standalone;
    static readonly containerNamePrefix = "buildx_buildkit_";
    constructor(opts?: BuildxOpts);
    static get configDir(): string;
    static get refsDir(): string;
    static get refsGroupDir(): string;
    static get certsDir(): string;
    isStandalone(): Promise<boolean>;
    getCommand(args: Array<string>): Promise<{
        command: string;
        args: string[];
    }>;
    isAvailable(): Promise<boolean>;
    version(): Promise<string>;
    printVersion(): Promise<void>;
    static parseVersion(stdout: string): string;
    versionSatisfies(range: string, version?: string): Promise<boolean>;
    static resolveCertsDriverOpts(driver: string, endpoint: string, cert: Cert): Array<string>;
    static localState(ref: string, dir?: string): LocalState;
    private static fixLocalState;
    static refs(opts: LocalRefsOpts, refs?: LocalRefsResponse): LocalRefsResponse;
    static convertWarningsToGitHubAnnotations(warnings: Array<VertexWarning>, buildRefs: Array<string>, refsDir?: string): Promise<Array<GitHubAnnotation> | undefined>;
}
