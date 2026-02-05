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

import {AnnotationProperties} from '@actions/core';
import type {getOctokit} from '@actions/github';
import {JwtPayload} from 'jwt-decode';

export interface GitHubRelease {
  id: number;
  tag_name: string;
  html_url: string;
  assets: Array<string>;
}

export interface GitHubContentOpts {
  owner: string;
  repo: string;
  ref?: string;
  path: string;
}

type Octokit = ReturnType<typeof getOctokit>;
export type GitHubRepo = Awaited<ReturnType<Octokit['rest']['repos']['get']>>['data'];

export interface GitHubActionsRuntimeToken extends JwtPayload {
  ac?: string;
}

export interface GitHubActionsRuntimeTokenAC {
  Scope: string;
  Permission: number;
}

export interface GitHubAnnotation extends AnnotationProperties {
  message: string;
}
