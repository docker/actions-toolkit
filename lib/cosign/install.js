"use strict";
/**
 * Copyright 2025 actions-toolkit authors
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Install = void 0;
const fs_1 = __importDefault(require("fs"));
const os_1 = __importDefault(require("os"));
const path_1 = __importDefault(require("path"));
const core = __importStar(require("@actions/core"));
const tc = __importStar(require("@actions/tool-cache"));
const semver = __importStar(require("semver"));
const util = __importStar(require("util"));
const buildx_1 = require("../buildx/buildx");
const cache_1 = require("../cache");
const context_1 = require("../context");
const exec_1 = require("../exec");
const git_1 = require("../git");
const github_1 = require("../github");
const util_1 = require("../util");
const dockerfile_1 = require("./dockerfile");
class Install {
    constructor(opts) {
        this.githubToken = (opts === null || opts === void 0 ? void 0 : opts.githubToken) || process.env.GITHUB_TOKEN;
        this.buildx = (opts === null || opts === void 0 ? void 0 : opts.buildx) || new buildx_1.Buildx();
    }
    download(v, ghaNoCache, skipState) {
        return __awaiter(this, void 0, void 0, function* () {
            const version = yield Install.getDownloadVersion(v);
            core.debug(`Install.download version: ${version.version}`);
            const release = yield Install.getRelease(version, this.githubToken);
            core.debug(`Install.download release tag name: ${release.tag_name}`);
            const vspec = yield this.vspec(release.tag_name);
            core.debug(`Install.download vspec: ${vspec}`);
            const c = semver.clean(vspec) || '';
            if (!semver.valid(c)) {
                throw new Error(`Invalid Cosign version "${vspec}".`);
            }
            const installCache = new cache_1.Cache({
                htcName: 'cosign-dl-bin',
                htcVersion: vspec,
                baseCacheDir: path_1.default.join(os_1.default.homedir(), '.bin'),
                cacheFile: os_1.default.platform() == 'win32' ? 'cosign.exe' : 'cosign',
                ghaNoCache: ghaNoCache
            });
            const cacheFoundPath = yield installCache.find();
            if (cacheFoundPath) {
                core.info(`Cosign binary found in ${cacheFoundPath}`);
                return cacheFoundPath;
            }
            const downloadURL = util.format(version.downloadURL, vspec, this.filename());
            core.info(`Downloading ${downloadURL}`);
            const htcDownloadPath = yield tc.downloadTool(downloadURL, undefined, this.githubToken);
            core.debug(`Install.download htcDownloadPath: ${htcDownloadPath}`);
            const cacheSavePath = yield installCache.save(htcDownloadPath, skipState);
            core.info(`Cached to ${cacheSavePath}`);
            return cacheSavePath;
        });
    }
    build(gitContext, ghaNoCache, skipState) {
        return __awaiter(this, void 0, void 0, function* () {
            const vspec = yield this.vspec(gitContext);
            core.debug(`Install.build vspec: ${vspec}`);
            const installCache = new cache_1.Cache({
                htcName: 'cosign-build-bin',
                htcVersion: vspec,
                baseCacheDir: path_1.default.join(os_1.default.homedir(), '.bin'),
                cacheFile: os_1.default.platform() == 'win32' ? 'cosign.exe' : 'cosign',
                ghaNoCache: ghaNoCache
            });
            const cacheFoundPath = yield installCache.find();
            if (cacheFoundPath) {
                core.info(`Cosign binary found in ${cacheFoundPath}`);
                return cacheFoundPath;
            }
            const outputDir = path_1.default.join(context_1.Context.tmpDir(), 'cosign-build-cache');
            const buildCmd = yield this.buildCommand(gitContext, outputDir);
            const buildBinPath = yield exec_1.Exec.getExecOutput(buildCmd.command, buildCmd.args, {
                ignoreReturnCode: true,
                input: Buffer.from(dockerfile_1.dockerfileContent)
            }).then(res => {
                var _a, _b, _c;
                if (res.stderr.length > 0 && res.exitCode != 0) {
                    throw new Error(`build failed with: ${(_c = (_b = (_a = res.stderr.match(/(.*)\s*$/)) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b.trim()) !== null && _c !== void 0 ? _c : 'unknown error'}`);
                }
                return `${outputDir}/cosign`;
            });
            const cacheSavePath = yield installCache.save(buildBinPath, skipState);
            core.info(`Cached to ${cacheSavePath}`);
            return cacheSavePath;
        });
    }
    install(binPath, dest) {
        return __awaiter(this, void 0, void 0, function* () {
            dest = dest || context_1.Context.tmpDir();
            const binDir = path_1.default.join(dest, 'cosign-bin');
            if (!fs_1.default.existsSync(binDir)) {
                fs_1.default.mkdirSync(binDir, { recursive: true });
            }
            const binName = os_1.default.platform() == 'win32' ? 'cosign.exe' : 'cosign';
            const cosignPath = path_1.default.join(binDir, binName);
            fs_1.default.copyFileSync(binPath, cosignPath);
            core.info('Fixing perms');
            fs_1.default.chmodSync(cosignPath, '0755');
            core.addPath(binDir);
            core.info('Added Cosign to PATH');
            core.info(`Binary path: ${cosignPath}`);
            return cosignPath;
        });
    }
    buildCommand(gitContext, outputDir) {
        return __awaiter(this, void 0, void 0, function* () {
            const buildxStandaloneFound = yield new buildx_1.Buildx({ standalone: true }).isAvailable();
            const buildxPluginFound = yield new buildx_1.Buildx({ standalone: false }).isAvailable();
            let buildStandalone = false;
            if ((yield this.buildx.isStandalone()) && buildxStandaloneFound) {
                core.debug(`Install.buildCommand: Buildx standalone found, build with it`);
                buildStandalone = true;
            }
            else if (!(yield this.buildx.isStandalone()) && buildxPluginFound) {
                core.debug(`Install.buildCommand: Buildx plugin found, build with it`);
                buildStandalone = false;
            }
            else if (buildxStandaloneFound) {
                core.debug(`Install.buildCommand: Buildx plugin not found, but standalone found so trying to build with it`);
                buildStandalone = true;
            }
            else if (buildxPluginFound) {
                core.debug(`Install.buildCommand: Buildx standalone not found, but plugin found so trying to build with it`);
                buildStandalone = false;
            }
            else {
                throw new Error(`Neither buildx standalone or plugin have been found to build from ref ${gitContext}`);
            }
            const args = ['build', '--platform', 'local', '--build-arg', 'BUILDKIT_CONTEXT_KEEP_GIT_DIR=1', '--output', `type=local,dest=${outputDir}`];
            if (process.env.GIT_AUTH_TOKEN) {
                args.push('--secret', 'id=GIT_AUTH_TOKEN');
            }
            args.push('-f-', gitContext);
            // prettier-ignore
            return yield new buildx_1.Buildx({ standalone: buildStandalone }).getCommand(args);
        });
    }
    filename() {
        let arch;
        switch (os_1.default.arch()) {
            case 'x64': {
                arch = 'amd64';
                break;
            }
            case 'ppc64': {
                arch = 'ppc64le';
                break;
            }
            default: {
                arch = os_1.default.arch();
                break;
            }
        }
        const platform = os_1.default.platform() == 'win32' ? 'windows' : os_1.default.platform();
        const ext = os_1.default.platform() == 'win32' ? '.exe' : '';
        return util.format('cosign-%s-%s%s', platform, arch, ext);
    }
    vspec(versionOrRef) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!util_1.Util.isValidRef(versionOrRef)) {
                const v = versionOrRef.replace(/^v+|v+$/g, '');
                core.info(`Use ${v} version spec cache key for ${versionOrRef}`);
                return v;
            }
            // eslint-disable-next-line prefer-const
            let [baseURL, ref] = versionOrRef.split('#');
            if (ref.length == 0) {
                ref = 'master';
            }
            let sha;
            if (ref.match(/^[0-9a-fA-F]{40}$/)) {
                sha = ref;
            }
            else {
                sha = yield git_1.Git.remoteSha(baseURL, ref, process.env.GIT_AUTH_TOKEN);
            }
            const [owner, repo] = baseURL.substring('https://github.com/'.length).split('/');
            const key = `${owner}/${util_1.Util.trimSuffix(repo, '.git')}/${sha}`;
            const hash = util_1.Util.hash(key);
            core.info(`Use ${hash} version spec cache key for ${key}`);
            return hash;
        });
    }
    static getDownloadVersion(v) {
        return __awaiter(this, void 0, void 0, function* () {
            return {
                version: v,
                downloadURL: 'https://github.com/sigstore/cosign/releases/download/v%s/%s',
                contentOpts: {
                    owner: 'docker',
                    repo: 'actions-toolkit',
                    ref: 'main',
                    path: '.github/cosign-releases.json'
                }
            };
        });
    }
    static getRelease(version, githubToken) {
        return __awaiter(this, void 0, void 0, function* () {
            const github = new github_1.GitHub({ token: githubToken });
            const releases = yield github.releases('Cosign', version.contentOpts);
            if (!releases[version.version]) {
                throw new Error(`Cannot find Cosign release ${version.version} in releases JSON`);
            }
            return releases[version.version];
        });
    }
}
exports.Install = Install;
//# sourceMappingURL=install.js.map