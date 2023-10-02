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
import {Inputs} from '../../src/buildx/inputs';

const fixturesDir = path.join(__dirname, '..', 'fixtures');
// prettier-ignore
const tmpDir = path.join(process.env.TEMP || '/tmp', 'buildx-inputs-jest');
const tmpName = path.join(tmpDir, '.tmpname-jest');
const metadata = `{
  "containerimage.config.digest": "sha256:059b68a595b22564a1cbc167af369349fdc2ecc1f7bc092c2235cbf601a795fd",
  "containerimage.digest": "sha256:b09b9482c72371486bb2c1d2c2a2633ed1d0b8389e12c8d52b9e052725c0c83c"
}`;

jest.spyOn(Context, 'tmpDir').mockImplementation((): string => {
  if (!fs.existsSync(tmpDir)) {
    fs.mkdirSync(tmpDir, {recursive: true});
  }
  return tmpDir;
});

jest.spyOn(Context, 'tmpName').mockImplementation((): string => {
  return tmpName;
});

beforeEach(() => {
  jest.clearAllMocks();
});

afterEach(() => {
  rimraf.sync(tmpDir);
});

describe('resolveBuildImageID', () => {
  it('matches', async () => {
    const imageID = 'sha256:bfb45ab72e46908183546477a08f8867fc40cebadd00af54b071b097aed127a9';
    const imageIDFile = Inputs.getBuildImageIDFilePath();
    await fs.writeFileSync(imageIDFile, imageID);
    const expected = Inputs.resolveBuildImageID();
    expect(expected).toEqual(imageID);
  });
});

describe('resolveBuildMetadata', () => {
  it('matches', async () => {
    const metadataFile = Inputs.getBuildMetadataFilePath();
    await fs.writeFileSync(metadataFile, metadata);
    const expected = Inputs.resolveBuildMetadata();
    expect(expected).toEqual(metadata);
  });
});

describe('resolveDigest', () => {
  it('matches', async () => {
    const metadataFile = Inputs.getBuildMetadataFilePath();
    await fs.writeFileSync(metadataFile, metadata);
    const expected = Inputs.resolveDigest();
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
    expect(Inputs.getProvenanceInput('provenance')).toEqual(expected);
  });
});

describe('resolveProvenanceAttrs', () => {
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
    expect(Inputs.resolveProvenanceAttrs(input)).toEqual(expected);
  });
});

describe('resolveBuildSecret', () => {
  test.each([
    ['A_SECRET=abcdef0123456789', false, 'A_SECRET', 'abcdef0123456789', null],
    ['GIT_AUTH_TOKEN=abcdefghijklmno=0123456789', false, 'GIT_AUTH_TOKEN', 'abcdefghijklmno=0123456789', null],
    ['MY_KEY=c3RyaW5nLXdpdGgtZXF1YWxzCg==', false, 'MY_KEY', 'c3RyaW5nLXdpdGgtZXF1YWxzCg==', null],
    ['aaaaaaaa', false, '', '', new Error('aaaaaaaa is not a valid secret')],
    ['aaaaaaaa=', false, '', '', new Error('aaaaaaaa= is not a valid secret')],
    ['=bbbbbbb', false, '', '', new Error('=bbbbbbb is not a valid secret')],
    [`foo=${path.join(fixturesDir, 'secret.txt')}`, true, 'foo', 'bar', null],
    [`notfound=secret`, true, '', '', new Error('secret file secret not found')]
  ])('given %p key and %p secret', async (kvp: string, file: boolean, exKey: string, exValue: string, error: Error | null) => {
    try {
      let secret: string;
      if (file) {
        secret = Inputs.resolveBuildSecretFile(kvp);
      } else {
        secret = Inputs.resolveBuildSecretString(kvp);
      }
      expect(secret).toEqual(`id=${exKey},src=${tmpName}`);
      expect(fs.readFileSync(tmpName, 'utf-8')).toEqual(exValue);
    } catch (e) {
      // eslint-disable-next-line jest/no-conditional-expect
      expect(e.message).toEqual(error?.message);
    }
  });

  test.each([
    ['FOO=bar', 'FOO', 'bar', null],
    ['FOO=', 'FOO', '', new Error('FOO= is not a valid secret')],
    ['=bar', '', '', new Error('=bar is not a valid secret')],
    ['FOO=bar=baz', 'FOO', 'bar=baz', null]
  ])('given %p key and %p env', async (kvp: string, exKey: string, exValue: string, error: Error | null) => {
    try {
      const secret = Inputs.resolveBuildSecretEnv(kvp);
      expect(secret).toEqual(`id=${exKey},env=${exValue}`);
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
    [['type=docker'], true, false],
    [['type=docker'], true, true],
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
