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
exports.ImageTools = void 0;
const buildx_1 = require("./buildx");
const exec_1 = require("../exec");
class ImageTools {
    constructor(opts) {
        this.buildx = (opts === null || opts === void 0 ? void 0 : opts.buildx) || new buildx_1.Buildx();
    }
    getCommand(args) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.buildx.getCommand(['imagetools', ...args]);
        });
    }
    getInspectCommand(args) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.getCommand(['inspect', ...args]);
        });
    }
    inspectImage(name) {
        return __awaiter(this, void 0, void 0, function* () {
            const cmd = yield this.getInspectCommand([name, '--format', '{{json .Image}}']);
            return yield exec_1.Exec.getExecOutput(cmd.command, cmd.args, {
                ignoreReturnCode: true,
                silent: true
            }).then(res => {
                if (res.stderr.length > 0 && res.exitCode != 0) {
                    throw new Error(res.stderr.trim());
                }
                const parsedOutput = JSON.parse(res.stdout);
                if (typeof parsedOutput === 'object' && !Array.isArray(parsedOutput) && parsedOutput !== null) {
                    if (Object.prototype.hasOwnProperty.call(parsedOutput, 'config')) {
                        return parsedOutput;
                    }
                    else {
                        return parsedOutput;
                    }
                }
                throw new Error('Unexpected output format');
            });
        });
    }
}
exports.ImageTools = ImageTools;
//# sourceMappingURL=imagetools.js.map