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

import {describe, expect, jest, it, beforeEach} from '@jest/globals';
import {DockerHubClient, validateRepoParts} from '../src/dockerhub';
import {GetRepositoryTagsResponse, RepositoryResponse} from '../src/types/dockerhub';

beforeEach(() => {
  jest.clearAllMocks();
});

import repoInfoFixture from './fixtures/dockerhub-repoinfo.json';
import repoTagsFixture from './fixtures/dockerhub-repotags.json';

describe('validateRepoParts', () => {
  it('should error if namespace is missing', () => {
    expect(() => validateRepoParts({name: '', namespace: ''})).toThrow('req.namespace is required');
  });

  it('should error if name is missing', () => {
    expect(() =>
      validateRepoParts({
        name: '',
        namespace: 'testnamespace'
      })
    ).toThrow('req.name is required');
  });

  it('should pass', () => {
    expect(() =>
      validateRepoParts({
        namespace: 'testnamespace',
        name: 'testname'
      })
    ).not.toThrow();
  });
});

describe('DockerApiClient', () => {
  describe('new', () => {
    it('should error with invalid options', async () => {
      await expect(
        DockerHubClient.new({
          username: ''
        })
      ).rejects.toThrow('DockerApiClient.new - opts.username is required');

      await expect(
        DockerHubClient.new({
          username: 'dockeruser'
        })
      ).rejects.toThrow('DockerApiClient.new - opts.password is required');
    });

    it('should return an instance', async () => {
      await expect(
        DockerHubClient.new({
          accessToken: 'myaccesstoken'
        })
      ).resolves.toBeInstanceOf(DockerHubClient);

      jest.spyOn(DockerHubClient, 'getAccessToken').mockImplementationOnce(async () => {
        return 'myaccesstoken';
      });

      await expect(
        DockerHubClient.new({
          username: 'dockeruser',
          password: 'dockerpassword'
        })
      ).resolves.toBeInstanceOf(DockerHubClient);
    });
  });

  describe('getAccessToken', () => {
    it('should error with missing username', async () => {
      await expect(DockerHubClient.getAccessToken('', '')).rejects.toThrow('DockerApiClient.getAccessToken - username is required');
    });

    it('should error with missing password', async () => {
      await expect(DockerHubClient.getAccessToken('dockeruser', '')).rejects.toThrow('DockerApiClient.getAccessToken - password is required');
    });

    it('should return a token', async () => {
      jest.spyOn(DockerHubClient, 'getAccessToken').mockImplementationOnce(async () => {
        return 'myaccesstoken';
      });

      await expect(DockerHubClient.getAccessToken('mydockeruser', 'mydockerpassword')).resolves.toBe('myaccesstoken');
    });
  });
});

describe('getRepository', () => {
  it('should return repo info', async () => {
    const client = await DockerHubClient.new({
      accessToken: 'myaccesstoken'
    });

    jest.spyOn(client, 'getRepository').mockImplementationOnce(async (): Promise<RepositoryResponse> => {
      return repoInfoFixture;
    });

    await expect(
      client.getRepository({
        name: 'myreponame',
        namespace: 'myusername'
      })
    ).resolves.toEqual(repoInfoFixture);
  });
});

describe('getRepositoryTags', () => {
  it('should return repo tags', async () => {
    const client = await DockerHubClient.new({
      accessToken: 'myaccesstoken'
    });

    jest.spyOn(client, 'getRepositoryTags').mockImplementationOnce(async (): Promise<GetRepositoryTagsResponse> => {
      return repoTagsFixture;
    });

    await expect(
      client.getRepositoryTags({
        name: 'myreponame',
        namespace: 'myusername'
      })
    ).resolves.toEqual(repoTagsFixture);
  });
});

describe('updateRepositoryDescription', () => {
  let client: DockerHubClient;

  beforeEach(async () => {
    client = await DockerHubClient.new({
      accessToken: 'myaccesstoken'
    });
  });

  it('should error if empty full description', async () => {
    await expect(
      client.updateRepositoryDescription({
        allow_empty_full_description: false,
        full_description: '',
        name: 'myreponame',
        namespace: 'myusername'
      })
    ).rejects.toThrow('DockerApiClient.updateRepositoryDescription - req.full_description is empty and req.allow_empty_full_description is false');
  });

  it('should set repository description', async () => {
    jest.spyOn(client, 'updateRepositoryDescription').mockImplementation(async (): Promise<RepositoryResponse> => {
      return repoInfoFixture;
    });

    await expect(
      client.updateRepositoryDescription({
        allow_empty_full_description: true,
        full_description: '',
        name: 'myreponame',
        namespace: 'myusername'
      })
    ).resolves.toEqual(repoInfoFixture);

    await expect(
      client.updateRepositoryDescription({
        allow_empty_full_description: true,
        full_description: '',
        name: 'myreponame',
        namespace: 'myusername'
      })
    ).resolves.toEqual(repoInfoFixture);
  });
});
