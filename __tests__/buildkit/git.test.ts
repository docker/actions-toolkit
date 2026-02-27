/**
 * Copyright 2024 actions-toolkit authors
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

import {beforeEach, describe, expect, vi, test} from 'vitest';

import {Git} from '../../src/buildkit/git.js';

import {GitRef, GitURL} from '../../src/types/buildkit/git.js';

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('parseURL', () => {
  // prettier-ignore
  test.each([
    [
      'http://github.com/moby/buildkit',
      {
        scheme: 'http',
        host: 'github.com',
        path: '/moby/buildkit'
      } as GitURL,
      false
    ],
    [
      'https://github.com/moby/buildkit',
      {
        scheme: 'https',
        host: 'github.com',
        path: '/moby/buildkit'
      } as GitURL,
      false
    ],
    [
      'http://github.com/moby/buildkit#v1.0.0',
      {
        scheme: 'http',
        host: 'github.com',
        path: '/moby/buildkit',
        fragment: {
          ref: 'v1.0.0',
        }
      } as GitURL,
      false
    ],
    [
      'http://github.com/moby/buildkit#v1.0.0:subdir',
      {
        scheme: 'http',
        host: 'github.com',
        path: '/moby/buildkit',
        fragment: {
          ref: 'v1.0.0',
          subdir: 'subdir'
        }
      } as GitURL,
      false
    ],
    [
      'http://foo:bar@github.com/moby/buildkit#v1.0.0',
      {
        scheme: 'http',
        host: 'github.com',
        path: '/moby/buildkit',
        fragment: {
          ref: 'v1.0.0',
        },
        user: {
          username: 'foo',
          password: 'bar',
          passwordSet: true
        }
      } as GitURL,
      false
    ],
    [
      'ssh://git@github.com/moby/buildkit.git',
      {
        scheme: 'ssh',
        host: 'github.com',
        path: '/moby/buildkit.git',
        user: {
          username: 'git',
          password: '',
          passwordSet: false
        }
      } as GitURL,
      false
    ],
    [
      'ssh://git@github.com:22/moby/buildkit.git',
      {
        scheme: 'ssh',
        host: 'github.com:22',
        path: '/moby/buildkit.git',
        user: {
          username: 'git',
          password: '',
          passwordSet: false
        }
      } as GitURL,
      false
    ],
    // TODO: handle SCP-style URLs
    // [
    //   'git@github.com:moby/buildkit.git',
    //   {
    //     scheme: 'ssh',
    //     host: 'github.com:22',
    //     path: 'moby/buildkit.git',
    //     user: {
    //       username: 'git',
    //       password: '',
    //       passwordSet: false
    //     }
    //   } as GitURL,
    //   false
    // ],
    [
      'ssh://root@subdomain.example.hostname:2222/root/my/really/weird/path/foo.git',
      {
        scheme: 'ssh',
        host: 'subdomain.example.hostname:2222',
        path: '/root/my/really/weird/path/foo.git',
        user: {
          username: 'root',
          password: '',
          passwordSet: false
        }
      } as GitURL,
      false
    ],
    [
      'git://host.xz:1234/path/to/repo.git',
      {
        scheme: 'git',
        host: 'host.xz:1234',
        path: '/path/to/repo.git',
      } as GitURL,
      false
    ],
    [
      'ssh://someuser@192.168.0.123:456/~/repo-in-my-home-dir.git',
      {
        scheme: 'ssh',
        host: '192.168.0.123:456',
        path: '/~/repo-in-my-home-dir.git',
        user: {
          username: 'someuser',
          password: '',
          passwordSet: false
        }
      } as GitURL,
      false
    ],
    [
      'httpx://github.com/moby/buildkit',
      {} as GitURL,
      true
    ],
    [
      'HTTP://github.com/moby/buildkit',
      {
        scheme: 'http',
        host: 'github.com',
        path: '/moby/buildkit'
      } as GitURL,
      false
    ],
  ])('given %p', async (ref: string, expected: GitURL, expectedErr: boolean) => {
    try {
      const got = Git.parseURL(ref);
      expect(got.scheme).toEqual(expected.scheme);
      expect(got.host).toEqual(expected.host);
      expect(got.path).toEqual(expected.path);
      expect(got.fragment).toEqual(expected.fragment);
      expect(got.user?.username).toEqual(expected.user?.username);
      expect(got.user?.password).toEqual(expected.user?.password);
      expect(got.user?.passwordSet).toEqual(expected.user?.passwordSet);
    } catch (err) {
      if (!expectedErr) {
        console.log(err);
      }
      // eslint-disable-next-line vitest/no-conditional-expect
      expect(expectedErr).toBeTruthy();
    }
  });
});

describe('parseRef', () => {
  // prettier-ignore
  test.each([
    [
      'https://example.com/',
      undefined
    ],
    [
      'https://example.com/foo',
      undefined
    ],
    [
      'https://example.com/foo.git',
      {
        remote: 'https://example.com/foo.git',
        shortName: 'foo'
      } as GitRef
    ],
    [
      'https://example.com/foo.git#deadbeef',
      {
        remote: 'https://example.com/foo.git',
        shortName: 'foo',
        commit: 'deadbeef'
      } as GitRef
    ],
    [
      'https://example.com/foo.git#release/1.2',
      {
        remote: 'https://example.com/foo.git',
        shortName: 'foo',
        commit: 'release/1.2'
      } as GitRef
    ],
    [
      'https://example.com/foo.git/',
      undefined
    ],
    [
      'https://example.com/foo.git.bar',
      undefined
    ],
    [
      'git://example.com/foo',
      {
        remote: 'git://example.com/foo',
        shortName: 'foo',
        unencryptedTCP: true
      } as GitRef
    ],
    [
      'github.com/moby/buildkit',
      {
        remote: 'github.com/moby/buildkit',
        shortName: 'buildkit',
        indistinguishableFromLocal: true
      } as GitRef
    ],
    [
      'custom.xyz/moby/buildkit.git',
      undefined
    ],
    [
      'https://github.com/moby/buildkit',
      undefined
    ],
    [
      'https://github.com/moby/buildkit.git',
      {
        remote: 'https://github.com/moby/buildkit.git',
        shortName: 'buildkit',
      } as GitRef
    ],
    [
      'https://foo:bar@github.com/moby/buildkit.git',
      {
        remote: 'https://foo:bar@github.com/moby/buildkit.git',
        shortName: 'buildkit',
      } as GitRef
    ],
    // TODO handle SCP-style URLs
    // [
    //   'git@github.com:moby/buildkit',
    //   {
    //     remote: 'git@github.com:moby/buildkit',
    //     shortName: 'buildkit',
    //   } as GitRef
    // ],
    // [
    //   'git@github.com:moby/buildkit.git',
    //   {
    //     remote: 'git@github.com:moby/buildkit',
    //     shortName: 'buildkit',
    //   } as GitRef
    // ],
    // [
    //   'git@bitbucket.org:atlassianlabs/atlassian-docker.git',
    //   {
    //     remote: 'git@bitbucket.org:atlassianlabs/atlassian-docker.git',
    //     shortName: 'atlassian-docker',
    //   } as GitRef
    // ],
    [
      'https://github.com/foo/bar.git#baz/qux:quux/quuz',
      {
        remote: 'https://github.com/foo/bar.git',
        shortName: 'bar',
        commit: 'baz/qux',
        subDir: 'quux/quuz',
      } as GitRef
    ],
    [
      'https://github.com/docker/docker.git#:myfolder',
      {
        remote: 'https://github.com/docker/docker.git',
        shortName: 'docker',
        subDir: 'myfolder',
        commit: ''
      } as GitRef
    ],
    [
      './.git',
      undefined
    ],
    [
      '.git',
      undefined
    ],
  ])('given %p', async (ref: string, expected: GitRef | undefined) => {
    try {
      const got = Git.parseRef(ref);
      expect(got).toEqual(expected);
    } catch (err) {
      if (expected) {
        console.log(err);
      }
      // eslint-disable-next-line vitest/no-conditional-expect
      expect(expected).toBeUndefined();
    }
  });
});
