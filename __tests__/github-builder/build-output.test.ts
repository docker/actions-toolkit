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

import {describe, expect, it} from 'vitest';
import {parse} from 'csv-parse/sync';

import {BuildOutput, BuildOutputOpts} from '../../src/github-builder/build-output.js';

describe('BuildOutput.resolve', () => {
  it.each([false, true])('preserves image exporter policy with push=%s', push => {
    expect(BuildOutput.resolve({output: 'image', images: ['user/app', 'ghcr.io/user/app'], push})).toBe(`type=image,"name=user/app,ghcr.io/user/app",oci-artifact=true,push-by-digest=true,name-canonical=true,push=${push}`);
  });

  it('omits compression settings by default and does not push', () => {
    expect(BuildOutput.resolve({output: 'image', images: ['user/app']})).toBe('type=image,name=user/app,oci-artifact=true,push-by-digest=true,name-canonical=true,push=false');
  });

  it.each(['uncompressed', 'gzip', 'estargz', 'zstd'] as const)('supports %s compression', compression => {
    const output = BuildOutput.resolve({output: 'image', images: ['user/app'], compression});
    expect(parse(output)[0]).toContain(`compression=${compression}`);
  });

  it('supports zstd compression of existing layers', () => {
    expect(BuildOutput.resolve({output: 'image', images: ['user/app'], push: true, compression: 'zstd', compressionLevel: 22, forceCompression: true})).toBe(
      'type=image,name=user/app,oci-artifact=true,push-by-digest=true,name-canonical=true,push=true,compression=zstd,compression-level=22,force-compression=true'
    );
  });

  it('preserves level zero and explicit false without requiring a compression algorithm', () => {
    expect(BuildOutput.resolve({output: 'image', images: ['user/app'], compressionLevel: 0, forceCompression: false})).toBe(
      'type=image,name=user/app,oci-artifact=true,push-by-digest=true,name-canonical=true,push=false,compression-level=0,force-compression=false'
    );
  });

  it('preserves local exporter policy', () => {
    expect(BuildOutput.resolve({output: 'local', localExportDir: '/tmp/build'})).toBe('type=local,platform-split=true,dest=/tmp/build');
  });

  it('does not apply image compression options to local output', () => {
    expect(BuildOutput.resolve({output: 'local', localExportDir: '/tmp/build', compression: 'zstd', compressionLevel: 22, forceCompression: true})).toBe('type=local,platform-split=true,dest=/tmp/build');
  });

  it.each(['/tmp/build,output', '/tmp/"build"', '/tmp/build\noutput', '/tmp/build\routput'])('round-trips destination %j as a single CSV field', localExportDir => {
    expect(parse(BuildOutput.resolve({output: 'local', localExportDir}))).toEqual([['type=local', 'platform-split=true', `dest=${localExportDir}`]]);
  });

  it('keeps quoted image values within the name field', () => {
    const images = ['user/app', 'quoted"name,push=false'];
    expect(parse(BuildOutput.resolve({output: 'image', images, push: true}))).toEqual([['type=image', `name=${images.join(',')}`, 'oci-artifact=true', 'push-by-digest=true', 'name-canonical=true', 'push=true']]);
  });

  it.each<{opts: BuildOutputOpts; error: string}>([
    {opts: {output: 'image'}, error: 'meta-images is required when output is image'},
    {opts: {output: 'image', images: []}, error: 'meta-images is required when output is image'},
    {opts: {output: 'local'}, error: 'localExportDir is required when output is local'},
    {opts: {output: 'local', localExportDir: ''}, error: 'localExportDir is required when output is local'},
    {opts: {output: 'docker'}, error: 'Invalid output: docker'}
  ])('rejects $opts', ({opts, error}) => {
    expect(() => BuildOutput.resolve(opts)).toThrow(error);
  });
});
