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
import { ExecOptions } from '@actions/exec';
import { BakeDefinition, ExportEntry } from '../types/buildx/bake';
import { BuildMetadata } from '../types/buildx/build';
import { VertexWarning } from '../types/buildkit/client';
export interface BakeOpts {
    buildx?: Buildx;
}
export interface BakeCmdOpts {
    allow?: Array<string>;
    call?: string;
    files?: Array<string>;
    load?: boolean;
    noCache?: boolean;
    overrides?: Array<string>;
    provenance?: string;
    push?: boolean;
    sbom?: string;
    source?: string;
    targets?: Array<string>;
    githubToken?: string;
}
export declare class Bake {
    private readonly buildx;
    private readonly metadataFilename;
    constructor(opts?: BakeOpts);
    getMetadataFilePath(): string;
    resolveMetadata(): BuildMetadata | undefined;
    resolveRefs(metadata?: BuildMetadata): Array<string> | undefined;
    resolveWarnings(metadata?: BuildMetadata): Array<VertexWarning> | undefined;
    getDefinition(cmdOpts: BakeCmdOpts, execOptions?: ExecOptions): Promise<BakeDefinition>;
    static parseDefinition(dt: string): BakeDefinition;
    private static parseAttestEntry;
    private static parseCacheEntry;
    private static parseExportEntry;
    private static parseSecretEntry;
    private static parseSSHEntry;
    static hasLocalExporter(def: BakeDefinition): boolean;
    static hasTarExporter(def: BakeDefinition): boolean;
    static hasDockerExporter(def: BakeDefinition, load?: boolean): boolean;
    static hasExporterType(name: string, exporters: Array<ExportEntry>): boolean;
    private static exporters;
    static hasGitAuthTokenSecret(def: BakeDefinition): boolean;
}
