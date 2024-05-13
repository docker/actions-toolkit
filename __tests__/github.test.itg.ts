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

import {beforeEach, describe, expect, it, jest, test} from '@jest/globals';
import fs from 'fs';
import * as path from 'path';

import {Buildx} from '../src/buildx/buildx';
import {Bake} from '../src/buildx/bake';
import {Build} from '../src/buildx/build';
import {Exec} from '../src/exec';
import {GitHub} from '../src/github';
import {History} from '../src/buildx/history';

const fixturesDir = path.join(__dirname, 'fixtures');

// prettier-ignore
const tmpDir = path.join(process.env.TEMP || '/tmp', 'github-jest');

const maybe = !process.env.GITHUB_ACTIONS || (process.env.GITHUB_ACTIONS === 'true' && process.env.ImageOS && process.env.ImageOS.startsWith('ubuntu')) ? describe : describe.skip;

beforeEach(() => {
  jest.clearAllMocks();
});

maybe('uploadArtifact', () => {
  it('uploads an artifact', async () => {
    const res = await GitHub.uploadArtifact({
      filename: path.join(fixturesDir, 'github-repo.json'),
      mimeType: 'application/json',
      retentionDays: 1
    });
    expect(res).toBeDefined();
    console.log('uploadArtifactResponse', res);
    expect(res?.url).toBeDefined();
  });
});

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

    const uploadRes = await GitHub.uploadArtifact({
      filename: exportRes?.dockerbuildFilename,
      mimeType: 'application/gzip',
      retentionDays: 1
    });
    expect(uploadRes).toBeDefined();
    expect(uploadRes?.url).toBeDefined();

    await GitHub.writeBuildSummary({
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
      [
        'bake',
        '-f', path.join(fixturesDir, 'hello-bake.hcl'),
        'hello'
      ],
    ],
    [
      'group',
      [
        'bake',
        '-f', path.join(fixturesDir, 'hello-bake.hcl'),
        'hello-all'
      ],
    ],
    [
      'matrix',
      [
        'bake',
        '-f', path.join(fixturesDir, 'hello-bake.hcl'),
        'hello-matrix'
      ],
    ]
  ])('write bake summary %p', async (_, bargs) => {
    const buildx = new Buildx();
    const bake = new Bake({buildx: buildx});

    fs.mkdirSync(tmpDir, {recursive: true});
    await expect(
      (async () => {
        // prettier-ignore
        const buildCmd = await buildx.getCommand([
          '--builder', process.env.CTN_BUILDER_NAME ?? 'default',
          ...bargs,
          '--metadata-file', bake.getMetadataFilePath()
        ]);
        await Exec.exec(buildCmd.command, buildCmd.args, {
          cwd: fixturesDir
        });
      })()
    ).resolves.not.toThrow();

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

    const uploadRes = await GitHub.uploadArtifact({
      filename: exportRes?.dockerbuildFilename,
      mimeType: 'application/gzip',
      retentionDays: 1
    });
    expect(uploadRes).toBeDefined();
    expect(uploadRes?.url).toBeDefined();

    await GitHub.writeBuildSummary({
      exportRes: exportRes,
      uploadRes: uploadRes,
      inputs: {
        files: path.join(fixturesDir, 'hello-bake.hcl')
      }
    });
  });
});
