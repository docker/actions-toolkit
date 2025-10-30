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
Object.defineProperty(exports, "__esModule", { value: true });
exports.Regctl = void 0;
const core = __importStar(require("@actions/core"));
const semver = __importStar(require("semver"));
const exec_1 = require("../exec");
class Regctl {
    constructor(opts) {
        this.binPath = (opts === null || opts === void 0 ? void 0 : opts.binPath) || 'regctl';
        this._version = '';
        this._versionOnce = false;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    blobGet(opts) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield exec_1.Exec.getExecOutput(this.binPath, ['blob', 'get', opts.repository, opts.digest], {
                ignoreReturnCode: true,
                silent: true
            }).then(res => {
                if (res.stderr.length > 0 && res.exitCode != 0) {
                    throw new Error(res.stderr.trim());
                }
                return res.stdout;
            });
        });
    }
    manifestGet(opts) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            return yield exec_1.Exec.getExecOutput(this.binPath, ['manifest', 'get', opts.image, `--platform=${(_a = opts.platform) !== null && _a !== void 0 ? _a : 'local'}`, `--format={{json .}}`], {
                ignoreReturnCode: true,
                silent: true
            }).then(res => {
                if (res.stderr.length > 0 && res.exitCode != 0) {
                    throw new Error(res.stderr.trim());
                }
                return JSON.parse(res.stdout.trim());
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
                    core.debug(`Regctl.isAvailable cmd err: ${res.stderr.trim()}`);
                    return false;
                }
                return res.exitCode == 0;
            })
                .catch(error => {
                core.debug(`Regctl.isAvailable error: ${error}`);
                return false;
            });
            core.debug(`Regctl.isAvailable: ${ok}`);
            return ok;
        });
    }
    version() {
        return __awaiter(this, void 0, void 0, function* () {
            if (this._versionOnce) {
                return this._version;
            }
            this._versionOnce = true;
            this._version = yield exec_1.Exec.getExecOutput(this.binPath, ['version', '--format', '{{.VCSTag}}'], {
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
            yield exec_1.Exec.exec(this.binPath, ['version'], {
                failOnStdErr: false
            });
        });
    }
    versionSatisfies(range, version) {
        return __awaiter(this, void 0, void 0, function* () {
            const ver = version !== null && version !== void 0 ? version : (yield this.version());
            if (!ver) {
                core.debug(`Regctl.versionSatisfies false: undefined version`);
                return false;
            }
            const res = semver.satisfies(ver, range) || /^[0-9a-f]{7}$/.exec(ver) !== null;
            core.debug(`Regctl.versionSatisfies ${ver} statisfies ${range}: ${res}`);
            return res;
        });
    }
}
exports.Regctl = Regctl;
//# sourceMappingURL=regctl.js.map