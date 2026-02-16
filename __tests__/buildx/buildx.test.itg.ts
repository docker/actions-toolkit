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

import {describe, expect, it} from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import * as core from '@actions/core';

import {Buildx} from '../../src/buildx/buildx.js';
import {Build} from '../../src/buildx/build.js';
import {Bake} from '../../src/buildx/bake.js';
import {Exec} from '../../src/exec.js';

const fixturesDir = path.join(__dirname, '..', '.fixtures');
const tmpDir = fs.mkdtempSync(path.join(process.env.TEMP || os.tmpdir(), 'buildx-buildx-itg-'));

const maybe = !process.env.GITHUB_ACTIONS || (process.env.GITHUB_ACTIONS === 'true' && process.env.ImageOS && process.env.ImageOS.startsWith('ubuntu')) ? describe : describe.skip;

maybe('convertWarningsToGitHubAnnotations', () => {
  it('build lint issues', async () => {
    const buildx = new Buildx();
    const build = new Build({buildx: buildx});

    fs.mkdirSync(tmpDir, {recursive: true});
    await expect(
      (async () => {
        // prettier-ignore
        const buildCmd = await buildx.getCommand([
          '--builder', process.env.CTN_BUILDER_NAME ?? 'default',
          'build',
          '-f', path.join(fixturesDir, 'lint.Dockerfile'),
          fixturesDir,
          '--metadata-file', build.getMetadataFilePath()
        ]);
        await Exec.exec(buildCmd.command, buildCmd.args, {
          env: Object.assign({}, process.env, {
            BUILDX_METADATA_WARNINGS: 'true'
          }) as {
            [key: string]: string;
          }
        });
      })()
    ).resolves.not.toThrow();

    const metadata = build.resolveMetadata();
    expect(metadata).toBeDefined();
    const buildRef = build.resolveRef(metadata);
    expect(buildRef).toBeDefined();
    const buildWarnings = build.resolveWarnings(metadata);
    expect(buildWarnings).toBeDefined();

    const annotations = await Buildx.convertWarningsToGitHubAnnotations(buildWarnings ?? [], [buildRef ?? '']);
    expect(annotations).toBeDefined();
    expect(annotations?.length).toBeGreaterThan(0);

    for (const annotation of annotations ?? []) {
      core.warning(annotation.message, annotation);
    }
  });

  it('bake lint issues', async () => {
    const buildx = new Buildx();
    const bake = new Bake({buildx: buildx});

    fs.mkdirSync(tmpDir, {recursive: true});
    await expect(
      (async () => {
        // prettier-ignore
        const buildCmd = await buildx.getCommand([
          '--builder', process.env.CTN_BUILDER_NAME ?? 'default',
          'bake',
          '-f', path.join(fixturesDir, 'lint.hcl'),
          '--metadata-file', bake.getMetadataFilePath()
        ]);
        await Exec.exec(buildCmd.command, buildCmd.args, {
          cwd: fixturesDir,
          env: Object.assign({}, process.env, {
            BUILDX_METADATA_WARNINGS: 'true'
          }) as {
            [key: string]: string;
          }
        });
      })()
    ).resolves.not.toThrow();

    const metadata = bake.resolveMetadata();
    expect(metadata).toBeDefined();
    const buildRefs = bake.resolveRefs(metadata);
    expect(buildRefs).toBeDefined();
    expect(buildRefs?.length).toEqual(3);
    const buildWarnings = bake.resolveWarnings(metadata);
    expect(buildWarnings).toBeDefined();

    const annotations = await Buildx.convertWarningsToGitHubAnnotations(buildWarnings ?? [], buildRefs ?? []);
    expect(annotations).toBeDefined();
    expect(annotations?.length).toBeGreaterThan(0);

    for (const annotation of annotations ?? []) {
      core.warning(annotation.message, annotation);
    }
  });
});
