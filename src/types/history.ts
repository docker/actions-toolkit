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

export interface ExportRecordOpts {
  refs: Array<string>;
  image?: string;
}

export interface ExportRecordResponse {
  dockerbuildFilename: string;
  dockerbuildSize: number;
  summaries: Summaries;
  builderName: string;
  nodeName: string;
  refs: Array<string>;
}

export interface Summaries {
  [ref: string]: RecordSummary;
}

export interface RecordSummary {
  name: string;
  status: string;
  duration: string;
  numCachedSteps: number;
  numTotalSteps: number;
  numCompletedSteps: number;
  frontendAttrs: Record<string, string>;
  error?: string;
}
