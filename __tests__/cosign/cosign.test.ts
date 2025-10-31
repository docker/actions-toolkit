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
import fs from 'fs';
import path from 'path';
import * as semver from 'semver';

import {Exec} from '../../src/exec';
import {Cosign} from '../../src/cosign/cosign';

const fixturesDir = path.join(__dirname, '..', '.fixtures');

describe('isAvailable', () => {
  it('checks Cosign is available', async () => {
    const execSpy = jest.spyOn(Exec, 'getExecOutput');
    const cosign = new Cosign();
    await cosign.isAvailable();
    // eslint-disable-next-line jest/no-standalone-expect
    expect(execSpy).toHaveBeenCalledWith(`cosign`, [], {
      silent: true,
      ignoreReturnCode: true
    });
  });
});

describe('printVersion', () => {
  it('prints Cosign version', async () => {
    const execSpy = jest.spyOn(Exec, 'exec');
    const cosign = new Cosign();
    await cosign.printVersion();
    expect(execSpy).toHaveBeenCalledWith(`cosign`, ['version', '--json'], {
      failOnStdErr: false
    });
  });
});

describe('version', () => {
  it('valid', async () => {
    const cosign = new Cosign();
    expect(semver.valid(await cosign.version())).not.toBeUndefined();
  });
});

describe('versionSatisfies', () => {
  test.each([
    ['v0.4.1', '>=0.3.2', true],
    ['v0.8.0', '>0.6.0', true],
    ['v0.8.0', '<0.3.0', false]
  ])('given %p', async (version, range, expected) => {
    const cosign = new Cosign();
    expect(await cosign.versionSatisfies(range, version)).toBe(expected);
  });
});

describe('parseCommandOutput', () => {
  // prettier-ignore
  test.each([
    [path.join(fixturesDir, 'cosign', 'sign-output1.txt')],
    [path.join(fixturesDir, 'cosign', 'sign-output2.txt')],
    [path.join(fixturesDir, 'cosign', 'sign-output3.txt')],
  ])('parsing %p', async (fixturePath: string) => {
    const signResult = Cosign.parseCommandOutput(fs.readFileSync(fixturePath, 'utf-8'));
    expect(signResult).toBeDefined();
    expect(signResult.bundle).toBeDefined();
  });

  // prettier-ignore
  test.each([
    [path.join(fixturesDir, 'cosign', 'verify-output-err1.txt')],
  ])('parsing %p', async (fixturePath: string) => {
    const signResult = Cosign.parseCommandOutput(fs.readFileSync(fixturePath, 'utf-8'));
    expect(signResult).toBeDefined();
    expect(signResult.bundle).toBeUndefined();
    expect(signResult.errors).toBeDefined();
  });
});
