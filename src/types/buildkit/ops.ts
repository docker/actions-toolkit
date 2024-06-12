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

// https://github.com/moby/buildkit/blob/v0.14.0/solver/pb/ops.pb.go#L1901-L1909
export interface Definition {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  def?: Array<any>;
  metadata: Record<string, OpMetadata>;
  Source?: Source;
}

// https://github.com/moby/buildkit/blob/v0.14.0/solver/pb/ops.pb.go#L1313-L1323
export interface OpMetadata {
  ignore_cache?: boolean;
  description?: Record<string, string>;
  export_cache?: ExportCache;
  caps: Record<string, boolean>;
  progress_group?: ProgressGroup;
}

// https://github.com/moby/buildkit/blob/v0.14.0/solver/pb/ops.pb.go#L1390-L1393
export interface Source {
  locations?: Record<string, Locations>;
  infos?: Array<SourceInfo>;
}

// https://github.com/moby/buildkit/blob/v0.14.0/solver/pb/ops.pb.go#L1439-L1441
export interface Locations {
  locations?: Array<Location>;
}

// https://github.com/moby/buildkit/blob/v0.14.0/solver/pb/ops.pb.go#L1545-L1548
export interface Location {
  sourceIndex?: number;
  ranges?: Array<Range>;
}

// https://github.com/moby/buildkit/blob/v0.14.0/solver/pb/ops.pb.go#L1594-L1597
export interface Range {
  start: Position;
  end: Position;
}

// https://github.com/moby/buildkit/blob/v0.14.0/solver/pb/ops.pb.go#L1643-L1646
export interface Position {
  line: number;
  character: number;
}

// https://github.com/moby/buildkit/blob/v0.14.0/solver/pb/ops.pb.go#L1480-L1485
export interface SourceInfo {
  filename?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data?: any;
  definition?: Definition;
  language?: string;
}

// https://github.com/moby/buildkit/blob/v0.14.0/solver/pb/ops.pb.go#L1691-L1693
export interface ExportCache {
  Value?: boolean;
}

// https://github.com/moby/buildkit/blob/v0.14.0/solver/pb/ops.pb.go#L1731-L1735
export interface ProgressGroup {
  id?: string;
  name?: string;
  weak?: boolean;
}
