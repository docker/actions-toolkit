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

import {Digest} from './digest.js';

import {MEDIATYPE_EMPTY_JSON_V1} from './mediatype.js';

export interface Descriptor {
  mediaType: string;
  digest: Digest;
  size: number;
  urls?: string[];
  annotations?: Record<string, string>;
  data?: string;
  platform?: Platform;
  artifactType?: string;
}

export interface Platform {
  architecture: string;
  os: string;
  'os.version'?: string;
  'os.features'?: string[];
  variant?: string;
}

export const DescriptorEmptyJSON: Descriptor = {
  mediaType: MEDIATYPE_EMPTY_JSON_V1,
  digest: 'sha256:44136fa355b3678a1146ad16f7e8649e94fb4fc21fe77e8310c060f61caaff8a',
  size: 2,
  data: '{}'
};
