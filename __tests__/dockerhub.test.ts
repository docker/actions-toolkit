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

import {describe, expect, jest, it} from '@jest/globals';
import * as fs from 'fs';
import * as path from 'path';

import {DockerHub} from '../src/dockerhub';
import {RepositoryResponse, RepositoryTagsResponse} from '../src/types/dockerhub';

import repoInfoFixture from './.fixtures/dockerhub-repoinfo.json';
import repoTagsFixture from './.fixtures/dockerhub-repotags.json';
import repoAllTagsFixture from './.fixtures/dockerhub-repoalltags.json';

describe('getRepository', () => {
  it('returns repo info', async () => {
    jest.spyOn(DockerHub.prototype, 'getRepository').mockImplementation((): Promise<RepositoryResponse> => {
      return <Promise<RepositoryResponse>>(repoInfoFixture as unknown);
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    jest.spyOn(DockerHub as any, 'login').mockReturnValue('jwt_token');
    const dockerhub = await DockerHub.build({
      credentials: {
        username: 'foo',
        password: '0123456-7890-0000-1111-222222222'
      }
    });
    const repoinfo = await dockerhub.getRepository({
      namespace: 'foo',
      name: 'bar'
    });
    expect(repoinfo.namespace).toEqual('foo');
    expect(repoinfo.name).toEqual('bar');
    expect(repoinfo.repository_type).toEqual('image');
  });
});

describe('getRepositoryTags', () => {
  it('return repo tags', async () => {
    jest.spyOn(DockerHub.prototype, 'getRepositoryTags').mockImplementation((): Promise<RepositoryTagsResponse> => {
      return <Promise<RepositoryTagsResponse>>(repoTagsFixture as unknown);
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    jest.spyOn(DockerHub as any, 'login').mockReturnValue('jwt_token');
    const dockerhub = await DockerHub.build({
      credentials: {
        username: 'foo',
        password: '0123456-7890-0000-1111-222222222'
      }
    });
    const resp = await dockerhub.getRepositoryTags({
      namespace: 'crazymax',
      name: 'diun'
    });
    expect(resp.count).toBeGreaterThan(0);
    expect(resp.next).not.toBeNull();
    expect(resp.results.length).toBeGreaterThan(0);
    expect(resp.results[0].last_updater_username).toEqual('crazymax');
  });
});

describe('getRepositoryAllTags', () => {
  it('return repo all tags', async () => {
    jest.spyOn(DockerHub.prototype, 'getRepositoryAllTags').mockImplementation((): Promise<RepositoryTagsResponse> => {
      return <Promise<RepositoryTagsResponse>>(repoAllTagsFixture as unknown);
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    jest.spyOn(DockerHub as any, 'login').mockReturnValue('jwt_token');
    const dockerhub = await DockerHub.build({
      credentials: {
        username: 'foo',
        password: '0123456-7890-0000-1111-222222222'
      }
    });
    const resp = await dockerhub.getRepositoryAllTags({
      namespace: 'crazymax',
      name: 'diun'
    });
    expect(resp.count).toBeGreaterThan(0);
    expect(resp.next).toBeNull();
    expect(resp.results.length).toBeGreaterThan(0);
    expect(resp.results[0].last_updater_username).toEqual('crazymax');
  });
});

describe('updateRepoDescription', () => {
  it.skip('set repo description', async () => {
    const dockerhub = await DockerHub.build({
      credentials: {
        username: 'foo',
        password: 'bar'
      }
    });
    const resp = await dockerhub.updateRepoDescription({
      namespace: 'crazymax',
      name: 'test-toolkit',
      description: 'Hello-World',
      full_description: fs.readFileSync(path.join(__dirname, '..', 'README.md'), 'utf-8')
    });
    expect(resp.namespace).toEqual('foo');
    expect(resp.name).toEqual('bar');
    expect(resp.description).toEqual('Hello-World');
  });
});
