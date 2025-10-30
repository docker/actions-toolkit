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
import { Buildx } from './buildx';
import { ExportOpts, ExportResponse, InspectOpts, InspectResponse } from '../types/buildx/history';
export interface HistoryOpts {
    buildx?: Buildx;
}
export declare class History {
    private readonly buildx;
    constructor(opts?: HistoryOpts);
    getCommand(args: Array<string>): Promise<{
        command: string;
        args: string[];
    }>;
    getInspectCommand(args: Array<string>): Promise<{
        command: string;
        args: string[];
    }>;
    getExportCommand(args: Array<string>): Promise<{
        command: string;
        args: string[];
    }>;
    inspect(opts: InspectOpts): Promise<InspectResponse>;
    export(opts: ExportOpts): Promise<ExportResponse>;
    private exportLegacy;
    private static exportFilename;
}
