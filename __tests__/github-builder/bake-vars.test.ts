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

  it('forwards metadata outputs in sorted order', () => {
    const json = '{"tags":["example/app:latest","example/app:main"],"labels":{"version":"1.2.3"}}';
    expect(
      BakeVars.resolve([], {
        DOCKER_METADATA_OUTPUT_VERSION: '1.2.3',
        DOCKER_METADATA_OUTPUT_TAG_NAMES: 'latest',
        DOCKER_METADATA_OUTPUT_JSON: json,
        DOCKER_METADATA_OUTPUT_BAKE_FILE_TAGS: '/tmp/tags.json',
        DOCKER_METADATA_OUTPUT_BAKE_FILE_LABELS: '/tmp/labels.json',
        DOCKER_METADATA_OUTPUT_BAKE_FILE_ANNOTATIONS: '/tmp/annotations.json',
        DOCKER_METADATA_OUTPUT_BAKE_FILE: '/tmp/metadata.json'
      })
    ).toEqual([
      'DOCKER_METADATA_OUTPUT_BAKE_FILE=/tmp/metadata.json',
      'DOCKER_METADATA_OUTPUT_BAKE_FILE_ANNOTATIONS=/tmp/annotations.json',
      'DOCKER_METADATA_OUTPUT_BAKE_FILE_LABELS=/tmp/labels.json',
      'DOCKER_METADATA_OUTPUT_BAKE_FILE_TAGS=/tmp/tags.json',
      `DOCKER_METADATA_OUTPUT_JSON=${json}`,
      'DOCKER_METADATA_OUTPUT_TAG_NAMES=latest',
      'DOCKER_METADATA_OUTPUT_VERSION=1.2.3'
    ]);
  });

  it('excludes metadata settings and requires the exact output prefix', () => {
    expect(
      BakeVars.resolve([], {
        DOCKER_METADATA_SET_OUTPUT_ENV: 'true',
        DOCKER_METADATA_ANNOTATIONS_LEVELS: 'manifest,index',
        DOCKER_METADATA_OUTPUT: 'excluded',
        DOCKER_METADATA_OUTPUTVERSION: 'excluded',
        docker_METADATA_OUTPUT_VERSION: 'excluded',
        OTHER_DOCKER_METADATA_OUTPUT_VERSION: 'excluded'
      })
    ).toEqual([]);
  });

  it('appends caller variables after metadata outputs', () => {
    const vars = ['DOCKER_METADATA_OUTPUT_VERSION=override', 'DOCKER_METADATA_OUTPUT_VERSION=final'];
    const env = {DOCKER_METADATA_OUTPUT_VERSION: '1.2.3'};
    expect(BakeVars.resolve(vars, env)).toEqual(['DOCKER_METADATA_OUTPUT_VERSION=1.2.3', ...vars]);
    expect(vars).toEqual(['DOCKER_METADATA_OUTPUT_VERSION=override', 'DOCKER_METADATA_OUTPUT_VERSION=final']);
    expect(env).toEqual({DOCKER_METADATA_OUTPUT_VERSION: '1.2.3'});
  });

  it('preserves multiline metadata outputs as single variable entries', () => {
    const tags = 'example/app:latest\nexample/app:main\n';
    const labels = 'org.opencontainers.image.version=1.2.3\r\norg.opencontainers.image.title=  "one,two"=three  \r\n';
    const annotations = 'manifest:org.opencontainers.image.version=1.2.3\nindex:org.opencontainers.image.title=example';
    expect(
      BakeVars.resolve([], {
        DOCKER_METADATA_OUTPUT_TAGS: tags,
        DOCKER_METADATA_OUTPUT_LABELS: labels,
        DOCKER_METADATA_OUTPUT_ANNOTATIONS: annotations
      })
    ).toEqual([`DOCKER_METADATA_OUTPUT_ANNOTATIONS=${annotations}`, `DOCKER_METADATA_OUTPUT_LABELS=${labels}`, `DOCKER_METADATA_OUTPUT_TAGS=${tags}`]);
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
    expect(BakeVars.resolve(['EMPTY='], {DOCKER_METADATA_OUTPUT_VERSION: '', GITHUB_EMPTY: '', RUNNER_UNDEFINED: undefined})).toEqual(['DOCKER_METADATA_OUTPUT_VERSION=', 'GITHUB_EMPTY=', 'RUNNER_UNDEFINED=', 'EMPTY=']);
  });

  it('preserves commas, quotes, equals signs and whitespace in values', () => {
    const value = '  "one,two"=three  ';
    expect(BakeVars.resolve([`CUSTOM=${value}`], {GITHUB_CUSTOM: value})).toEqual([`GITHUB_CUSTOM=${value}`, `CUSTOM=${value}`]);
  });

  it('defaults to the process environment', () => {
    vi.stubEnv('CI', 'true');
    vi.stubEnv('DOCKER_METADATA_OUTPUT_VERSION', '1.2.3');
    vi.stubEnv('GITHUB_BAKE_VARS_TEST', 'github');
    vi.stubEnv('RUNNER_BAKE_VARS_TEST', 'runner');
    vi.stubEnv('BAKE_VARS_TEST', 'excluded');
    const vars = BakeVars.resolve([]);
    expect(vars).toContain('CI=true');
    expect(vars).toContain('DOCKER_METADATA_OUTPUT_VERSION=1.2.3');
    expect(vars).toContain('GITHUB_BAKE_VARS_TEST=github');
    expect(vars).toContain('RUNNER_BAKE_VARS_TEST=runner');
    expect(vars).not.toContain('BAKE_VARS_TEST=excluded');
  });
});
