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
import { ExecOptions, ExecOutput } from '@actions/exec';
import { ConfigFile, ContextInfo } from '../types/docker/docker';
export declare class Docker {
    static get configDir(): string;
    static configFile(): ConfigFile | undefined;
    static isAvailable(): Promise<boolean>;
    static isDaemonRunning(): Promise<boolean>;
    static exec(args?: string[], options?: ExecOptions): Promise<number>;
    static getExecOutput(args?: string[], options?: ExecOptions): Promise<ExecOutput>;
    private static execOptions;
    static context(name?: string): Promise<string>;
    static contextInspect(name?: string): Promise<ContextInfo>;
    static printVersion(): Promise<void>;
    static printInfo(): Promise<void>;
    static parseRepoTag(image: string): {
        repository: string;
        tag: string;
    };
    static pull(image: string, cache?: boolean): Promise<void>;
}
