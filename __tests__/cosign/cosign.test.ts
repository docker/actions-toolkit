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

import {describe, expect, it, vi, test} from 'vitest';
import fs from 'fs';
import path from 'path';
import * as semver from 'semver';

import {Exec} from '../../src/exec.js';
import {Cosign} from '../../src/cosign/cosign.js';

const fixturesDir = path.join(__dirname, '..', '.fixtures');

describe('isAvailable', () => {
  it('checks Cosign is available', async () => {
    const execSpy = vi.spyOn(Exec, 'getExecOutput');
    const cosign = new Cosign();
    await cosign.isAvailable();
    expect(execSpy).toHaveBeenCalledWith(`cosign`, [], {
      silent: true,
      ignoreReturnCode: true
    });
  });
});

describe('printVersion', () => {
  it('prints Cosign version', async () => {
    const execSpy = vi.spyOn(Exec, 'exec');
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

describe('getErrorMessage', () => {
  test.each([
    {name: 'empty output', stderr: '', expected: 'unknown error'},
    {name: 'whitespace-only output', stderr: ' \r\n\t\n', expected: 'unknown error'},
    {name: 'trailing blank lines', stderr: 'warning\n  signing failed  \n \t\n', expected: 'signing failed'},
    {name: 'CRLF output', stderr: 'warning\r\nverification failed\r\n', expected: 'verification failed'},
    {name: 'carriage returns', stderr: 'progress\rverification failed\r', expected: 'verification failed'},
    {name: 'terminal formatting', stderr: 'warning\n\u001b[31msigning failed\u001b[0m\n', expected: 'signing failed'},
    {name: 'formatting-only output', stderr: '\u001b[0m\n', expected: 'unknown error'},
    {name: 'execution error', stderr: 'Error: signing failed\n2026/09/11 12:00:00 error during command execution: signing failed\n', expected: '2026/09/11 12:00:00 error during command execution: signing failed'}
  ])('$name', ({stderr, expected}) => {
    expect(Cosign.getErrorMessage(stderr)).toBe(expected);
  });
});

describe('versionSatisfies', () => {
  test.each([
    ['v0.4.1', '>=0.3.2', true],
    ['v0.8.0', '>0.6.0', true],
    ['v0.8.0', '<0.3.0', false]
  ])('given %o', async (version, range, expected) => {
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
  ])('parsing %o', async (fixturePath: string) => {
    const signResult = Cosign.parseCommandOutput(fs.readFileSync(fixturePath, 'utf-8'));
    expect(signResult).toBeDefined();
    expect(signResult.bundle).toBeDefined();
  });

  // prettier-ignore
  test.each([
    [path.join(fixturesDir, 'cosign', 'verify-output-err1.txt')],
  ])('parsing %o', async (fixturePath: string) => {
    const signResult = Cosign.parseCommandOutput(fs.readFileSync(fixturePath, 'utf-8'));
    expect(signResult).toBeDefined();
    expect(signResult.bundle).toBeUndefined();
    expect(signResult.errors).toBeDefined();
  });
});
