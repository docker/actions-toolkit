/**
 * Copyright 2026 actions-toolkit authors
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

import * as core from '@actions/core';

import {UploadResponse} from './artifact.js';
import {BakeDefinition} from '../buildx/bake.js';
import {ExportResponse} from '../buildx/history.js';

export type SummaryTableRow = Parameters<typeof core.summary.addTable>[0][number];
export type SummaryTableCell = Exclude<SummaryTableRow[number], string>;

export interface BuildSummaryOpts {
  exportRes: ExportResponse;
  uploadRes?: UploadResponse;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  inputs?: any;
  bakeDefinition?: BakeDefinition;
  // builder options
  driver?: string;
  endpoint?: string;
}
