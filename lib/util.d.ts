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
export interface ListOpts {
    ignoreComma?: boolean;
    comment?: string;
    quote?: string | boolean | Buffer | null;
}
export declare class Util {
    static getInputList(name: string, opts?: ListOpts): string[];
    static getList(input: string, opts?: ListOpts): string[];
    static getInputNumber(name: string): number | undefined;
    static asyncForEach(array: any, callback: any): Promise<void>;
    static isValidURL(urlStr: string): boolean;
    static isValidRef(refStr: string): boolean;
    static powershellCommand(script: string, params?: Record<string, string>): Promise<{
        command: string;
        args: string[];
    }>;
    static isDirectory(p: any): boolean;
    static trimPrefix(str: string, suffix: string): string;
    static trimSuffix(str: string, suffix: string): string;
    static sleep(seconds: number): Promise<unknown>;
    static hash(input: string): string;
    static parseBool(str: string): boolean;
    static formatFileSize(bytes: number): string;
    static generateRandomString(length?: number): string;
    static stringToUnicodeEntities(str: string): string;
    static countLines(input: string): number;
    static isPathRelativeTo(parentPath: string, childPath: string): boolean;
    static formatDuration(ns: number): string;
}
