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

import {beforeAll, describe, expect, jest, it, test} from '@jest/globals';
import fs from 'fs';
import * as path from 'path';

import {Buildx} from '../../src/buildx/buildx';
import {Build} from '../../src/buildx/build';
import {Install as CosignInstall} from '../../src/cosign/install';
import {Docker} from '../../src/docker/docker';
import {Exec} from '../../src/exec';
import {Sigstore} from '../../src/sigstore/sigstore';

const fixturesDir = path.join(__dirname, '..', '.fixtures');

const runTest = process.env.GITHUB_ACTIONS && process.env.GITHUB_ACTIONS === 'true' && process.env.ImageOS && process.env.ImageOS.startsWith('ubuntu');

const maybe = runTest ? describe : describe.skip;
const maybeIdToken = runTest && process.env.ACTIONS_ID_TOKEN_REQUEST_URL ? describe : describe.skip;

// needs current GitHub repo info
jest.unmock('@actions/github');

beforeAll(async () => {
  const cosignInstall = new CosignInstall();
  const cosignBinPath = await cosignInstall.download({
    version: 'v3.0.2'
  });
  await cosignInstall.install(cosignBinPath);
}, 100000);

maybeIdToken('signAttestationManifests', () => {
  it('build, sign and verify', async () => {
    const buildx = new Buildx();
    const build = new Build({buildx: buildx});
    const imageName = 'ghcr.io/docker/actions-toolkit/test';

    await expect(
      (async () => {
        await Docker.getExecOutput(['login', '--password-stdin', '--username', process.env.GITHUB_REPOSITORY_OWNER || 'docker', 'ghcr.io'], {
          input: Buffer.from(process.env.GITHUB_TOKEN || '')
        });
      })()
    ).resolves.not.toThrow();

    await expect(
      (async () => {
        // prettier-ignore
        const buildCmd = await buildx.getCommand([
          '--builder', process.env.CTN_BUILDER_NAME ?? 'default',
          'build',
          '-f', path.join(fixturesDir, 'hello.Dockerfile'),
          '--provenance=mode=max',
          '--tag', `${imageName}:sigstore-itg`,
          '--platform', 'linux/amd64,linux/arm64',
          '--push',
          '--metadata-file', build.getMetadataFilePath(),
          fixturesDir
        ]);
        await Exec.exec(buildCmd.command, buildCmd.args);
      })()
    ).resolves.not.toThrow();

    const metadata = build.resolveMetadata();
    expect(metadata).toBeDefined();
    const buildDigest = build.resolveDigest(metadata);
    expect(buildDigest).toBeDefined();

    const sigstore = new Sigstore();
    const signResults = await sigstore.signAttestationManifests({
      imageNames: [imageName],
      imageDigest: buildDigest!
    });
    expect(Object.keys(signResults).length).toEqual(2);

    const verifyResults = await sigstore.verifySignedManifests(signResults, {
      certificateIdentityRegexp: `^https://github.com/docker/actions-toolkit/.github/workflows/test.yml.*$`
    });
    expect(Object.keys(verifyResults).length).toEqual(2);
  }, 100000);
});

maybe('verifyImageAttestations', () => {
  test.each([
    ['moby/buildkit:master@sha256:84014da3581b2ff2c14cb4f60029cf9caa272b79e58f2e89c651ea6966d7a505', `^https://github.com/docker/github-builder-experimental/.github/workflows/bake.yml.*$`],
    ['docker/dockerfile-upstream:master@sha256:3e8cd5ebf48acd1a1939649ad1c62ca44c029852b22493c16a9307b654334958', `^https://github.com/docker/github-builder-experimental/.github/workflows/bake.yml.*$`]
  ])(
    'given %p',
    async (image, certificateIdentityRegexp) => {
      const sigstore = new Sigstore();
      const verifyResults = await sigstore.verifyImageAttestations(image, {
        certificateIdentityRegexp: certificateIdentityRegexp
      });
      expect(Object.keys(verifyResults).length).toBeGreaterThan(0);
      for (const [attestationRef, res] of Object.entries(verifyResults)) {
        expect(attestationRef).toBeDefined();
        expect(res.cosignArgs).toBeDefined();
        expect(res.signatureManifestDigest).toBeDefined();
      }
    },
    60000
  );
});

maybeIdToken('signProvenanceBlobs', () => {
  it('single platform', async () => {
    const sigstore = new Sigstore();
    const results = await sigstore.signProvenanceBlobs({
      localExportDir: path.join(fixturesDir, 'sigstore', 'single')
    });
    expect(Object.keys(results).length).toEqual(1);
    const provenancePath = Object.keys(results)[0];
    expect(provenancePath).toEqual(path.join(fixturesDir, 'sigstore', 'single', 'provenance.json'));
    expect(fs.existsSync(results[provenancePath].bundlePath)).toBe(true);
    expect(results[provenancePath].payload).toBeDefined();
    expect(results[provenancePath].certificate).toBeDefined();
    expect(results[provenancePath].tlogID).toBeDefined();
    console.log(provenancePath, JSON.stringify(results[provenancePath].payload, null, 2));
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
      expect(res.payload).toBeDefined();
      expect(res.certificate).toBeDefined();
      expect(res.tlogID).toBeDefined();
      console.log(provenancePath, JSON.stringify(res.payload, null, 2));
    }
  });
});

maybeIdToken('verifySignedArtifacts', () => {
  it('sign and verify', async () => {
    const sigstore = new Sigstore();
    const signResults = await sigstore.signProvenanceBlobs({
      localExportDir: path.join(fixturesDir, 'sigstore', 'multi')
    });
    expect(Object.keys(signResults).length).toEqual(2);

    const verifyResults = await sigstore.verifySignedArtifacts(signResults, {
      certificateIdentityRegexp: `^https://github.com/docker/actions-toolkit/.github/workflows/test.yml.*$`
    });
    expect(Object.keys(verifyResults).length).toEqual(2);
    for (const [artifactPath, res] of Object.entries(verifyResults)) {
      expect(fs.existsSync(artifactPath)).toBe(true);
      expect(res.bundlePath).toBeDefined();
      expect(res.cosignArgs).toBeDefined();
    }
  });
});
