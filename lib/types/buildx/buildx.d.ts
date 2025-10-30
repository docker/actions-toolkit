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
import { GitHubContentOpts } from '../github';
export interface Cert {
    cacert?: string;
    cert?: string;
    key?: string;
}
export interface DownloadVersion {
    key: string;
    version: string;
    downloadURL: string;
    contentOpts: GitHubContentOpts;
}
export interface LocalRefsOpts {
    dir: string;
    builderName?: string;
    nodeName?: string;
    since?: Date;
}
export interface LocalRefsResponse {
    [ref: string]: LocalState;
}
export interface LocalState {
    Target: string;
    LocalPath: string;
    DockerfilePath: string;
    GroupRef?: string;
}
