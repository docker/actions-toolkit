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

import {describe, expect, it, vi, test} from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

import {Builder} from '../../src/buildx/builder.js';
import {Exec} from '../../src/exec.js';

import {BuilderInfo} from '../../src/types/buildx/builder.js';

const fixturesDir = path.join(__dirname, '..', '.fixtures');

vi.spyOn(Builder.prototype, 'inspect').mockImplementation(async (): Promise<BuilderInfo> => {
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
    const execSpy = vi.spyOn(Exec, 'getExecOutput');
    const builder = new Builder();
    await builder.exists('foo');
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
    ],
    [
     'inspect8.txt',
     {
       "name": "builder-52aa0611-faf0-42ac-a940-461e4e287d68",
       "driver": "docker-container",
       "lastActivity": new Date("2023-06-13T13:52:31.000Z"),
       "nodes": [
         {
           "buildkit": "v0.11.6",
           "buildkitd-flags": "--debug --allow-insecure-entitlement security.insecure --allow-insecure-entitlement network.host",
           "driver-opts": [
             "image=moby/buildkit:buildx-stable-1",
             "network=host",
           ],
           "endpoint": "unix:///var/run/docker.sock",
           "name": "builder-52aa0611-faf0-42ac-a940-461e4e287d680",
           "platforms": "linux/amd64,linux/amd64/v2,linux/amd64/v3,linux/amd64/v4,linux/arm64,linux/riscv64,linux/ppc64le,linux/s390x,linux/386,linux/mips64le,linux/mips64,linux/arm/v7,linux/arm/v6",
           "status": "running",
           "labels": {
             "org.mobyproject.buildkit.worker.executor": "oci",
             "org.mobyproject.buildkit.worker.hostname": "fv-az572-38",
             "org.mobyproject.buildkit.worker.network": "host",
             "org.mobyproject.buildkit.worker.oci.process-mode": "sandbox",
             "org.mobyproject.buildkit.worker.selinux.enabled": "false",
             "org.mobyproject.buildkit.worker.snapshotter": "overlayfs",
           },
           "gcPolicy": [
             {
               "all": false,
               "filter": [
                 "type==source.local",
                 "type==exec.cachemount",
                 "type==source.git.checkout"
               ],
               "keepDuration": "48h0m0s",
               "keepBytes": "488.3MiB",
             },
             {
               "all": false,
               "keepDuration": "1440h0m0s",
               "keepBytes": "8.382GiB",
             },
             {
               "all": false,
               "keepBytes": "8.382GiB",
             },
             {
               "all": true,
               "keepBytes": "8.382GiB",
             }
           ]
         }
       ]
     }
    ],
    [
      'inspect9.txt',
      {
        "name": "default",
        "driver": "docker",
        "lastActivity": new Date("2023-06-13T18:13:43.000Z"),
        "nodes": [
          {
            "buildkit": "v0.11.7-0.20230525183624-798ad6b0ce9f",
            "endpoint": "default",
            "name": "default",
            "platforms": "linux/amd64,linux/amd64/v2,linux/amd64/v3,linux/arm64,linux/riscv64,linux/ppc64le,linux/s390x,linux/386,linux/mips64le,linux/mips64,linux/arm/v7,linux/arm/v6",
            "status": "running",
            "gcPolicy": [
              {
                "all": true,
                "keepBytes": "100GiB",
              }
            ]
          }
        ]
      }
    ],
    [
      'inspect10.txt',
      {
        "name": "remote-builder",
        "driver": "remote",
        "lastActivity": new Date("2023-04-20T12:47:49.000Z"),
        "nodes": [
          {
            "name": "remote-builder0",
            "endpoint": "docker-container://buildx_buildkit_dk-remote-builder0",
            "status": "inactive"
          },
          {
            "name": "aws_graviton2",
            "endpoint": "tcp://10.0.0.1:1234",
            "driver-opts": [
              "cacert=/home/user/.certs/aws_graviton2/ca.pem",
              "cert=/home/user/.certs/aws_graviton2/cert.pem",
              "key=/home/user/.certs/aws_graviton2/key.pem"
            ],
            "status": "running",
            "buildkit": "v0.11.6",
            "platforms": "darwin/arm64,linux/arm64,linux/arm/v5,linux/arm/v6,linux/arm/v7,windows/arm64",
            "labels": {
              "org.mobyproject.buildkit.worker.executor": "oci",
              "org.mobyproject.buildkit.worker.hostname": "77ebc22e2d82",
              "org.mobyproject.buildkit.worker.network": "host",
              "org.mobyproject.buildkit.worker.oci.process-mode": "sandbox",
              "org.mobyproject.buildkit.worker.selinux.enabled": "false",
              "org.mobyproject.buildkit.worker.snapshotter": "overlayfs"
            },
            "gcPolicy": [
              {
                "all": false,
                "filter": [
                  "type==source.local",
                  "type==exec.cachemount",
                  "type==source.git.checkout"
                ],
                "keepDuration": "48h0m0s",
                "keepBytes": "488.3MiB"
              },
              {
                "all": false,
                "keepDuration": "1440h0m0s",
                "keepBytes": "23.28GiB"
              },
              {
                "all": false,
                "keepBytes": "23.28GiB"
              },
              {
                "all": true,
                "keepBytes": "23.28GiB"
              }
            ]
          },
          {
            "name": "linuxone_s390x",
            "endpoint": "tcp://10.0.0.2:1234",
            "driver-opts": [
              "cacert=/home/user/.certs/linuxone_s390x/ca.pem",
              "cert=/home/user/.certs/linuxone_s390x/cert.pem",
              "key=/home/user/.certs/linuxone_s390x/key.pem"
            ],
            "status": "running",
            "buildkit": "v0.11.6",
            "platforms": "linux/s390x",
            "labels": {
              "org.mobyproject.buildkit.worker.executor": "oci",
              "org.mobyproject.buildkit.worker.hostname": "9d0d62a96818",
              "org.mobyproject.buildkit.worker.network": "host",
              "org.mobyproject.buildkit.worker.oci.process-mode": "sandbox",
              "org.mobyproject.buildkit.worker.selinux.enabled": "false",
              "org.mobyproject.buildkit.worker.snapshotter": "overlayfs"
            },
            "gcPolicy": [
              {
                "all": false,
                "keepBytes": "488.3MiB",
                "filter": [
                  "type==source.local",
                  "type==exec.cachemount",
                  "type==source.git.checkout"
                ],
                "keepDuration": "48h0m0s"
              },
              {
                "all": false,
                "keepDuration": "1440h0m0s",
                "keepBytes": "9.313GiB"
              },
              {
                "all": false,
                "keepBytes": "9.313GiB"
              },
              {
                "all": true,
                "keepBytes": "9.313GiB"
              }
            ]
          }
        ],
      }
    ],
    [
     'inspect11.txt',
     {
       "name": "builder",
       "driver": "docker-container",
       "lastActivity": new Date("2024-03-01T14:25:03.000Z"),
       "nodes": [
         {
           "buildkit": "37657a1",
           "buildkitd-flags": "--debug --allow-insecure-entitlement security.insecure --allow-insecure-entitlement network.host --allow-insecure-entitlement=network.host",
           "driver-opts": [
             "env.JAEGER_TRACE=localhost:6831",
             "image=moby/buildkit:master",
             "network=host",
             "env.BUILDKIT_STEP_LOG_MAX_SIZE=10485760",
             "env.BUILDKIT_STEP_LOG_MAX_SPEED=10485760",
           ],
           "endpoint": "unix:///var/run/docker.sock",
           "name": "builder0",
           "platforms": "linux/amd64,linux/amd64/v2,linux/amd64/v3,linux/arm64,linux/riscv64,linux/ppc64le,linux/s390x,linux/386,linux/mips64le,linux/mips64,linux/arm/v7,linux/arm/v6",
           "status": "running",
           "features": {
             "Cache export": true,
             "Docker exporter": true,
             "Multi-platform build": true,
             "OCI exporter": true,
           },
           "labels": {
             "org.mobyproject.buildkit.worker.executor": "oci",
             "org.mobyproject.buildkit.worker.hostname": "docker-desktop",
             "org.mobyproject.buildkit.worker.network": "host",
             "org.mobyproject.buildkit.worker.oci.process-mode": "sandbox",
             "org.mobyproject.buildkit.worker.selinux.enabled": "false",
             "org.mobyproject.buildkit.worker.snapshotter": "overlayfs",
           },
           "gcPolicy": [
             {
               "all": false,
               "filter": [
                 "type==source.local",
                 "type==exec.cachemount",
                 "type==source.git.checkout"
               ],
               "keepDuration": "48h0m0s",
               "keepBytes": "488.3MiB",
             },
             {
               "all": false,
               "keepDuration": "1440h0m0s",
               "keepBytes": "94.06GiB",
             },
             {
               "all": false,
               "keepBytes": "94.06GiB",
             },
             {
               "all": true,
               "keepBytes": "94.06GiB",
             }
           ],
           "files": {
             "buildkitd.toml": `debug = true
insecure-entitlements = ["network.host", "security.insecure"]
trace = true

[log]
  format = "text"
`,
             "foo.txt": `foo = bar
baz = qux
`,
           }
         }
       ]
     }
    ],
    [
     'inspect12.txt',
     {
       "name": "nvidia",
       "driver": "docker-container",
       "lastActivity": new Date("2025-02-14T15:57:45.000Z"),
       "nodes": [
         {
           "buildkit": "v0.20.0-rc2-4-gd30d8e22c.m",
           "buildkitd-flags": "--allow-insecure-entitlement=network.host",
           "driver-opts": [
             "image=moby/buildkit:local",
           ],
           "endpoint": "unix:///var/run/docker.sock",
           "name": "nvidia0",
           "platforms": "linux/amd64,linux/amd64/v2,linux/amd64/v3,linux/arm64,linux/riscv64,linux/ppc64le,linux/s390x,linux/386,linux/arm/v7,linux/arm/v6",
           "status": "running",
           "features": {
             "Cache export": true,
             "Docker exporter": true,
             "Multi-platform build": true,
             "OCI exporter": true,
           },
           "labels": {
             "org.mobyproject.buildkit.worker.executor": "oci",
             "org.mobyproject.buildkit.worker.hostname": "76ac9a510d96",
             "org.mobyproject.buildkit.worker.network": "host",
             "org.mobyproject.buildkit.worker.oci.process-mode": "sandbox",
             "org.mobyproject.buildkit.worker.selinux.enabled": "false",
             "org.mobyproject.buildkit.worker.snapshotter": "overlayfs",
           },
           "devices": [
             {
               "annotations": {
                 "foo": "bar",
                 "org.mobyproject.buildkit.device.autoallow": "true"
               },
               "autoAllow": true,
               "name": "nvidia.com/gpu=all"
             },
             {
               "annotations": {
                 "bar": "baz"
               },
               "autoAllow": false,
               "name": "docker.com/gpu=venus"
             }
           ],
           "gcPolicy": [
             {
               "all": false,
               "filter": [
                 "type==source.local",
                 "type==exec.cachemount",
                 "type==source.git.checkout"
               ],
               "keepDuration": "48h0m0s",
               "maxUsedSpace": "488.3MiB",
             },
             {
               "all": false,
               "keepDuration": "1440h0m0s",
               "maxUsedSpace": "93.13GiB",
               "minFreeSpace": "188.1GiB",
               "reservedSpace": "9.313GiB",
             },
             {
               "all": false,
               "maxUsedSpace": "93.13GiB",
               "minFreeSpace": "188.1GiB",
               "reservedSpace": "9.313GiB",
             },
             {
               "all": true,
               "maxUsedSpace": "93.13GiB",
               "minFreeSpace": "188.1GiB",
               "reservedSpace": "9.313GiB",
             }
           ]
         }
       ]
     }
    ],
  ])('given %p', async (inspectFile, expected) => {
    expect(await Builder.parseInspect(fs.readFileSync(path.join(fixturesDir, inspectFile)).toString())).toEqual(expected);
  });
});
