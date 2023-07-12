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

import {components as OctoOpenApiTypes} from '@octokit/openapi-types';
import {JwtPayload} from 'jwt-decode';

// Our custom release JSON.
export interface GitHubRelease {
  id: number;
  tag_name: string;
  html_url: string;
  assets: Array<string>;
}

// Release JSON from the github api. Api version: 2022-11-28
// https://docs.github.com/en/rest/releases/releases?apiVersion=2022-11-28#get-the-latest-release
export interface OctokitRelease {
  id: number;
  tag_name: string;
  assets: Array<{name: string; url: string}>;
}

export type GitHubRepo = OctoOpenApiTypes['schemas']['repository'];

export interface GitHubActionsRuntimeToken extends JwtPayload {
  ac?: string;
}

export interface GitHubActionsRuntimeTokenAC {
  Scope: string;
  Permission: number;
}
