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

import {BakeVars} from '../../src/github-builder/bake-vars.js';

describe('BakeVars.resolve', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('forwards any GITHUB_ or RUNNER_ variable in sorted order', () => {
    expect(BakeVars.resolve([], {RUNNER_CUSTOM: 'custom-runner', GITHUB_SHA: 'abc123', RUNNER_OS: 'Linux', GITHUB_CUSTOM: 'custom-github'})).toEqual([
      'GITHUB_CUSTOM=custom-github',
      'GITHUB_SHA=abc123',
      'RUNNER_CUSTOM=custom-runner',
      'RUNNER_OS=Linux'
    ]);
  });

  it('excludes other environment variables and requires exact prefixes', () => {
    expect(BakeVars.resolve([], {BUILDX_VERSION: 'v0.37.2', PATH: '/usr/bin', GITHUB: 'github', RUNNER: 'runner', github_SHA: 'abc123', OTHER_GITHUB_SHA: 'abc123'})).toEqual([]);
  });

  it('forwards only the exact CI name and preserves its value', () => {
    expect(BakeVars.resolve([], {CI: 'false', CI_CUSTOM: 'excluded', ci: 'excluded', ACTIONS_RUNTIME_TOKEN: 'excluded'})).toEqual(['CI=false']);
  });

  it('lets caller variables override CI', () => {
    expect(BakeVars.resolve(['CI=false'], {CI: 'true'})).toEqual(['CI=true', 'CI=false']);
  });

  it('appends caller variables so they take precedence over forwarded values', () => {
    const vars = ['GITHUB_SHA=override', 'XX_VERSION=1.9.0', 'GITHUB_SHA=final'];
    const env = {GITHUB_SHA: 'abc123'};
    expect(BakeVars.resolve(vars, env)).toEqual(['GITHUB_SHA=abc123', ...vars]);
    expect(vars).toEqual(['GITHUB_SHA=override', 'XX_VERSION=1.9.0', 'GITHUB_SHA=final']);
    expect(env).toEqual({GITHUB_SHA: 'abc123'});
  });

  it('preserves empty values', () => {
    expect(BakeVars.resolve(['EMPTY='], {GITHUB_EMPTY: '', RUNNER_UNDEFINED: undefined})).toEqual(['GITHUB_EMPTY=', 'RUNNER_UNDEFINED=', 'EMPTY=']);
  });

  it('preserves commas, quotes, equals signs and whitespace in values', () => {
    const value = '  "one,two"=three  ';
    expect(BakeVars.resolve([`CUSTOM=${value}`], {GITHUB_CUSTOM: value})).toEqual([`GITHUB_CUSTOM=${value}`, `CUSTOM=${value}`]);
  });

  it('defaults to the process environment', () => {
    vi.stubEnv('CI', 'true');
    vi.stubEnv('GITHUB_BAKE_VARS_TEST', 'github');
    vi.stubEnv('RUNNER_BAKE_VARS_TEST', 'runner');
    vi.stubEnv('BAKE_VARS_TEST', 'excluded');
    const vars = BakeVars.resolve([]);
    expect(vars).toContain('CI=true');
    expect(vars).toContain('GITHUB_BAKE_VARS_TEST=github');
    expect(vars).toContain('RUNNER_BAKE_VARS_TEST=runner');
    expect(vars).not.toContain('BAKE_VARS_TEST=excluded');
  });
});
