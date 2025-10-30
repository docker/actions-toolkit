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
export interface UndockOpts {
    binPath?: string;
}
export interface UndockRunOpts {
    source: string;
    dist: string;
    logLevel?: string;
    logCaller?: boolean;
    cacheDir?: string;
    platform?: string;
    all?: boolean;
    include?: Array<string>;
    insecure?: boolean;
    rmDist?: boolean;
    wrap?: boolean;
}
export declare class Undock {
    private readonly binPath;
    private _version;
    private _versionOnce;
    constructor(opts?: UndockOpts);
    run(opts: UndockRunOpts): Promise<void>;
    isAvailable(): Promise<boolean>;
    version(): Promise<string>;
    printVersion(): Promise<void>;
    versionSatisfies(range: string, version?: string): Promise<boolean>;
}
