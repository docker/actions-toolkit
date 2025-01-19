/**
 * Copyright 2025 actions-toolkit authors
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

import {describe, expect, it} from '@jest/globals';
import * as fs from 'fs';
import * as path from 'path';

import {ImageTools} from '../../src/buildx/imagetools';
import {Image} from '../../src/types/oci/config';

const fixturesDir = path.join(__dirname, '..', '.fixtures');

const maybe = !process.env.GITHUB_ACTIONS || (process.env.GITHUB_ACTIONS === 'true' && process.env.ImageOS && process.env.ImageOS.startsWith('ubuntu')) ? describe : describe.skip;

maybe('inspectImage', () => {
  it('inspect single platform', async () => {
    const image = await new ImageTools().inspectImage('moby/buildkit:latest@sha256:5769c54b98840147b74128f38fb0b0a049e24b11a75bd81664131edd2854593f');
    const expectedImage = <Image>JSON.parse(fs.readFileSync(path.join(fixturesDir, 'imagetools-01.json'), {encoding: 'utf-8'}).trim());
    expect(image).toEqual(expectedImage);
  });
  it('inspect multi platform', async () => {
    const image = await new ImageTools().inspectImage('moby/buildkit:latest@sha256:86c0ad9d1137c186e9d455912167df20e530bdf7f7c19de802e892bb8ca16552');
    const expectedImage = <Record<string, Image>>JSON.parse(fs.readFileSync(path.join(fixturesDir, 'imagetools-02.json'), {encoding: 'utf-8'}).trim());
    expect(image).toEqual(expectedImage);
  });
});
