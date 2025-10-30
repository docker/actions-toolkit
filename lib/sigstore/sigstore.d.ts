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
import { Attestation } from '@actions/attest';
import { Cosign } from '../cosign/cosign';
import { Subject } from '../types/intoto/intoto';
export interface SignProvenanceBlobsOpts {
    localExportDir: string;
    name?: string;
    noTransparencyLog?: boolean;
}
export interface SignProvenanceBlobsResult extends Attestation {
    bundlePath: string;
    subjects: Array<Subject>;
}
export interface VerifySignedProvenanceBlobsOpts {
    certificateIdentityRegexp: string;
}
export interface VerifySignedProvenanceBlobsResult {
    bundlePath: string;
    cosignArgs: Array<string>;
}
export interface SigstoreOpts {
    cosign?: Cosign;
}
export declare class Sigstore {
    private readonly cosign;
    constructor(opts?: SigstoreOpts);
    signProvenanceBlobs(opts: SignProvenanceBlobsOpts): Promise<Record<string, SignProvenanceBlobsResult>>;
    verifySignedProvenanceBlobs(opts: VerifySignedProvenanceBlobsOpts, signed: Record<string, SignProvenanceBlobsResult>): Promise<Record<string, VerifySignedProvenanceBlobsResult>>;
    private signingEndpoints;
    private static getProvenanceBlobs;
    private static getProvenanceSubjects;
    private static toAttestation;
}
