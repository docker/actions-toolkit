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

import {afterEach, describe, expect, test} from '@jest/globals';
import fs from 'fs';
import os from 'os';
import path from 'path';
import * as rimraf from 'rimraf';

import {mockArch, mockPlatform} from '../.helpers/os';

import {OCI} from '../../src/oci/oci';

import {Platform} from '../../src/types/oci/descriptor';

const fixturesDir = path.join(__dirname, '..', '.fixtures');
const tmpDir = fs.mkdtempSync(path.join(process.env.TEMP || os.tmpdir(), 'oci-oci-'));

afterEach(function () {
  rimraf.sync(tmpDir);
});

describe('defaultPlatform', () => {
  test.each([
    ['win32', 'x64', {architecture: 'amd64', os: 'windows'}],
    ['win32', 'arm64', {architecture: 'arm64', os: 'windows'}],
    ['darwin', 'x64', {architecture: 'amd64', os: 'darwin'}],
    ['darwin', 'arm64', {architecture: 'arm64', os: 'darwin'}],
    ['linux', 'ia32', {architecture: '386', os: 'linux'}],
    ['linux', 'x64', {architecture: 'amd64', os: 'linux'}],
    ['linux', 'arm64', {architecture: 'arm64', os: 'linux'}],
    ['linux', 'ppc64', {architecture: 'ppc64le', os: 'linux'}],
    ['linux', 's390x', {architecture: 's390x', os: 'linux'}]
  ])('default platform for %s/%s', async (os: string, arch: string, expected: Platform) => {
    mockPlatform(os as NodeJS.Platform);
    mockArch(arch);
    const res = OCI.defaultPlatform();
    expect(res).toEqual(expected);
  });
});

describe('loadArchive', () => {
  // prettier-ignore
  test.each(fs.readdirSync(path.join(fixturesDir, 'oci-archive')).filter(file => {
      return fs.statSync(path.join(path.join(fixturesDir, 'oci-archive'), file)).isFile();
    }).map(filename => [filename]))('extracting %p', async (filename) => {
    const res = await OCI.loadArchive({
      file: path.join(fixturesDir, 'oci-archive', filename)
    });
    expect(res).toBeDefined();
    expect(res?.root.index).toBeDefined();
    expect(res?.root.layout).toBeDefined();
    // console.log(JSON.stringify(res, null, 2));
  });
});
