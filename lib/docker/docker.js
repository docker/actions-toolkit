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
exports.Docker = void 0;
const fs_1 = __importDefault(require("fs"));
const os_1 = __importDefault(require("os"));
const path_1 = __importDefault(require("path"));
const core = __importStar(require("@actions/core"));
const io = __importStar(require("@actions/io"));
const context_1 = require("../context");
const cache_1 = require("../cache");
const exec_1 = require("../exec");
const util_1 = require("../util");
class Docker {
    static get configDir() {
        return process.env.DOCKER_CONFIG || path_1.default.join(os_1.default.homedir(), '.docker');
    }
    static configFile() {
        const f = path_1.default.join(Docker.configDir, 'config.json');
        if (!fs_1.default.existsSync(f)) {
            return undefined;
        }
        return JSON.parse(fs_1.default.readFileSync(f, { encoding: 'utf-8' }));
    }
    static isAvailable() {
        return __awaiter(this, void 0, void 0, function* () {
            return yield io
                .which('docker', true)
                .then(res => {
                core.debug(`Docker.isAvailable ok: ${res}`);
                return true;
            })
                .catch(error => {
                core.debug(`Docker.isAvailable error: ${error}`);
                return false;
            });
        });
    }
    static isDaemonRunning() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                yield Docker.getExecOutput([`version`], {
                    silent: true
                });
                return true;
            }
            catch (e) {
                return false;
            }
        });
    }
    static exec(args, options) {
        return __awaiter(this, void 0, void 0, function* () {
            return exec_1.Exec.exec('docker', args, Docker.execOptions(options));
        });
    }
    static getExecOutput(args, options) {
        return __awaiter(this, void 0, void 0, function* () {
            return exec_1.Exec.getExecOutput('docker', args, Docker.execOptions(options));
        });
    }
    static execOptions(options) {
        if (!options) {
            options = {};
        }
        if (!options.env) {
            options.env = Object.assign({}, process.env, {
                DOCKER_CONTENT_TRUST: 'false'
            });
        }
        else {
            options.env.DOCKER_CONTENT_TRUST = 'false';
        }
        return options;
    }
    static context(name) {
        return __awaiter(this, void 0, void 0, function* () {
            const args = ['context', 'inspect', '--format', '{{.Name}}'];
            if (name) {
                args.push(name);
            }
            return yield Docker.getExecOutput(args, {
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
    static contextInspect(name) {
        return __awaiter(this, void 0, void 0, function* () {
            const args = ['context', 'inspect', '--format=json'];
            if (name) {
                args.push(name);
            }
            return yield Docker.getExecOutput(args, {
                ignoreReturnCode: true,
                silent: true
            }).then(res => {
                if (res.stderr.length > 0 && res.exitCode != 0) {
                    throw new Error(res.stderr.trim());
                }
                return JSON.parse(res.stdout.trim())[0];
            });
        });
    }
    static printVersion() {
        return __awaiter(this, void 0, void 0, function* () {
            yield Docker.exec(['version']);
        });
    }
    static printInfo() {
        return __awaiter(this, void 0, void 0, function* () {
            yield Docker.exec(['info']);
        });
    }
    static parseRepoTag(image) {
        let sepPos;
        const digestPos = image.indexOf('@');
        const colonPos = image.lastIndexOf(':');
        if (digestPos >= 0) {
            // priority on digest
            sepPos = digestPos;
        }
        else if (colonPos >= 0) {
            sepPos = colonPos;
        }
        else {
            return {
                repository: image,
                tag: 'latest'
            };
        }
        const tag = image.slice(sepPos + 1);
        if (tag.indexOf('/') === -1) {
            return {
                repository: image.slice(0, sepPos),
                tag: tag
            };
        }
        return {
            repository: image,
            tag: 'latest'
        };
    }
    static pull(image, cache) {
        return __awaiter(this, void 0, void 0, function* () {
            const parsedImage = Docker.parseRepoTag(image);
            const repoSanitized = parsedImage.repository.replace(/[^a-zA-Z0-9.]+/g, '--');
            const tagSanitized = parsedImage.tag.replace(/[^a-zA-Z0-9.]+/g, '--');
            const imageCache = new cache_1.Cache({
                htcName: repoSanitized,
                htcVersion: tagSanitized,
                baseCacheDir: path_1.default.join(Docker.configDir, '.cache', 'images', repoSanitized),
                cacheFile: 'image.tar'
            });
            let cacheFoundPath;
            if (cache) {
                cacheFoundPath = yield imageCache.find();
                if (cacheFoundPath) {
                    core.info(`Image found from cache in ${cacheFoundPath}`);
                    yield Docker.getExecOutput(['load', '-i', cacheFoundPath], {
                        ignoreReturnCode: true
                    }).then(res => {
                        var _a, _b, _c;
                        if (res.stderr.length > 0 && res.exitCode != 0) {
                            core.warning(`Failed to load image from cache: ${(_c = (_b = (_a = res.stderr.match(/(.*)\s*$/)) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b.trim()) !== null && _c !== void 0 ? _c : 'unknown error'}`);
                        }
                    });
                }
            }
            let pulled = true;
            yield Docker.getExecOutput(['pull', image], {
                ignoreReturnCode: true
            }).then(res => {
                var _a, _b, _c;
                if (res.stderr.length > 0 && res.exitCode != 0) {
                    pulled = false;
                    const err = (_c = (_b = (_a = res.stderr.match(/(.*)\s*$/)) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b.trim()) !== null && _c !== void 0 ? _c : 'unknown error';
                    if (cacheFoundPath) {
                        core.warning(`Failed to pull image, using one from cache: ${err}`);
                    }
                    else {
                        throw new Error(err);
                    }
                }
            });
            if (cache && pulled) {
                const imageTarPath = path_1.default.join(context_1.Context.tmpDir(), `${util_1.Util.hash(image)}.tar`);
                yield Docker.getExecOutput(['save', '-o', imageTarPath, image], {
                    ignoreReturnCode: true
                }).then((res) => __awaiter(this, void 0, void 0, function* () {
                    var _a, _b, _c;
                    if (res.stderr.length > 0 && res.exitCode != 0) {
                        core.warning(`Failed to save image: ${(_c = (_b = (_a = res.stderr.match(/(.*)\s*$/)) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b.trim()) !== null && _c !== void 0 ? _c : 'unknown error'}`);
                    }
                    else {
                        const cachePath = yield imageCache.save(imageTarPath);
                        core.info(`Image cached to ${cachePath}`);
                    }
                }));
            }
        });
    }
}
exports.Docker = Docker;
//# sourceMappingURL=docker.js.map