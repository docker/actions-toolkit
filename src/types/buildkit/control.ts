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

import {Descriptor} from '../oci/descriptor.js';
import {Digest} from '../oci/digest.js';
import {ProgressGroup, Range, SourceInfo} from './ops.js';
import {RpcStatus} from './rpc.js';

// https://github.com/moby/buildkit/blob/v0.14.0/api/services/control/control.pb.go#L1504-L1525
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

// https://github.com/moby/buildkit/blob/v0.14.0/api/services/control/control.pb.go#L1909-L1917
export interface Exporter {
  Type: string;
  Attrs: Record<string, string>;
}

// https://github.com/moby/buildkit/blob/v0.14.0/api/services/control/control.pb.go#L1845-L1852
export interface BuildResultInfo {
  ResultDeprecated?: Descriptor;
  Attestations?: Array<Descriptor>;
  Results?: Record<number, Descriptor>;
}

// https://github.com/moby/buildkit/blob/v0.14.0/api/services/control/control.pb.go#L751-L759
export interface StatusResponse {
  vertexes?: Array<Vertex>;
  statuses?: Array<VertexStatus>;
  logs?: Array<VertexLog>;
  warnings?: Array<VertexWarning>;
}

// https://github.com/moby/buildkit/blob/v0.14.0/api/services/control/control.pb.go#L822-L834
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

// https://github.com/moby/buildkit/blob/v0.14.0/api/services/control/control.pb.go#L911-L923
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

// https://github.com/moby/buildkit/blob/v0.14.0/api/services/control/control.pb.go#L1007-L1015
export interface VertexLog {
  vertex: Digest;
  timestamp: Date;
  stream?: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  msg?: any;
}

// https://github.com/moby/buildkit/blob/v0.14.0/api/services/control/control.pb.go#L1071-L1082
export interface VertexWarning {
  vertex: Digest;
  level?: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  short?: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  detail?: Array<any>;
  url?: string;
  info?: SourceInfo;
  ranges?: Array<Range>;
}
