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
      [path.join(fixturesDir, 'bake.hcl')],
      ['validate'],
      {
        "group": {
          "default": {
            "targets": [
              "validate"
            ]
          },
          "validate": {
            "targets": [
              "lint",
              "validate-vendor",
              "validate-docs"
            ]
          }
        },
        "target": {
          "lint": {
            "context": ".",
            "dockerfile": "./hack/dockerfiles/lint.Dockerfile",
            "args": {
              "BUILDKIT_CONTEXT_KEEP_GIT_DIR": "1",
              "GO_VERSION": "1.20"
            },
            "output": [
              "type=cacheonly"
            ]
          },
          "validate-docs": {
            "context": ".",
            "dockerfile": "./hack/dockerfiles/docs.Dockerfile",
            "args": {
              "BUILDKIT_CONTEXT_KEEP_GIT_DIR": "1",
              "BUILDX_EXPERIMENTAL": "1",
              "FORMATS": "md",
              "GO_VERSION": "1.20"
            },
            "target": "validate",
            "output": [
              "type=cacheonly"
            ]
          },
          "validate-vendor": {
            "context": ".",
            "dockerfile": "./hack/dockerfiles/vendor.Dockerfile",
            "args": {
              "BUILDKIT_CONTEXT_KEEP_GIT_DIR": "1",
              "GO_VERSION": "1.20"
            },
            "target": "validate",
            "output": [
              "type=cacheonly"
            ]
          }
        }
      }
    ]
  ])('given %p', async (files, targets, expected: BakeDefinition) => {
    const bake = new Bake();
    expect(await bake.parseDefinitions(files, targets)).toEqual(expected);
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
      },
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
      },
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
      },
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
      },
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
      },
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
      },
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
      },
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
      },
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
      },
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
      },
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
      },
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
      },
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
      },
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
      },
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
      },
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
      },
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
      },
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
      },
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
      },
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
      },
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
      },
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
      },
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
      },
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
      },
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
      },
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
      },
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
      },
      true,
      true
    ],
  ])('given %o and load:%p returns %p', async (def: BakeDefinition, expected: boolean, load: boolean) => {
    expect(Bake.hasDockerExporter(def, load)).toEqual(expected);
  });
});
