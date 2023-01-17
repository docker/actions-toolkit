import {describe, expect, it, jest, test} from '@jest/globals';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as semver from 'semver';
import * as buildkit from '../src/buildkit';
import * as buildx from '../src/buildx';
import * as util from '../src/util';

const tmpdir = fs.mkdtempSync(path.join(os.tmpdir(), 'docker-actions-toolkit-')).split(path.sep).join(path.posix.sep);
jest.spyOn(util, 'tmpDir').mockImplementation((): string => {
  return tmpdir;
});

const tmpname = path.join(tmpdir, '.tmpname').split(path.sep).join(path.posix.sep);
jest.spyOn(util, 'tmpNameSync').mockImplementation((): string => {
  return tmpname;
});

jest.spyOn(buildx, 'inspect').mockImplementation(async (): Promise<buildx.Builder> => {
  return {
    name: 'builder2',
    driver: 'docker-container',
    'last-activity': new Date('2023-01-16 09:45:23 +0000 UTC'),
    nodes: [
      {
        buildkit: 'v0.11.0',
        'buildkitd-flags': '--debug --allow-insecure-entitlement security.insecure --allow-insecure-entitlement network.host',
        'driver-opts': ['BUILDKIT_STEP_LOG_MAX_SIZE=10485760', 'BUILDKIT_STEP_LOG_MAX_SPEED=10485760', 'JAEGER_TRACE=localhost:6831', 'image=moby/buildkit:latest', 'network=host'],
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
    const version = await buildkit.getVersion('builder2');
    expect(semver.valid(version)).not.toBeNull();
  });
});

describe('satisfies', () => {
  test.each([
    ['builder2', '>=0.10.0', true],
    ['builder2', '>0.11.0', false]
  ])('given %p', async (builderName, range, expected) => {
    expect(await buildkit.satisfies(builderName, range)).toBe(expected);
  });
});

describe('getConfig', () => {
  test.each([
    ['debug = true', false, 'debug = true', false],
    [`notfound.toml`, true, '', true],
    [
      `${path.join(__dirname, 'fixtures', 'buildkitd.toml').split(path.sep).join(path.posix.sep)}`,
      true,
      `debug = true
[registry."docker.io"]
  mirrors = ["mirror.gcr.io"]
`,
      false
    ]
  ])('given %p config', async (val, file, exValue, invalid) => {
    try {
      let config: string;
      if (file) {
        config = await buildkit.getConfigFile(val);
      } else {
        config = await buildkit.getConfigInline(val);
      }
      expect(true).toBe(!invalid);
      expect(config).toEqual(tmpname);
      const configValue = fs.readFileSync(tmpname, 'utf-8');
      expect(configValue).toEqual(exValue);
    } catch (err) {
      // eslint-disable-next-line jest/no-conditional-expect
      expect(true).toBe(invalid);
    }
  });
});
