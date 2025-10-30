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
exports.Compose = void 0;
const core = __importStar(require("@actions/core"));
const docker_1 = require("../docker/docker");
const exec_1 = require("../exec");
class Compose {
    constructor(opts) {
        this._standalone = opts === null || opts === void 0 ? void 0 : opts.standalone;
        this._version = '';
        this._versionOnce = false;
    }
    isStandalone() {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            const standalone = (_a = this._standalone) !== null && _a !== void 0 ? _a : !(yield docker_1.Docker.isAvailable());
            core.debug(`Compose.isStandalone: ${standalone}`);
            return standalone;
        });
    }
    getCommand(args) {
        return __awaiter(this, void 0, void 0, function* () {
            const standalone = yield this.isStandalone();
            return {
                command: standalone ? 'compose' : 'docker',
                args: standalone ? args : ['compose', ...args]
            };
        });
    }
    isAvailable() {
        return __awaiter(this, void 0, void 0, function* () {
            const cmd = yield this.getCommand([]);
            const ok = yield exec_1.Exec.getExecOutput(cmd.command, cmd.args, {
                ignoreReturnCode: true,
                silent: true
            })
                .then(res => {
                if (res.stderr.length > 0 && res.exitCode != 0) {
                    core.debug(`Compose.isAvailable cmd err: ${res.stderr.trim()}`);
                    return false;
                }
                return res.exitCode == 0;
            })
                .catch(error => {
                core.debug(`Compose.isAvailable error: ${error}`);
                return false;
            });
            core.debug(`Compose.isAvailable: ${ok}`);
            return ok;
        });
    }
    version() {
        return __awaiter(this, void 0, void 0, function* () {
            if (this._versionOnce) {
                return this._version;
            }
            this._versionOnce = true;
            const cmd = yield this.getCommand(['version']);
            this._version = yield exec_1.Exec.getExecOutput(cmd.command, cmd.args, {
                ignoreReturnCode: true,
                silent: true
            }).then(res => {
                if (res.stderr.length > 0 && res.exitCode != 0) {
                    throw new Error(res.stderr.trim());
                }
                return Compose.parseVersion(res.stdout.trim());
            });
            return this._version;
        });
    }
    printVersion() {
        return __awaiter(this, void 0, void 0, function* () {
            const cmd = yield this.getCommand(['version']);
            yield exec_1.Exec.exec(cmd.command, cmd.args, {
                failOnStdErr: false
            });
        });
    }
    static parseVersion(stdout) {
        const matches = /\sv?([0-9a-f]{7}|[0-9.]+)/.exec(stdout);
        if (!matches) {
            throw new Error(`Cannot parse compose version`);
        }
        return matches[1];
    }
}
exports.Compose = Compose;
//# sourceMappingURL=compose.js.map