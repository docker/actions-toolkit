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
exports.Cache = void 0;
const fs_1 = __importDefault(require("fs"));
const os_1 = __importDefault(require("os"));
const path_1 = __importDefault(require("path"));
const core = __importStar(require("@actions/core"));
const tc = __importStar(require("@actions/tool-cache"));
const cache = __importStar(require("@actions/cache"));
const util = __importStar(require("util"));
class Cache {
    constructor(opts) {
        this.opts = opts;
        this.ghaCacheKey = util.format('%s-%s-%s', this.opts.htcName, this.opts.htcVersion, this.platform());
        this.ghaNoCache = this.opts.ghaNoCache;
        this.cacheDir = path_1.default.join(this.opts.baseCacheDir, this.opts.htcVersion, this.platform());
        this.cachePath = path_1.default.join(this.cacheDir, this.opts.cacheFile);
        if (!fs_1.default.existsSync(this.cacheDir)) {
            fs_1.default.mkdirSync(this.cacheDir, { recursive: true });
        }
    }
    save(file, skipState) {
        return __awaiter(this, void 0, void 0, function* () {
            core.debug(`Cache.save ${file}`);
            const cachePath = this.copyToCache(file);
            const htcPath = yield tc.cacheDir(this.cacheDir, this.opts.htcName, this.opts.htcVersion, this.platform());
            core.debug(`Cache.save cached to hosted tool cache ${htcPath}`);
            if (!this.ghaNoCache && cache.isFeatureAvailable()) {
                if (skipState) {
                    core.debug(`Cache.save caching ${this.ghaCacheKey} to GitHub Actions cache`);
                    yield cache.saveCache([this.cacheDir], this.ghaCacheKey);
                }
                else {
                    core.debug(`Cache.save sending ${this.ghaCacheKey} to post state`);
                    core.saveState(Cache.POST_CACHE_KEY, JSON.stringify({
                        dir: this.cacheDir,
                        key: this.ghaCacheKey
                    }));
                }
            }
            return cachePath;
        });
    }
    find() {
        return __awaiter(this, void 0, void 0, function* () {
            let htcPath = tc.find(this.opts.htcName, this.opts.htcVersion, this.platform());
            if (htcPath) {
                core.info(`Restored from hosted tool cache ${htcPath}`);
                return this.copyToCache(`${htcPath}/${this.opts.cacheFile}`);
            }
            if (!this.ghaNoCache && cache.isFeatureAvailable()) {
                core.debug(`GitHub Actions cache feature available`);
                if (yield cache.restoreCache([this.cacheDir], this.ghaCacheKey)) {
                    core.info(`Restored ${this.ghaCacheKey} from GitHub Actions cache`);
                    htcPath = yield tc.cacheDir(this.cacheDir, this.opts.htcName, this.opts.htcVersion, this.platform());
                    core.info(`Cached to hosted tool cache ${htcPath}`);
                    return this.copyToCache(`${htcPath}/${this.opts.cacheFile}`);
                }
            }
            else if (this.ghaNoCache) {
                core.info(`GitHub Actions cache disabled`);
            }
            else {
                core.info(`GitHub Actions cache feature not available`);
            }
            return '';
        });
    }
    static post() {
        return __awaiter(this, void 0, void 0, function* () {
            const state = core.getState(Cache.POST_CACHE_KEY);
            if (!state) {
                core.info(`State not set`);
                return Promise.resolve(undefined);
            }
            let cacheState;
            try {
                cacheState = JSON.parse(state);
            }
            catch (e) {
                throw new Error(`Failed to parse cache post state: ${e}`);
            }
            if (!cacheState.dir || !cacheState.key) {
                throw new Error(`Invalid cache post state: ${state}`);
            }
            core.info(`Caching ${cacheState.key} to GitHub Actions cache`);
            yield cache.saveCache([cacheState.dir], cacheState.key);
            return cacheState;
        });
    }
    copyToCache(file) {
        core.debug(`Copying ${file} to ${this.cachePath}`);
        fs_1.default.copyFileSync(file, this.cachePath);
        return this.cachePath;
    }
    platform() {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const arm_version = process.config.variables.arm_version;
        return `${os_1.default.platform()}-${os_1.default.arch()}${arm_version ? 'v' + arm_version : ''}`;
    }
}
exports.Cache = Cache;
Cache.POST_CACHE_KEY = 'postCache';
//# sourceMappingURL=cache.js.map