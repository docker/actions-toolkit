import {describe, expect, it, jest, test} from '@jest/globals';
import * as fs from 'fs';
import * as path from 'path';
import * as util from '../src/util';

jest.spyOn(util, 'defaultContext').mockImplementation((): string => {
  return 'https://github.com/docker/actions-toolkit.git#refs/heads/test-jest';
});

jest.spyOn(util, 'tmpDir').mockImplementation((): string => {
  const tmpDir = path.join('/tmp/.docker-build-push-jest').split(path.sep).join(path.posix.sep);
  if (!fs.existsSync(tmpDir)) {
    fs.mkdirSync(tmpDir, {recursive: true});
  }
  return tmpDir;
});

jest.spyOn(util, 'tmpNameSync').mockImplementation((): string => {
  return path.join('/tmp/.docker-build-push-jest', '.tmpname-jest').split(path.sep).join(path.posix.sep);
});

describe('getInputList', () => {
  it('single line correctly', async () => {
    await setInput('foo', 'bar');
    const res = util.getInputList('foo');
    expect(res).toEqual(['bar']);
  });

  it('multiline correctly', async () => {
    setInput('foo', 'bar\nbaz');
    const res = util.getInputList('foo');
    expect(res).toEqual(['bar', 'baz']);
  });

  it('empty lines correctly', async () => {
    setInput('foo', 'bar\n\nbaz');
    const res = util.getInputList('foo');
    expect(res).toEqual(['bar', 'baz']);
  });

  it('comma correctly', async () => {
    setInput('foo', 'bar,baz');
    const res = util.getInputList('foo');
    expect(res).toEqual(['bar', 'baz']);
  });

  it('empty result correctly', async () => {
    setInput('foo', 'bar,baz,');
    const res = util.getInputList('foo');
    expect(res).toEqual(['bar', 'baz']);
  });

  it('different new lines correctly', async () => {
    setInput('foo', 'bar\r\nbaz');
    const res = util.getInputList('foo');
    expect(res).toEqual(['bar', 'baz']);
  });

  it('different new lines and comma correctly', async () => {
    setInput('foo', 'bar\r\nbaz,bat');
    const res = util.getInputList('foo');
    expect(res).toEqual(['bar', 'baz', 'bat']);
  });

  it('multiline and ignoring comma correctly', async () => {
    setInput('cache-from', 'user/app:cache\ntype=local,src=path/to/dir');
    const res = util.getInputList('cache-from', true);
    expect(res).toEqual(['user/app:cache', 'type=local,src=path/to/dir']);
  });

  it('different new lines and ignoring comma correctly', async () => {
    setInput('cache-from', 'user/app:cache\r\ntype=local,src=path/to/dir');
    const res = util.getInputList('cache-from', true);
    expect(res).toEqual(['user/app:cache', 'type=local,src=path/to/dir']);
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
    const res = util.getInputList('secrets', true);
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
    const res = util.getInputList('secrets', true);
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
    const res = util.getInputList('secrets', true);
    expect(res).toEqual(['GIT_AUTH_TOKEN=abcdefgh,ijklmno=0123456789', 'MYSECRET=aaaaaaaa', 'bbbbbbb', 'ccccccccc', 'FOO=bar']);
  });

  it('large multiline values', async () => {
    const pgp = fs.readFileSync(path.join(__dirname, 'fixtures', 'pgp.txt'), {encoding: 'utf-8'});
    setInput(
      'secrets',
      `"GPG_KEY=${pgp}"
FOO=bar`
    );
    const res = util.getInputList('secrets', true);
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
    const res = util.getInputList('secrets', true);
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

    await util.asyncForEach(testValues, async value => {
      results.push(value);
    });

    expect(results).toEqual(testValues);
  });
});

describe('isValidUrl', () => {
  test.each([
    ['https://github.com/docker/buildx.git', true],
    ['https://github.com/docker/buildx.git#refs/pull/648/head', true],
    ['v0.4.1', false]
  ])('given %p', async (url, expected) => {
    expect(util.isValidUrl(url)).toEqual(expected);
  });
});

// See: https://github.com/actions/toolkit/blob/a1b068ec31a042ff1e10a522d8fdf0b8869d53ca/packages/core/src/core.ts#L89
function getInputName(name: string): string {
  return `INPUT_${name.replace(/ /g, '_').toUpperCase()}`;
}

function setInput(name: string, value: string): void {
  process.env[getInputName(name)] = value;
}
