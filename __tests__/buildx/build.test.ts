/**
 * Copyright 2023 actions-toolkit authors
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

import {afterEach, beforeEach, describe, expect, it, vi, test} from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import * as github from '@actions/github';
import * as rimraf from 'rimraf';

import {Context} from '../../src/context.js';
import {Build} from '../../src/buildx/build.js';
import {Buildx} from '../../src/buildx/buildx.js';

import {GitContextFormat} from '../../src/types/buildx/build.js';

const fixturesDir = path.join(__dirname, '..', '.fixtures');
const tmpDir = fs.mkdtempSync(path.join(process.env.TEMP || os.tmpdir(), 'buildx-build-'));
const tmpName = path.join(tmpDir, '.tmpname-vi');
const metadata = JSON.parse(fs.readFileSync(path.join(fixturesDir, 'metadata-build.json'), 'utf-8'));

vi.spyOn(Context, 'tmpDir').mockImplementation((): string => {
  fs.mkdirSync(tmpDir, {recursive: true});
  return tmpDir;
});

vi.spyOn(Context, 'tmpName').mockImplementation((): string => {
  return tmpName;
});

afterEach(() => {
  rimraf.sync(tmpDir);
});

describe('gitContext', () => {
  const originalEnv = process.env;
  const githubContextSha = '860c1904a1ce19322e91ac35af1ab07466440c37';
  const pullRequestHeadSha = 'f11797113e5a9b86bd976329c5dbb8a8bfdfadfa';
  beforeEach(() => {
    vi.resetModules();
    process.env = {
      ...originalEnv,
      DOCKER_DEFAULT_GIT_CONTEXT_PR_HEAD_REF: '',
      BUILDX_SEND_GIT_QUERY_AS_INPUT: ''
    };
    github.context.sha = githubContextSha;
    github.context.payload.pull_request = {
      number: 15,
      head: {
        sha: pullRequestHeadSha
      }
    };
  });
  afterEach(() => {
    process.env = originalEnv;
    delete github.context.payload.pull_request;
  });

  type GitContextTestCase = {
    ref: string;
    checksum?: string;
    subdir?: string;
    attrs?: Record<string, string>;
    format: GitContextFormat | undefined;

    prHeadRef: boolean;
    sendGitQueryAsInput: boolean;
    buildxQuerySupport: boolean;
  };

  // prettier-ignore
  const gitContextCases: [GitContextTestCase, string][] = [
    // no format set (defaults to fragment)
    [{ref: 'refs/heads/master', format: undefined, prHeadRef: false, sendGitQueryAsInput: false, buildxQuerySupport: true}, 'https://github.com/docker/actions-toolkit.git#860c1904a1ce19322e91ac35af1ab07466440c37'],
    [{ref: 'master', format: undefined, prHeadRef: false, sendGitQueryAsInput: false, buildxQuerySupport: true}, 'https://github.com/docker/actions-toolkit.git#860c1904a1ce19322e91ac35af1ab07466440c37'],
    [{ref: 'refs/pull/15/merge', checksum: undefined, format: undefined, prHeadRef: false, sendGitQueryAsInput: false, buildxQuerySupport: true}, 'https://github.com/docker/actions-toolkit.git#860c1904a1ce19322e91ac35af1ab07466440c37'],
    [{ref: 'refs/tags/v1.0.0', format: undefined, prHeadRef: false, sendGitQueryAsInput: false, buildxQuerySupport: true}, 'https://github.com/docker/actions-toolkit.git#860c1904a1ce19322e91ac35af1ab07466440c37'],
    [{ref: 'refs/pull/15/merge', checksum: undefined, format: undefined, prHeadRef: true, sendGitQueryAsInput: false, buildxQuerySupport: true}, 'https://github.com/docker/actions-toolkit.git#f11797113e5a9b86bd976329c5dbb8a8bfdfadfa'],
    // no format set (defaults to query only when client-side query resolution is enabled and supported)
    [{ref: 'refs/heads/master', format: undefined, prHeadRef: false, sendGitQueryAsInput: true, buildxQuerySupport: true}, 'https://github.com/docker/actions-toolkit.git?ref=refs/heads/master&checksum=860c1904a1ce19322e91ac35af1ab07466440c37'],
    [{ref: 'refs/pull/15/merge', checksum: undefined, format: undefined, prHeadRef: false, sendGitQueryAsInput: true, buildxQuerySupport: true}, 'https://github.com/docker/actions-toolkit.git?ref=860c1904a1ce19322e91ac35af1ab07466440c37'],
    [{ref: 'refs/pull/15/merge', checksum: undefined, format: undefined, prHeadRef: true, sendGitQueryAsInput: true, buildxQuerySupport: true}, 'https://github.com/docker/actions-toolkit.git?ref=f11797113e5a9b86bd976329c5dbb8a8bfdfadfa'],
    [{ref: 'refs/heads/master', format: undefined, prHeadRef: false, sendGitQueryAsInput: true, buildxQuerySupport: false}, 'https://github.com/docker/actions-toolkit.git#860c1904a1ce19322e91ac35af1ab07466440c37'],
    [{ref: 'refs/heads/master', format: undefined, prHeadRef: false, sendGitQueryAsInput: false, buildxQuerySupport: true, attrs: {}}, 'https://github.com/docker/actions-toolkit.git#860c1904a1ce19322e91ac35af1ab07466440c37'],
    [{ref: 'refs/heads/master', checksum: undefined, format: undefined, prHeadRef: false, sendGitQueryAsInput: false, buildxQuerySupport: true, attrs: {checksum: 'cafebabe'}}, 'https://github.com/docker/actions-toolkit.git#cafebabe'],
    [{ref: 'refs/heads/master', format: undefined, prHeadRef: false, sendGitQueryAsInput: false, buildxQuerySupport: true, attrs: {subdir: 'subdir'}}, 'https://github.com/docker/actions-toolkit.git#860c1904a1ce19322e91ac35af1ab07466440c37:subdir'],
    [{ref: 'refs/heads/master', format: undefined, prHeadRef: false, sendGitQueryAsInput: false, buildxQuerySupport: true, attrs: {ref: 'refs/tags/v1.0.0'}}, 'https://github.com/docker/actions-toolkit.git#860c1904a1ce19322e91ac35af1ab07466440c37'],
    [{ref: 'refs/heads/master', format: undefined, prHeadRef: false, sendGitQueryAsInput: false, buildxQuerySupport: true, attrs: {'keep-git-dir': 'true'}}, 'https://github.com/docker/actions-toolkit.git?ref=refs/heads/master&checksum=860c1904a1ce19322e91ac35af1ab07466440c37&keep-git-dir=true'],
    [{ref: 'refs/heads/master', format: undefined, prHeadRef: false, sendGitQueryAsInput: false, buildxQuerySupport: false, attrs: {'keep-git-dir': 'true'}}, 'https://github.com/docker/actions-toolkit.git?ref=refs/heads/master&checksum=860c1904a1ce19322e91ac35af1ab07466440c37&keep-git-dir=true'],
    [{ref: 'refs/heads/master', checksum: undefined, format: undefined, prHeadRef: false, sendGitQueryAsInput: false, buildxQuerySupport: true, attrs: {checksum: 'cafebabe', 'keep-git-dir': 'true'}}, 'https://github.com/docker/actions-toolkit.git?ref=refs/heads/master&checksum=cafebabe&keep-git-dir=true'],
    [{ref: 'refs/heads/master', format: undefined, prHeadRef: false, sendGitQueryAsInput: false, buildxQuerySupport: true, attrs: {submodules: 'false'}}, 'https://github.com/docker/actions-toolkit.git?ref=refs/heads/master&checksum=860c1904a1ce19322e91ac35af1ab07466440c37&submodules=false'],
    [{ref: 'refs/heads/master', format: undefined, prHeadRef: false, sendGitQueryAsInput: false, buildxQuerySupport: false, attrs: {submodules: 'false'}}, 'https://github.com/docker/actions-toolkit.git?ref=refs/heads/master&checksum=860c1904a1ce19322e91ac35af1ab07466440c37&submodules=false'],
    // query format
    [{ref: 'refs/heads/master', format: 'query', prHeadRef: false, sendGitQueryAsInput: false, buildxQuerySupport: true}, 'https://github.com/docker/actions-toolkit.git?ref=refs/heads/master&checksum=860c1904a1ce19322e91ac35af1ab07466440c37'],
    [{ref: 'master', format: 'query', prHeadRef: false, sendGitQueryAsInput: false, buildxQuerySupport: true}, 'https://github.com/docker/actions-toolkit.git?ref=refs/heads/master&checksum=860c1904a1ce19322e91ac35af1ab07466440c37'],
    [{ref: 'refs/pull/15/merge', checksum: undefined, format: 'query', prHeadRef: false, sendGitQueryAsInput: false, buildxQuerySupport: true}, 'https://github.com/docker/actions-toolkit.git?ref=860c1904a1ce19322e91ac35af1ab07466440c37'],
    [{ref: 'refs/tags/v1.0.0', format: 'query', prHeadRef: false, sendGitQueryAsInput: false, buildxQuerySupport: true}, 'https://github.com/docker/actions-toolkit.git?ref=refs/tags/v1.0.0&checksum=860c1904a1ce19322e91ac35af1ab07466440c37'],
    [{ref: 'refs/pull/15/merge', checksum: undefined, format: 'query', prHeadRef: true, sendGitQueryAsInput: false, buildxQuerySupport: true}, 'https://github.com/docker/actions-toolkit.git?ref=f11797113e5a9b86bd976329c5dbb8a8bfdfadfa'],
    [{ref: 'refs/pull/15/merge', checksum: undefined, format: 'query', prHeadRef: false, sendGitQueryAsInput: false, buildxQuerySupport: true, attrs: {checksum: 'cafebabe'}}, 'https://github.com/docker/actions-toolkit.git?ref=refs/pull/15/merge&checksum=cafebabe'],
    [{ref: 'refs/heads/master', format: 'query', prHeadRef: false, sendGitQueryAsInput: false, buildxQuerySupport: true, subdir: 'subdir'}, 'https://github.com/docker/actions-toolkit.git?ref=refs/heads/master&checksum=860c1904a1ce19322e91ac35af1ab07466440c37&subdir=subdir'],
    [{ref: 'refs/heads/master', format: 'query', prHeadRef: false, sendGitQueryAsInput: false, buildxQuerySupport: true, subdir: '.'}, 'https://github.com/docker/actions-toolkit.git?ref=refs/heads/master&checksum=860c1904a1ce19322e91ac35af1ab07466440c37'],
    [{ref: 'refs/heads/master', checksum: undefined, format: 'query', prHeadRef: false, sendGitQueryAsInput: false, buildxQuerySupport: true, attrs: {ref: 'refs/tags/v1.0.0', checksum: 'cafebabe', subdir: 'subdir', submodules: 'false'}}, 'https://github.com/docker/actions-toolkit.git?ref=refs/heads/master&checksum=cafebabe&subdir=subdir&submodules=false'],
    [{ref: 'refs/heads/master', format: 'query', prHeadRef: false, sendGitQueryAsInput: false, buildxQuerySupport: true, subdir: 'subdir', attrs: {'keep-git-dir': 'true'}}, 'https://github.com/docker/actions-toolkit.git?ref=refs/heads/master&checksum=860c1904a1ce19322e91ac35af1ab07466440c37&subdir=subdir&keep-git-dir=true'],
    [{ref: 'refs/heads/master', format: 'query', prHeadRef: false, sendGitQueryAsInput: false, buildxQuerySupport: true, attrs: {submodules: 'true'}}, 'https://github.com/docker/actions-toolkit.git?ref=refs/heads/master&checksum=860c1904a1ce19322e91ac35af1ab07466440c37&submodules=true'],
    [{ref: 'refs/heads/master', format: 'query', prHeadRef: false, sendGitQueryAsInput: false, buildxQuerySupport: true, attrs: {submodules: 'false'}}, 'https://github.com/docker/actions-toolkit.git?ref=refs/heads/master&checksum=860c1904a1ce19322e91ac35af1ab07466440c37&submodules=false'],
    [{ref: 'refs/heads/master', format: 'query', prHeadRef: false, sendGitQueryAsInput: false, buildxQuerySupport: true, attrs: {'keep-git-dir': 'true', submodules: 'false'}}, 'https://github.com/docker/actions-toolkit.git?ref=refs/heads/master&checksum=860c1904a1ce19322e91ac35af1ab07466440c37&keep-git-dir=true&submodules=false'],
    // fragment format
    [{ref: 'refs/heads/master', format: 'fragment', prHeadRef: false, sendGitQueryAsInput: false, buildxQuerySupport: true}, 'https://github.com/docker/actions-toolkit.git#860c1904a1ce19322e91ac35af1ab07466440c37'],
    [{ref: 'master', format: 'fragment', prHeadRef: false, sendGitQueryAsInput: false, buildxQuerySupport: true}, 'https://github.com/docker/actions-toolkit.git#860c1904a1ce19322e91ac35af1ab07466440c37'],
    [{ref: 'refs/pull/15/merge', checksum: undefined, format: 'fragment', prHeadRef: false, sendGitQueryAsInput: false, buildxQuerySupport: true}, 'https://github.com/docker/actions-toolkit.git#860c1904a1ce19322e91ac35af1ab07466440c37'],
    [{ref: 'refs/tags/v1.0.0', format: 'fragment', prHeadRef: false, sendGitQueryAsInput: false, buildxQuerySupport: true}, 'https://github.com/docker/actions-toolkit.git#860c1904a1ce19322e91ac35af1ab07466440c37'],
    [{ref: 'refs/pull/15/merge', checksum: undefined, format: 'fragment', prHeadRef: true, sendGitQueryAsInput: false, buildxQuerySupport: true}, 'https://github.com/docker/actions-toolkit.git#f11797113e5a9b86bd976329c5dbb8a8bfdfadfa'],
    [{ref: 'refs/pull/15/merge', checksum: undefined, format: 'fragment', prHeadRef: false, sendGitQueryAsInput: false, buildxQuerySupport: true, attrs: {checksum: 'cafebabe'}}, 'https://github.com/docker/actions-toolkit.git#refs/pull/15/merge'],
    [{ref: 'refs/heads/master', checksum: undefined, format: 'fragment', prHeadRef: false, sendGitQueryAsInput: false, buildxQuerySupport: true, attrs: {checksum: 'cafebabe', subdir: 'subdir', ref: 'refs/tags/v1.0.0'}}, 'https://github.com/docker/actions-toolkit.git#cafebabe:subdir'],
    [{ref: 'refs/heads/master', format: 'fragment', prHeadRef: false, sendGitQueryAsInput: false, buildxQuerySupport: true, attrs: {'keep-git-dir': 'true'}}, 'https://github.com/docker/actions-toolkit.git#860c1904a1ce19322e91ac35af1ab07466440c37'],
    [{ref: 'refs/heads/master', format: 'fragment', prHeadRef: false, sendGitQueryAsInput: false, buildxQuerySupport: true, subdir: 'subdir'}, 'https://github.com/docker/actions-toolkit.git#860c1904a1ce19322e91ac35af1ab07466440c37:subdir'],
    [{ref: 'refs/heads/master', format: 'fragment', prHeadRef: false, sendGitQueryAsInput: false, buildxQuerySupport: true, subdir: '.'}, 'https://github.com/docker/actions-toolkit.git#860c1904a1ce19322e91ac35af1ab07466440c37'],
    [{ref: 'refs/pull/15/merge', checksum: undefined, format: 'fragment', prHeadRef: true, sendGitQueryAsInput: false, buildxQuerySupport: true, subdir: 'subdir'}, 'https://github.com/docker/actions-toolkit.git#f11797113e5a9b86bd976329c5dbb8a8bfdfadfa:subdir'],
  ];

  test.each(gitContextCases)('given %o should return %o', async (input: GitContextTestCase, expected: string) => {
    const {ref, checksum, format, prHeadRef, sendGitQueryAsInput, buildxQuerySupport, subdir, attrs} = input;
    process.env.DOCKER_DEFAULT_GIT_CONTEXT_PR_HEAD_REF = prHeadRef ? 'true' : '';
    process.env.BUILDX_SEND_GIT_QUERY_AS_INPUT = sendGitQueryAsInput ? 'true' : '';
    const buildx = new Buildx();
    vi.spyOn(buildx, 'versionSatisfies').mockResolvedValue(buildxQuerySupport);
    const build = new Build({buildx});
    expect(
      await build.gitContext({
        ref,
        ...('checksum' in input ? {checksum} : {checksum: '860c1904a1ce19322e91ac35af1ab07466440c37'}),
        format,
        subdir,
        attrs
      })
    ).toEqual(expected);
  });
});

describe('resolveImageID', () => {
  it('matches', async () => {
    const imageID = 'sha256:bfb45ab72e46908183546477a08f8867fc40cebadd00af54b071b097aed127a9';
    const build = new Build();
    fs.writeFileSync(build.getImageIDFilePath(), imageID);
    expect(build.resolveImageID()).toEqual(imageID);
  });
});

describe('resolveMetadata', () => {
  it('matches', async () => {
    const build = new Build();
    fs.writeFileSync(build.getMetadataFilePath(), JSON.stringify(metadata));
    expect(build.resolveMetadata()).toEqual(metadata);
  });
});

describe('resolveRef', () => {
  it('matches', async () => {
    const build = new Build();
    fs.writeFileSync(build.getMetadataFilePath(), JSON.stringify(metadata));
    expect(build.resolveRef()).toEqual('default/default/n6ibcp9b2pw108rrz7ywdznvo');
  });
});

describe('resolveProvenance', () => {
  it('matches', async () => {
    const build = new Build();
    fs.writeFileSync(build.getMetadataFilePath(), JSON.stringify(metadata));
    const provenance = build.resolveProvenance();
    expect(provenance).toBeDefined();
    expect(provenance?.buildType).toEqual('https://mobyproject.org/buildkit@v1');
    expect(provenance?.materials).toBeDefined();
    expect(provenance?.materials?.length).toEqual(2);
  });
});

describe('resolveWarnings', () => {
  it('matches', async () => {
    const build = new Build();
    fs.writeFileSync(build.getMetadataFilePath(), JSON.stringify(metadata));
    const warnings = build.resolveWarnings();
    expect(warnings).toBeDefined();
    expect(warnings?.length).toEqual(3);
  });
});

describe('resolveDigest', () => {
  it('matches', async () => {
    const build = new Build();
    fs.writeFileSync(build.getMetadataFilePath(), JSON.stringify(metadata));
    expect(build.resolveDigest()).toEqual('sha256:b09b9482c72371486bb2c1d2c2a2633ed1d0b8389e12c8d52b9e052725c0c83c');
  });
});

describe('getProvenanceInput', () => {
  beforeEach(() => {
    process.env = Object.keys(process.env).reduce((object, key) => {
      if (!key.startsWith('INPUT_')) {
        object[key] = process.env[key];
      }
      return object;
    }, {});
  });

  // prettier-ignore
  test.each([
    [
      'true',
      'builder-id=https://github.com/docker/actions-toolkit/actions/runs/2188748038/attempts/2'
    ],
    [
      'false',
      'false'
    ],
    [
      'mode=min',
      'mode=min,builder-id=https://github.com/docker/actions-toolkit/actions/runs/2188748038/attempts/2'
    ],
    [
      'mode=max',
      'mode=max,builder-id=https://github.com/docker/actions-toolkit/actions/runs/2188748038/attempts/2'
    ],
    [
      'builder-id=foo',
      'builder-id=foo'
    ],
    [
      'mode=max,builder-id=foo',
      'mode=max,builder-id=foo'
    ],
    [
      '',
      ''
    ],
  ])('given input %o', async (input: string, expected: string) => {
    setInput('provenance', input);
    expect(Build.getProvenanceInput('provenance')).toEqual(expected);
  });
});

describe('resolveProvenanceAttrs', () => {
  // prettier-ignore
  test.each([
    [
      'mode=min',
      'mode=min,builder-id=https://github.com/docker/actions-toolkit/actions/runs/2188748038/attempts/2'
    ],
    [
      'mode=max',
      'mode=max,builder-id=https://github.com/docker/actions-toolkit/actions/runs/2188748038/attempts/2'
    ],
    [
      'builder-id=foo',
      'builder-id=foo'
    ],
    [
      'mode=max,builder-id=foo',
      'mode=max,builder-id=foo'
    ],
    [
      '',
      'builder-id=https://github.com/docker/actions-toolkit/actions/runs/2188748038/attempts/2'
    ],
  ])('given %o', async (input: string, expected: string) => {
    expect(Build.resolveProvenanceAttrs(input)).toEqual(expected);
  });
});

describe('resolveSecret', () => {
  // prettier-ignore
  test.each([
    ['A_SECRET=abcdef0123456789', 'A_SECRET', 'abcdef0123456789'],
    ['GIT_AUTH_TOKEN=abcdefghijklmno=0123456789', 'GIT_AUTH_TOKEN', 'abcdefghijklmno=0123456789'],
    ['MY_KEY=c3RyaW5nLXdpdGgtZXF1YWxzCg==', 'MY_KEY', 'c3RyaW5nLXdpdGgtZXF1YWxzCg==']
  ])('given %o key and string secret', (kvp: string, exKey: string, exValue: string) => {
    const secret = Build.resolveSecretString(kvp);
    expect(secret).toEqual(`id=${exKey},src=${tmpName}`);
    expect(fs.readFileSync(tmpName, 'utf-8')).toEqual(exValue);
  });

  // prettier-ignore
  test.each([
    [`foo=${path.join(fixturesDir, 'secret.txt')}`, 'foo', path.join(fixturesDir, 'secret.txt')]
  ])('given %o key and file secret', (kvp: string, exKey: string, exSrc: string) => {
    const secret = Build.resolveSecretFile(kvp);
    expect(secret).toEqual(`id=${exKey},src=${exSrc}`);
  });

  // prettier-ignore
  test.each([
    ['aaaaaaaa', false, 'aaaaaaaa is not a valid secret'],
    ['aaaaaaaa=', false, 'aaaaaaaa= is not a valid secret'],
    ['=bbbbbbb', false, '=bbbbbbb is not a valid secret'],
    ['notfound=secret', true, 'secret file secret not found']
  ])('given %o key and %o secret throws', (kvp: string, file: boolean, errorMessage: string) => {
    const resolve = (): string => (file ? Build.resolveSecretFile(kvp) : Build.resolveSecretString(kvp));
    expect(resolve).toThrow(errorMessage);
  });

  // prettier-ignore
  test('preserves file-backed secret path and bytes', async () => {
    fs.mkdirSync(tmpDir, {recursive: true});
    const sourceFile = path.join(tmpDir, 'secret.bin');
    const sourceBytes = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x00, 0xff, 0x41, 0x42, 0x43, 0x0a, 0x80]);
    fs.writeFileSync(sourceFile, sourceBytes);
    const secret = Build.resolveSecretFile(`foo=${sourceFile}`);
    expect(secret).toEqual(`id=foo,src=${sourceFile}`);
    expect(fs.readFileSync(sourceFile)).toEqual(sourceBytes);
    expect(fs.existsSync(tmpName)).toBeFalsy();
  });

  // prettier-ignore
  test.each([
    ['FOO=bar', 'FOO', 'bar'],
    ['FOO=bar=baz', 'FOO', 'bar=baz']
  ])('given %o key and %o env', (kvp: string, exKey: string, exValue: string) => {
    const secret = Build.resolveSecretEnv(kvp);
    expect(secret).toEqual(`id=${exKey},env=${exValue}`);
  });

  // prettier-ignore
  test.each([
    ['FOO=', 'FOO= is not a valid secret'],
    ['=bar', '=bar is not a valid secret']
  ])('given %o key and %o env throws', (kvp: string, errorMessage: string) => {
    expect(() => Build.resolveSecretEnv(kvp)).toThrow(errorMessage);
  });
});

describe('resolveCacheToAttrs', () => {
  // prettier-ignore
  test.each([
    [
      '',
      undefined,
      ''
    ],
    [
      'user/app:cache',
      undefined,
      'user/app:cache'
    ],
    [
      'type=inline',
      undefined,
      'type=inline'
    ],
    [
      'type=gha',
      undefined,
      'type=gha,repository=docker/actions-toolkit',
    ],
    [
      'type=gha,mode=max',
      undefined,
      'type=gha,mode=max,repository=docker/actions-toolkit',
    ],
    [
      'type=gha,mode=max',
      'abcd1234',
      'type=gha,mode=max,repository=docker/actions-toolkit,ghtoken=abcd1234',
    ],
    [
      'type=gha,repository=foo/bar,mode=max',
      undefined,
      'type=gha,repository=foo/bar,mode=max',
    ],
    [
      'type=gha,repository=foo/bar,mode=max',
      'abcd1234',
      'type=gha,repository=foo/bar,mode=max,ghtoken=abcd1234',
    ],
  ])('given %o', async (input: string, githubToken: string | undefined, expected: string) => {
    expect(Build.resolveCacheToAttrs(input, githubToken)).toEqual(expected);
  });
});

describe('hasLocalExporter', () => {
  // prettier-ignore
  test.each([
    [['type=registry,ref=user/app'], false],
    [['type=docker'], false],
    [['type=local,dest=./release-out'], true],
    [['type=tar,dest=/tmp/image.tar'], false],
    [['type=docker', 'type=tar,dest=/tmp/image.tar'], false],
    [['"type=tar","dest=/tmp/image.tar"'], false],
    [['" type= local" , dest=./release-out'], true],
    [['.'], true]
  ])('given %o returns %o', async (exporters: Array<string>, expected: boolean) => {
    expect(Build.hasLocalExporter(exporters)).toEqual(expected);
  });
});

describe('hasTarExporter', () => {
  // prettier-ignore
  test.each([
    [['type=registry,ref=user/app'], false],
    [['type=docker'], false],
    [['type=local,dest=./release-out'], false],
    [['type=tar,dest=/tmp/image.tar'], true],
    [['type=docker', 'type=tar,dest=/tmp/image.tar'], true],
    [['"type=tar","dest=/tmp/image.tar"'], true],
    [['" type= local" , dest=./release-out'], false],
    [['.'], false]
  ])('given %o returns %o', async (exporters: Array<string>, expected: boolean) => {
    expect(Build.hasTarExporter(exporters)).toEqual(expected);
  });
});

describe('hasDockerExporter', () => {
  // prettier-ignore
  test.each([
    [['type=registry,ref=user/app'], false, undefined],
    [['type=docker'], true, undefined],
    [['type=local,dest=./release-out'], false, undefined],
    [['type=tar,dest=/tmp/image.tar'], false, undefined],
    [['type=docker', 'type=tar,dest=/tmp/image.tar'], true, undefined],
    [['"type=tar","dest=/tmp/image.tar"'], false, undefined],
    [['" type= local" , dest=./release-out'], false, undefined],
    [['type=docker'], true, false],
    [['type=docker'], true, true],
    [['.'], true, true],
  ])('given %o returns %o', async (exporters: Array<string>, expected: boolean, load: boolean | undefined) => {
    expect(Build.hasDockerExporter(exporters, load)).toEqual(expected);
  });
});

describe('hasAttestationType', () => {
  // prettier-ignore
  test.each([
    ['type=provenance,mode=min', 'provenance', true],
    ['type=sbom,true', 'sbom', true],
    ['type=foo,bar', 'provenance', false],
  ])('given %o for %o returns %o', async (attrs: string, name: string, expected: boolean) => {
    expect(Build.hasAttestationType(name, attrs)).toEqual(expected);
  });
});

describe('resolveAttestationAttrs', () => {
  // prettier-ignore
  test.each([
    [
      'type=provenance,mode=min',
      'type=provenance,mode=min'
    ],
    [
      'type=provenance,true',
      'type=provenance,disabled=false'
    ],
    [
      'type=provenance,false',
      'type=provenance,disabled=true'
    ],
    [
      '',
      ''
    ],
  ])('given %o', async (input: string, expected: string) => {
    expect(Build.resolveAttestationAttrs(input)).toEqual(expected);
  });
});

describe('hasGitAuthTokenSecret', () => {
  // prettier-ignore
  test.each([
    [['A_SECRET=abcdef0123456789'], undefined, false],
    [['GIT_AUTH_TOKEN=abcdefghijklmno=0123456789'], undefined, true],
    [['GIT_AUTH_TOKEN.github.com=abcdefghijklmno=0123456789'], 'github.com', true],
  ])('given %o secret', async (kvp: Array<string>, domain: string | undefined, expected: boolean) => {
    expect(Build.hasGitAuthTokenSecret(kvp, domain)).toBe(expected);
  });
});

// See: https://github.com/actions/toolkit/blob/a1b068ec31a042ff1e10a522d8fdf0b8869d53ca/packages/core/src/core.ts#L89
function getInputName(name: string): string {
  return `INPUT_${name.replace(/ /g, '_').toUpperCase()}`;
}

function setInput(name: string, value: string): void {
  process.env[getInputName(name)] = value;
}
