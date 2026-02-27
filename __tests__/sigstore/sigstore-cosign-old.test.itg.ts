/**
 * Copyright 2026 actions-toolkit authors
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

import {beforeAll, describe, expect, it} from 'vitest';
import * as path from 'path';

import {Buildx} from '../../src/buildx/buildx.js';
import {Build} from '../../src/buildx/build.js';
import {Install as CosignInstall} from '../../src/cosign/install.js';
import {Docker} from '../../src/docker/docker.js';
import {Exec} from '../../src/exec.js';
import {Sigstore} from '../../src/sigstore/sigstore.js';

const fixturesDir = path.join(__dirname, '..', '.fixtures');

const runTest = process.env.GITHUB_ACTIONS && process.env.GITHUB_ACTIONS === 'true' && process.env.ImageOS && process.env.ImageOS.startsWith('ubuntu');

const maybeIdToken = runTest && process.env.ACTIONS_ID_TOKEN_REQUEST_URL ? describe : describe.skip;

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
