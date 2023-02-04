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
import * as httpm from '@actions/http-client';
import {HttpCodes} from '@actions/http-client';

import {RepositoryRequest, RepositoryResponse, TokenRequest, TokenResponse, UpdateRepoDescriptionRequest} from './types/dockerhub';

export interface DockerHubOpts {
  credentials: TokenRequest;
}

const apiBaseURL = 'https://hub.docker.com';
const loginURL = `${apiBaseURL}/v2/users/login?refresh_token=true`;
const repositoriesURL = `${apiBaseURL}/v2/repositories/`;

export class DockerHub {
  private readonly opts: DockerHubOpts;
  private readonly httpc: httpm.HttpClient;

  private constructor(opts: DockerHubOpts, httpc: httpm.HttpClient) {
    this.opts = opts;
    this.httpc = httpc;
  }

  public static async build(opts: DockerHubOpts): Promise<DockerHub> {
    return new DockerHub(
      opts,
      new httpm.HttpClient('docker-actions-toolkit', [], {
        headers: {
          Authorization: `JWT ${await DockerHub.login(opts.credentials)}`,
          'Content-Type': 'application/json'
        }
      })
    );
  }

  public async getRepository(req: RepositoryRequest): Promise<RepositoryResponse> {
    const resp: httpm.HttpClientResponse = await this.httpc.get(`${repositoriesURL}${req.namespace}/${req.name}`);
    return <RepositoryResponse>JSON.parse(await DockerHub.handleResponse(resp));
  }

  public async updateRepoDescription(req: UpdateRepoDescriptionRequest): Promise<RepositoryResponse> {
    const body = {
      full_description: req.full_description
    };
    if (req.description) {
      body['description'] = req.description;
    }
    const resp: httpm.HttpClientResponse = await this.httpc.patch(`${repositoriesURL}${req.namespace}/${req.name}`, JSON.stringify(body));
    return <RepositoryResponse>JSON.parse(await DockerHub.handleResponse(resp));
  }

  private static async login(req: TokenRequest): Promise<string> {
    const http: httpm.HttpClient = new httpm.HttpClient('docker-actions-toolkit', [], {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    const resp: httpm.HttpClientResponse = await http.post(loginURL, JSON.stringify(req));
    const tokenResp = <TokenResponse>JSON.parse(await DockerHub.handleResponse(resp));
    core.setSecret(`${tokenResp.token}`);
    return `${tokenResp.token}`;
  }

  private static async handleResponse(resp: httpm.HttpClientResponse): Promise<string> {
    const body = await resp.readBody();
    resp.message.statusCode = resp.message.statusCode || HttpCodes.InternalServerError;
    if (resp.message.statusCode < 200 || resp.message.statusCode >= 300) {
      if (resp.message.statusCode == HttpCodes.Unauthorized) {
        throw new Error(`Docker Hub API: operation not permitted`);
      }
      const errResp = <Record<string, string>>JSON.parse(body);
      for (const k of ['message', 'detail', 'error']) {
        if (errResp[k]) {
          throw new Error(`Docker Hub API: bad status code ${resp.message.statusCode}: ${errResp[k]}`);
        }
      }
      throw new Error(`Docker Hub API: bad status code ${resp.message.statusCode}`);
    }
    return body;
  }
}
