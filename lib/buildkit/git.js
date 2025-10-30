"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.Git = void 0;
class Git {
    // https://github.com/moby/buildkit/blob/2ec1338fc13f73b43f0b1b4f4678d7cd654bc86c/util/gitutil/git_url.go#L79
    static parseURL(remote) {
        const match = remote.match(Git.protoRegexp);
        if (match && match.length > 0) {
            let proto = match[0].toLowerCase();
            proto = proto.slice(0, proto.lastIndexOf('://'));
            if (!(proto in Git.supportedProtos)) {
                throw new Error(`Invalid protocol: ${proto}`);
            }
            return Git.fromURL(new URL(remote));
        }
        throw new Error('Unknown protocol');
    }
    // https://github.com/moby/buildkit/blob/2ec1338fc13f73b43f0b1b4f4678d7cd654bc86c/util/gitutil/git_url.go#L108
    static fromURL(url) {
        const withoutFragment = new URL(url.toString());
        withoutFragment.hash = '';
        let user;
        if (url.username || url.password) {
            user = {
                username: url.username,
                password: url.password,
                passwordSet: url.password !== ''
            };
        }
        // TODO: handle SCP-style URLs
        return {
            scheme: url.protocol.slice(0, -1),
            user: user,
            host: `${url.hostname}${url.port ? ':' + url.port : ''}`,
            path: url.pathname,
            fragment: Git.splitGitFragment(url.hash),
            remote: withoutFragment.toString()
        };
    }
    // https://github.com/moby/buildkit/blob/2ec1338fc13f73b43f0b1b4f4678d7cd654bc86c/util/gitutil/git_url.go#L69
    static splitGitFragment(fragment) {
        if (fragment === '') {
            return undefined;
        }
        const [ref, subdir] = fragment.slice(1).split(':');
        return {
            ref: ref,
            subdir: subdir
        };
    }
    // https://github.com/moby/buildkit/blob/2ec1338fc13f73b43f0b1b4f4678d7cd654bc86c/util/gitutil/git_ref.go#L52
    static parseRef(ref) {
        const res = {};
        let remote;
        if (ref.startsWith('./') || ref.startsWith('../')) {
            throw new Error('Invalid argument');
        }
        else if (ref.startsWith('github.com/')) {
            res.indistinguishableFromLocal = true; // Deprecated
            remote = Git.fromURL(new URL('https://' + ref));
        }
        else {
            remote = Git.parseURL(ref);
            if (['http', 'git'].includes(remote.scheme)) {
                res.unencryptedTCP = true; // Discouraged, but not deprecated
            }
            if (['http', 'https'].includes(remote.scheme) && !remote.path.endsWith('.git')) {
                throw new Error('Invalid argument');
            }
        }
        res.remote = remote.remote;
        if (res.indistinguishableFromLocal) {
            res.remote = res.remote.split('://')[1];
        }
        if (remote.fragment) {
            res.commit = remote.fragment.ref;
            res.subDir = remote.fragment.subdir;
        }
        const repoSplitBySlash = res.remote.split('/');
        res.shortName = repoSplitBySlash[repoSplitBySlash.length - 1].replace('.git', '');
        return res;
    }
}
exports.Git = Git;
Git.protoRegexp = new RegExp('^[a-zA-Z0-9]+://');
Git.supportedProtos = {
    http: {},
    https: {},
    ssh: {},
    git: {}
};
//# sourceMappingURL=git.js.map