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

import {describe, expect, test} from '@jest/globals';
import * as fs from 'fs';
import * as path from 'path';

import {Bake} from '../../src/buildx/bake';
import {BakeDefinition} from '../../src/types/buildx/bake';

const fixturesDir = path.join(__dirname, '..', '.fixtures');

const maybe = !process.env.GITHUB_ACTIONS || (process.env.GITHUB_ACTIONS === 'true' && process.env.ImageOS && process.env.ImageOS.startsWith('ubuntu')) ? describe : describe.skip;

maybe('getDefinition', () => {
  // prettier-ignore
  test.each([
    [
      'https://github.com/docker/buildx.git#v0.10.4',
      ['binaries-cross'],
      path.join(fixturesDir, 'bake-buildx-0.10.4-binaries-cross.json'),
      false,
    ],
    // TODO: uncomment this test case when we have access to the private repo using an access token
    // [
    //   'https://github.com/docker/test-docker-action.git#remote-private',
    //   ['default'],
    //   path.join(fixturesDir, 'bake-test-docker-action-remote-private.json'),
    //   true,
    // ]
  ])('given %p', async (source: string, targets: string[], out: string, auth) => {
    const gitAuthToken = process.env.GITHUB_TOKEN || '';
    if (auth && !gitAuthToken) {
      console.log(`Git auth token not available, skipping test`);
      return;
    }
    const bake = new Bake();
    const expectedDef = <BakeDefinition>JSON.parse(fs.readFileSync(out, {encoding: 'utf-8'}).trim())
    expect(await bake.getDefinition({
      source: source,
      targets: targets,
      githubToken: gitAuthToken,
    })).toEqual(expectedDef);
  });
});
