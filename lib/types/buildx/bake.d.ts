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
export interface BakeDefinition {
    group: Record<string, Group>;
    target: Record<string, Target>;
}
export interface Group {
    description?: string;
    targets: Array<string>;
}
export interface Target {
    description?: string;
    args?: Record<string, string>;
    attest?: Array<AttestEntry> | Array<string>;
    'cache-from'?: Array<CacheEntry> | Array<string>;
    'cache-to'?: Array<CacheEntry> | Array<string>;
    call?: string;
    context: string;
    contexts?: Record<string, string>;
    dockerfile: string;
    'dockerfile-inline'?: string;
    entitlements?: Array<string>;
    labels?: Record<string, string>;
    'no-cache'?: boolean;
    'no-cache-filter'?: Array<string>;
    output?: Array<ExportEntry> | Array<string>;
    platforms?: Array<string>;
    pull?: boolean;
    secret?: Array<SecretEntry> | Array<string>;
    'shm-size'?: string;
    ssh?: Array<SSHEntry> | Array<string>;
    tags?: Array<string>;
    target?: string;
    ulimits?: Array<string>;
}
export interface AttestEntry {
    type: string;
    disabled?: string | boolean;
    [key: string]: string | boolean | undefined;
}
export interface CacheEntry {
    type: string;
    [key: string]: string;
}
export interface ExportEntry {
    type: string;
    [key: string]: string;
}
export interface SecretEntry {
    id?: string;
    src?: string;
    env?: string;
}
export interface SSHEntry {
    id?: string;
    paths?: Array<string>;
}
