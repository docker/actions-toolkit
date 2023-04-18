/**
 * Copyright 2023 actions-toolkit authors
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

import {beforeEach, describe, expect, jest, test} from '@jest/globals';
import * as fs from 'fs';
import * as path from 'path';

import {Bake} from '../../src/buildx/bake';
import {BakeDefinition} from '../../src/types/bake';

const fixturesDir = path.join(__dirname, '..', 'fixtures');

beforeEach(() => {
  jest.clearAllMocks();
});

describe('parseDefinitions', () => {
  // prettier-ignore
  test.each([
    [
      [path.join(fixturesDir, 'bake-01.hcl')],
      ['validate'],
      [],
      path.join(fixturesDir, 'bake-01-validate.json')
    ],
    [
      [path.join(fixturesDir, 'bake-02.hcl')],
      ['build'],
      [],
      path.join(fixturesDir, 'bake-02-build.json')
    ],
    [
      [path.join(fixturesDir, 'bake-01.hcl')],
      ['image'],
      ['*.output=type=docker', '*.platform=linux/amd64'],
      path.join(fixturesDir, 'bake-01-overrides.json')
    ]
  ])('given %p', async (sources: string[], targets: string[], overrides: string[], out: string) => {
    const bake = new Bake();
    const expectedDef = <BakeDefinition>JSON.parse(fs.readFileSync(out, {encoding: 'utf-8'}).trim())
    expect(await bake.parseDefinitions(sources, targets, overrides)).toEqual(expectedDef);
  });
});

describe('hasLocalExporter', () => {
  // prettier-ignore
  test.each([
    [
      {
        "target": {
          "build": {
            "output": [
              "type=docker"
            ]
          },
        }
      } as unknown as BakeDefinition,
      false
    ],
    [
      {
        "target": {
          "build": {
            "target": "build"
          },
        }
      } as unknown as BakeDefinition,
      false
    ],
    [
      {
        "target": {
          "local": {
            "output": [
              "type=local,dest=./release-out"
            ]
          },
        }
      } as unknown as BakeDefinition,
      true
    ],
    [
      {
        "target": {
          "tar": {
            "output": [
              "type=tar,dest=/tmp/image.tar"
            ]
          },
        }
      } as unknown as BakeDefinition,
      false
    ],
    [
      {
        "target": {
          "tar": {
            "output": [
              '"type=tar","dest=/tmp/image.tar"',
            ]
          },
        }
      } as unknown as BakeDefinition,
      false
    ],
    [
      {
        "target": {
          "local": {
            "output": [
              '" type= local" , dest=./release-out',
            ]
          },
        }
      } as unknown as BakeDefinition,
      true
    ],
    [
      {
        "target": {
          "local": {
            "output": [
              ".",
            ]
          },
        }
      } as unknown as BakeDefinition,
      true
    ]
  ])('given %o returns %p', async (def: BakeDefinition, expected: boolean) => {
    expect(Bake.hasLocalExporter(def)).toEqual(expected);
  });
});

describe('hasTarExporter', () => {
  // prettier-ignore
  test.each([
    [
      {
        "target": {
          "reg": {
            "output": [
              "type=registry,ref=user/app"
            ]
          },
        }
      } as unknown as BakeDefinition,
      false
    ],
    [
      {
        "target": {
          "build": {
            "output": [
              "type=docker"
            ]
          },
        }
      } as unknown as BakeDefinition,
      false
    ],
    [
      {
        "target": {
          "local": {
            "output": [
              "type=local,dest=./release-out"
            ]
          },
        }
      } as unknown as BakeDefinition,
      false
    ],
    [
      {
        "target": {
          "tar": {
            "output": [
              "type=tar,dest=/tmp/image.tar"
            ]
          },
        }
      } as unknown as BakeDefinition,
      true
    ],
    [
      {
        "target": {
          "multi": {
            "output": [
              "type=docker",
              "type=tar,dest=/tmp/image.tar"
            ]
          },
        }
      } as unknown as BakeDefinition,
      true
    ],
    [
      {
        "target": {
          "tar": {
            "output": [
              '"type=tar","dest=/tmp/image.tar"',
            ]
          },
        }
      } as unknown as BakeDefinition,
      true
    ],
    [
      {
        "target": {
          "local": {
            "output": [
              '" type= local" , dest=./release-out',
            ]
          },
        }
      } as unknown as BakeDefinition,
      false
    ],
    [
      {
        "target": {
          "local": {
            "output": [
              ".",
            ]
          },
        }
      } as unknown as BakeDefinition,
      false
    ],
  ])('given %o returns %p', async (def: BakeDefinition, expected: boolean) => {
    expect(Bake.hasTarExporter(def)).toEqual(expected);
  });
});

describe('hasDockerExporter', () => {
  // prettier-ignore
  test.each([
    [
      {
        "target": {
          "reg": {
            "output": [
              "type=registry,ref=user/app"
            ]
          },
        }
      } as unknown as BakeDefinition,
      false,
      undefined
    ],
    [
      {
        "target": {
          "build": {
            "output": [
              "type=docker"
            ]
          },
        }
      } as unknown as BakeDefinition,
      true,
      undefined
    ],
    [
      {
        "target": {
          "multi": {
            "output": [
              "type=docker",
              "type=tar,dest=/tmp/image.tar"
            ]
          },
        }
      } as unknown as BakeDefinition,
      true,
      undefined
    ],
    [
      {
        "target": {
          "local": {
            "output": [
              '" type= local" , dest=./release-out'
            ]
          },
        }
      } as unknown as BakeDefinition,
      false,
      undefined
    ],
    [
      {
        "target": {
          "local": {
            "output": [
              "type=local,dest=./release-out"
            ]
          },
        }
      } as unknown as BakeDefinition,
      false,
      undefined
    ],
    [
      {
        "target": {
          "tar": {
            "output": [
              "type=tar,dest=/tmp/image.tar"
            ]
          },
        }
      } as unknown as BakeDefinition,
      false,
      undefined
    ],
    [
      {
        "target": {
          "multi": {
            "output": [
              "type=docker",
              "type=tar,dest=/tmp/image.tar"
            ]
          },
        }
      } as unknown as BakeDefinition,
      true,
      undefined
    ],
    [
      {
        "target": {
          "tar": {
            "output": [
              '"type=tar","dest=/tmp/image.tar"'
            ]
          },
        }
      } as unknown as BakeDefinition,
      false,
      undefined
    ],
    [
      {
        "target": {
          "tar": {
            "output": [
              '"type=tar","dest=/tmp/image.tar"'
            ]
          },
        }
      } as unknown as BakeDefinition,
      false,
      undefined
    ],
    [
      {
        "target": {
          "local": {
            "output": [
              '" type= local" , dest=./release-out'
            ]
          },
        }
      } as unknown as BakeDefinition,
      false,
      undefined
    ],
    [
      {
        "target": {
          "build": {
            "output": [
              "type=docker"
            ]
          },
        }
      } as unknown as BakeDefinition,
      true,
      false
    ],
    [
      {
        "target": {
          "build": {
            "output": [
              "type=docker"
            ]
          },
        }
      } as unknown as BakeDefinition,
      true,
      true
    ],
    [
      {
        "target": {
          "build": {
            "output": [
              "."
            ]
          },
        }
      } as unknown as BakeDefinition,
      true,
      true
    ],
  ])('given %o and load:%p returns %p', async (def: BakeDefinition, expected: boolean, load: boolean | undefined) => {
    expect(Bake.hasDockerExporter(def, load)).toEqual(expected);
  });
});
