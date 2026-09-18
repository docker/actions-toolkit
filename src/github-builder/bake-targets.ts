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

import {Bake} from '../buildx/bake.js';
import {BakeDefinition} from '../types/buildx/bake.js';

export class BakeTargets {
  // Enforces github-builder single-root policy on a resolved Bake definition
  public static resolve(definition: BakeDefinition, target: string): Array<string> {
    const targets = Bake.resolveContextTargets(definition, target);
    const allowedTargets = new Set(targets);
    const unsupportedTargets = Object.keys(definition.target).filter(name => !allowedTargets.has(name));
    if (unsupportedTargets.length > 0) {
      throw new Error(`Only one target can be built at once, found unsupported targets: ${unsupportedTargets.join(', ')}`);
    }
    return targets;
  }
}
