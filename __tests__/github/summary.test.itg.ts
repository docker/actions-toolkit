/**
 * Copyright 2024 actions-toolkit authors
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
import fs from 'fs';
import os from 'os';
import path from 'path';

import {Buildx} from '../../src/buildx/buildx';
import {Bake} from '../../src/buildx/bake';
import {Build} from '../../src/buildx/build';
import {Exec} from '../../src/exec';
import {GitHubArtifact} from '../../src/github/artifact';
import {GitHubSummary} from '../../src/github/summary';
import {History} from '../../src/buildx/history';

const fixturesDir = path.join(__dirname, '..', '.fixtures');
const tmpDir = fs.mkdtempSync(path.join(process.env.TEMP || os.tmpdir(), 'github-itg-'));

const maybe = !process.env.GITHUB_ACTIONS || (process.env.GITHUB_ACTIONS === 'true' && process.env.ImageOS && process.env.ImageOS.startsWith('ubuntu')) ? describe : describe.skip;

maybe('writeBuildSummary', () => {
  // prettier-ignore
  test.each([
    [
      "single",
      [
        'build',
        '-f', path.join(fixturesDir, 'hello.Dockerfile'),
        fixturesDir
      ],
    ],
    [
      "multiplatform",
      [
        'build',
        '-f', path.join(fixturesDir, 'hello.Dockerfile'),
        '--platform', 'linux/amd64,linux/arm64',
        fixturesDir
      ],
    ]
  ])('write build summary %p', async (_, bargs) => {
    const buildx = new Buildx();
    const build = new Build({buildx: buildx});

    fs.mkdirSync(tmpDir, {recursive: true});
    await expect(
      (async () => {
        // prettier-ignore
        const buildCmd = await buildx.getCommand([
          '--builder', process.env.CTN_BUILDER_NAME ?? 'default',
          ...bargs,
          '--metadata-file', build.getMetadataFilePath()
        ]);
        await Exec.exec(buildCmd.command, buildCmd.args);
      })()
    ).resolves.not.toThrow();

    const metadata = build.resolveMetadata();
    expect(metadata).toBeDefined();
    const buildRef = build.resolveRef(metadata);
    expect(buildRef).toBeDefined();

    const history = new History({buildx: buildx});
    const exportRes = await history.export({
      refs: [buildRef ?? '']
    });
    expect(exportRes).toBeDefined();
    expect(exportRes?.dockerbuildFilename).toBeDefined();
    expect(exportRes?.dockerbuildSize).toBeDefined();
    expect(exportRes?.summaries).toBeDefined();

    const uploadRes = await GitHubArtifact.upload({
      filename: exportRes?.dockerbuildFilename,
      mimeType: 'application/gzip',
      retentionDays: 1
    });
    expect(uploadRes).toBeDefined();
    expect(uploadRes?.url).toBeDefined();

    await GitHubSummary.writeBuildSummary({
      exportRes: exportRes,
      uploadRes: uploadRes,
      inputs: {
        context: fixturesDir,
        file: path.join(fixturesDir, 'hello.Dockerfile')
      }
    });
  });

  // prettier-ignore
  test.each([
    [
      'single',
      path.join(fixturesDir, 'hello-bake.hcl'),
      'hello'
    ],
    [
      'group',
      path.join(fixturesDir, 'hello-bake.hcl'),
      'hello-all'
    ],
    [
      'matrix',
      path.join(fixturesDir, 'hello-bake.hcl'),
      'hello-matrix'
    ]
  ])('write bake summary %p', async (_, file, target) => {
    const buildx = new Buildx();
    const bake = new Bake({buildx: buildx});

    fs.mkdirSync(tmpDir, {recursive: true});
    await expect(
      (async () => {
        // prettier-ignore
        const buildCmd = await buildx.getCommand([
          '--builder', process.env.CTN_BUILDER_NAME ?? 'default',
          'bake',
          '-f', file,
          target,
          '--metadata-file', bake.getMetadataFilePath()
        ]);
        await Exec.exec(buildCmd.command, buildCmd.args, {
          cwd: fixturesDir
        });
      })()
    ).resolves.not.toThrow();

    const definition = await bake.getDefinition(
      {
        files: [file],
        targets: [target],
      },
      {
        cwd: fixturesDir
      }
    );

    const metadata = bake.resolveMetadata();
    expect(metadata).toBeDefined();
    const buildRefs = bake.resolveRefs(metadata);
    expect(buildRefs).toBeDefined();

    const history = new History({buildx: buildx});
    const exportRes = await history.export({
      refs: buildRefs ?? []
    });
    expect(exportRes).toBeDefined();
    expect(exportRes?.dockerbuildFilename).toBeDefined();
    expect(exportRes?.dockerbuildSize).toBeDefined();
    expect(exportRes?.summaries).toBeDefined();

    const uploadRes = await GitHubArtifact.upload({
      filename: exportRes?.dockerbuildFilename,
      mimeType: 'application/gzip',
      retentionDays: 1
    });
    expect(uploadRes).toBeDefined();
    expect(uploadRes?.url).toBeDefined();

    await GitHubSummary.writeBuildSummary({
      exportRes: exportRes,
      uploadRes: uploadRes,
      inputs: {
        files: path.join(fixturesDir, 'hello-bake.hcl')
      },
      bakeDefinition: definition
    });
  });

  it('fails with dockerfile syntax issue', async () => {
    const startedTime = new Date();
    const buildx = new Buildx();
    const build = new Build({buildx: buildx});

    fs.mkdirSync(tmpDir, {recursive: true});
    await expect(
      (async () => {
        // prettier-ignore
        const buildCmd = await buildx.getCommand([
          '--builder', process.env.CTN_BUILDER_NAME ?? 'default',
          'build',
          '-f', path.join(fixturesDir, 'hello-err.Dockerfile'),
          fixturesDir,
          '--metadata-file', build.getMetadataFilePath()
        ]);
        await Exec.exec(buildCmd.command, buildCmd.args);
      })()
    ).rejects.toThrow();

    const refs = Buildx.refs({
      dir: Buildx.refsDir,
      builderName: process.env.CTN_BUILDER_NAME ?? 'default',
      since: startedTime
    });
    expect(refs).toBeDefined();
    expect(Object.keys(refs).length).toBeGreaterThan(0);

    const history = new History({buildx: buildx});
    const exportRes = await history.export({
      refs: [Object.keys(refs)[0] ?? '']
    });
    expect(exportRes).toBeDefined();
    expect(exportRes?.dockerbuildFilename).toBeDefined();
    expect(exportRes?.dockerbuildSize).toBeDefined();
    expect(exportRes?.summaries).toBeDefined();

    const uploadRes = await GitHubArtifact.upload({
      filename: exportRes?.dockerbuildFilename,
      mimeType: 'application/gzip',
      retentionDays: 1
    });
    expect(uploadRes).toBeDefined();
    expect(uploadRes?.url).toBeDefined();

    await GitHubSummary.writeBuildSummary({
      exportRes: exportRes,
      uploadRes: uploadRes,
      inputs: {
        context: fixturesDir,
        file: path.join(fixturesDir, 'hello-err.Dockerfile')
      }
    });
  });

  it('without build record', async () => {
    const startedTime = new Date();
    const buildx = new Buildx();
    const build = new Build({buildx: buildx});

    fs.mkdirSync(tmpDir, {recursive: true});
    await expect(
      (async () => {
        // prettier-ignore
        const buildCmd = await buildx.getCommand([
          '--builder', process.env.CTN_BUILDER_NAME ?? 'default',
          'build',
          '-f', path.join(fixturesDir, 'hello.Dockerfile'),
          fixturesDir,
          '--metadata-file', build.getMetadataFilePath()
        ]);
        await Exec.exec(buildCmd.command, buildCmd.args);
      })()
    ).resolves.not.toThrow();

    const refs = Buildx.refs({
      dir: Buildx.refsDir,
      builderName: process.env.CTN_BUILDER_NAME ?? 'default',
      since: startedTime
    });
    expect(refs).toBeDefined();
    expect(Object.keys(refs).length).toBeGreaterThan(0);

    const history = new History({buildx: buildx});
    const exportRes = await history.export({
      refs: [Object.keys(refs)[0] ?? '']
    });
    expect(exportRes).toBeDefined();
    expect(exportRes?.dockerbuildFilename).toBeDefined();
    expect(exportRes?.dockerbuildSize).toBeDefined();
    expect(exportRes?.summaries).toBeDefined();

    await GitHubSummary.writeBuildSummary({
      exportRes: exportRes,
      inputs: {
        context: fixturesDir,
        file: path.join(fixturesDir, 'hello.Dockerfile')
      }
    });
  });
});
