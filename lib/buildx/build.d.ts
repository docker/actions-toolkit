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
import { Buildx } from './buildx';
import { BuildMetadata } from '../types/buildx/build';
import { VertexWarning } from '../types/buildkit/client';
import { ProvenancePredicate } from '../types/intoto/slsa_provenance/v0.2/provenance';
export interface BuildOpts {
    buildx?: Buildx;
}
export interface ResolveSecretsOpts {
    asFile?: boolean;
    redact?: boolean;
}
export declare class Build {
    private readonly buildx;
    private readonly iidFilename;
    private readonly metadataFilename;
    constructor(opts?: BuildOpts);
    getImageIDFilePath(): string;
    resolveImageID(): string | undefined;
    getMetadataFilePath(): string;
    resolveMetadata(): BuildMetadata | undefined;
    resolveRef(metadata?: BuildMetadata): string | undefined;
    resolveProvenance(metadata?: BuildMetadata): ProvenancePredicate | undefined;
    resolveWarnings(metadata?: BuildMetadata): Array<VertexWarning> | undefined;
    resolveDigest(metadata?: BuildMetadata): string | undefined;
    static resolveSecretString(kvp: string): string;
    static resolveSecretFile(kvp: string): string;
    static resolveSecretEnv(kvp: string): string;
    static resolveSecret(kvp: string, opts?: ResolveSecretsOpts): [string, string];
    static getProvenanceInput(name: string): string;
    static resolveProvenanceAttrs(input: string): string;
    static resolveCacheToAttrs(input: string, githubToken?: string): string;
    static hasLocalExporter(exporters: string[]): boolean;
    static hasTarExporter(exporters: string[]): boolean;
    static hasDockerExporter(exporters: string[], load?: boolean): boolean;
    static hasExporterType(name: string, exporters: string[]): boolean;
    static hasAttestationType(name: string, attrs: string): boolean;
    static resolveAttestationAttrs(attrs: string): string;
    static hasGitAuthTokenSecret(secrets: string[]): boolean;
    static parseSecretKvp(kvp: string, redact?: boolean): [string, string];
}
