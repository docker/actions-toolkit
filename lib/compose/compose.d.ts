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
export interface ComposeOpts {
    standalone?: boolean;
}
export declare class Compose {
    private _version;
    private _versionOnce;
    private readonly _standalone;
    constructor(opts?: ComposeOpts);
    isStandalone(): Promise<boolean>;
    getCommand(args: Array<string>): Promise<{
        command: string;
        args: string[];
    }>;
    isAvailable(): Promise<boolean>;
    version(): Promise<string>;
    printVersion(): Promise<void>;
    static parseVersion(stdout: string): string;
}
