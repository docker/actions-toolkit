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

import {describe, expect, it, jest, test} from '@jest/globals';
import * as semver from 'semver';

import {Exec} from '../../src/exec';
import {Regctl} from '../../src/regclient/regctl';

import {Image} from '../../src/types/oci/config';

describe('manifestGet', () => {
  // prettier-ignore
  test.each([
    ['moby/moby-bin:28.1.0-rc.2'],
    ['crazymax/diun:4.17.0'],
  ])('given %p', async image => {
    const regctl = new Regctl();
    const manifest = await regctl.manifestGet({
      image: image,
    });
    console.log(`${image} manifest: ${JSON.stringify(manifest, null, 2)}`);
    expect(manifest).not.toBeNull();
    expect(manifest?.config).toBeDefined();
    expect(manifest?.config.digest).not.toEqual('');
    expect(manifest?.layers).toBeDefined();
    expect(manifest?.layers.length).toBeGreaterThan(0);
  });
});

describe('blobGet', () => {
  // prettier-ignore
  test.each([
    ['moby/moby-bin', 'sha256:234fccbd13fde0ba978a19f728cbdc67e29bc76247ac560822bb6ae5236c0bf0'],
    ['crazymax/diun', 'sha256:1e4881f66e0ec0f1710b837002107050bbbc0a231d8a42d7f422b56a139900bb'],
  ])('given %p', async (repo, digest) => {
    const regctl = new Regctl();
    const blob = await regctl.blobGet({
      repository: repo,
      digest: digest
    });
    expect(blob).toBeDefined();
    console.log(`${repo}:@${digest} blob: ${JSON.stringify(JSON.parse(blob), null, 2)}`);
  });
});

describe('image config', () => {
  // prettier-ignore
  test.each([
    ['moby/moby-bin:28.1.0-rc.2'],
    ['crazymax/diun:4.17.0'],
  ])('given %p', async image => {
    const regctl = new Regctl();
    const manifest = await regctl.manifestGet({
      image: image,
    });
    expect(manifest).not.toBeNull();
    expect(manifest?.config).toBeDefined();
    expect(manifest?.config.digest).not.toEqual('');
    const blob = await regctl.blobGet({
      repository: image, // image works as well
      digest: manifest?.config.digest
    });
    const imageConfig = <Image>JSON.parse(blob);
    console.log(`${image} config: ${JSON.stringify(imageConfig, null, 2)}`);
    expect(imageConfig).not.toBeNull();
    expect(imageConfig.config).toBeDefined();
    expect(imageConfig?.config?.Labels).toBeDefined();
    expect(Object.keys(imageConfig?.config?.Labels || {}).length).toBeGreaterThan(0);
  });
});

describe('isAvailable', () => {
  it('checks regctl is available', async () => {
    const execSpy = jest.spyOn(Exec, 'getExecOutput');
    const regctl = new Regctl();
    await regctl.isAvailable();
    // eslint-disable-next-line jest/no-standalone-expect
    expect(execSpy).toHaveBeenCalledWith(`regctl`, [], {
      silent: true,
      ignoreReturnCode: true
    });
  });
});

describe('printVersion', () => {
  it('prints regctl version', async () => {
    const execSpy = jest.spyOn(Exec, 'exec');
    const regctl = new Regctl();
    await regctl.printVersion();
    expect(execSpy).toHaveBeenCalledWith(`regctl`, ['version'], {
      failOnStdErr: false
    });
  });
});

describe('version', () => {
  it('valid', async () => {
    const regctl = new Regctl();
    expect(semver.valid(await regctl.version())).not.toBeUndefined();
  });
});

describe('versionSatisfies', () => {
  test.each([
    ['v0.8.2', '>=0.6.0', true],
    ['v0.8.0', '>0.6.0', true],
    ['v0.8.0', '<0.3.0', false]
  ])('given %p', async (version, range, expected) => {
    const regctl = new Regctl();
    expect(await regctl.versionSatisfies(range, version)).toBe(expected);
  });
});
