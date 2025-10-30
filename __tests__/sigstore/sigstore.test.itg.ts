/**
 * Copyright 2025 actions-toolkit authors
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
import fs from 'fs';
import * as path from 'path';

import {Sigstore} from '../../src/sigstore/sigstore';

const fixturesDir = path.join(__dirname, '..', '.fixtures');

const maybe = process.env.GITHUB_ACTIONS && process.env.GITHUB_ACTIONS === 'true' && process.env.ACTIONS_ID_TOKEN_REQUEST_URL && process.env.ImageOS && process.env.ImageOS.startsWith('ubuntu') ? describe : describe.skip;

// needs current GitHub repo info
jest.unmock('@actions/github');

maybe('signProvenanceBlobs', () => {
  it('single platform', async () => {
    const sigstore = new Sigstore();
    const results = await sigstore.signProvenanceBlobs({
      localExportDir: path.join(fixturesDir, 'sigstore', 'single')
    });
    expect(Object.keys(results).length).toEqual(1);
    const provenancePath = Object.keys(results)[0];
    expect(provenancePath).toEqual(path.join(fixturesDir, 'sigstore', 'single', 'provenance.json'));
    expect(fs.existsSync(results[provenancePath].bundlePath)).toBe(true);
    expect(results[provenancePath].bundle).toBeDefined();
    expect(results[provenancePath].certificate).toBeDefined();
    expect(results[provenancePath].tlogID).toBeDefined();
    expect(results[provenancePath].attestationID).not.toBeDefined();
    console.log(provenancePath, JSON.stringify(results[provenancePath].bundle, null, 2));
  });
  it('multi-platform', async () => {
    const sigstore = new Sigstore();
    const results = await sigstore.signProvenanceBlobs({
      localExportDir: path.join(fixturesDir, 'sigstore', 'multi')
    });
    expect(Object.keys(results).length).toEqual(2);
    for (const [provenancePath, res] of Object.entries(results)) {
      expect(provenancePath).toMatch(/linux_(amd64|arm64)\/provenance.json/);
      expect(fs.existsSync(res.bundlePath)).toBe(true);
      expect(res.bundle).toBeDefined();
      expect(res.certificate).toBeDefined();
      expect(res.tlogID).toBeDefined();
      expect(res.attestationID).not.toBeDefined();
      console.log(provenancePath, JSON.stringify(res.bundle, null, 2));
    }
  });
});
