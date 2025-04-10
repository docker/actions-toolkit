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

export interface InspectOpts {
  ref?: string;
  builder?: string;
}

export type BuildStatus = 'completed' | 'running' | 'failed' | 'canceled';

export interface InspectResponse {
  Name?: string;
  Ref: string;

  Context?: string;
  Dockerfile?: string;
  VCSRepository?: string;
  VCSRevision?: string;
  Target?: string;
  Platform?: Array<string>;
  KeepGitDir?: boolean;

  NamedContexts?: Array<InspectKeyValueOutput>;

  StartedAt?: Date;
  CompletedAt?: Date;
  Duration?: number;
  Status?: BuildStatus;
  Error?: InspectErrorOutput;

  NumCompletedSteps: number;
  NumTotalSteps: number;
  NumCachedSteps: number;

  BuildArgs?: Array<InspectKeyValueOutput>;
  Labels?: Array<InspectKeyValueOutput>;

  Config?: InspectConfigOutput;

  Materials?: InspectMaterialOutput[];
  Attachments?: InspectAttachmentOutput[];

  Errors?: Array<string>;
}

export interface InspectConfigOutput {
  Network?: string;
  ExtraHosts?: Array<string>;
  Hostname?: string;
  CgroupParent?: string;
  ImageResolveMode?: string;
  MultiPlatform?: boolean;
  NoCache?: boolean;
  NoCacheFilter?: Array<string>;

  ShmSize?: string;
  Ulimit?: string;
  CacheMountNS?: string;
  DockerfileCheckConfig?: string;
  SourceDateEpoch?: string;
  SandboxHostname?: string;

  RestRaw?: Array<InspectKeyValueOutput>;
}

export interface InspectMaterialOutput {
  URI?: string;
  Digests?: Array<string>;
}

export interface InspectAttachmentOutput {
  Digest?: string;
  Platform?: string;
  Type?: string;
}

export interface InspectErrorOutput {
  Code?: number;
  Message?: string;
  Name?: string;
  Logs?: Array<string>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Sources?: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Stack?: any;
}

export interface InspectKeyValueOutput {
  Name?: string;
  Value?: string;
}

export interface ExportBuildOpts {
  refs: Array<string>;
  image?: string;
}

export interface ExportBuildResponse {
  dockerbuildFilename: string;
  dockerbuildSize: number;
  summaries: Summaries;
  builderName: string;
  nodeName: string;
  refs: Array<string>;
}

export interface Summaries {
  [ref: string]: Summary;
}

export interface Summary {
  name: string;
  status: string;
  duration: string;
  numCachedSteps: number;
  numTotalSteps: number;
  numCompletedSteps: number;
  frontendAttrs: Record<string, string>;
  error?: string;
}
