import {afterEach, beforeEach, describe, expect, it, jest, test} from '@jest/globals';
import * as fs from 'fs';
import * as path from 'path';
import * as semver from 'semver';
import * as exec from '@actions/exec';
import rimraf from 'rimraf';

import {Buildx} from '../src/buildx';

const tmpDir = path.join('/tmp/.docker-actions-toolkit-jest').split(path.sep).join(path.posix.sep);
const tmpName = path.join(tmpDir, '.tmpname-jest').split(path.sep).join(path.posix.sep);
const metadata = `{
  "containerimage.config.digest": "sha256:059b68a595b22564a1cbc167af369349fdc2ecc1f7bc092c2235cbf601a795fd",
  "containerimage.digest": "sha256:b09b9482c72371486bb2c1d2c2a2633ed1d0b8389e12c8d52b9e052725c0c83c"
}`;

jest.spyOn(Buildx.prototype as any, 'tmpDir').mockImplementation((): string => {
  if (!fs.existsSync(tmpDir)) {
    fs.mkdirSync(tmpDir, {recursive: true});
  }
  return tmpDir;
});

beforeEach(() => {
  jest.clearAllMocks();
});

afterEach(() => {
  rimraf.sync(tmpDir);
});

jest.spyOn(Buildx.prototype as any, 'tmpName').mockImplementation((): string => {
  return tmpName;
});

describe('getBuildImageID', () => {
  it('matches', async () => {
    const buildx = new Buildx();
    const imageID = 'sha256:bfb45ab72e46908183546477a08f8867fc40cebadd00af54b071b097aed127a9';
    const imageIDFile = buildx.getBuildImageIDFilePath();
    await fs.writeFileSync(imageIDFile, imageID);
    const expected = buildx.getBuildImageID();
    expect(expected).toEqual(imageID);
  });
});

describe('getBuildMetadata', () => {
  it('matches', async () => {
    const buildx = new Buildx();
    const metadataFile = buildx.getBuildMetadataFilePath();
    await fs.writeFileSync(metadataFile, metadata);
    const expected = buildx.getBuildMetadata();
    expect(expected).toEqual(metadata);
  });
});

describe('getDigest', () => {
  it('matches', async () => {
    const buildx = new Buildx();
    const metadataFile = buildx.getBuildMetadataFilePath();
    await fs.writeFileSync(metadataFile, metadata);
    const expected = buildx.getDigest();
    expect(expected).toEqual('sha256:b09b9482c72371486bb2c1d2c2a2633ed1d0b8389e12c8d52b9e052725c0c83c');
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
    expect(Buildx.hasLocalExporter(exporters)).toEqual(expected);
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
    expect(Buildx.hasTarExporter(exporters)).toEqual(expected);
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
    expect(Buildx.hasDockerExporter(exporters, load)).toEqual(expected);
  });
});

describe('isAvailable', () => {
  it('docker cli', async () => {
    const execSpy = jest.spyOn(exec, 'getExecOutput');
    const buildx = new Buildx({
      standalone: false
    });
    buildx.isAvailable().catch(() => {
      // noop
    });
    // eslint-disable-next-line jest/no-standalone-expect
    expect(execSpy).toHaveBeenCalledWith(`docker`, ['buildx'], {
      silent: true,
      ignoreReturnCode: true
    });
  });
  it('standalone', async () => {
    const execSpy = jest.spyOn(exec, 'getExecOutput');
    const buildx = new Buildx({
      standalone: true
    });
    buildx.isAvailable().catch(() => {
      // noop
    });
    // eslint-disable-next-line jest/no-standalone-expect
    expect(execSpy).toHaveBeenCalledWith(`buildx`, [], {
      silent: true,
      ignoreReturnCode: true
    });
  });
});

describe('printVersion', () => {
  it('docker cli', () => {
    const execSpy = jest.spyOn(exec, 'exec');
    const buildx = new Buildx({
      standalone: false
    });
    buildx.printVersion();
    expect(execSpy).toHaveBeenCalledWith(`docker`, ['buildx', 'version'], {
      failOnStdErr: false
    });
  });
  it('standalone', () => {
    const execSpy = jest.spyOn(exec, 'exec');
    const buildx = new Buildx({
      standalone: true
    });
    buildx.printVersion();
    expect(execSpy).toHaveBeenCalledWith(`buildx`, ['version'], {
      failOnStdErr: false
    });
  });
});

describe('getVersion', () => {
  it('valid', async () => {
    const buildx = new Buildx();
    const version = await buildx.getVersion();
    expect(semver.valid(version)).not.toBeNull();
  });
});

describe('parseVersion', () => {
  test.each([
    ['github.com/docker/buildx 0.4.1+azure bda4882a65349ca359216b135896bddc1d92461c', '0.4.1'],
    ['github.com/docker/buildx v0.4.1 bda4882a65349ca359216b135896bddc1d92461c', '0.4.1'],
    ['github.com/docker/buildx v0.4.2 fb7b670b764764dc4716df3eba07ffdae4cc47b2', '0.4.2'],
    ['github.com/docker/buildx f117971 f11797113e5a9b86bd976329c5dbb8a8bfdfadfa', 'f117971']
  ])('given %p', async (stdout, expected) => {
    expect(Buildx.parseVersion(stdout)).toEqual(expected);
  });
});

describe('versionSatisfies', () => {
  test.each([
    ['0.4.1', '>=0.3.2', true],
    ['bda4882a65349ca359216b135896bddc1d92461c', '>0.1.0', false],
    ['f117971', '>0.6.0', true]
  ])('given %p', async (version, range, expected) => {
    const buildx = new Buildx();
    expect(await buildx.versionSatisfies(range, version)).toBe(expected);
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
    [`foo=${path.join(__dirname, 'fixtures', 'secret.txt').split(path.sep).join(path.posix.sep)}`, true, 'foo', 'bar', null],
    [`notfound=secret`, true, '', '', new Error('secret file secret not found')]
  ])('given %p key and %p secret', async (kvp: string, file: boolean, exKey: string, exValue: string, error: Error) => {
    try {
      const buildx = new Buildx();
      let secret: string;
      if (file) {
        secret = buildx.generateBuildSecretFile(kvp);
      } else {
        secret = buildx.generateBuildSecretString(kvp);
      }
      expect(secret).toEqual(`id=${exKey},src=${tmpName}`);
      expect(fs.readFileSync(tmpName, 'utf-8')).toEqual(exValue);
    } catch (e) {
      // eslint-disable-next-line jest/no-conditional-expect
      expect(e.message).toEqual(error?.message);
    }
  });
});

describe('hasGitAuthTokenSecret', () => {
  // prettier-ignore
  test.each([
    [['A_SECRET=abcdef0123456789'], false],
    [['GIT_AUTH_TOKEN=abcdefghijklmno=0123456789'], true],
  ])('given %p secret', async (kvp: Array<string>, expected: boolean) => {
    expect(Buildx.hasGitAuthTokenSecret(kvp)).toBe(expected);
  });
});
