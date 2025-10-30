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
export declare const PREDICATE_SLSA_PROVENANCE = "https://slsa.dev/provenance/v0.2";
export interface ProvenancePredicate {
    builder: ProvenanceBuilder;
    buildType: string;
    invocation?: ProvenanceInvocation;
    buildConfig?: any;
    metadata: ProvenanceMetadata;
    materials?: Material[];
}
export interface ProvenanceBuilder {
    id: string;
}
export interface ProvenanceInvocation {
    configSource?: ConfigSource;
    parameters?: any;
    environment?: any;
}
export interface DigestSet {
    [key: string]: string;
}
export interface ConfigSource {
    uri?: string;
    digest?: DigestSet;
    entryPoint?: string;
}
export interface Completeness {
    parameters?: boolean;
    environment?: boolean;
    materials?: boolean;
}
export interface ProvenanceMetadata {
    buildInvocationId?: string;
    buildStartedOn?: string;
    completeness?: Completeness;
    reproducible?: boolean;
}
export interface Material {
    uri: string;
    digest: DigestSet;
}
