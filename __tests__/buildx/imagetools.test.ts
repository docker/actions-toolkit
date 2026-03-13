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

import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import * as rimraf from 'rimraf';

import {Buildx} from '../../src/buildx/buildx.js';
import {ImageTools} from '../../src/buildx/imagetools.js';
import {Context} from '../../src/context.js';
import {Exec} from '../../src/exec.js';

const tmpDir = fs.mkdtempSync(path.join(process.env.TEMP || os.tmpdir(), 'buildx-imagetools-'));
const metadataFile = path.join(tmpDir, 'imagetools-metadata.json');

vi.spyOn(Context, 'tmpDir').mockImplementation((): string => {
  fs.mkdirSync(tmpDir, {recursive: true});
  return tmpDir;
});

vi.spyOn(Context, 'tmpName').mockImplementation((): string => {
  return metadataFile;
});

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
  rimraf.sync(tmpDir);
});

beforeEach(() => {
  vi.useRealTimers();
  fs.mkdirSync(tmpDir, {recursive: true});
});

describe('inspectManifest', () => {
  it('retries transient manifest unknown errors when requested', async () => {
    vi.useFakeTimers();

    const getCommand = vi.fn().mockResolvedValue({
      command: 'docker',
      args: ['buildx', 'imagetools', 'inspect']
    });
    const buildx = {getCommand} as unknown as Buildx;
    const execSpy = vi
      .spyOn(Exec, 'getExecOutput')
      .mockResolvedValueOnce({
        exitCode: 1,
        stdout: '',
        stderr: 'ERROR: MANIFEST_UNKNOWN: manifest unknown'
      })
      .mockResolvedValueOnce({
        exitCode: 0,
        stdout: JSON.stringify({
          schemaVersion: 2,
          mediaType: 'application/vnd.oci.image.index.v1+json',
          manifests: []
        }),
        stderr: ''
      });

    const inspectPromise = new ImageTools({buildx}).inspectManifest({
      name: 'docker.io/library/alpine:latest',
      retryOnManifestUnknown: true,
      retryLimit: 2
    });

    await vi.runAllTimersAsync();

    expect(await inspectPromise).toEqual({
      schemaVersion: 2,
      mediaType: 'application/vnd.oci.image.index.v1+json',
      manifests: []
    });
    expect(getCommand).toHaveBeenCalledWith(['imagetools', 'inspect', 'docker.io/library/alpine:latest', '--format', '{{json .Manifest}}']);
    expect(execSpy).toHaveBeenCalledTimes(2);
  });

  it('does not retry non-manifest errors', async () => {
    const getCommand = vi.fn().mockResolvedValue({
      command: 'docker',
      args: ['buildx', 'imagetools', 'inspect']
    });
    const buildx = {getCommand} as unknown as Buildx;
    const execSpy = vi.spyOn(Exec, 'getExecOutput').mockResolvedValue({
      exitCode: 1,
      stdout: '',
      stderr: 'ERROR: unauthorized'
    });

    const result = await new ImageTools({buildx})
      .inspectManifest({
        name: 'docker.io/library/alpine:latest',
        retryOnManifestUnknown: true
      })
      .then(
        value => ({value, error: undefined}),
        error => ({value: undefined, error: error as Error})
      );

    expect(result.value).toBeUndefined();
    expect(result.error).toBeInstanceOf(Error);
    expect(result.error?.message).toContain('ERROR: unauthorized');

    expect(execSpy).toHaveBeenCalledTimes(1);
  });
});

describe('inspectImage', () => {
  it('retries transient manifest unknown errors when requested', async () => {
    vi.useFakeTimers();

    const getCommand = vi.fn().mockResolvedValue({
      command: 'docker',
      args: ['buildx', 'imagetools', 'inspect']
    });
    const buildx = {getCommand} as unknown as Buildx;
    const execSpy = vi
      .spyOn(Exec, 'getExecOutput')
      .mockResolvedValueOnce({
        exitCode: 1,
        stdout: '',
        stderr: 'ERROR: MANIFEST_UNKNOWN: manifest unknown'
      })
      .mockResolvedValueOnce({
        exitCode: 0,
        stdout: JSON.stringify({
          config: {
            digest: 'sha256:test'
          }
        }),
        stderr: ''
      });

    const inspectPromise = new ImageTools({buildx}).inspectImage({
      name: 'docker.io/library/alpine:latest',
      retryOnManifestUnknown: true,
      retryLimit: 2
    });

    await vi.runAllTimersAsync();

    expect(await inspectPromise).toEqual({
      config: {
        digest: 'sha256:test'
      }
    });
    expect(getCommand).toHaveBeenCalledWith(['imagetools', 'inspect', 'docker.io/library/alpine:latest', '--format', '{{json .Image}}']);
    expect(execSpy).toHaveBeenCalledTimes(2);
  });
});

describe('create', () => {
  it('parses metadata and supports cwd sources', async () => {
    const getCommand = vi.fn().mockResolvedValue({
      command: 'docker',
      args: ['buildx', 'imagetools', 'create']
    });
    const buildx = {getCommand} as unknown as Buildx;

    fs.writeFileSync(
      metadataFile,
      JSON.stringify({
        'containerimage.descriptor': {
          mediaType: 'application/vnd.oci.image.index.v1+json',
          digest: 'sha256:19ffeab6f8bc9293ac2c3fdf94ebe28396254c993aea0b5a542cfb02e0883fa3',
          size: 4654
        },
        'image.name': 'docker.io/user/app,docker.io/user/app2'
      })
    );

    const execSpy = vi.spyOn(Exec, 'getExecOutput').mockResolvedValue({
      exitCode: 0,
      stdout: '',
      stderr: ''
    });

    const result = await new ImageTools({buildx}).create({
      sources: ['cwd://descriptor.json', 'docker.io/library/alpine:latest'],
      tags: ['docker.io/user/app:latest'],
      silent: true
    });

    expect(getCommand).toHaveBeenCalledWith(['imagetools', 'create', '--tag', 'docker.io/user/app:latest', '--metadata-file', metadataFile, '--file', 'descriptor.json', 'docker.io/library/alpine:latest']);
    expect(execSpy).toHaveBeenCalledWith('docker', ['buildx', 'imagetools', 'create'], {
      ignoreReturnCode: true,
      silent: true
    });
    expect(result).toEqual({
      digest: 'sha256:19ffeab6f8bc9293ac2c3fdf94ebe28396254c993aea0b5a542cfb02e0883fa3',
      descriptor: {
        mediaType: 'application/vnd.oci.image.index.v1+json',
        digest: 'sha256:19ffeab6f8bc9293ac2c3fdf94ebe28396254c993aea0b5a542cfb02e0883fa3',
        size: 4654
      },
      imageNames: ['docker.io/user/app', 'docker.io/user/app2']
    });
  });

  it('does not parse metadata in dry-run mode', async () => {
    const getCommand = vi.fn().mockResolvedValue({
      command: 'docker',
      args: ['buildx', 'imagetools', 'create']
    });
    const buildx = {getCommand} as unknown as Buildx;

    const execSpy = vi.spyOn(Exec, 'getExecOutput').mockResolvedValue({
      exitCode: 0,
      stdout: '',
      stderr: ''
    });

    const result = await new ImageTools({buildx}).create({
      sources: ['docker.io/library/alpine:latest'],
      dryRun: true,
      silent: true
    });

    expect(getCommand).toHaveBeenCalledWith(['imagetools', 'create', '--dry-run', 'docker.io/library/alpine:latest']);
    expect(execSpy).toHaveBeenCalledWith('docker', ['buildx', 'imagetools', 'create'], {
      ignoreReturnCode: true,
      silent: true
    });
    expect(result).toBeUndefined();
  });

  it('passes annotations to imagetools create', async () => {
    const getCommand = vi.fn().mockResolvedValue({
      command: 'docker',
      args: ['buildx', 'imagetools', 'create']
    });
    const buildx = {getCommand} as unknown as Buildx;

    const execSpy = vi.spyOn(Exec, 'getExecOutput').mockResolvedValue({
      exitCode: 0,
      stdout: '',
      stderr: ''
    });

    const result = await new ImageTools({buildx}).create({
      sources: ['docker.io/library/alpine:latest'],
      annotations: ['index:org.opencontainers.image.title=Alpine', 'manifest-descriptor:org.opencontainers.image.description=Base image'],
      silent: true
    });

    expect(getCommand).toHaveBeenCalledWith([
      'imagetools',
      'create',
      '--annotation',
      'index:org.opencontainers.image.title=Alpine',
      '--annotation',
      'manifest-descriptor:org.opencontainers.image.description=Base image',
      '--metadata-file',
      metadataFile,
      'docker.io/library/alpine:latest'
    ]);
    expect(execSpy).toHaveBeenCalledWith('docker', ['buildx', 'imagetools', 'create'], {
      ignoreReturnCode: true,
      silent: true
    });
    expect(result).toBeUndefined();
  });

  it('skips command execution when skipExec is enabled', async () => {
    const getCommand = vi.fn().mockResolvedValue({
      command: 'docker',
      args: ['buildx', 'imagetools', 'create']
    });
    const buildx = {getCommand} as unknown as Buildx;
    const execSpy = vi.spyOn(Exec, 'getExecOutput').mockResolvedValue({
      exitCode: 0,
      stdout: '',
      stderr: ''
    });

    const result = await new ImageTools({buildx}).create({
      sources: ['docker.io/library/alpine:latest'],
      skipExec: true
    });

    expect(getCommand).toHaveBeenCalledWith(['imagetools', 'create', '--metadata-file', metadataFile, 'docker.io/library/alpine:latest']);
    expect(execSpy).not.toHaveBeenCalled();
    expect(result).toBeUndefined();
  });
});
