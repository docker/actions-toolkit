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

import {describe, expect, it, vi} from 'vitest';
import * as core from '@actions/core';

import {RunnerMapping} from '../../src/github-builder/runner-mapping.js';

vi.mock('@actions/core', () => ({warning: vi.fn()}));

describe('parse', () => {
  it('accepts a label and ignores blank lines without mutating the input', () => {
    const input = [' ', ' ubuntu-24.04 ', '\t'];
    expect(RunnerMapping.parse(input)).toEqual({defaultRunner: 'ubuntu-24.04', rules: []});
    expect(input).toEqual([' ', ' ubuntu-24.04 ', '\t']);
    expect(core.warning).not.toHaveBeenCalled();
  });

  it('parses mappings, preserving rule order and values after the first equals sign', () => {
    expect(RunnerMapping.parse([' linux/arm = custom=arm ', ' default = ubuntu-24.04 ', 'linux = ubuntu-latest'])).toEqual({
      defaultRunner: 'ubuntu-24.04',
      rules: [
        {pattern: 'linux/arm', runner: 'custom=arm'},
        {pattern: 'linux', runner: 'ubuntu-latest'}
      ]
    });
  });

  it('uses the last default mapping', () => {
    expect(RunnerMapping.parse(['default=first', 'default=last'])).toEqual({defaultRunner: 'last', rules: []});
  });

  it.each([
    ['amd64', 'ubuntu-24.04'],
    ['arm64', 'ubuntu-24.04-arm']
  ])('preserves deprecated alias %s and its warning', (alias, runner) => {
    expect(RunnerMapping.parse([alias])).toEqual({defaultRunner: runner, rules: []});
    expect(core.warning).toHaveBeenCalledExactlyOnceWith(`The runner input value "${alias}" is deprecated; use runner=${runner} instead`);
  });

  it('preserves auto mappings and its warning', () => {
    expect(RunnerMapping.parse(['auto'])).toEqual({
      defaultRunner: 'ubuntu-24.04',
      rules: [
        {pattern: 'linux/arm', runner: 'ubuntu-24.04-arm'},
        {pattern: 'linux/arm64', runner: 'ubuntu-24.04-arm'}
      ]
    });
    expect(core.warning).toHaveBeenCalledExactlyOnceWith('The runner input value "auto" is deprecated; use a runner mapping with default=ubuntu-24.04, linux/arm=ubuntu-24.04-arm, and linux/arm64=ubuntu-24.04-arm instead');
  });

  it('does not expand aliases used as mapping values', () => {
    expect(RunnerMapping.parse(['default=auto', 'linux/arm=arm64'])).toEqual({defaultRunner: 'auto', rules: [{pattern: 'linux/arm', runner: 'arm64'}]});
    expect(core.warning).not.toHaveBeenCalled();
  });

  it.each([
    [[], 'runner input cannot be empty'],
    [[' ', '\t'], 'runner input cannot be empty'],
    [['first', 'second'], 'Invalid runner mapping: first'],
    [['default=runner', 'linux'], 'Invalid runner mapping: linux'],
    [['=runner'], 'Runner mapping pattern cannot be empty'],
    [['default= '], 'Runner mapping value cannot be empty for default'],
    [['default=runner', 'linux= '], 'Runner mapping value cannot be empty for linux'],
    [['linux=runner'], 'Runner mapping must define a default runner'],
    [['default=runner', '/linux=runner'], 'Runner mapping pattern is not a valid platform prefix: /linux'],
    [['default=runner', 'linux/=runner'], 'Runner mapping pattern is not a valid platform prefix: linux/'],
    [['default=runner', 'linux//arm=runner'], 'Runner mapping pattern is not a valid platform prefix: linux//arm']
  ])('rejects invalid mapping %j', (input, message) => {
    expect(() => RunnerMapping.parse(input)).toThrow(message);
  });
});

describe('resolve', () => {
  const config = RunnerMapping.parse(['default=fallback', 'linux/arm/v7=armv7', 'linux/arm=arm', 'linux=linux', 'linux/arm64=arm64']);

  it.each([
    [undefined, 'fallback'],
    ['', 'fallback'],
    ['windows/amd64', 'fallback'],
    ['linux', 'linux'],
    ['linux/amd64', 'linux'],
    ['linux/arm', 'arm'],
    ['linux/arm/v6', 'arm'],
    ['linux/arm/v7', 'armv7'],
    ['linux/arm64', 'arm64'],
    ['linux/arm64/v8', 'arm64'],
    ['linux/arm64ish', 'linux'],
    ['linuxish/arm', 'fallback'],
    ['Linux/arm', 'fallback']
  ])('resolves %j to %s', (platform, expected) => {
    expect(RunnerMapping.resolve(config, platform)).toBe(expected);
  });

  it('uses the later rule on ties, without overriding a more specific match', () => {
    const config = RunnerMapping.parse(['default=fallback', 'linux/arm/v7=specific', 'linux/arm=first', 'linux/arm=last']);
    expect(RunnerMapping.resolve(config, 'linux/arm')).toBe('last');
    expect(RunnerMapping.resolve(config, 'linux/arm/v7')).toBe('specific');
    expect(config.rules.map(rule => rule.runner)).toEqual(['specific', 'first', 'last']);
  });

  it('uses a single label for any platform', () => {
    expect(RunnerMapping.resolve(RunnerMapping.parse(['custom-runner']), 'linux/arm64')).toBe('custom-runner');
  });
});
