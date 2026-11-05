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

import {BuildOutput} from '../../src/github-builder/build-output.js';
import {MetaImages} from '../../src/github-builder/meta-images.js';

describe('MetaImages.resolve', () => {
  it.each([
    {inputs: [], expected: []},
    {inputs: ['User/App'], expected: ['user/app']},
    {inputs: ['User/App', 'GHCR.IO/User/App'], expected: ['user/app', 'ghcr.io/user/app']},
    {inputs: ['User/App, GHCR.IO/User/App'], expected: ['user/app', 'ghcr.io/user/app']},
    {inputs: ['name=User/App'], expected: ['user/app']},
    {inputs: ['name=User/App,enable=true'], expected: ['user/app']},
    {inputs: ['User/App,enable=false'], expected: []},
    {inputs: ['enable=true,name=User/App'], expected: ['user/app']},
    {inputs: [' NAME = User/App , ENABLE = true '], expected: ['user/app']},
    {inputs: ['"name=User/App","enable=true"'], expected: ['user/app']},
    {inputs: ['name=User/Prod,enable=false', 'name=User/Build'], expected: ['user/build']},
    {inputs: ['name=User/Prod,enable=false', 'name=User/Build,enable=false'], expected: []},
    {inputs: ['name=User/App', 'name=User/App'], expected: ['user/app', 'user/app']},
    {inputs: ['name=User/First,name=User/Last,enable=false,enable=true'], expected: ['user/last']}
  ])('resolves $inputs', ({inputs, expected}) => {
    expect(MetaImages.resolve(inputs)).toEqual(expected);
  });

  it.each([
    {input: 'name=user/app,enable=maybe', error: 'Invalid enable attribute value'},
    {input: 'name=user/app,enable=TRUE', error: 'Invalid enable attribute value'},
    {input: 'name=user/app,enable=', error: 'Invalid enable attribute value'},
    {input: 'name=user/app,unknown=true', error: 'Unknown image attribute'},
    {input: 'name=', error: 'Image name attribute empty'},
    {input: 'enable=false', error: 'Image name attribute empty'},
    {input: 'name=,enable=false', error: 'Image name attribute empty'}
  ])('rejects $input', ({input, error}) => {
    expect(() => MetaImages.resolve([input])).toThrow(`${error}: ${input}`);
  });

  it('rejects malformed CSV', () => {
    expect(() => MetaImages.resolve(['"name=user/app'])).toThrow();
  });

  it('exports only enabled image names for the issue 327 input', () => {
    const images = MetaImages.resolve(['name=registry.example.com/prod/app,enable=false', 'name=registry.example.com/build/app']);
    expect(parse(BuildOutput.resolve({output: 'image', images, push: true}))).toEqual([['type=image', 'name=registry.example.com/build/app', 'oci-artifact=true', 'push-by-digest=true', 'name-canonical=true', 'push=true']]);
  });

  it('lets the image exporter reject an input with no enabled images', () => {
    const images = MetaImages.resolve(['name=user/app,enable=false']);
    expect(() => BuildOutput.resolve({output: 'image', images})).toThrow('meta-images is required when output is image');
  });
});
