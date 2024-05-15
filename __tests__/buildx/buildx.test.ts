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

import {describe, expect, it, jest, test, beforeEach, afterEach} from '@jest/globals';
import * as fs from 'fs';
import * as path from 'path';
import * as rimraf from 'rimraf';
import * as semver from 'semver';

import {Buildx} from '../../src/buildx/buildx';
import {Context} from '../../src/context';
import {Exec} from '../../src/exec';

import {Cert} from '../../src/types/buildx/buildx';

const fixturesDir = path.join(__dirname, '..', 'fixtures');
// prettier-ignore
const tmpDir = path.join(process.env.TEMP || '/tmp', 'buildx-jest');
const tmpName = path.join(tmpDir, '.tmpname-jest');

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

describe('configDir', () => {
  const originalEnv = process.env;
  beforeEach(() => {
    jest.resetModules();
    process.env = {
      ...originalEnv,
      BUILDX_CONFIG: '/var/docker/buildx',
      DOCKER_CONFIG: '/var/docker/config'
    };
  });
  afterEach(() => {
    process.env = originalEnv;
  });
  it('returns default', async () => {
    process.env.BUILDX_CONFIG = '';
    expect(Buildx.configDir).toEqual(path.join('/var/docker/config', 'buildx'));
  });
  it('returns from env', async () => {
    expect(Buildx.configDir).toEqual('/var/docker/buildx');
  });
});

describe('certsDir', () => {
  const originalEnv = process.env;
  beforeEach(() => {
    jest.resetModules();
    process.env = {
      ...originalEnv,
      BUILDX_CONFIG: '/var/docker/buildx'
    };
  });
  afterEach(() => {
    process.env = originalEnv;
  });
  it('returns default', async () => {
    process.env.BUILDX_CONFIG = '/var/docker/buildx';
    expect(Buildx.certsDir).toEqual(path.join('/var/docker/buildx', 'certs'));
  });
});

describe('isAvailable', () => {
  it('docker cli', async () => {
    const execSpy = jest.spyOn(Exec, 'getExecOutput');
    const buildx = new Buildx({
      standalone: false
    });
    await buildx.isAvailable();
    // eslint-disable-next-line jest/no-standalone-expect
    expect(execSpy).toHaveBeenCalledWith(`docker`, ['buildx'], {
      silent: true,
      ignoreReturnCode: true
    });
  });
  it('standalone', async () => {
    const execSpy = jest.spyOn(Exec, 'getExecOutput');
    const buildx = new Buildx({
      standalone: true
    });
    await buildx.isAvailable();
    // eslint-disable-next-line jest/no-standalone-expect
    expect(execSpy).toHaveBeenCalledWith(`buildx`, [], {
      silent: true,
      ignoreReturnCode: true
    });
  });
});

describe('printVersion', () => {
  it('docker cli', async () => {
    const execSpy = jest.spyOn(Exec, 'exec');
    const buildx = new Buildx({
      standalone: false
    });
    await buildx.printVersion();
    expect(execSpy).toHaveBeenCalledWith(`docker`, ['buildx', 'version'], {
      failOnStdErr: false
    });
  });
  it('standalone', async () => {
    const execSpy = jest.spyOn(Exec, 'exec');
    const buildx = new Buildx({
      standalone: true
    });
    await buildx.printVersion();
    expect(execSpy).toHaveBeenCalledWith(`buildx`, ['version'], {
      failOnStdErr: false
    });
  });
});

describe('version', () => {
  it('valid', async () => {
    const buildx = new Buildx();
    expect(semver.valid(await buildx.version())).not.toBeUndefined();
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

describe('resolveCertsDriverOpts', () => {
  const originalEnv = process.env;
  beforeEach(() => {
    jest.resetModules();
    process.env = {
      ...originalEnv,
      BUILDX_CONFIG: path.join(tmpDir, 'resolveCertsDriverOpts', 'buildx')
    };
  });
  afterEach(() => {
    process.env = originalEnv;
    rimraf.sync(path.join(tmpDir, 'resolveCertsDriverOpts', 'buildx'));
  });
  // prettier-ignore
  test.each([
    [
      1,
      'mycontext',
      'docker-container',
      {},
      [],
      []
    ],
    [
      2,
      'docker-container://mycontainer',
      'docker-container',
      {},
      [],
      []
    ],
    [
      3,
      'tcp://graviton2:1234',
      'remote',
      {},
      [],
      []
    ],
    [
      4,
      'tcp://graviton2:1234',
      'remote',
      {
        cacert: 'foo',
        cert: 'foo',
        key: 'foo',
      } as Cert,
      [
        path.join(tmpDir, 'resolveCertsDriverOpts', 'buildx', 'certs', 'cacert_graviton2-1234.pem'),
        path.join(tmpDir, 'resolveCertsDriverOpts', 'buildx', 'certs', 'cert_graviton2-1234.pem'),
        path.join(tmpDir, 'resolveCertsDriverOpts', 'buildx', 'certs', 'key_graviton2-1234.pem')
      ],
      [
        `cacert=${path.join(tmpDir, 'resolveCertsDriverOpts', 'buildx', 'certs', 'cacert_graviton2-1234.pem')}`,
        `cert=${path.join(tmpDir, 'resolveCertsDriverOpts', 'buildx', 'certs', 'cert_graviton2-1234.pem')}`,
        `key=${path.join(tmpDir, 'resolveCertsDriverOpts', 'buildx', 'certs', 'key_graviton2-1234.pem')}`
      ]
    ],
    [
      5,
      'tcp://mybuilder:1234',
      'docker-container',
      {
        cacert: 'foo',
        cert: 'foo',
        key: 'foo',
      } as Cert,
      [
        path.join(tmpDir, 'resolveCertsDriverOpts', 'buildx', 'certs', 'cacert_mybuilder-1234.pem'),
        path.join(tmpDir, 'resolveCertsDriverOpts', 'buildx', 'certs', 'cert_mybuilder-1234.pem'),
        path.join(tmpDir, 'resolveCertsDriverOpts', 'buildx', 'certs', 'key_mybuilder-1234.pem')
      ],
      []
    ],
  ])('%p. given %p endpoint, %p driver', async (id: number, endpoint: string, driver: string, cert: Cert, expectedFiles: Array<string>, expectedOpts: Array<string>) => {
    fs.mkdirSync(Buildx.certsDir, {recursive: true});
    expect(Buildx.resolveCertsDriverOpts(driver, endpoint, cert)).toEqual(expectedOpts);
    for (const k in expectedFiles) {
      const file = expectedFiles[k];
      expect(fs.existsSync(file)).toBe(true);
    }
  });
});

describe('refs', () => {
  it('returns all refs', async () => {
    const refs = Buildx.refs({
      dir: path.join(fixturesDir, 'buildx-refs')
    });
    expect(Object.keys(refs).length).toEqual(11);
  });
  it('returns default builder refs', async () => {
    const refs = Buildx.refs({
      dir: path.join(fixturesDir, 'buildx-refs'),
      builderName: 'default'
    });
    expect(Object.keys(refs).length).toEqual(8);
  });
  it('returns foo builder refs', async () => {
    const refs = Buildx.refs({
      dir: path.join(fixturesDir, 'buildx-refs'),
      builderName: 'foo'
    });
    expect(Object.keys(refs).length).toEqual(3);
  });
  it('returns default builder refs since', async () => {
    const mdate = new Date('2023-09-05T00:00:00Z');
    fs.utimesSync(path.join(fixturesDir, 'buildx-refs', 'default', 'default', '36dix0eiv9evr61vrwzn32w7q'), mdate, mdate);
    fs.utimesSync(path.join(fixturesDir, 'buildx-refs', 'default', 'default', '49p5r8und2konke5pmlyzqp3n'), mdate, mdate);
    fs.utimesSync(path.join(fixturesDir, 'buildx-refs', 'default', 'default', 'a8zqzhhv5yiazm396jobsgdw2'), mdate, mdate);
    const refs = Buildx.refs({
      dir: path.join(fixturesDir, 'buildx-refs'),
      builderName: 'default',
      since: new Date('2024-01-10T00:00:00Z')
    });
    expect(Object.keys(refs).length).toEqual(5);
  });
});
