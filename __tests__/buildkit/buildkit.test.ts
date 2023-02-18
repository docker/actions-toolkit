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

import {beforeEach, describe, expect, it, jest, test} from '@jest/globals';

import {BuildKit} from '../../src/buildkit/buildkit';
import {Builder} from '../../src/buildx/builder';
import {Context} from '../../src/context';

import {BuilderInfo} from '../../src/types/builder';

beforeEach(() => {
  jest.clearAllMocks();
});

jest.spyOn(Builder.prototype, 'inspect').mockImplementation(async (): Promise<BuilderInfo> => {
  return {
    name: 'builder2',
    driver: 'docker-container',
    lastActivity: new Date('2023-01-16 09:45:23 +0000 UTC'),
    nodes: [
      {
        buildkitVersion: 'v0.11.0',
        buildkitdFlags: '--debug --allow-insecure-entitlement security.insecure --allow-insecure-entitlement network.host',
        driverOpts: ['BUILDKIT_STEP_LOG_MAX_SIZE=10485760', 'BUILDKIT_STEP_LOG_MAX_SPEED=10485760', 'JAEGER_TRACE=localhost:6831', 'image=moby/buildkit:latest', 'network=host'],
        endpoint: 'unix:///var/run/docker.sock',
        name: 'builder20',
        platforms: 'linux/amd64,linux/amd64/v2,linux/amd64/v3,linux/arm64,linux/riscv64,linux/ppc64le,linux/s390x,linux/386,linux/mips64le,linux/mips64,linux/arm/v7,linux/arm/v6',
        status: 'running'
      }
    ]
  };
});

describe('getVersion', () => {
  it('valid', async () => {
    const builder = new Builder({
      context: new Context()
    });
    const builderInfo = await builder.inspect('builder2');
    const buildkit = new BuildKit({
      context: new Context()
    });
    const version = await buildkit.getVersion(builderInfo.nodes[0]);
    expect(version).toBe('v0.11.0');
  });
});

describe('satisfies', () => {
  test.each([
    ['builder2', '>=0.10.0', true],
    ['builder2', '>0.11.0', false]
  ])('given %p', async (builderName, range, expected) => {
    const buildkit = new BuildKit({
      context: new Context()
    });
    expect(await buildkit.versionSatisfies(builderName, range)).toBe(expected);
  });
});
