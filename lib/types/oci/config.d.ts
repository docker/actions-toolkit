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
import { Digest } from './digest';
import { Platform } from './descriptor';
export interface ImageConfig {
    User?: string;
    ExposedPorts?: Record<string, unknown>;
    Env?: string[];
    Entrypoint?: string[];
    Cmd?: string[];
    Volumes?: Record<string, unknown>;
    WorkingDir?: string;
    Labels?: Record<string, string>;
    StopSignal?: string;
    ArgsEscaped?: boolean;
}
export interface RootFS {
    type: string;
    diff_ids: Digest[];
}
export interface History {
    created?: string;
    created_by?: string;
    author?: string;
    comment?: string;
    empty_layer?: boolean;
}
export interface Image extends Platform {
    created?: string;
    author?: string;
    config?: ImageConfig;
    rootfs: RootFS;
    history?: History[];
}
