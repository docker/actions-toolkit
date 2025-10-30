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
export interface TokenRequest {
    username: string;
    password: string;
}
export interface TokenResponse {
    token: string;
    detail: string;
}
export interface RepositoryRequest {
    namespace: string;
    name: string;
}
export interface RepositoryResponse {
    user: string;
    name: string;
    namespace: string;
    repository_type: string;
    status: number;
    status_description: string;
    description: string;
    is_private: boolean;
    is_automated: boolean;
    can_edit: boolean;
    star_count: number;
    pull_count: number;
    last_updated: string;
    date_registered: string;
    collaborator_count: number;
    affiliation: string;
    hub_user: string;
    has_starred: boolean;
    full_description: string;
    permissions: {
        read: boolean;
        write: boolean;
        admin: boolean;
    };
    media_types: Array<string>;
    content_types: Array<string>;
}
export interface RepositoryTagsRequest {
    namespace: string;
    name: string;
    page?: number;
    page_size?: number;
}
export interface RepositoryTagsResponse {
    count: number;
    next?: string;
    previous?: string;
    results: Array<RepositoryTagsResult>;
}
export interface RepositoryTagsResult {
    creator: number;
    id: number;
    images: Array<RepositoryTagsResultImage>;
    last_updated: Date;
    last_updater: number;
    last_updater_username: string;
    name: string;
    repository: number;
    full_size: number;
    v2: boolean;
    tag_status: string;
    tag_last_pulled: Date;
    tag_last_pushed: Date;
    media_type: string;
    content_type: string;
    digest: string;
}
export interface RepositoryTagsResultImage {
    architecture: string;
    features: string;
    variant?: string;
    digest: string;
    os: string;
    os_features: string;
    os_version?: string;
    size: number;
    status: string;
    last_pulled: Date;
    last_pushed: Date;
}
export interface UpdateRepoDescriptionRequest {
    name: string;
    namespace: string;
    description?: string;
    full_description: string;
}
