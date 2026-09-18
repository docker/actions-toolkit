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

import {afterEach, describe, expect, it, vi} from 'vitest';
import fs from 'fs';
import path from 'path';
import * as core from '@actions/core';

import {BuildSecrets} from '../../src/github-builder/build-secrets.js';
import {Context} from '../../src/context.js';

vi.mock('@actions/core', () => ({setSecret: vi.fn(), exportVariable: vi.fn(), setOutput: vi.fn()}));

const directories: Array<string> = [];
afterEach(() => {
  vi.restoreAllMocks();
  directories.splice(0).forEach(directory => BuildSecrets.cleanup(directory));
});

describe('BuildSecrets', () => {
  it.each(['', '  \n', '---\n', '{}'])('does not create files for empty input %j', input => {
    expect(BuildSecrets.prepareBuild(input)).toEqual({directory: '', inputs: []});
    expect(BuildSecrets.prepareBake(input, 'app', ['app'])).toEqual({directory: '', inputs: []});
  });

  it.each(['[value]', 'value', 'key: [value]', 'key: {nested: value}'])('rejects invalid Build shape %j', input => {
    expect(() => BuildSecrets.prepareBuild(input)).toThrow(/build-secrets/);
  });

  it.each(['key: [value]', 'app: {key: {nested: value}}'])('rejects invalid Bake shape %j', input => {
    expect(() => BuildSecrets.prepareBake(input, 'app', ['app'])).toThrow(/build-secrets/);
  });

  it.each(['key: !PRIVATE value', 'key: *PRIVATE', 'key: PRIVATE\nkey: PRIVATE', 'key: [PRIVATE'])('does not expose YAML errors for %j', input => {
    expect(() => BuildSecrets.prepareBuild(input)).toThrow(/^Failed to parse build-secrets YAML at line \d+, column \d+$/);
    expect(() => BuildSecrets.prepareBake(input, 'app', ['app'])).toThrow(/^Failed to parse build-secrets YAML at line \d+, column \d+$/);
  });

  it.each(['', 'foo,bar', 'foo"bar', 'foo=bar', ' foo', 'foo ', 'foo\nbar', 'foo\rbar', 'GIT_AUTH_TOKEN'])('rejects Build ID %j', id => {
    expect(() => BuildSecrets.prepareBuild(`${JSON.stringify(id)}: value`)).toThrow(/Build secret/);
  });

  it.each(['', 'foo=bar', 'foo\nbar', 'foo\rbar'])('rejects Bake ID %j', id => {
    expect(() => BuildSecrets.prepareBake(`${JSON.stringify(id)}: value`, 'app', ['app'])).toThrow(/Build secret IDs/);
  });

  it.each(['empty: ""\nkeep: |+\n  line\n\n', 'empty: ""\nkeep: "line\\n\\n"'])('preserves exact bytes and masks values for %j', input => {
    const result = BuildSecrets.prepareBuild(input);
    directories.push(result.directory);
    expect(result.inputs).toEqual([`empty=${path.join(result.directory, '0')}`, `keep=${path.join(result.directory, '1')}`]);
    expect(fs.readFileSync(path.join(result.directory, '0'), 'utf8')).toBe('');
    expect(fs.readFileSync(path.join(result.directory, '1'), 'utf8')).toBe('line\n\n');
    expect(core.setSecret).toHaveBeenCalledWith('');
    expect(core.setSecret).toHaveBeenCalledWith('line\n\n');
    expect(core.exportVariable).not.toHaveBeenCalled();
    expect(core.setOutput).not.toHaveBeenCalled();
  });

  it('keeps scalar spellings and empty values without YAML coercion', () => {
    const result = BuildSecrets.prepareBuild('yes: yes\nnumber: 123\nboolean: true\nnull: ~\nempty: ""');
    directories.push(result.directory);
    expect(result.inputs.map((_, index) => fs.readFileSync(path.join(result.directory, String(index)), 'utf8'))).toEqual(['yes', '123', 'true', '~', '']);
  });

  it('scopes nested mappings without interpreting dots or commas in Bake IDs', () => {
    const result = BuildSecrets.prepareBake('release.token: first\n.npmrc: second\nrelease:\n  aws.credentials: third\n  foo,bar: fourth\n', 'app', ['app', 'release']);
    directories.push(result.directory);
    expect(result.inputs).toEqual(['app.secret.release.token', 'app.secret..npmrc', 'release.secret.aws.credentials', 'release.secret.foo,bar'].map((key, index) => `${key}=src=${path.join(result.directory, String(index))}`));
    expect(result.inputs.map((_, index) => fs.readFileSync(path.join(result.directory, String(index)), 'utf8'))).toEqual(['first', 'second', 'third', 'fourth']);
  });

  it.each(['token: value', 'other:\n  token: value'])('rejects unresolved targets before creating files for %j', input => {
    const mkdir = vi.spyOn(fs, 'mkdtempSync');
    expect(() => BuildSecrets.prepareBake(input, 'missing', ['app'])).toThrow(/not part of the resolved Bake definition/);
    expect(mkdir).not.toHaveBeenCalled();
  });

  it('preserves override order for duplicate canonical Bake IDs', () => {
    const result = BuildSecrets.prepareBake('token: first\napp:\n  token: second', 'app', ['app']);
    directories.push(result.directory);
    expect(result.inputs).toEqual([0, 1].map(index => `app.secret.token=src=${path.join(result.directory, String(index))}`));
  });

  it('uses private files, unique directories and idempotent cleanup', () => {
    const write = vi.spyOn(fs, 'writeFileSync');
    const first = BuildSecrets.prepareBuild('token: value');
    const second = BuildSecrets.prepareBuild('token: value');
    directories.push(first.directory, second.directory);
    expect(first.directory).not.toBe(second.directory);
    expect(write).toHaveBeenCalledWith(path.join(first.directory, '0'), 'value', {mode: 0o600});
    BuildSecrets.cleanup(first.directory);
    BuildSecrets.cleanup(first.directory);
    BuildSecrets.cleanup('');
    expect(fs.existsSync(first.directory)).toBe(false);
    expect(fs.existsSync(second.directory)).toBe(true);
  });

  it.skipIf(process.platform === 'win32')('sets restrictive POSIX permissions', () => {
    const result = BuildSecrets.prepareBuild('token: value');
    directories.push(result.directory);
    expect(fs.statSync(result.directory).mode & 0o777).toBe(0o700);
    expect(fs.statSync(path.join(result.directory, '0')).mode & 0o777).toBe(0o600);
  });

  it('removes partial files if a write fails', () => {
    const before = fs.readdirSync(Context.tmpDir());
    const write = fs.writeFileSync.bind(fs);
    vi.spyOn(fs, 'writeFileSync').mockImplementation((file, data, options) => {
      if (path.basename(String(file)) === '1') {
        throw new Error('write failed');
      }
      return write(file, data, options);
    });
    expect(() => BuildSecrets.prepareBuild('first: value\nsecond: value')).toThrow('write failed');
    expect(fs.readdirSync(Context.tmpDir())).toEqual(before);
  });
});
