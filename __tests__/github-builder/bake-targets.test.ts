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

import {BakeTargets} from '../../src/github-builder/bake-targets.js';
import {BakeDefinition} from '../../src/types/buildx/bake.js';

describe('BakeTargets.resolve', () => {
  const target = {context: '.', dockerfile: 'Dockerfile'};

  it('accepts a single root with transitive named-context targets', () => {
    const definition: BakeDefinition = {
      group: {default: {targets: ['app']}},
      target: {app: {...target, contexts: {base: 'target:base'}}, base: {...target, contexts: {source: 'target:source'}}, source: target}
    };
    expect(BakeTargets.resolve(definition, 'app')).toEqual(['app', 'base', 'source']);
  });

  it('accepts a single target without dependencies', () => {
    expect(BakeTargets.resolve({group: {}, target: {app: target}}, 'app')).toEqual(['app']);
  });

  it('rejects targets outside the selected root graph', () => {
    const definition: BakeDefinition = {
      group: {},
      target: {app: {...target, contexts: {base: 'target:base'}}, base: target, other: target, another: target}
    };
    expect(() => BakeTargets.resolve(definition, 'app')).toThrow('Only one target can be built at once, found unsupported targets: other, another');
  });

  it('does not expand a group, even if it contains just one target', () => {
    expect(() => BakeTargets.resolve({group: {all: {targets: ['app']}}, target: {app: target}}, 'all')).toThrow('Unable to resolve all target, found: app');
  });

  it('propagates missing dependency errors before checking unrelated targets', () => {
    const definition: BakeDefinition = {group: {}, target: {app: {...target, contexts: {base: 'target:missing'}}, unrelated: target}};
    expect(() => BakeTargets.resolve(definition, 'app')).toThrow('Target app uses unknown named context target missing');
  });

  it('leaves cycle validation to Buildx', () => {
    const definition: BakeDefinition = {
      group: {},
      target: {app: {...target, contexts: {base: 'target:base'}}, base: {...target, contexts: {app: 'target:app'}}}
    };
    expect(BakeTargets.resolve(definition, 'app')).toEqual(['app', 'base']);
  });
});
