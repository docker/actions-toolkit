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

import {OCI} from '../../src/oci/oci';

const fixturesDir = path.join(__dirname, '..', '.fixtures');
const tmpDir = fs.mkdtempSync(path.join(process.env.TEMP || os.tmpdir(), 'oci-oci-'));

afterEach(function () {
  rimraf.sync(tmpDir);
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
