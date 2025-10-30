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
import * as httpm from '@actions/http-client';
import { RepositoryRequest, RepositoryResponse, RepositoryTagsRequest, RepositoryTagsResponse, TokenRequest, UpdateRepoDescriptionRequest } from './types/dockerhub';
export interface DockerHubOpts {
    credentials: TokenRequest;
}
export declare class DockerHub {
    private readonly opts;
    private readonly httpc;
    private constructor();
    static build(opts: DockerHubOpts): Promise<DockerHub>;
    getRepositoryTags(req: RepositoryTagsRequest): Promise<RepositoryTagsResponse>;
    getRepositoryAllTags(req: RepositoryTagsRequest): Promise<RepositoryTagsResponse>;
    getRepository(req: RepositoryRequest): Promise<RepositoryResponse>;
    updateRepoDescription(req: UpdateRepoDescriptionRequest): Promise<RepositoryResponse>;
    private static login;
    private static handleResponse;
    static parseError(resp: httpm.HttpClientResponse, body: string): Error;
}
