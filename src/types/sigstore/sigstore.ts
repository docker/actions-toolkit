/**
 * Copyright 2025 actions-toolkit authors
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

import type {SerializedBundle} from '@sigstore/bundle';

import {Subject} from '../intoto/intoto';

export const FULCIO_URL = 'https://fulcio.sigstore.dev';
export const REKOR_URL = 'https://rekor.sigstore.dev';
export const TSASERVER_URL = 'https://timestamp.sigstore.dev';
export const SEARCH_URL = 'https://search.sigstore.dev';

export interface Endpoints {
  fulcioURL: string;
  rekorURL?: string;
  tsaServerURL?: string;
}

export interface ParsedBundle {
  payload: SerializedBundle;
  certificate: string;
  tlogID?: string;
}

export interface SignAttestationManifestsOpts {
  imageNames: Array<string>;
  imageDigest: string;
  noTransparencyLog?: boolean;
}

export interface SignAttestationManifestsResult extends ParsedBundle {
  imageName: string;
}

export interface VerifySignedManifestsOpts {
  certificateIdentityRegexp: string;
  noTransparencyLog?: boolean;
  retryOnManifestUnknown?: boolean;
}

export interface VerifySignedManifestsResult {
  cosignArgs: Array<string>;
  signatureManifestDigest: string;
}

export interface SignProvenanceBlobsOpts {
  localExportDir: string;
  name?: string;
  noTransparencyLog?: boolean;
}

export interface SignProvenanceBlobsResult extends ParsedBundle {
  bundlePath: string;
  subjects: Array<Subject>;
}

export interface VerifySignedArtifactsOpts {
  certificateIdentityRegexp: string;
  noTransparencyLog?: boolean;
}

export interface VerifySignedArtifactsResult {
  bundlePath: string;
  cosignArgs: Array<string>;
}
