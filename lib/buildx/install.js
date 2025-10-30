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
const buildx_1 = require("./buildx");
const cache_1 = require("../cache");
const context_1 = require("../context");
const exec_1 = require("../exec");
const docker_1 = require("../docker/docker");
const git_1 = require("../git");
const github_1 = require("../github");
const util_1 = require("../util");
class Install {
    constructor(opts) {
        this.standalone = opts === null || opts === void 0 ? void 0 : opts.standalone;
        this.githubToken = (opts === null || opts === void 0 ? void 0 : opts.githubToken) || process.env.GITHUB_TOKEN;
    }
    /*
     * Download buildx binary from GitHub release
     * @param v: version semver version or latest
     * @param ghaNoCache: disable binary caching in GitHub Actions cache backend
     * @returns path to the buildx binary
     */
    download(v, ghaNoCache) {
        return __awaiter(this, void 0, void 0, function* () {
            const version = yield Install.getDownloadVersion(v);
            core.debug(`Install.download version: ${version.version}`);
            const release = yield Install.getRelease(version, this.githubToken);
            core.debug(`Install.download release tag name: ${release.tag_name}`);
            const vspec = yield this.vspec(release.tag_name);
            core.debug(`Install.download vspec: ${vspec}`);
            const c = semver.clean(vspec) || '';
            if (!semver.valid(c)) {
                throw new Error(`Invalid Buildx version "${vspec}".`);
            }
            const installCache = new cache_1.Cache({
                htcName: version.key != 'official' ? `buildx-dl-bin-${version.key}` : 'buildx-dl-bin',
                htcVersion: vspec,
                baseCacheDir: path_1.default.join(buildx_1.Buildx.configDir, '.bin'),
                cacheFile: os_1.default.platform() == 'win32' ? 'docker-buildx.exe' : 'docker-buildx',
                ghaNoCache: ghaNoCache
            });
            const cacheFoundPath = yield installCache.find();
            if (cacheFoundPath) {
                core.info(`Buildx binary found in ${cacheFoundPath}`);
                return cacheFoundPath;
            }
            const downloadURL = util.format(version.downloadURL, vspec, this.filename(vspec));
            core.info(`Downloading ${downloadURL}`);
            const htcDownloadPath = yield tc.downloadTool(downloadURL, undefined, this.githubToken);
            core.debug(`Install.download htcDownloadPath: ${htcDownloadPath}`);
            const cacheSavePath = yield installCache.save(htcDownloadPath);
            core.info(`Cached to ${cacheSavePath}`);
            return cacheSavePath;
        });
    }
    /*
     * Build buildx binary from source
     * @param gitContext: git repo context
     * @param ghaNoCache: disable binary caching in GitHub Actions cache backend
     * @returns path to the buildx binary
     */
    build(gitContext, ghaNoCache) {
        return __awaiter(this, void 0, void 0, function* () {
            const vspec = yield this.vspec(gitContext);
            core.debug(`Install.build vspec: ${vspec}`);
            const installCache = new cache_1.Cache({
                htcName: 'buildx-build-bin',
                htcVersion: vspec,
                baseCacheDir: path_1.default.join(buildx_1.Buildx.configDir, '.bin'),
                cacheFile: os_1.default.platform() == 'win32' ? 'docker-buildx.exe' : 'docker-buildx',
                ghaNoCache: ghaNoCache
            });
            const cacheFoundPath = yield installCache.find();
            if (cacheFoundPath) {
                core.info(`Buildx binary found in ${cacheFoundPath}`);
                return cacheFoundPath;
            }
            const outputDir = path_1.default.join(context_1.Context.tmpDir(), 'buildx-build-cache');
            const buildCmd = yield this.buildCommand(gitContext, outputDir);
            const buildBinPath = yield exec_1.Exec.getExecOutput(buildCmd.command, buildCmd.args, {
                ignoreReturnCode: true
            }).then(res => {
                var _a, _b, _c;
                if (res.stderr.length > 0 && res.exitCode != 0) {
                    throw new Error(`build failed with: ${(_c = (_b = (_a = res.stderr.match(/(.*)\s*$/)) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b.trim()) !== null && _c !== void 0 ? _c : 'unknown error'}`);
                }
                return `${outputDir}/buildx`;
            });
            const cacheSavePath = yield installCache.save(buildBinPath);
            core.info(`Cached to ${cacheSavePath}`);
            return cacheSavePath;
        });
    }
    installStandalone(binPath, dest) {
        return __awaiter(this, void 0, void 0, function* () {
            core.info('Standalone mode');
            dest = dest || context_1.Context.tmpDir();
            const binDir = path_1.default.join(dest, 'buildx-bin-standalone');
            if (!fs_1.default.existsSync(binDir)) {
                fs_1.default.mkdirSync(binDir, { recursive: true });
            }
            const binName = os_1.default.platform() == 'win32' ? 'buildx.exe' : 'buildx';
            const buildxPath = path_1.default.join(binDir, binName);
            fs_1.default.copyFileSync(binPath, buildxPath);
            core.info('Fixing perms');
            fs_1.default.chmodSync(buildxPath, '0755');
            core.addPath(binDir);
            core.info('Added Buildx to PATH');
            core.info(`Binary path: ${buildxPath}`);
            return buildxPath;
        });
    }
    installPlugin(binPath, dest) {
        return __awaiter(this, void 0, void 0, function* () {
            core.info('Docker plugin mode');
            dest = dest || docker_1.Docker.configDir;
            const pluginsDir = path_1.default.join(dest, 'cli-plugins');
            if (!fs_1.default.existsSync(pluginsDir)) {
                fs_1.default.mkdirSync(pluginsDir, { recursive: true });
            }
            const binName = os_1.default.platform() == 'win32' ? 'docker-buildx.exe' : 'docker-buildx';
            const pluginPath = path_1.default.join(pluginsDir, binName);
            fs_1.default.copyFileSync(binPath, pluginPath);
            core.info('Fixing perms');
            fs_1.default.chmodSync(pluginPath, '0755');
            core.info(`Plugin path: ${pluginPath}`);
            return pluginPath;
        });
    }
    buildCommand(gitContext, outputDir) {
        return __awaiter(this, void 0, void 0, function* () {
            const buildxStandaloneFound = yield new buildx_1.Buildx({ standalone: true }).isAvailable();
            const buildxPluginFound = yield new buildx_1.Buildx({ standalone: false }).isAvailable();
            let buildStandalone = false;
            if ((yield this.isStandalone()) && buildxStandaloneFound) {
                core.debug(`Install.buildCommand: Buildx standalone found, build with it`);
                buildStandalone = true;
            }
            else if (!(yield this.isStandalone()) && buildxPluginFound) {
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
            const args = ['build', '--target', 'binaries', '--platform', 'local', '--build-arg', 'BUILDKIT_CONTEXT_KEEP_GIT_DIR=1', '--output', `type=local,dest=${outputDir}`];
            if (process.env.GIT_AUTH_TOKEN) {
                args.push('--secret', 'id=GIT_AUTH_TOKEN');
            }
            args.push(gitContext);
            //prettier-ignore
            return yield new buildx_1.Buildx({ standalone: buildStandalone }).getCommand(args);
        });
    }
    isStandalone() {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            const standalone = (_a = this.standalone) !== null && _a !== void 0 ? _a : !(yield docker_1.Docker.isAvailable());
            core.debug(`Install.isStandalone: ${standalone}`);
            return standalone;
        });
    }
    filename(version) {
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
            case 'arm': {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const arm_version = process.config.variables.arm_version;
                arch = arm_version ? 'arm-v' + arm_version : 'arm';
                break;
            }
            default: {
                arch = os_1.default.arch();
                break;
            }
        }
        const platform = os_1.default.platform() == 'win32' ? 'windows' : os_1.default.platform();
        const ext = os_1.default.platform() == 'win32' ? '.exe' : '';
        return util.format('buildx-v%s.%s-%s%s', version, platform, arch, ext);
    }
    /*
     * Get version spec (fingerprint) for cache key. If versionOrRef is a valid
     * Git context, then return the SHA of the ref along the repo and owner and
     * create a hash of it. Otherwise, return the versionOrRef (semver) as is
     * without the 'v' prefix.
     */
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
            let [repoKey, version] = v.split(':');
            if (!version) {
                version = repoKey;
                repoKey = 'official';
            }
            if (repoKey === 'lab') {
                repoKey = 'cloud';
            }
            switch (repoKey) {
                case 'official': {
                    return {
                        key: repoKey,
                        version: version,
                        downloadURL: 'https://github.com/docker/buildx/releases/download/v%s/%s',
                        contentOpts: {
                            owner: 'docker',
                            repo: 'actions-toolkit',
                            ref: 'main',
                            path: '.github/buildx-releases.json'
                        }
                    };
                }
                case 'cloud': {
                    return {
                        key: repoKey,
                        version: version,
                        downloadURL: 'https://github.com/docker/buildx-desktop/releases/download/v%s/%s',
                        contentOpts: {
                            owner: 'docker',
                            repo: 'actions-toolkit',
                            ref: 'main',
                            path: '.github/buildx-lab-releases.json'
                        }
                    };
                }
                default: {
                    throw new Error(`Cannot find buildx version for ${v}`);
                }
            }
        });
    }
    static getRelease(version, githubToken) {
        return __awaiter(this, void 0, void 0, function* () {
            const github = new github_1.GitHub({ token: githubToken });
            const releases = yield github.releases('Buildx', version.contentOpts);
            if (!releases[version.version]) {
                throw new Error(`Cannot find Buildx release ${version.version} in releases JSON`);
            }
            return releases[version.version];
        });
    }
}
exports.Install = Install;
//# sourceMappingURL=install.js.map