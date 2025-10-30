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
import { Descriptor } from '../oci/descriptor';
import { Digest } from '../oci/digest';
import { ProgressGroup, Range, SourceInfo } from './ops';
import { RpcStatus } from './rpc';
export interface BuildHistoryRecord {
    Ref: string;
    Frontend: string;
    FrontendAttrs: Record<string, string>;
    Exporters: Array<Exporter>;
    error?: RpcStatus;
    CreatedAt?: Date;
    CompletedAt?: Date;
    logs?: Descriptor;
    ExporterResponse: Record<string, string>;
    Result?: BuildResultInfo;
    Results: Record<string, BuildResultInfo>;
    Generation: number;
    trace?: Descriptor;
    pinned: boolean;
    numCachedSteps: number;
    numTotalSteps: number;
    numCompletedSteps: number;
}
export interface Exporter {
    Type: string;
    Attrs: Record<string, string>;
}
export interface BuildResultInfo {
    ResultDeprecated?: Descriptor;
    Attestations?: Array<Descriptor>;
    Results?: Record<number, Descriptor>;
}
export interface StatusResponse {
    vertexes?: Array<Vertex>;
    statuses?: Array<VertexStatus>;
    logs?: Array<VertexLog>;
    warnings?: Array<VertexWarning>;
}
export interface Vertex {
    digest: Digest;
    inputs: Array<Digest>;
    name?: string;
    cached?: boolean;
    started?: Date;
    completed?: Date;
    error?: string;
    progressGroup?: ProgressGroup;
}
export interface VertexStatus {
    ID?: string;
    vertex: Digest;
    name?: string;
    current?: number;
    total?: number;
    timestamp: Date;
    started?: Date;
    completed?: Date;
}
export interface VertexLog {
    vertex: Digest;
    timestamp: Date;
    stream?: number;
    msg?: any;
}
export interface VertexWarning {
    vertex: Digest;
    level?: number;
    short?: any;
    detail?: Array<any>;
    url?: string;
    info?: SourceInfo;
    ranges?: Array<Range>;
}
