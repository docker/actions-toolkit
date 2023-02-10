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
import * as exec from '@actions/exec';

import {Buildx} from '../../src/buildx/buildx';
import {Context} from '../../src/context';

// prettier-ignore
const tmpDir = path.join(process.env.TEMP || '/tmp', 'buildx-jest').split(path.sep).join(path.posix.sep);
const tmpName = path.join(tmpDir, '.tmpname-jest').split(path.sep).join(path.posix.sep);

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

describe('isAvailable', () => {
  it('docker cli', async () => {
    const execSpy = jest.spyOn(exec, 'getExecOutput');
    const buildx = new Buildx({
      context: new Context(),
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
      context: new Context(),
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

describe('printInspect', () => {
  it('prints builder2 instance', () => {
    const execSpy = jest.spyOn(exec, 'exec');
    const buildx = new Buildx({
      context: new Context(),
      standalone: true
    });
    buildx.printInspect('builder2').catch(() => {
      // noop
    });
    expect(execSpy).toHaveBeenCalledWith(`buildx`, ['inspect', 'builder2'], {
      failOnStdErr: false
    });
  });
});

describe('printVersion', () => {
  it('docker cli', () => {
    const execSpy = jest.spyOn(exec, 'exec');
    const buildx = new Buildx({
      context: new Context(),
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
      context: new Context(),
      standalone: true
    });
    buildx.printVersion();
    expect(execSpy).toHaveBeenCalledWith(`buildx`, ['version'], {
      failOnStdErr: false
    });
  });
});

describe('version', () => {
  it('valid', async () => {
    const buildx = new Buildx({
      context: new Context()
    });
    expect(semver.valid(await buildx.version)).not.toBeUndefined();
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
    const buildx = new Buildx({
      context: new Context()
    });
    expect(await buildx.versionSatisfies(range, version)).toBe(expected);
  });
});
