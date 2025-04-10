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

import {describe, expect, it, test} from '@jest/globals';
import * as fs from 'fs';
import * as path from 'path';

import {Util} from '../src/util';

describe('getInputList', () => {
  it('single line correctly', async () => {
    await setInput('foo', 'bar');
    const res = Util.getInputList('foo');
    expect(res).toEqual(['bar']);
  });

  it('empty correctly', async () => {
    setInput('foo', '');
    const res = Util.getInputList('foo');
    expect(res).toEqual([]);
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
    const pgp = fs.readFileSync(path.join(__dirname, '.fixtures', 'pgp.txt'), {encoding: 'utf-8'});
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

  it('keep quotes', async () => {
    const output = `type=image,"name=ghcr.io/nginxinc/nginx-unprivileged,docker.io/nginxinc/nginx-unprivileged",push-by-digest=true,name-canonical=true,push=true`;
    setInput('outputs', output);
    expect(Util.getInputList('outputs', {ignoreComma: true, quote: false})).toEqual([output]);
  });
});

describe('getInputNumber', () => {
  it('should return a number when input is a valid number string', () => {
    setInput('foo', '42');
    const result = Util.getInputNumber('foo');
    expect(result).toBe(42);
  });

  it('should return undefined when input is an empty string', () => {
    setInput('foo', '');
    const result = Util.getInputNumber('foo');
    expect(result).toBeUndefined();
  });

  it('should return undefined when input is not provided', () => {
    const result = Util.getInputNumber('foo');
    expect(result).toBeUndefined();
  });

  it('should return NaN when input is not a valid number', () => {
    setInput('foo', 'invalid');
    const result = Util.getInputNumber('foo');
    expect(result).toBeNaN();
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

describe('hash', () => {
  it('returns 2c26b46b68ffc68ff99b453c1d30413413422d706483bfa0f98a5e886266e7ae', async () => {
    expect(Util.hash('foo')).toEqual('2c26b46b68ffc68ff99b453c1d30413413422d706483bfa0f98a5e886266e7ae');
  });
});

// https://github.com/golang/go/blob/f6b93a4c358b28b350dd8fe1780c1f78e520c09c/src/strconv/atob_test.go#L36-L58
describe('parseBool', () => {
  [
    {input: '', expected: false, throwsError: true},
    {input: 'asdf', expected: false, throwsError: true},
    {input: '0', expected: false, throwsError: false},
    {input: 'f', expected: false, throwsError: false},
    {input: 'F', expected: false, throwsError: false},
    {input: 'FALSE', expected: false, throwsError: false},
    {input: 'false', expected: false, throwsError: false},
    {input: 'False', expected: false, throwsError: false},
    {input: '1', expected: true, throwsError: false},
    {input: 't', expected: true, throwsError: false},
    {input: 'T', expected: true, throwsError: false},
    {input: 'TRUE', expected: true, throwsError: false},
    {input: 'true', expected: true, throwsError: false},
    {input: 'True', expected: true, throwsError: false}
  ].forEach(({input, expected, throwsError}) => {
    test(`parseBool("${input}")`, () => {
      if (throwsError) {
        // eslint-disable-next-line jest/no-conditional-expect
        expect(() => Util.parseBool(input)).toThrow();
      } else {
        // eslint-disable-next-line jest/no-conditional-expect
        expect(Util.parseBool(input)).toBe(expected);
      }
    });
  });
});

describe('formatFileSize', () => {
  test('should return "0 Bytes" when given 0 bytes', () => {
    expect(Util.formatFileSize(0)).toBe('0 Bytes');
  });
  test('should format bytes to KB correctly', () => {
    expect(Util.formatFileSize(1024)).toBe('1 KB');
    expect(Util.formatFileSize(2048)).toBe('2 KB');
    expect(Util.formatFileSize(1500)).toBe('1.46 KB');
  });
  test('should format bytes to MB correctly', () => {
    expect(Util.formatFileSize(1024 * 1024)).toBe('1 MB');
    expect(Util.formatFileSize(2.5 * 1024 * 1024)).toBe('2.5 MB');
    expect(Util.formatFileSize(3.8 * 1024 * 1024)).toBe('3.8 MB');
  });
  test('should format bytes to GB correctly', () => {
    expect(Util.formatFileSize(1024 * 1024 * 1024)).toBe('1 GB');
    expect(Util.formatFileSize(2.5 * 1024 * 1024 * 1024)).toBe('2.5 GB');
    expect(Util.formatFileSize(3.8 * 1024 * 1024 * 1024)).toBe('3.8 GB');
  });
  test('should format bytes to TB correctly', () => {
    expect(Util.formatFileSize(1024 * 1024 * 1024 * 1024)).toBe('1 TB');
    expect(Util.formatFileSize(2.5 * 1024 * 1024 * 1024 * 1024)).toBe('2.5 TB');
    expect(Util.formatFileSize(3.8 * 1024 * 1024 * 1024 * 1024)).toBe('3.8 TB');
  });
});

describe('generateRandomString', () => {
  it('should generate a random string of default length 10', async () => {
    const res = Util.generateRandomString();
    expect(typeof res).toBe('string');
    expect(res.length).toBe(10);
    expect(/^[0-9a-f]+$/i.test(res)).toBe(true);
  });
  it('should generate a random string of specified length', async () => {
    const length = 15;
    const res = Util.generateRandomString(length);
    expect(typeof res).toBe('string');
    expect(res.length).toBe(15);
    expect(/^[0-9a-f]+$/i.test(res)).toBe(true);
  });
});

describe('stringToUnicodeEntities', () => {
  it('should convert a string to Unicode entities', () => {
    const input = 'Hello, World!';
    const expected = '&#x48;&#x65;&#x6c;&#x6c;&#x6f;&#x2c;&#x20;&#x57;&#x6f;&#x72;&#x6c;&#x64;&#x21;';
    const result = Util.stringToUnicodeEntities(input);
    expect(result).toEqual(expected);
  });
  it('should handle an empty string', () => {
    const input = '';
    const expected = '';
    const result = Util.stringToUnicodeEntities(input);
    expect(result).toEqual(expected);
  });
  it('should handle special characters', () => {
    const input = '@#^&*()';
    const expected = '&#x40;&#x23;&#x5e;&#x26;&#x2a;&#x28;&#x29;';
    const result = Util.stringToUnicodeEntities(input);
    expect(result).toEqual(expected);
  });
  it('should handle non-English characters', () => {
    const input = 'こんにちは';
    const expected = '&#x3053;&#x3093;&#x306b;&#x3061;&#x306f;';
    const result = Util.stringToUnicodeEntities(input);
    expect(result).toEqual(expected);
  });
});

describe('countLines', () => {
  it('counts total number of lines correctly', () => {
    const text = `This

is
a
sample

text
with
multiple
lines`;

    const result = Util.countLines(text);
    expect(result).toEqual(10); // Including empty lines
  });
  it('handles edge case with empty string', () => {
    const text = '';

    const result = Util.countLines(text);
    expect(result).toEqual(1); // Empty string should have 1 line
  });
  it('handles edge case with single line', () => {
    const text = 'Single line text';

    const result = Util.countLines(text);
    expect(result).toEqual(1); // Single line should have 1 line
  });
  it('handles multiple types of line breaks', () => {
    const text = `Line 1\r\nLine 2\rLine 3\nLine 4`;

    const result = Util.countLines(text);
    expect(result).toEqual(4); // Different line break types should be counted correctly
  });
});

describe('isPathRelativeTo', () => {
  it('should return true for a child path directly inside the parent path', () => {
    const parentPath = '/home/user/projects';
    const childPath = '/home/user/projects/subproject';
    expect(Util.isPathRelativeTo(parentPath, childPath)).toBe(true);
  });
  it('should return true for a deeply nested child path inside the parent path', () => {
    const parentPath = '/home/user';
    const childPath = '/home/user/projects/subproject/module';
    expect(Util.isPathRelativeTo(parentPath, childPath)).toBe(true);
  });
  it('should return false for a child path outside the parent path', () => {
    const parentPath = '/home/user/projects';
    const childPath = '/home/user/otherprojects/subproject';
    expect(Util.isPathRelativeTo(parentPath, childPath)).toBe(false);
  });
  it('should return true for a child path specified with relative segments', () => {
    const parentPath = '/home/user/projects';
    const childPath = '/home/user/projects/../projects/subproject';
    expect(Util.isPathRelativeTo(parentPath, childPath)).toBe(true);
  });
  it('should return false when the child path is actually a parent path', () => {
    const parentPath = '/home/user/projects/subproject';
    const childPath = '/home/user/projects';
    expect(Util.isPathRelativeTo(parentPath, childPath)).toBe(false);
  });
});

describe('formatDuration', () => {
  it('formats 0 nanoseconds as "0s"', () => {
    expect(Util.formatDuration(0)).toBe('0s');
  });
  it('formats only seconds', () => {
    expect(Util.formatDuration(5e9)).toBe('5s');
    expect(Util.formatDuration(59e9)).toBe('59s');
  });
  it('formats minutes and seconds', () => {
    expect(Util.formatDuration(65e9)).toBe('1m5s');
    expect(Util.formatDuration(600e9)).toBe('10m');
  });
  it('formats hours, minutes, and seconds', () => {
    expect(Util.formatDuration(3661e9)).toBe('1h1m1s');
    expect(Util.formatDuration(7322e9)).toBe('2h2m2s');
  });
  it('formats hours only', () => {
    expect(Util.formatDuration(3 * 3600e9)).toBe('3h');
  });
  it('formats hours and minutes', () => {
    expect(Util.formatDuration(3900e9)).toBe('1h5m');
  });
  it('formats minutes only', () => {
    expect(Util.formatDuration(120e9)).toBe('2m');
  });
  it('rounds down partial seconds', () => {
    expect(Util.formatDuration(1799999999)).toBe('1s');
  });
});

// See: https://github.com/actions/toolkit/blob/a1b068ec31a042ff1e10a522d8fdf0b8869d53ca/packages/core/src/core.ts#L89
function getInputName(name: string): string {
  return `INPUT_${name.replace(/ /g, '_').toUpperCase()}`;
}

function setInput(name: string, value: string): void {
  process.env[getInputName(name)] = value;
}
