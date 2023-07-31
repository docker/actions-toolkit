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

import * as core from '@actions/core';
import {HttpClient, HttpClientResponse, HttpCodes} from '@actions/http-client';
import {GetRepositoryTagsRequest, GetRepositoryTagsResponse, GetRepositoryRequest, GetTokenResponse, RepositoryResponse, UpdateRepoDescriptionRequest} from './types/dockerhub';

const apiBaseUrl = 'https://hub.docker.com/v2';
const userAgent = 'docker/actions-toolkit';
const baseHeaders = {
  'Content-Type': 'application/json'
};

export interface DockerHubClientOptions {
  username?: string;
  password?: string;
  accessToken?: string;
}

/*
 * A client for interacting with the Docker REST API. Not to be mixed with the
 * engine API.
 */
export class DockerHubClient {
  readonly client: HttpClient;

  private constructor(client: HttpClient) {
    this.client = client;
  }

  /*
   * Returns a new DockerApiClient using a username and password/PAT or an
   * already retrieved access token.
   */
  public static async new(opts: DockerHubClientOptions): Promise<DockerHubClient> {
    const {username, password, accessToken} = opts;

    // If accessToken is defined, create client and return.
    if ((accessToken ?? '').trim() != '') {
      const client = new HttpClient(userAgent, [], {
        headers: {
          ...baseHeaders,
          Authorization: `Bearer ${accessToken}`
        }
      });

      return new DockerHubClient(client);
    }

    if (!username) {
      throw new Error('DockerApiClient.new - opts.username is required');
    }

    if (!password) {
      throw new Error('DockerApiClient.new - opts.password is required');
    }

    // Log in and set client based on response
    const token = await DockerHubClient.getAccessToken(username, password);
    const client = new HttpClient(userAgent, [], {
      headers: {
        ...baseHeaders,
        Authorization: `Bearer ${token}`
      }
    });

    return new DockerHubClient(client);
  }

  /*
   * Returns an access token using the username and password/PAT supplied.
   */
  public static async getAccessToken(username: string, password: string): Promise<string> {
    const url = `${apiBaseUrl}/users/login`;
    const client = new HttpClient(userAgent, [], {headers: baseHeaders});

    if ((username ?? '').trim() == '') {
      throw new Error('DockerApiClient.getAccessToken - username is required');
    }

    if ((password ?? '').trim() == '') {
      throw new Error('DockerApiClient.getAccessToken - password is required');
    }

    const rawResp = await client.post(
      url,
      JSON.stringify({
        username,
        password
      })
    );

    const {token} = await handleResponse<GetTokenResponse>(rawResp);
    core.setSecret(token);
    return token;
  }

  /*
   * Returns a repository by namespace and name.
   */
  public async getRepository(req: GetRepositoryRequest): Promise<RepositoryResponse> {
    validateRepoParts(req);

    const url = `${apiBaseUrl}/repositories/${req.namespace}/${req.name}`;

    const rawResp = await this.client.get(url);
    return handleResponse<RepositoryResponse>(rawResp);
  }

  /*
   * Returns repository tags by namespace and name. This is a paged call.
   */
  public async getRepositoryTags(req: GetRepositoryTagsRequest): Promise<GetRepositoryTagsResponse> {
    validateRepoParts(req);

    const url = new URL(`${apiBaseUrl}/repositories/${req.namespace}/${req.name}/tags`);

    if (req.page !== undefined && req.page > 0) {
      url.searchParams.append('page', req.page.toString());
    }

    if (req.page_size !== undefined && req.page_size > 0) {
      url.searchParams.append('page_size', req.page_size.toString());
    }

    const rawResp = await this.client.get(url.toString());
    return handleResponse<GetRepositoryTagsResponse>(rawResp);
  }

  /*
   * Updates a repository's descriptions and returns the details.
   */
  public async updateRepositoryDescription(req: UpdateRepoDescriptionRequest): Promise<RepositoryResponse> {
    validateRepoParts(req);

    req.full_description = req.full_description ?? '';

    if (req.full_description.trim() === '' && !req.allow_empty_full_description) {
      throw new Error(`DockerApiClient.updateRepositoryDescription - req.full_description is empty and req.allow_empty_full_description is false`);
    }

    const body: Record<string, string> = {
      full_description: req.full_description
    };

    if ((req.description ?? '').trim() != '') {
      body['description'] = req.description as string;
    }

    try {
      const rawResp = await this.client.patch(`${apiBaseUrl}/repositories/${req.namespace}/${req.name}`, JSON.stringify(body));

      return handleResponse<RepositoryResponse>(rawResp);
    } catch (e) {
      throw new Error(`DockerApiClient.updateRepositoryTags - ${e}`);
    }
  }
}

export interface RepoParts {
  namespace: string;
  name: string;
}

export function validateRepoParts(val: RepoParts) {
  val = val ?? {
    namespace: '',
    name: ''
  };
  val.namespace = val.namespace ?? '';
  val.name = val.name ?? '';

  if (val.namespace.trim() == '') {
    throw new Error('req.namespace is required');
  }

  if (val.name.trim() == '') {
    throw new Error('req.name is required');
  }
}

async function handleResponse<T>(response: HttpClientResponse): Promise<T> {
  const body = await response.readBody();

  // Default the status code to internal.
  const statusCode = response.message.statusCode ?? HttpCodes.InternalServerError;

  if (statusCode < 200 || statusCode >= 400) {
    const errResp = JSON.parse(body) as Record<string, string>;

    for (const k of ['message', 'detail', 'error']) {
      // We have a couple different props that can come back. Check the known
      // ones.
      if (errResp[k]) {
        throw new Error(`docker api request failed: ${statusCode} ${errResp[k]}`);
      }
    }

    throw new Error(`docker api request failed: ${statusCode} ${body}`);
  }

  return JSON.parse(body) as T;
}
