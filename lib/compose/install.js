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
const cache_1 = require("../cache");
const context_1 = require("../context");
const docker_1 = require("../docker/docker");
const github_1 = require("../github");
class Install {
    constructor(opts) {
        this.standalone = opts === null || opts === void 0 ? void 0 : opts.standalone;
        this.githubToken = (opts === null || opts === void 0 ? void 0 : opts.githubToken) || process.env.GITHUB_TOKEN;
    }
    /*
     * Download compose binary from GitHub release
     * @param v: version semver version or latest
     * @param ghaNoCache: disable binary caching in GitHub Actions cache backend
     * @returns path to the compose binary
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
                throw new Error(`Invalid Compose version "${vspec}".`);
            }
            const installCache = new cache_1.Cache({
                htcName: version.key != 'official' ? `compose-dl-bin-${version.key}` : 'compose-dl-bin',
                htcVersion: vspec,
                baseCacheDir: path_1.default.join(os_1.default.homedir(), '.bin', 'docker-compose'),
                cacheFile: os_1.default.platform() == 'win32' ? 'docker-compose.exe' : 'docker-compose',
                ghaNoCache: ghaNoCache
            });
            const cacheFoundPath = yield installCache.find();
            if (cacheFoundPath) {
                core.info(`Compose binary found in ${cacheFoundPath}`);
                return cacheFoundPath;
            }
            const downloadURL = util.format(version.downloadURL, vspec, this.filename());
            core.info(`Downloading ${downloadURL}`);
            const htcDownloadPath = yield tc.downloadTool(downloadURL, undefined, this.githubToken);
            core.debug(`Install.download htcDownloadPath: ${htcDownloadPath}`);
            const cacheSavePath = yield installCache.save(htcDownloadPath);
            core.info(`Cached to ${cacheSavePath}`);
            return cacheSavePath;
        });
    }
    installStandalone(binPath, dest) {
        return __awaiter(this, void 0, void 0, function* () {
            core.info('Standalone mode');
            dest = dest || context_1.Context.tmpDir();
            const binDir = path_1.default.join(dest, 'compose-bin-standalone');
            if (!fs_1.default.existsSync(binDir)) {
                fs_1.default.mkdirSync(binDir, { recursive: true });
            }
            const binName = os_1.default.platform() == 'win32' ? 'compose.exe' : 'compose';
            const composePath = path_1.default.join(binDir, binName);
            fs_1.default.copyFileSync(binPath, composePath);
            core.info('Fixing perms');
            fs_1.default.chmodSync(composePath, '0755');
            core.addPath(binDir);
            core.info('Added Compose to PATH');
            core.info(`Binary path: ${composePath}`);
            return composePath;
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
            const binName = os_1.default.platform() == 'win32' ? 'docker-compose.exe' : 'docker-compose';
            const pluginPath = path_1.default.join(pluginsDir, binName);
            fs_1.default.copyFileSync(binPath, pluginPath);
            core.info('Fixing perms');
            fs_1.default.chmodSync(pluginPath, '0755');
            core.info(`Plugin path: ${pluginPath}`);
            return pluginPath;
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
    filename() {
        let arch;
        switch (os_1.default.arch()) {
            case 'x64': {
                arch = 'x86_64';
                break;
            }
            case 'ppc64': {
                arch = 'ppc64le';
                break;
            }
            case 'arm': {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const arm_version = process.config.variables.arm_version;
                arch = arm_version ? 'armv' + arm_version : 'arm';
                break;
            }
            case 'arm64': {
                arch = 'aarch64';
                break;
            }
            default: {
                arch = os_1.default.arch();
                break;
            }
        }
        const platform = os_1.default.platform() == 'win32' ? 'windows' : os_1.default.platform();
        const ext = os_1.default.platform() == 'win32' ? '.exe' : '';
        return util.format('docker-compose-%s-%s%s', platform, arch, ext);
    }
    vspec(version) {
        return __awaiter(this, void 0, void 0, function* () {
            const v = version.replace(/^v+|v+$/g, '');
            core.info(`Use ${v} version spec cache key for ${version}`);
            return v;
        });
    }
    static getDownloadVersion(v) {
        return __awaiter(this, void 0, void 0, function* () {
            let [repoKey, version] = v.split(':');
            if (!version) {
                version = repoKey;
                repoKey = 'official';
            }
            switch (repoKey) {
                case 'official': {
                    return {
                        key: repoKey,
                        version: version,
                        downloadURL: 'https://github.com/docker/compose/releases/download/v%s/%s',
                        contentOpts: {
                            owner: 'docker',
                            repo: 'actions-toolkit',
                            ref: 'main',
                            path: '.github/compose-releases.json'
                        }
                    };
                }
                case 'cloud': {
                    return {
                        key: repoKey,
                        version: version,
                        downloadURL: 'https://github.com/docker/compose-desktop/releases/download/v%s/%s',
                        contentOpts: {
                            owner: 'docker',
                            repo: 'actions-toolkit',
                            ref: 'main',
                            path: '.github/compose-lab-releases.json'
                        }
                    };
                }
                default: {
                    throw new Error(`Cannot find compose version for ${v}`);
                }
            }
        });
    }
    static getRelease(version, githubToken) {
        return __awaiter(this, void 0, void 0, function* () {
            const github = new github_1.GitHub({ token: githubToken });
            const releases = yield github.releases('Compose', version.contentOpts);
            if (!releases[version.version]) {
                throw new Error(`Cannot find Compose release ${version.version} in releases JSON`);
            }
            return releases[version.version];
        });
    }
}
exports.Install = Install;
//# sourceMappingURL=install.js.map