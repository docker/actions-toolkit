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

import {afterEach, beforeEach, describe, expect, it, test, vi} from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import * as semver from 'semver';
import {ExecOutput} from '@actions/exec';

import {Cosign} from '../../src/cosign/cosign.js';
import {Exec} from '../../src/exec.js';
import {ImageTools} from '../../src/buildx/imagetools.js';
import {Sigstore} from '../../src/sigstore/sigstore.js';

const tmpDir = fs.mkdtempSync(path.join(process.env.TEMP || os.tmpdir(), 'sigstore-test-'));
const failedExecOutput: ExecOutput = {
  exitCode: 1,
  stdout: '',
  stderr: 'cosign failed'
};

describe('signAttestationManifests', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      ACTIONS_ID_TOKEN_REQUEST_URL: 'https://token.actions.githubusercontent.com'
    };
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  test.each([
    ['v3.0.6', false, '--with-default-services=true', true, false],
    ['v3.1.1', false, '--with-default-rekor-v2=true', false, false],
    ['v3.1.1', true, '--with-default-services=true', false, true]
  ])('given cosign %s and noTransparencyLog=%s', async (version, noTransparencyLog, expectedDefaultServiceArg, expectedNewBundleFormat, expectedNoDefaultRekor) => {
    const cosign = mockCosign(version);
    const sigstore = new Sigstore({
      cosign,
      imageTools: mockImageTools()
    });

    const execSpy = vi.spyOn(Exec, 'exec').mockImplementation(async (_cmd, args) => {
      const outArg = args?.find(arg => arg.startsWith('--out='));
      if (outArg) {
        fs.writeFileSync(outArg.substring('--out='.length), '{}', 'utf-8');
      }
      return 0;
    });
    const execOutputSpy = vi.spyOn(Exec, 'getExecOutput').mockResolvedValue(failedExecOutput);

    await expect(
      sigstore.signAttestationManifests({
        imageNames: ['example.com/foo/bar'],
        imageDigest: 'sha256:manifest',
        noTransparencyLog
      })
    ).rejects.toThrow('Cosign sign command failed');

    const createConfigArgs = execSpy.mock.calls[0][1] ?? [];
    expect(createConfigArgs).toContain(expectedDefaultServiceArg);
    expect(createConfigArgs.includes('--with-default-rekor-v2=true')).toBe(expectedDefaultServiceArg === '--with-default-rekor-v2=true');
    expect(createConfigArgs.includes('--no-default-rekor=true')).toBe(expectedNoDefaultRekor);

    const signArgs = execOutputSpy.mock.calls[0][1] ?? [];
    expect(signArgs.includes('--new-bundle-format')).toBe(expectedNewBundleFormat);
    expect(signArgs.some(arg => arg.startsWith('--signing-config='))).toBe(true);
  });
});

describe('verifyImageAttestation', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  test.each([
    ['v3.0.6', true],
    ['v3.1.1', false]
  ])('given cosign %s', async (version, expectedNewBundleFormat) => {
    const sigstore = new Sigstore({
      cosign: mockCosign(version)
    });
    const execOutputSpy = vi.spyOn(Exec, 'getExecOutput').mockResolvedValue(failedExecOutput);

    await expect(
      sigstore.verifyImageAttestation('example.com/foo/bar@sha256:attestation', {
        certificateIdentityRegexp: '^https://github.com/docker/actions-toolkit/.*$'
      })
    ).rejects.toThrow('Cosign verify command failed');

    const verifyArgs = execOutputSpy.mock.calls[0][1] ?? [];
    expect(verifyArgs).toContain('--experimental-oci11');
    expect(verifyArgs.includes('--new-bundle-format')).toBe(expectedNewBundleFormat);
  });
});

describe('verifySignedArtifacts', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('omits the deprecated bundle format flag for cosign 3.1.1', async () => {
    const sigstore = new Sigstore({
      cosign: mockCosign('v3.1.1')
    });
    const execOutputSpy = vi.spyOn(Exec, 'getExecOutput').mockResolvedValue({
      exitCode: 0,
      stdout: '',
      stderr: ''
    });
    const provenancePath = path.join(tmpDir, 'provenance.json');
    const artifactPath = path.join(tmpDir, 'artifact');

    await sigstore.verifySignedArtifacts(
      {
        [provenancePath]: {
          bundlePath: path.join(tmpDir, 'provenance.sigstore.json'),
          certificate: '',
          payload: {} as never,
          subjects: [
            {
              name: path.basename(artifactPath),
              digest: {
                sha256: 'digest'
              }
            }
          ]
        }
      },
      {
        certificateIdentityRegexp: '^https://github.com/docker/actions-toolkit/.*$'
      }
    );

    const verifyArgs = execOutputSpy.mock.calls[0][1] ?? [];
    expect(verifyArgs).not.toContain('--new-bundle-format');
    expect(verifyArgs).toContain('--bundle');
  });
});

function mockCosign(version: string): Cosign {
  return {
    binPath: 'cosign',
    isAvailable: vi.fn().mockResolvedValue(true),
    versionSatisfies: vi.fn(async (range: string) => {
      return semver.satisfies(version, range) || /^[0-9a-f]{7}$/.exec(version) !== null;
    })
  } as unknown as Cosign;
}

function mockImageTools(): ImageTools {
  return {
    attestationDigests: vi.fn().mockResolvedValue(['sha256:attestation'])
  } as unknown as ImageTools;
}
