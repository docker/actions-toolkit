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
exports.Undock = void 0;
const core = __importStar(require("@actions/core"));
const semver = __importStar(require("semver"));
const exec_1 = require("../exec");
class Undock {
    constructor(opts) {
        this.binPath = (opts === null || opts === void 0 ? void 0 : opts.binPath) || 'undock';
        this._version = '';
        this._versionOnce = false;
    }
    run(opts) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!opts.source) {
                throw new Error('source is required');
            }
            if (!opts.dist) {
                throw new Error('dist is required');
            }
            const args = [];
            if (opts.logLevel) {
                args.push(`--log-level=${opts.logLevel}`);
            }
            if (opts.logCaller) {
                args.push('--log-caller');
            }
            if (opts.cacheDir) {
                args.push(`--cachedir=${opts.cacheDir}`);
            }
            if (opts.platform) {
                args.push(`--platform=${opts.platform}`);
            }
            if (opts.all) {
                args.push('--all');
            }
            if (opts.include) {
                opts.include.forEach(i => {
                    args.push(`--include=${i}`);
                });
            }
            if (opts.insecure) {
                args.push('--insecure');
            }
            if (opts.rmDist) {
                args.push('--rm-dist');
            }
            if (opts.wrap) {
                args.push('--wrap');
            }
            args.push(opts.source, opts.dist);
            yield exec_1.Exec.exec(this.binPath, args, {
                failOnStdErr: false
            });
        });
    }
    isAvailable() {
        return __awaiter(this, void 0, void 0, function* () {
            const ok = yield exec_1.Exec.getExecOutput(this.binPath, [], {
                ignoreReturnCode: true,
                silent: true
            })
                .then(res => {
                if (res.stderr.length > 0 && res.exitCode != 0) {
                    core.debug(`Undock.isAvailable cmd err: ${res.stderr.trim()}`);
                    return false;
                }
                return res.exitCode == 0;
            })
                .catch(error => {
                core.debug(`Undock.isAvailable error: ${error}`);
                return false;
            });
            core.debug(`Undock.isAvailable: ${ok}`);
            return ok;
        });
    }
    version() {
        return __awaiter(this, void 0, void 0, function* () {
            if (this._versionOnce) {
                return this._version;
            }
            this._versionOnce = true;
            this._version = yield exec_1.Exec.getExecOutput(this.binPath, ['--version'], {
                ignoreReturnCode: true,
                silent: true
            }).then(res => {
                if (res.stderr.length > 0 && res.exitCode != 0) {
                    throw new Error(res.stderr.trim());
                }
                return res.stdout.trim();
            });
            return this._version;
        });
    }
    printVersion() {
        return __awaiter(this, void 0, void 0, function* () {
            yield exec_1.Exec.exec(this.binPath, ['--version'], {
                failOnStdErr: false
            });
        });
    }
    versionSatisfies(range, version) {
        return __awaiter(this, void 0, void 0, function* () {
            const ver = version !== null && version !== void 0 ? version : (yield this.version());
            if (!ver) {
                core.debug(`Undock.versionSatisfies false: undefined version`);
                return false;
            }
            const res = semver.satisfies(ver, range) || /^[0-9a-f]{7}$/.exec(ver) !== null;
            core.debug(`Undock.versionSatisfies ${ver} statisfies ${range}: ${res}`);
            return res;
        });
    }
}
exports.Undock = Undock;
//# sourceMappingURL=undock.js.map