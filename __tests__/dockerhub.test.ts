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
import * as fs from 'fs';
import * as path from 'path';

import {DockerHub} from '../src/dockerhub';
import {RepositoryResponse} from '../src/types/dockerhub';

beforeEach(() => {
  jest.clearAllMocks();
});

import repoInfoFixture from './fixtures/dockerhub-repoinfo.json';

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
