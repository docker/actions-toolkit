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
export interface Definition {
    def?: Array<any>;
    metadata: Record<string, OpMetadata>;
    Source?: Source;
}
export interface OpMetadata {
    ignore_cache?: boolean;
    description?: Record<string, string>;
    export_cache?: ExportCache;
    caps: Record<string, boolean>;
    progress_group?: ProgressGroup;
}
export interface Source {
    locations?: Record<string, Locations>;
    infos?: Array<SourceInfo>;
}
export interface Locations {
    locations?: Array<Location>;
}
export interface Location {
    sourceIndex?: number;
    ranges?: Array<Range>;
}
export interface Range {
    start: Position;
    end: Position;
}
export interface Position {
    line: number;
    character: number;
}
export interface SourceInfo {
    filename?: string;
    data?: any;
    definition?: Definition;
    language?: string;
}
export interface ExportCache {
    Value?: boolean;
}
export interface ProgressGroup {
    id?: string;
    name?: string;
    weak?: boolean;
}
