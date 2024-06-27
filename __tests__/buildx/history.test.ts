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

import {afterEach, beforeEach, describe, expect, jest, test} from '@jest/globals';
import path from 'path';
import * as rimraf from 'rimraf';

import {History} from '../../src/buildx/history';

const fixturesDir = path.join(__dirname, '..', 'fixtures');

// prettier-ignore
const tmpDir = path.join(process.env.TEMP || '/tmp', 'docker-jest');

beforeEach(() => {
  jest.clearAllMocks();
});

afterEach(function () {
  rimraf.sync(tmpDir);
});

describe('load', () => {
  // prettier-ignore
  test.each([
    ['crazy-max~docker-alpine-s6~II9A63.dockerbuild'],
    ['docker~build-push-action~2778G2.dockerbuild'],
    ['docker~login-action~T0XYYW.dockerbuild'],
    ['docker~test-docker-action~dfile-error~DEBCS4.dockerbuild'],
    ['docker~test-docker-action~go-error~BGI5SX.dockerbuild'],
    ['moby~buildkit~LWDOW6.dockerbuild'],
  ])('loading %p', async (filename) => {
    const res = await History.load({
      file: path.join(fixturesDir, 'oci-archive', filename)
    });
    // console.log(JSON.stringify(res, null, 2));
    expect(res).toBeDefined();
  });
});
