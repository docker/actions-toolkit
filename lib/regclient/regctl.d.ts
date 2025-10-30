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
import { Manifest } from '../types/oci/manifest';
export interface RegctlOpts {
    binPath?: string;
}
export interface RegctlBlobGetOpts {
    repository: string;
    digest: string;
}
export interface RegctlManifestGetOpts {
    image: string;
    platform?: string;
}
export declare class Regctl {
    private readonly binPath;
    private _version;
    private _versionOnce;
    constructor(opts?: RegctlOpts);
    blobGet(opts: RegctlBlobGetOpts): Promise<any>;
    manifestGet(opts: RegctlManifestGetOpts): Promise<Manifest>;
    isAvailable(): Promise<boolean>;
    version(): Promise<string>;
    printVersion(): Promise<void>;
    versionSatisfies(range: string, version?: string): Promise<boolean>;
}
