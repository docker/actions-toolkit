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
export interface BuilderInfo {
    name?: string;
    driver?: string;
    lastActivity?: Date;
    nodes: NodeInfo[];
}
export interface Node {
    name?: string;
    endpoint?: string;
    'driver-opts'?: Array<string>;
    'buildkitd-flags'?: string;
    platforms?: string;
}
export interface NodeInfo extends Node {
    status?: string;
    buildkit?: string;
    features?: Record<string, boolean>;
    labels?: Record<string, string>;
    devices?: Array<Device>;
    gcPolicy?: Array<GCPolicy>;
    files?: Record<string, string>;
}
export interface Device {
    name?: string;
    annotations?: Record<string, string>;
    autoAllow?: boolean;
    onDemand?: boolean;
}
export interface GCPolicy {
    all?: boolean;
    filter?: string[];
    keepDuration?: string;
    keepBytes?: string;
    reservedSpace?: string;
    maxUsedSpace?: string;
    minFreeSpace?: string;
}
