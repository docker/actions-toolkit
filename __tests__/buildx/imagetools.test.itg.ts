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

import {Manifest as ImageToolsManifest} from '../../src/types/buildx/imagetools';
import {Image} from '../../src/types/oci/config';
import {Descriptor} from '../../src/types/oci/descriptor';

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

maybe('inspectManifest', () => {
  it('inspect descriptor', async () => {
    const manifest = await new ImageTools().inspectManifest('moby/buildkit:latest@sha256:dccc69dd895968c4f21aa9e43e715f25f0cedfce4b17f1014c88c307928e22fc');
    const expectedManifest = <Descriptor>JSON.parse(fs.readFileSync(path.join(fixturesDir, 'imagetools-03.json'), {encoding: 'utf-8'}).trim());
    expect(manifest).toEqual(expectedManifest);
  });
  it('inspect index', async () => {
    const manifest = await new ImageTools().inspectManifest('moby/buildkit:latest@sha256:79cc6476ab1a3371c9afd8b44e7c55610057c43e18d9b39b68e2b0c2475cc1b6');
    const expectedManifest = <ImageToolsManifest>JSON.parse(fs.readFileSync(path.join(fixturesDir, 'imagetools-04.json'), {encoding: 'utf-8'}).trim());
    expect(manifest).toEqual(expectedManifest);
  });
});

maybe('attestationDescriptors', () => {
  it('returns buildkit attestations descriptors', async () => {
    const attestations = await new ImageTools().attestationDescriptors('moby/buildkit:latest@sha256:79cc6476ab1a3371c9afd8b44e7c55610057c43e18d9b39b68e2b0c2475cc1b6');
    const expectedAttestations = <Array<Descriptor>>JSON.parse(fs.readFileSync(path.join(fixturesDir, 'imagetools-05.json'), {encoding: 'utf-8'}).trim());
    expect(attestations).toEqual(expectedAttestations);
  });
});

maybe('attestationDigests', () => {
  it('returns buildkit attestations digests', async () => {
    const digests = await new ImageTools().attestationDigests('moby/buildkit:latest@sha256:79cc6476ab1a3371c9afd8b44e7c55610057c43e18d9b39b68e2b0c2475cc1b6');
    // prettier-ignore
    expect(digests).toEqual([
      'sha256:2ba4ad6eae1efcafee73a971953093c7c32b6938f2f9fd4998c8bf4d0fbe76f2',
      'sha256:0709528fae1747ce17638ad2978ee7936b38a294136eaadaf692e415f64b1e03',
      'sha256:241b7159129d53923c89708bcc052b3398086a826519896be2f025545916e43e',
      'sha256:97f4a222a7992dba6dc1a43991d0cca1fcffdc25593033c6a3a7ff14c8651cbf',
      'sha256:aa933713d8094b2708120e889acb6f7153dee4e0f3298ccd3e37a584cd0c260d',
      'sha256:d95ca72d4f2a6bc416d4b2f3003b2af9d5f4dea99acec6ad3ab0c2082000a98c'
    ]);
  });
});
