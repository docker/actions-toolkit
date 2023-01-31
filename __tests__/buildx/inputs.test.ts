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

import {afterEach, beforeEach, describe, expect, it, jest, test} from '@jest/globals';
import * as fs from 'fs';
import * as path from 'path';
import * as rimraf from 'rimraf';

import {Context} from '../../src/context';
import {Buildx} from '../../src/buildx/buildx';
import {Inputs} from '../../src/buildx/inputs';

const fixturesDir = path.join(__dirname, '..', 'fixtures');
const tmpDir = path.join('/tmp/.docker-actions-toolkit-jest').split(path.sep).join(path.posix.sep);
const tmpName = path.join(tmpDir, '.tmpname-jest').split(path.sep).join(path.posix.sep);
const metadata = `{
  "containerimage.config.digest": "sha256:059b68a595b22564a1cbc167af369349fdc2ecc1f7bc092c2235cbf601a795fd",
  "containerimage.digest": "sha256:b09b9482c72371486bb2c1d2c2a2633ed1d0b8389e12c8d52b9e052725c0c83c"
}`;

jest.spyOn(Context.prototype, 'tmpDir').mockImplementation((): string => {
  if (!fs.existsSync(tmpDir)) {
    fs.mkdirSync(tmpDir, {recursive: true});
  }
  return tmpDir;
});
jest.spyOn(Context.prototype, 'tmpName').mockImplementation((): string => {
  return tmpName;
});

beforeEach(() => {
  jest.clearAllMocks();
});

afterEach(() => {
  rimraf.sync(tmpDir);
});

describe('getBuildImageID', () => {
  it('matches', async () => {
    const buildx = new Buildx({
      context: new Context()
    });
    const imageID = 'sha256:bfb45ab72e46908183546477a08f8867fc40cebadd00af54b071b097aed127a9';
    const imageIDFile = buildx.inputs.getBuildImageIDFilePath();
    await fs.writeFileSync(imageIDFile, imageID);
    const expected = buildx.inputs.getBuildImageID();
    expect(expected).toEqual(imageID);
  });
});

describe('getBuildMetadata', () => {
  it('matches', async () => {
    const buildx = new Buildx({
      context: new Context()
    });
    const metadataFile = buildx.inputs.getBuildMetadataFilePath();
    await fs.writeFileSync(metadataFile, metadata);
    const expected = buildx.inputs.getBuildMetadata();
    expect(expected).toEqual(metadata);
  });
});

describe('getDigest', () => {
  it('matches', async () => {
    const buildx = new Buildx({
      context: new Context()
    });
    const metadataFile = buildx.inputs.getBuildMetadataFilePath();
    await fs.writeFileSync(metadataFile, metadata);
    const expected = buildx.inputs.getDigest();
    expect(expected).toEqual('sha256:b09b9482c72371486bb2c1d2c2a2633ed1d0b8389e12c8d52b9e052725c0c83c');
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
      'builder-id=https://github.com/docker/actions-toolkit/actions/runs/123'
    ],
    [
      'false',
      'false'
    ],
    [
      'mode=min',
      'mode=min,builder-id=https://github.com/docker/actions-toolkit/actions/runs/123'
    ],
    [
      'mode=max',
      'mode=max,builder-id=https://github.com/docker/actions-toolkit/actions/runs/123'
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
  ])('given input %p', async (input: string, expected: string) => {
    await setInput('provenance', input);
    const buildx = new Buildx({
      context: new Context()
    });
    expect(buildx.inputs.getProvenanceInput('provenance')).toEqual(expected);
  });
});

describe('getProvenanceAttrs', () => {
  // prettier-ignore
  test.each([
    [
      'mode=min',
      'mode=min,builder-id=https://github.com/docker/actions-toolkit/actions/runs/123'
    ],
    [
      'mode=max',
      'mode=max,builder-id=https://github.com/docker/actions-toolkit/actions/runs/123'
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
      'builder-id=https://github.com/docker/actions-toolkit/actions/runs/123'
    ],
  ])('given %p', async (input: string, expected: string) => {
    const buildx = new Buildx({
      context: new Context()
    });
    expect(buildx.inputs.getProvenanceAttrs(input)).toEqual(expected);
  });
});

describe('generateBuildSecret', () => {
  test.each([
    ['A_SECRET=abcdef0123456789', false, 'A_SECRET', 'abcdef0123456789', null],
    ['GIT_AUTH_TOKEN=abcdefghijklmno=0123456789', false, 'GIT_AUTH_TOKEN', 'abcdefghijklmno=0123456789', null],
    ['MY_KEY=c3RyaW5nLXdpdGgtZXF1YWxzCg==', false, 'MY_KEY', 'c3RyaW5nLXdpdGgtZXF1YWxzCg==', null],
    ['aaaaaaaa', false, '', '', new Error('aaaaaaaa is not a valid secret')],
    ['aaaaaaaa=', false, '', '', new Error('aaaaaaaa= is not a valid secret')],
    ['=bbbbbbb', false, '', '', new Error('=bbbbbbb is not a valid secret')],
    [`foo=${path.join(fixturesDir, 'secret.txt').split(path.sep).join(path.posix.sep)}`, true, 'foo', 'bar', null],
    [`notfound=secret`, true, '', '', new Error('secret file secret not found')]
  ])('given %p key and %p secret', async (kvp: string, file: boolean, exKey: string, exValue: string, error: Error) => {
    try {
      const buildx = new Buildx({
        context: new Context()
      });
      let secret: string;
      if (file) {
        secret = buildx.inputs.generateBuildSecretFile(kvp);
      } else {
        secret = buildx.inputs.generateBuildSecretString(kvp);
      }
      expect(secret).toEqual(`id=${exKey},src=${tmpName}`);
      expect(fs.readFileSync(tmpName, 'utf-8')).toEqual(exValue);
    } catch (e) {
      // eslint-disable-next-line jest/no-conditional-expect
      expect(e.message).toEqual(error?.message);
    }
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
  ])('given %p returns %p', async (exporters: Array<string>, expected: boolean) => {
    expect(Inputs.hasLocalExporter(exporters)).toEqual(expected);
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
  ])('given %p returns %p', async (exporters: Array<string>, expected: boolean) => {
    expect(Inputs.hasTarExporter(exporters)).toEqual(expected);
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
    [['.'], true, true],
  ])('given %p returns %p', async (exporters: Array<string>, expected: boolean, load: boolean | undefined) => {
    expect(Inputs.hasDockerExporter(exporters, load)).toEqual(expected);
  });
});

describe('hasGitAuthTokenSecret', () => {
  // prettier-ignore
  test.each([
    [['A_SECRET=abcdef0123456789'], false],
    [['GIT_AUTH_TOKEN=abcdefghijklmno=0123456789'], true],
  ])('given %p secret', async (kvp: Array<string>, expected: boolean) => {
    expect(Inputs.hasGitAuthTokenSecret(kvp)).toBe(expected);
  });
});

// See: https://github.com/actions/toolkit/blob/a1b068ec31a042ff1e10a522d8fdf0b8869d53ca/packages/core/src/core.ts#L89
function getInputName(name: string): string {
  return `INPUT_${name.replace(/ /g, '_').toUpperCase()}`;
}

function setInput(name: string, value: string): void {
  process.env[getInputName(name)] = value;
}
