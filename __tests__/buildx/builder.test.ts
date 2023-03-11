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
import * as fs from 'fs';
import * as path from 'path';

import {Builder} from '../../src/buildx/builder';
import {Exec} from '../../src/exec';

import {BuilderInfo} from '../../src/types/builder';

const fixturesDir = path.join(__dirname, '..', 'fixtures');

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
        buildkit: 'v0.11.0',
        'buildkitd-flags': '--debug --allow-insecure-entitlement security.insecure --allow-insecure-entitlement network.host',
        'driver-opts': ['BUILDKIT_STEP_LOG_MAX_SIZE=10485760', 'BUILDKIT_STEP_LOG_MAX_SPEED=10485760', 'JAEGER_TRACE=localhost:6831', 'image=moby/buildkit:latest', 'network=host', 'qemu.install=true'],
        endpoint: 'unix:///var/run/docker.sock',
        name: 'builder20',
        platforms: 'linux/amd64,linux/amd64/v2,linux/amd64/v3,linux/arm64,linux/riscv64,linux/ppc64le,linux/s390x,linux/386,linux/mips64le,linux/mips64,linux/arm/v7,linux/arm/v6',
        status: 'running'
      }
    ]
  };
});

describe('exists', () => {
  it('valid', async () => {
    const execSpy = jest.spyOn(Exec, 'getExecOutput');
    const builder = new Builder();
    await builder.exists('foo');
    // eslint-disable-next-line jest/no-standalone-expect
    expect(execSpy).toHaveBeenCalledWith(`docker`, ['buildx', 'inspect', 'foo'], {
      silent: true,
      ignoreReturnCode: true
    });
  });
});

describe('inspect', () => {
  it('valid', async () => {
    const builder = new Builder();
    const builderInfo = await builder.inspect('');
    expect(builderInfo).not.toBeUndefined();
    expect(builderInfo.name).not.toEqual('');
    expect(builderInfo.driver).not.toEqual('');
    expect(builderInfo.nodes).not.toEqual({});
  }, 100000);
});

describe('parseInspect', () => {
  // prettier-ignore
  test.each([
    [
     'inspect1.txt',
     {
       "name": "builder-5cb467f7-0940-47e1-b94b-d51f54054d62",
       "driver": "docker-container",
       "nodes": [
         {
           "name": "builder-5cb467f7-0940-47e1-b94b-d51f54054d620",
           "endpoint": "unix:///var/run/docker.sock",
           "status": "running",
           "buildkitd-flags": "--allow-insecure-entitlement security.insecure --allow-insecure-entitlement network.host",
           "buildkit": "v0.10.4",
           "platforms": "linux/amd64,linux/amd64/v2,linux/amd64/v3,linux/amd64/v4,linux/arm64,linux/riscv64,linux/386,linux/arm/v7,linux/arm/v6"
         }
       ]
     }
    ],
    [
     'inspect2.txt',
     {
       "name": "builder-5f449644-ff29-48af-8344-abb0292d0673",
       "driver": "docker-container",
       "nodes": [
         {
           "name": "builder-5f449644-ff29-48af-8344-abb0292d06730",
           "endpoint": "unix:///var/run/docker.sock",
           "driver-opts": [
             "image=moby/buildkit:latest"
           ],
           "status": "running",
           "buildkitd-flags": "--allow-insecure-entitlement security.insecure --allow-insecure-entitlement network.host",
           "buildkit": "v0.10.4",
           "platforms": "linux/amd64,linux/amd64/v2,linux/amd64/v3,linux/amd64/v4,linux/386"
         }
       ]
     }
    ],
    [
     'inspect3.txt',
     {
       "name": "builder-9929e463-7954-4dc3-89cd-514cca29ff80",
       "driver": "docker-container",
       "nodes": [
         {
           "name": "builder-9929e463-7954-4dc3-89cd-514cca29ff800",
           "endpoint": "unix:///var/run/docker.sock",
           "driver-opts": [
             "image=moby/buildkit:master",
             "network=host"
           ],
           "status": "running",
           "buildkitd-flags": "--allow-insecure-entitlement security.insecure --allow-insecure-entitlement network.host",
           "buildkit": "3fab389",
           "platforms": "linux/amd64,linux/amd64/v2,linux/amd64/v3,linux/amd64/v4,linux/386"
         }
       ]
     }
    ],
    [
     'inspect4.txt',
     {
       "name": "default",
       "driver": "docker",
       "nodes": [
         {
           "name": "default",
           "endpoint": "default",
           "status": "running",
           "buildkit": "20.10.17",
           "platforms": "linux/amd64,linux/arm64,linux/riscv64,linux/ppc64le,linux/s390x,linux/386,linux/arm/v7,linux/arm/v6"
         }
       ]
     }
    ],
    [
     'inspect5.txt',
     {
       "name": "remote-builder",
       "driver": "remote",
       "nodes": [
         {
           "name": "aws_graviton2",
           "endpoint": "tcp://1.23.45.67:1234",
           "driver-opts": [
             "cert=/home/user/.certs/aws_graviton2/cert.pem",
             "key=/home/user/.certs/aws_graviton2/key.pem",
             "cacert=/home/user/.certs/aws_graviton2/ca.pem"
           ],
           "status": "running",
           "platforms": "darwin/arm64,linux/arm64,linux/arm/v5,linux/arm/v6,linux/arm/v7,windows/arm64"
         }
       ]
     }
    ],
    [
     'inspect6.txt',
     {
       "nodes": [
         {
           "name": "builder-17cfff01-48d9-4c3d-9332-9992e308a5100",
           "endpoint": "unix:///var/run/docker.sock",
           "status": "running",
           "buildkitd-flags": "--allow-insecure-entitlement security.insecure --allow-insecure-entitlement network.host",
           "platforms": "linux/amd64,linux/amd64/v2,linux/amd64/v3,linux/386"
         }
       ],
       "name": "builder-17cfff01-48d9-4c3d-9332-9992e308a510",
       "driver": "docker-container"
     }
    ],
    [
     'inspect7.txt',
     {
       "name": "builder2",
       "driver": "docker-container",
       "lastActivity": new Date("2023-01-16T09:45:23.000Z"),
       "nodes": [
         {
           "buildkit": "v0.11.0",
           "buildkitd-flags": "--debug --allow-insecure-entitlement security.insecure --allow-insecure-entitlement network.host",
           "driver-opts": [
             "env.BUILDKIT_STEP_LOG_MAX_SIZE=10485760",
             "env.BUILDKIT_STEP_LOG_MAX_SPEED=10485760",
             "env.JAEGER_TRACE=localhost:6831",
             "image=moby/buildkit:latest",
             "network=host",
             "qemu.install=true"
           ],
           "endpoint": "unix:///var/run/docker.sock",
           "name": "builder20",
           "platforms": "linux/amd64,linux/amd64/v2,linux/amd64/v3,linux/arm64,linux/riscv64,linux/ppc64le,linux/s390x,linux/386,linux/mips64le,linux/mips64,linux/arm/v7,linux/arm/v6",
           "status": "running"
         }
       ]
     }
    ]
  ])('given %p', async (inspectFile, expected) => {
    expect(await Builder.parseInspect(fs.readFileSync(path.join(fixturesDir, inspectFile)).toString())).toEqual(expected);
  });
});
