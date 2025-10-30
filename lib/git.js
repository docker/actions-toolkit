"use strict";
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
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Git = void 0;
const core = __importStar(require("@actions/core"));
const core_1 = require("@octokit/core");
const plugin_rest_endpoint_methods_1 = require("@octokit/plugin-rest-endpoint-methods");
const exec_1 = require("./exec");
const github_1 = require("./github");
const context_1 = require("@actions/github/lib/context");
class Git {
    static context() {
        return __awaiter(this, void 0, void 0, function* () {
            const ctx = new context_1.Context();
            ctx.ref = yield Git.ref();
            ctx.sha = yield Git.fullCommit();
            return ctx;
        });
    }
    static isInsideWorkTree() {
        return __awaiter(this, void 0, void 0, function* () {
            return yield Git.exec(['rev-parse', '--is-inside-work-tree'])
                .then(out => {
                return out === 'true';
            })
                .catch(() => {
                return false;
            });
        });
    }
    static remoteSha(repo, ref, token) {
        return __awaiter(this, void 0, void 0, function* () {
            const repoMatch = repo.match(/github.com\/([^/]+)\/([^/]+?)(?:\.git)?(\/|$)/);
            // if we have a token and this is a GitHub repo we can use the GitHub API
            if (token && repoMatch) {
                core.setSecret(token);
                const octokit = new (core_1.Octokit.plugin(plugin_rest_endpoint_methods_1.restEndpointMethods).defaults({
                    baseUrl: github_1.GitHub.apiURL
                }))({ auth: token });
                const [owner, repoName] = repoMatch.slice(1, 3);
                try {
                    return (yield octokit.rest.repos.listCommits({
                        owner: owner,
                        repo: repoName,
                        sha: ref,
                        per_page: 1
                    })).data[0].sha;
                }
                catch (e) {
                    throw new Error(`Cannot find remote ref for ${repo}#${ref}: ${e.message}`);
                }
            }
            // otherwise we fall back to git ls-remote
            return yield Git.exec(['ls-remote', repo, ref]).then(out => {
                const [rsha] = out.split(/[\s\t]/);
                if (rsha.length == 0) {
                    throw new Error(`Cannot find remote ref for ${repo}#${ref}`);
                }
                return rsha;
            });
        });
    }
    static remoteURL() {
        return __awaiter(this, void 0, void 0, function* () {
            return yield Git.exec(['remote', 'get-url', 'origin']).then(rurl => {
                if (rurl.length == 0) {
                    return Git.exec(['remote', 'get-url', 'upstream']).then(rurl => {
                        if (rurl.length == 0) {
                            throw new Error(`Cannot find remote URL for origin or upstream`);
                        }
                        return rurl;
                    });
                }
                return rurl;
            });
        });
    }
    static ref() {
        return __awaiter(this, void 0, void 0, function* () {
            const isHeadDetached = yield Git.isHeadDetached();
            if (isHeadDetached) {
                return yield Git.getDetachedRef();
            }
            return yield Git.exec(['symbolic-ref', 'HEAD']);
        });
    }
    static fullCommit() {
        return __awaiter(this, void 0, void 0, function* () {
            return yield Git.exec(['show', '--format=%H', 'HEAD', '--quiet', '--']);
        });
    }
    static shortCommit() {
        return __awaiter(this, void 0, void 0, function* () {
            return yield Git.exec(['show', '--format=%h', 'HEAD', '--quiet', '--']);
        });
    }
    static tag() {
        return __awaiter(this, void 0, void 0, function* () {
            return yield Git.exec(['tag', '--points-at', 'HEAD', '--sort', '-version:creatordate']).then(tags => {
                if (tags.length == 0) {
                    return Git.exec(['describe', '--tags', '--abbrev=0']);
                }
                return tags.split('\n')[0];
            });
        });
    }
    static isHeadDetached() {
        return __awaiter(this, void 0, void 0, function* () {
            return yield Git.exec(['branch', '--show-current']).then(res => {
                return res.length == 0;
            });
        });
    }
    static getDetachedRef() {
        return __awaiter(this, void 0, void 0, function* () {
            const res = yield Git.exec(['show', '-s', '--pretty=%D']);
            // Can be "HEAD, <tagname>" or "grafted, HEAD, <tagname>"
            const refMatch = res.match(/^(grafted, )?HEAD, (.*)$/);
            if (!refMatch || !refMatch[2]) {
                throw new Error(`Cannot find detached HEAD ref in "${res}"`);
            }
            const ref = refMatch[2].trim();
            // Tag refs are formatted as "tag: <tagname>"
            if (ref.startsWith('tag: ')) {
                return `refs/tags/${ref.split(':')[1].trim()}`;
            }
            // Branch refs are formatted as "<origin>/<branch-name>, <branch-name>"
            const branchMatch = ref.match(/^[^/]+\/[^/]+, (.+)$/);
            if (branchMatch) {
                return `refs/heads/${branchMatch[1].trim()}`;
            }
            // Pull request merge refs are formatted as "pull/<number>/<state>"
            const prMatch = ref.match(/^pull\/\d+\/(head|merge)$/);
            if (prMatch) {
                return `refs/${ref}`;
            }
            throw new Error(`Unsupported detached HEAD ref in "${res}"`);
        });
    }
    static exec() {
        return __awaiter(this, arguments, void 0, function* (args = []) {
            return yield exec_1.Exec.getExecOutput(`git`, args, {
                ignoreReturnCode: true,
                silent: true
            }).then(res => {
                if (res.stderr.length > 0 && res.exitCode != 0) {
                    throw new Error(res.stderr);
                }
                return res.stdout.trim();
            });
        });
    }
    static commitDate(ref) {
        return __awaiter(this, void 0, void 0, function* () {
            return new Date(yield Git.exec(['show', '-s', '--format="%ci"', ref]));
        });
    }
}
exports.Git = Git;
//# sourceMappingURL=git.js.map