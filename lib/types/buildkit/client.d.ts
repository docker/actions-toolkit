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
import { Digest } from '../oci/digest';
import { ProgressGroup, Range, SourceInfo } from './ops';
export interface Vertex {
    digest?: Digest;
    inputs?: Array<Digest>;
    name?: string;
    started?: Date;
    completed?: Date;
    cached?: boolean;
    error?: string;
    progressGroup?: ProgressGroup;
}
export interface VertexStatus {
    id: string;
    vertex?: Digest;
    name?: string;
    total?: number;
    current: number;
    timestamp?: Date;
    started?: Date;
    completed?: Date;
}
export interface VertexLog {
    vertex?: Digest;
    stream?: number;
    data: any;
    timestamp: Date;
}
export interface VertexWarning {
    vertex?: Digest;
    level?: number;
    short?: any;
    detail?: Array<any>;
    url?: string;
    sourceInfo?: SourceInfo;
    range?: Array<Range>;
}
export interface SolveStatus {
    vertexes?: Array<Vertex>;
    statuses?: Array<VertexStatus>;
    logs?: Array<VertexLog>;
    warnings?: Array<VertexWarning>;
}
export interface SolveResponse {
    exporterResponse: Record<string, string>;
}
