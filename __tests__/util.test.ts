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

import {beforeEach, describe, expect, it, jest, test} from '@jest/globals';
import * as fs from 'fs';
import * as path from 'path';

import {Util} from '../src/util';

beforeEach(() => {
  jest.clearAllMocks();
});

describe('getInputList', () => {
  it('single line correctly', async () => {
    await setInput('foo', 'bar');
    const res = Util.getInputList('foo');
    expect(res).toEqual(['bar']);
  });

  it('multiline correctly', async () => {
    setInput('foo', 'bar\nbaz');
    const res = Util.getInputList('foo');
    expect(res).toEqual(['bar', 'baz']);
  });

  it('empty lines correctly', async () => {
    setInput('foo', 'bar\n\nbaz');
    const res = Util.getInputList('foo');
    expect(res).toEqual(['bar', 'baz']);
  });

  it('comma correctly', async () => {
    setInput('foo', 'bar,baz');
    const res = Util.getInputList('foo');
    expect(res).toEqual(['bar', 'baz']);
  });

  it('empty result correctly', async () => {
    setInput('foo', 'bar,baz,');
    const res = Util.getInputList('foo');
    expect(res).toEqual(['bar', 'baz']);
  });

  it('different new lines correctly', async () => {
    setInput('foo', 'bar\r\nbaz');
    const res = Util.getInputList('foo');
    expect(res).toEqual(['bar', 'baz']);
  });

  it('different new lines and comma correctly', async () => {
    setInput('foo', 'bar\r\nbaz,bat');
    const res = Util.getInputList('foo');
    expect(res).toEqual(['bar', 'baz', 'bat']);
  });

  it('multiline and ignoring comma correctly', async () => {
    setInput('cache-from', 'user/app:cache\ntype=local,src=path/to/dir');
    const res = Util.getInputList('cache-from', {ignoreComma: true});
    expect(res).toEqual(['user/app:cache', 'type=local,src=path/to/dir']);
  });

  it('multiline and ignoring comment correctly', async () => {
    setInput('labels', 'foo=bar\nbar=qux#baz');
    const res = Util.getInputList('labels');
    expect(res).toEqual(['foo=bar', 'bar=qux#baz']);
  });

  it('multiline with comment', async () => {
    setInput('labels', 'foo=bar\nbar=qux#baz');
    const res = Util.getInputList('labels', {comment: '#'});
    expect(res).toEqual(['foo=bar', 'bar=qux']);
  });

  it('different new lines and ignoring comma correctly', async () => {
    setInput('cache-from', 'user/app:cache\r\ntype=local,src=path/to/dir');
    const res = Util.getInputList('cache-from', {ignoreComma: true});
    expect(res).toEqual(['user/app:cache', 'type=local,src=path/to/dir']);
  });

  it('do not escape surrounding quotes', async () => {
    setInput('driver-opts', `"env.no_proxy=localhost,127.0.0.1,.mydomain"`);
    const res = Util.getInputList('driver-opts', {ignoreComma: true, quote: false});
    expect(res).toEqual(['"env.no_proxy=localhost,127.0.0.1,.mydomain"']);
  });

  it('escape surrounding quotes', async () => {
    setInput('platforms', 'linux/amd64\n"linux/arm64,linux/arm/v7"');
    const res = Util.getInputList('platforms');
    expect(res).toEqual(['linux/amd64', 'linux/arm64', 'linux/arm/v7']);
  });

  it('multiline values', async () => {
    setInput(
      'secrets',
      `GIT_AUTH_TOKEN=abcdefgh,ijklmno=0123456789
"MYSECRET=aaaaaaaa
bbbbbbb
ccccccccc"
FOO=bar`
    );
    const res = Util.getInputList('secrets', {ignoreComma: true});
    expect(res).toEqual([
      'GIT_AUTH_TOKEN=abcdefgh,ijklmno=0123456789',
      `MYSECRET=aaaaaaaa
bbbbbbb
ccccccccc`,
      'FOO=bar'
    ]);
  });

  it('multiline values with empty lines', async () => {
    setInput(
      'secrets',
      `GIT_AUTH_TOKEN=abcdefgh,ijklmno=0123456789
"MYSECRET=aaaaaaaa
bbbbbbb
ccccccccc"
FOO=bar
"EMPTYLINE=aaaa

bbbb
ccc"`
    );
    const res = Util.getInputList('secrets', {ignoreComma: true});
    expect(res).toEqual([
      'GIT_AUTH_TOKEN=abcdefgh,ijklmno=0123456789',
      `MYSECRET=aaaaaaaa
bbbbbbb
ccccccccc`,
      'FOO=bar',
      `EMPTYLINE=aaaa

bbbb
ccc`
    ]);
  });

  it('multiline values without quotes', async () => {
    setInput(
      'secrets',
      `GIT_AUTH_TOKEN=abcdefgh,ijklmno=0123456789
MYSECRET=aaaaaaaa
bbbbbbb
ccccccccc
FOO=bar`
    );
    const res = Util.getInputList('secrets', {ignoreComma: true});
    expect(res).toEqual(['GIT_AUTH_TOKEN=abcdefgh,ijklmno=0123456789', 'MYSECRET=aaaaaaaa', 'bbbbbbb', 'ccccccccc', 'FOO=bar']);
  });

  it('large multiline values', async () => {
    const pgp = fs.readFileSync(path.join(__dirname, 'fixtures', 'pgp.txt'), {encoding: 'utf-8'});
    setInput(
      'secrets',
      `"GPG_KEY=${pgp}"
FOO=bar`
    );
    const res = Util.getInputList('secrets', {ignoreComma: true});
    expect(res).toEqual([`GPG_KEY=${pgp}`, 'FOO=bar']);
  });

  it('multiline values escape quotes', async () => {
    setInput(
      'secrets',
      `GIT_AUTH_TOKEN=abcdefgh,ijklmno=0123456789
"MYSECRET=aaaaaaaa
bbbb""bbb
ccccccccc"
FOO=bar`
    );
    const res = Util.getInputList('secrets', {ignoreComma: true});
    expect(res).toEqual([
      'GIT_AUTH_TOKEN=abcdefgh,ijklmno=0123456789',
      `MYSECRET=aaaaaaaa
bbbb"bbb
ccccccccc`,
      'FOO=bar'
    ]);
  });
});

describe('asyncForEach', () => {
  it('executes async tasks sequentially', async () => {
    const testValues = [1, 2, 3, 4, 5];
    const results: number[] = [];

    await Util.asyncForEach(testValues, async value => {
      results.push(value);
    });

    expect(results).toEqual(testValues);
  });
});

describe('isValidURL', () => {
  test.each([
    ['https://github.com/docker/buildx.git', true],
    ['https://github.com/docker/buildx.git#refs/pull/648/head', true],
    ['git@github.com:moby/buildkit.git', false],
    ['git://github.com/user/repo.git', false],
    ['github.com/moby/buildkit.git#main', false],
    ['v0.4.1', false]
  ])('given %p', async (url, expected) => {
    expect(Util.isValidURL(url)).toEqual(expected);
  });
});

describe('isValidRef', () => {
  test.each([
    ['https://github.com/docker/buildx.git', true],
    ['https://github.com/docker/buildx.git#refs/pull/648/head', true],
    ['git@github.com:moby/buildkit.git', true],
    ['git://github.com/user/repo.git', true],
    ['github.com/moby/buildkit.git#main', true],
    ['v0.4.1', false]
  ])('given %p', async (url, expected) => {
    expect(Util.isValidRef(url)).toEqual(expected);
  });
});

describe('trimPrefix', () => {
  test.each([
    ['', 'abc', ''],
    ['abc', 'a', 'bc'],
    ['abc', 'ab', 'c'],
    ['abc', '', 'abc'],
    ['abc', '', 'abc'],
    ['abc', 'd', 'abc'],
    ['abc', 'abc', ''],
    ['abc', 'abcd', 'abc'],
    ['abcdabc', 'abc', 'dabc'],
    ['abcabc', 'abc', 'abc'],
    ['abcdabc', 'd', 'abcdabc']
  ])('given %p', async (str, prefix, expected) => {
    expect(Util.trimPrefix(str, prefix)).toEqual(expected);
  });
});

describe('trimSuffix', () => {
  test.each([
    ['', 'abc', ''],
    ['abc', 'c', 'ab'],
    ['abc', '', 'abc'],
    ['abc', 'bc', 'a'],
    ['abc', 'abc', ''],
    ['abc', 'abcd', 'abc'],
    ['abc', 'aabc', 'abc'],
    ['abcdabc', 'abc', 'abcd'],
    ['abcabc', 'abc', 'abc'],
    ['abcdabc', 'd', 'abcdabc']
  ])('given %p', async (str, suffix, expected) => {
    expect(Util.trimSuffix(str, suffix)).toEqual(expected);
  });
});

// See: https://github.com/actions/toolkit/blob/a1b068ec31a042ff1e10a522d8fdf0b8869d53ca/packages/core/src/core.ts#L89
function getInputName(name: string): string {
  return `INPUT_${name.replace(/ /g, '_').toUpperCase()}`;
}

function setInput(name: string, value: string): void {
  process.env[getInputName(name)] = value;
}
